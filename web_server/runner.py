import asyncio
import json
import os
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

try:
    from web_server.runtime_utils import (
        DEFAULT_RUN_TIMEOUT_SECONDS,
        RUN_STATUS_COMPLETED,
        RUN_STATUS_FAILED,
        RUN_STATUS_PENDING,
        RUN_STATUS_RUNNING,
        RUN_STATUS_STOPPED,
        RUN_STATUS_TIMEOUT,
    )
except Exception:
    from runtime_utils import (
        DEFAULT_RUN_TIMEOUT_SECONDS,
        RUN_STATUS_COMPLETED,
        RUN_STATUS_FAILED,
        RUN_STATUS_PENDING,
        RUN_STATUS_RUNNING,
        RUN_STATUS_STOPPED,
        RUN_STATUS_TIMEOUT,
    )


worker_semaphore = asyncio.Semaphore(3)
active_runs_lock = asyncio.Lock()
active_sessions: Dict[str, Any] = {}
active_runs: Dict[str, Dict[str, Any]] = {}
active_processes: Dict[str, asyncio.subprocess.Process] = {}
active_tasks: Dict[str, "asyncio.Task"] = {}


@dataclass
class RunnerDeps:
    project_root: str
    scripts_dir: str
    envs_file: str
    internal_token: str
    session_factory: Callable[[], Any]
    case_model: Any
    build_python_script: Callable[[Dict[str, Any]], str]
    validate_case_placeholders: Callable[[Dict[str, Any]], None]
    safe_script_path: Callable[[str], str]
    run_dir: Callable[[str], str]
    run_meta_path: Callable[[str], str]
    load_env: Callable[[], None]
    infer_failure_reason: Callable[[list], Dict[str, Any]]


def safe_run_id(run_id: str) -> str:
    return (run_id or "").strip().replace("/", "_").replace("\\", "_").replace("..", "_")


async def terminate_process(process: asyncio.subprocess.Process, timeout: int = 5) -> None:
    if process.returncode is not None:
        return
    process.terminate()
    try:
        await asyncio.wait_for(process.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()


async def stop_active_run(run_id: str, run_meta_path: Callable[[str], str]) -> Tuple[int, Dict[str, Any]]:
    safe_id = safe_run_id(run_id)
    process = active_processes.get(safe_id)
    run_meta = active_runs.get(safe_id)
    if process is None:
        # 排队中（pending）：通过取消任务来释放队列位
        if run_meta and run_meta.get("status") == RUN_STATUS_PENDING:
            task = active_tasks.get(safe_id)
            if task is not None and not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
            # 兜底：worker finally 应已清理；若 meta 仍为 pending，标记 stopped
            if run_meta.get("status") == RUN_STATUS_PENDING:
                run_meta["status"] = RUN_STATUS_STOPPED
                run_meta["ended_at"] = int(time.time())
                run_meta["failure_reason"] = {"category": "cancelled", "message": "排队中被取消"}
                try:
                    with open(run_meta_path(safe_id), "w", encoding="utf-8") as f:
                        json.dump(run_meta, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
            active_runs.pop(safe_id, None)
            active_tasks.pop(safe_id, None)
            return 200, {"status": "success", "message": "Queued run cancelled"}
        if run_meta and run_meta.get("status") == RUN_STATUS_RUNNING:
            run_meta["status"] = RUN_STATUS_FAILED
            run_meta["ended_at"] = int(time.time())
            run_meta["failure_reason"] = {"category": "cancelled", "message": "运行进程未找到，已标记为停止"}
            try:
                with open(run_meta_path(safe_id), "w", encoding="utf-8") as f:
                    json.dump(run_meta, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
        return 404, {"error": "Run process not found"}

    if process.returncode is not None:
        return 200, {"status": "success", "message": "Run already finished"}

    await terminate_process(process)

    if run_meta is not None:
        run_meta["status"] = RUN_STATUS_STOPPED
        run_meta["ended_at"] = int(time.time())
        if run_meta.get("started_at"):
            run_meta["duration_ms"] = (run_meta["ended_at"] - run_meta["started_at"]) * 1000
        run_meta["failure_reason"] = {"category": "cancelled", "message": "用户手动停止运行"}
        run_meta.setdefault("logs", []).append("🛑 用户手动停止运行")
        try:
            with open(run_meta_path(safe_id), "w", encoding="utf-8") as f:
                json.dump(run_meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    ws = active_sessions.get(safe_id)
    if ws:
        try:
            await ws.send_json({"type": "log", "message": "🛑 用户手动停止运行"})
            await ws.send_json({"type": "status", "status": RUN_STATUS_STOPPED})
        except Exception:
            pass

    return 200, {"status": "success", "message": "Run stopped"}


def _load_case(deps: RunnerDeps, name: str) -> Optional[Dict[str, Any]]:
    db = deps.session_factory()
    try:
        case_model = db.query(deps.case_model).filter_by(id=name).first()
        if not case_model:
            return None
        return {
            "id": case_model.id,
            "name": case_model.name,
            "start_url": case_model.start_url,
            "steps": json.loads(case_model.steps) if case_model.steps else [],
            "variables": json.loads(case_model.variables) if getattr(case_model, "variables", None) else {},
            "dataset": json.loads(case_model.dataset) if getattr(case_model, "dataset", None) else [],
            "type": case_model.type,
        }
    finally:
        db.close()


def _apply_env_override(case: Dict[str, Any], base_url_override: Optional[str]) -> None:
    if not base_url_override or not case.get("start_url"):
        return
    su = case["start_url"]
    if su.startswith("/"):
        case["start_url"] = base_url_override.rstrip("/") + su
        return
    from urllib.parse import urlparse
    parsed_base = urlparse(base_url_override)
    parsed_su = urlparse(su)
    if parsed_base.scheme and parsed_base.netloc:
        case["start_url"] = parsed_su._replace(scheme=parsed_base.scheme, netloc=parsed_base.netloc).geturl()


def _find_env_base_url(envs_file: str, env_id: Optional[str]) -> Optional[str]:
    if not env_id or not os.path.exists(envs_file):
        return None
    with open(envs_file, "r", encoding="utf-8") as f:
        envs = json.load(f)
    for e in envs:
        if e.get("id") == env_id:
            return e.get("base_url")
    return None


async def start_run(
    deps: RunnerDeps,
    name: str,
    env_id: Optional[str],
    wait_for_ws: bool,
    extra_env: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    case = _load_case(deps, name)
    file_path: Optional[str] = None
    if not case:
        file_path = deps.safe_script_path(name)
    resolved_script_path: Optional[str] = None
    temp_file: Optional[tempfile.NamedTemporaryFile] = None
    case_id: Optional[str] = None

    if case:
        case_id = case["id"]
        _apply_env_override(case, _find_env_base_url(deps.envs_file, env_id))
        deps.validate_case_placeholders(case)
        script_content = deps.build_python_script(case)
        os.makedirs(deps.scripts_dir, exist_ok=True)
        temp_file = tempfile.NamedTemporaryFile(
            dir=deps.scripts_dir,
            mode="w",
            suffix=".py",
            prefix="test_case_",
            delete=False,
            encoding="utf-8",
        )
        temp_file.write(script_content)
        temp_file.flush()
        resolved_script_path = temp_file.name
    elif file_path and os.path.exists(file_path):
        resolved_script_path = file_path
    else:
        raise FileNotFoundError("File not found")

    run_id = f"run_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    session_id = run_id

    run_folder = deps.run_dir(run_id)
    os.makedirs(os.path.join(run_folder, "screenshots"), exist_ok=True)
    meta = {
        "schema_version": 2,
        "id": run_id,
        "case_id": case_id or name,
        "status": RUN_STATUS_PENDING,
        "started_at": int(time.time()),
        "ended_at": None,
        "duration_ms": None,
        "failure_reason": None,
        "logs": [],
        "screenshots": [],
        "heal_events": [],
        "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
    active_runs[run_id] = meta
    with open(deps.run_meta_path(run_id), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    task = asyncio.create_task(
        run_pytest_worker(
            deps,
            session_id,
            resolved_script_path,
            temp_file.name if temp_file else None,
            wait_for_ws=wait_for_ws,
            extra_env=extra_env,
        )
    )
    active_tasks[run_id] = task
    return {"run_id": run_id, "session_id": session_id}


async def run_pytest_worker(
    deps: RunnerDeps,
    session_id: str,
    script_path: str,
    cleanup_path: Optional[str] = None,
    wait_for_ws: bool = True,
    extra_env: Optional[Dict[str, str]] = None,
) -> None:
    async def _send(payload: Dict[str, Any]) -> None:
        # 每次发送时实时取 ws，避免缓存过期连接
        current_ws = active_sessions.get(session_id)
        if current_ws is None:
            return
        try:
            await current_ws.send_json(payload)
        except Exception:
            pass

    # wait_for_ws 与发送均包裹 try/except，任何 ws 失败不得改变 meta 生命周期
    try:
        if wait_for_ws:
            for _ in range(50):
                if session_id in active_sessions:
                    break
                await asyncio.sleep(0.1)
        await _send({"type": "log", "message": "⏳ 等待队列资源中..."})
    except Exception:
        pass

    async with worker_semaphore:
        # 获得队列资源后才置 running；排队期间可被 cancel 取消
        run_meta = active_runs.get(session_id)
        if run_meta is not None and run_meta.get("status") == RUN_STATUS_PENDING:
            run_meta["status"] = RUN_STATUS_RUNNING
            try:
                with open(deps.run_meta_path(session_id), "w", encoding="utf-8") as f:
                    json.dump(run_meta, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
        run_meta = active_runs.get(session_id)

        deps.load_env()
        env = os.environ.copy()
        env["PLAYWRIGHT_HEADLESS"] = "1"
        env["AI_TESTER_WS_SESSION"] = session_id
        env["AI_TESTER_WS_PORT"] = "8000"
        env["AI_TESTER_INTERNAL_TOKEN"] = deps.internal_token
        env["AI_TESTER_RUN_HISTORY_DIR"] = deps.run_dir(session_id)
        env["PYTHONPATH"] = os.pathsep.join(
            [os.path.join(deps.project_root, "src"), env.get("PYTHONPATH", "")]
        ).strip(os.pathsep)
        if os.environ.get("OPENAI_API_KEY") and not env.get("OPENAI_API_KEY"):
            env["OPENAI_API_KEY"] = os.environ["OPENAI_API_KEY"]
        if extra_env:
            for k, v in extra_env.items():
                if v is None:
                    continue
                env[str(k)] = str(v)

        try:
            await _send({"type": "log", "message": f"🚀 开始执行用例: {os.path.basename(script_path)}"})
            if not env.get("OPENAI_API_KEY"):
                await _send({"type": "log", "message": "⚠️ 未检测到 OPENAI_API_KEY，本次运行将禁用 AI 自愈，仅按录制的 selector 执行。"})

            venv_python = os.path.join(deps.project_root, "venv", "bin", "python3")
            python_exec = venv_python if os.path.exists(venv_python) else sys.executable
            venv_bin = os.path.dirname(venv_python)
            if os.path.exists(venv_bin):
                env["PATH"] = os.pathsep.join([venv_bin, env.get("PATH", "")]).strip(os.pathsep)
            process = await asyncio.create_subprocess_exec(
                python_exec,
                "-m",
                "pytest",
                "-q",
                "-s",
                "--tb=short",
                "--disable-warnings",
                "-p",
                "ai_tester.pytest_fixtures",
                script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=env,
                cwd=deps.project_root,
            )
            active_processes[session_id] = process
            timeout_at = time.monotonic() + DEFAULT_RUN_TIMEOUT_SECONDS
            timed_out = False

            while True:
                remaining = timeout_at - time.monotonic()
                if remaining <= 0:
                    timed_out = True
                    break
                try:
                    line = await asyncio.wait_for(process.stdout.readline(), timeout=min(1.0, remaining))
                except asyncio.TimeoutError:
                    if process.returncode is not None:
                        break
                    continue
                if not line:
                    break

                decoded_line = line.decode("utf-8").rstrip()
                if not decoded_line:
                    continue
                if decoded_line.startswith("=========================") or decoded_line.startswith("-------------------------"):
                    continue
                if decoded_line.startswith("collected ") or "passed in " in decoded_line or "warnings summary" in decoded_line or "test_case_" in decoded_line:
                    continue
                if "short test summary info" in decoded_line or "FAILED tests/" in decoded_line or "PASSED tests/" in decoded_line:
                    continue

                await _send({"type": "log", "message": decoded_line})
                if run_meta is not None:
                    run_meta["logs"].append(decoded_line)

            if timed_out and process.returncode is None:
                await terminate_process(process)
            else:
                await process.wait()

            if run_meta is not None and run_meta.get("status") == RUN_STATUS_STOPPED:
                return
            final_status = RUN_STATUS_TIMEOUT if timed_out else (RUN_STATUS_COMPLETED if process.returncode == 0 else RUN_STATUS_FAILED)
            try:
                if timed_out:
                    await _send({"type": "log", "message": f"⏱️ 运行超过 {DEFAULT_RUN_TIMEOUT_SECONDS} 秒，已自动停止。"})
                await _send({"type": "status", "status": final_status})
            except Exception:
                pass
            if run_meta is not None:
                run_meta["status"] = final_status
                run_meta["ended_at"] = int(time.time())
                if run_meta.get("started_at"):
                    run_meta["duration_ms"] = (run_meta["ended_at"] - run_meta["started_at"]) * 1000
                if timed_out:
                    run_meta.setdefault("logs", []).append(f"⏱️ 运行超过 {DEFAULT_RUN_TIMEOUT_SECONDS} 秒，已自动停止。")
                    run_meta["failure_reason"] = {"category": "timeout", "message": f"运行超过 {DEFAULT_RUN_TIMEOUT_SECONDS} 秒"}
                elif process.returncode != 0:
                    run_meta["failure_reason"] = deps.infer_failure_reason(run_meta.get("logs") or [])
                try:
                    token_path = os.path.join(deps.run_dir(session_id), "token_usage.json")
                    if os.path.exists(token_path):
                        with open(token_path, "r", encoding="utf-8") as f:
                            token_summary = json.load(f)
                        run_meta["token_usage"] = token_summary.get("totals") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                        run_meta["token_summary"] = token_summary
                except Exception:
                    pass

        except asyncio.CancelledError:
            # 排队中被取消 / 运行中被取消：写终态 stopped，清理后 re-raise
            if run_meta is not None:
                run_meta["status"] = RUN_STATUS_STOPPED
                run_meta["ended_at"] = int(time.time())
                if run_meta.get("started_at"):
                    run_meta["duration_ms"] = (run_meta["ended_at"] - run_meta["started_at"]) * 1000
                run_meta["failure_reason"] = {"category": "cancelled", "message": "排队中被取消"}
                run_meta.setdefault("logs", []).append("🛑 排队中被取消")
            try:
                with open(deps.run_meta_path(session_id), "w", encoding="utf-8") as f:
                    json.dump(run_meta, f, ensure_ascii=False, indent=2) if run_meta is not None else None
            except Exception:
                pass
            active_processes.pop(session_id, None)
            active_runs.pop(session_id, None)
            active_tasks.pop(session_id, None)
            active_sessions.pop(session_id, None)
            if cleanup_path:
                try:
                    os.unlink(cleanup_path)
                except Exception:
                    pass
            raise
        except Exception as e:
            try:
                await _send({"type": "log", "message": f"❌ 执行异常: {str(e)}"})
                await _send({"type": "status", "status": RUN_STATUS_FAILED})
            except Exception:
                pass
            if run_meta is not None:
                run_meta["status"] = RUN_STATUS_FAILED
                run_meta["ended_at"] = int(time.time())
                if run_meta.get("started_at"):
                    run_meta["duration_ms"] = (run_meta["ended_at"] - run_meta["started_at"]) * 1000
                run_meta["logs"].append(f"❌ 执行异常: {str(e)}")
                run_meta["failure_reason"] = {"category": "exception", "message": str(e)}
                try:
                    token_path = os.path.join(deps.run_dir(session_id), "token_usage.json")
                    if os.path.exists(token_path):
                        with open(token_path, "r", encoding="utf-8") as f:
                            token_summary = json.load(f)
                        run_meta["token_usage"] = token_summary.get("totals") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                        run_meta["token_summary"] = token_summary
                except Exception:
                    pass
        finally:
            active_processes.pop(session_id, None)
            if run_meta is not None:
                try:
                    with open(deps.run_meta_path(session_id), "w", encoding="utf-8") as f:
                        json.dump(run_meta, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
                active_runs.pop(session_id, None)
            active_tasks.pop(session_id, None)
            if cleanup_path:
                try:
                    os.unlink(cleanup_path)
                except Exception:
                    pass
