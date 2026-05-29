import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

try:
    from web_server.runtime_utils import (
        RUN_STATUS_COMPLETED,
        RUN_STATUS_FAILED,
        RUN_STATUS_RUNNING,
        RUN_STATUS_TIMEOUT,
        RUN_TERMINAL_STATUSES,
    )
except Exception:
    from runtime_utils import (
        RUN_STATUS_COMPLETED,
        RUN_STATUS_FAILED,
        RUN_STATUS_RUNNING,
        RUN_STATUS_TIMEOUT,
        RUN_TERMINAL_STATUSES,
    )


@dataclass
class SuiteRunnerDeps:
    run_meta_path: Callable[[str], str]
    suite_run_meta_path: Callable[[str], str]
    start_run: Callable[..., Any]


async def wait_run_finished(deps: SuiteRunnerDeps, run_id: str, attempts: int = 7200, interval: float = 0.25) -> Dict[str, Any]:
    meta_path = deps.run_meta_path(run_id)
    for _ in range(attempts):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            if meta.get("status") in RUN_TERMINAL_STATUSES:
                return meta
        except Exception:
            pass
        await asyncio.sleep(interval)
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        pass
    return {"id": run_id, "status": RUN_STATUS_TIMEOUT, "duration_ms": None, "heal_events": [], "failure_reason": {"category": "timeout", "message": "等待用例运行结束超时"}}


async def run_suite_worker(
    deps: SuiteRunnerDeps,
    suite_run_id: str,
    case_ids: List[str],
    env_id: Optional[str],
    storage_state_path: str,
    setup_case_id: Optional[str],
) -> None:
    meta_path = deps.suite_run_meta_path(suite_run_id)
    started_ts = time.time()
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            suite_meta = json.load(f)
    except Exception:
        return

    passed = 0
    failed = 0
    heal_total = 0
    token_prompt_total = 0
    token_completion_total = 0
    token_total = 0
    items: List[Dict[str, Any]] = []

    extra_env = {"AI_TESTER_STORAGE_STATE_PATH": storage_state_path} if storage_state_path else None

    for idx, case_id in enumerate(case_ids):
        suite_meta["current_index"] = idx
        suite_meta["current_case_id"] = case_id
        _write_meta(meta_path, suite_meta)

        try:
            run_info = await deps.start_run(name=case_id, env_id=env_id, wait_for_ws=False, extra_env=extra_env)
            run_id = run_info["run_id"]
            item = {"case_id": case_id, "run_id": run_id, "status": RUN_STATUS_RUNNING, "duration_ms": None, "heal_count": None}
            items.append(item)
            suite_meta["items"] = items
            _write_meta(meta_path, suite_meta)
            run_meta = await wait_run_finished(deps, run_id)
        except Exception:
            run_id = f"run_failed_{uuid.uuid4().hex[:8]}"
            run_meta = {"id": run_id, "status": RUN_STATUS_FAILED, "duration_ms": None, "heal_events": []}
            items.append({"case_id": case_id, "run_id": run_id, "status": RUN_STATUS_FAILED, "duration_ms": None, "heal_count": 0})

        status = run_meta.get("status") or RUN_STATUS_FAILED
        duration_ms = run_meta.get("duration_ms")
        heal_count = len(run_meta.get("heal_events") or [])
        token_usage = run_meta.get("token_usage") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        token_prompt_total += int(token_usage.get("prompt_tokens", 0) or 0)
        token_completion_total += int(token_usage.get("completion_tokens", 0) or 0)
        token_total += int(token_usage.get("total_tokens", 0) or 0)
        heal_total += heal_count
        if status == RUN_STATUS_COMPLETED:
            passed += 1
        else:
            failed += 1

        try:
            last_item = items[-1]
            if last_item.get("case_id") == case_id and last_item.get("run_id") == run_id:
                last_item["status"] = status
                last_item["duration_ms"] = duration_ms
                last_item["heal_count"] = heal_count
                last_item["token_usage"] = token_usage
        except Exception:
            pass

        suite_meta["items"] = items
        suite_meta["summary"] = _summary(case_ids, passed, failed, heal_total, token_prompt_total, token_completion_total, token_total)
        _write_meta(meta_path, suite_meta)

        if setup_case_id and case_id == setup_case_id and status != RUN_STATUS_COMPLETED:
            suite_meta["status"] = RUN_STATUS_FAILED
            suite_meta["ended_at"] = int(time.time())
            suite_meta["duration_ms"] = int((time.time() - started_ts) * 1000)
            suite_meta["current_index"] = None
            suite_meta["current_case_id"] = None
            _write_meta(meta_path, suite_meta)
            return

    suite_meta["status"] = RUN_STATUS_FAILED if failed > 0 else RUN_STATUS_COMPLETED
    suite_meta["ended_at"] = int(time.time())
    suite_meta["duration_ms"] = int((time.time() - started_ts) * 1000)
    suite_meta["current_index"] = None
    suite_meta["current_case_id"] = None
    suite_meta["items"] = items
    suite_meta["summary"] = _summary(case_ids, passed, failed, heal_total, token_prompt_total, token_completion_total, token_total)
    _write_meta(meta_path, suite_meta)


def _summary(case_ids: List[str], passed: int, failed: int, heal_total: int, token_prompt: int, token_completion: int, token_total: int) -> Dict[str, int]:
    return {
        "total": len(case_ids),
        "passed": passed,
        "failed": failed,
        "heal_total": heal_total,
        "token_prompt": token_prompt,
        "token_completion": token_completion,
        "token_total": token_total,
    }


def _write_meta(meta_path: str, meta: Dict[str, Any]) -> None:
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
