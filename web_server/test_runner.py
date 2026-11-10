import asyncio
import json
import time

import pytest

try:
    from web_server import runner
    from web_server.runtime_utils import RUN_STATUS_PENDING, RUN_STATUS_RUNNING, RUN_STATUS_STOPPED
except Exception:
    import runner
    from runtime_utils import RUN_STATUS_PENDING, RUN_STATUS_RUNNING, RUN_STATUS_STOPPED


class FakeProcess:
    def __init__(self):
        self.returncode = None
        self.terminated = False
        self.killed = False

    def terminate(self):
        self.terminated = True
        self.returncode = -15

    def kill(self):
        self.killed = True
        self.returncode = -9

    async def wait(self):
        return self.returncode


@pytest.fixture(autouse=True)
def clear_runner_state():
    runner.active_processes.clear()
    runner.active_runs.clear()
    runner.active_sessions.clear()
    runner.active_tasks.clear()
    yield
    runner.active_processes.clear()
    runner.active_runs.clear()
    runner.active_sessions.clear()
    runner.active_tasks.clear()


def test_stop_active_run_unknown_returns_404(tmp_path):
    def meta_path(run_id):
        return str(tmp_path / run_id / "meta.json")

    status_code, payload = asyncio.run(runner.stop_active_run("missing", meta_path))

    assert status_code == 404
    assert payload["error"] == "Run process not found"


def test_stop_active_run_terminates_process_and_writes_meta(tmp_path):
    run_id = "run_1"
    meta_dir = tmp_path / run_id
    meta_dir.mkdir()
    process = FakeProcess()
    runner.active_processes[run_id] = process
    runner.active_runs[run_id] = {
        "id": run_id,
        "status": RUN_STATUS_RUNNING,
        "started_at": int(time.time()) - 3,
        "logs": [],
    }

    def meta_path(run_id):
        return str(tmp_path / run_id / "meta.json")

    status_code, payload = asyncio.run(runner.stop_active_run(run_id, meta_path))

    assert status_code == 200
    assert payload["status"] == "success"
    assert process.terminated is True
    meta = json.loads((meta_dir / "meta.json").read_text(encoding="utf-8"))
    assert meta["status"] == RUN_STATUS_STOPPED
    assert meta["failure_reason"]["category"] == "cancelled"
    assert meta["duration_ms"] >= 3000


class FakeTask:
    """最小可取消的 asyncio.Task 替身：cancel() 立即让 await 完成。"""

    def __init__(self):
        self.cancelled_called = False
        self._done = False

    def cancel(self):
        self.cancelled_called = True
        self._done = True
        return True

    def done(self):
        return self._done

    def __await__(self):
        async def _noop():
            return None
        return _noop().__await__()


def test_stop_active_run_cancels_pending(tmp_path):
    run_id = "run_pending"
    meta_dir = tmp_path / run_id
    meta_dir.mkdir()
    runner.active_runs[run_id] = {
        "id": run_id,
        "status": RUN_STATUS_PENDING,
        "started_at": int(time.time()),
        "logs": [],
    }
    task = FakeTask()
    runner.active_tasks[run_id] = task

    def meta_path(run_id):
        return str(tmp_path / run_id / "meta.json")

    status_code, payload = asyncio.run(runner.stop_active_run(run_id, meta_path))

    assert status_code == 200
    assert payload["status"] == "success"
    assert payload["message"] == "Queued run cancelled"
    assert task.cancelled_called is True
    meta = json.loads((meta_dir / "meta.json").read_text(encoding="utf-8"))
    assert meta["status"] == RUN_STATUS_STOPPED
    assert meta["failure_reason"]["category"] == "cancelled"
    assert run_id not in runner.active_runs
    assert run_id not in runner.active_tasks


# ---------- run_pytest_worker: 超时分支与 stopped 不被覆盖 ----------

def _make_runner_deps(tmp_path, monkeypatch):
    """构造最小 RunnerDeps，用于直接调用 run_pytest_worker。"""
    from web_server.runner import RunnerDeps

    def load_env():
        # 不实际加载 .env，避免污染测试环境
        pass

    def infer_failure_reason(logs):
        return {"category": "unknown", "message": "推断失败原因"}

    def build_python_script(case):
        return "print('fake script')"

    def validate_case_placeholders(doc):
        return None

    def safe_script_path(name):
        return str(tmp_path / "fake_script.py")

    def run_dir(session_id):
        d = tmp_path / session_id
        d.mkdir(parents=True, exist_ok=True)
        return str(d)

    def run_meta_path(session_id):
        return str(tmp_path / session_id / "meta.json")

    class _FakeModel:
        pass

    def session_factory():
        class _S:
            def query(self, *_a, **_k):
                class _Q:
                    def filter_by(self, **_k):
                        return self
                    def first(self):
                        return None
                return _Q()
            def close(self):
                pass
        return _S()

    return RunnerDeps(
        project_root=str(tmp_path),
        scripts_dir=str(tmp_path / "scripts"),
        envs_file=str(tmp_path / "envs.json"),
        internal_token="test-internal-token",
        session_factory=session_factory,
        case_model=_FakeModel,
        build_python_script=build_python_script,
        validate_case_placeholders=validate_case_placeholders,
        safe_script_path=safe_script_path,
        run_dir=run_dir,
        run_meta_path=run_meta_path,
        load_env=load_env,
        infer_failure_reason=infer_failure_reason,
    )


class _FakeStdout:
    """模拟子进程 stdout：readline 永久挂起，触发超时分支。"""
    async def readline(self):
        # 永不返回数据，让 wait_for 触发 TimeoutError
        await asyncio.sleep(100)
        return b""


class _HangingProcess:
    """模拟一个永不结束的子进程，用于验证超时分支。"""
    def __init__(self):
        self.returncode = None
        self.stdout = _FakeStdout()
        self.terminated = False
        self.killed = False

    def terminate(self):
        self.terminated = True

    def kill(self):
        self.killed = True

    async def wait(self):
        # 进程被 terminate 后返回非 0 退出码
        return self.returncode if self.returncode is not None else -15


def test_run_pytest_worker_timeout_branch(tmp_path, monkeypatch):
    """超时分支：DEFAULT_RUN_TIMEOUT_SECONDS=1 时，挂起进程应触发 timeout 终态。"""
    from web_server.runtime_utils import RUN_STATUS_TIMEOUT
    from web_server.runner import run_pytest_worker

    # 把模块级常量改为 1 秒，使 worker 在 1 秒后进入超时分支
    monkeypatch.setattr(runner, "DEFAULT_RUN_TIMEOUT_SECONDS", 1)

    session_id = "run_timeout"
    meta_dir = tmp_path / session_id
    meta_dir.mkdir(parents=True, exist_ok=True)
    runner.active_runs[session_id] = {
        "id": session_id,
        "status": RUN_STATUS_PENDING,
        "started_at": int(time.time()),
        "logs": [],
        "screenshots": [],
    }
    # 预置一个 ws，避免 wait_for_ws 等待 5 秒
    runner.active_sessions[session_id] = object()

    hanging = _HangingProcess()
    async def fake_create_subprocess_exec(*args, **kwargs):
        return hanging
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    # terminate_process 会调用 process.terminate()/kill() 与 wait，使用真实实现即可
    monkeypatch.setattr(asyncio, "wait_for", asyncio.wait_for)

    deps = _make_runner_deps(tmp_path, monkeypatch)
    asyncio.run(run_pytest_worker(deps, session_id, str(tmp_path / "fake_script.py"), wait_for_ws=False))

    meta_path = tmp_path / session_id / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert meta["status"] == RUN_STATUS_TIMEOUT
    assert meta.get("failure_reason", {}).get("category") == "timeout"
    assert hanging.terminated is True
    runner.active_sessions.pop(session_id, None)


class _NonZeroProcess:
    """模拟一个以非 0 退出码结束的进程，用于验证 stopped 终态不被覆盖。"""
    def __init__(self):
        self.returncode = None
        self.stdout = _FakeStdout()
        self.terminated = False

    def terminate(self):
        self.terminated = True
        self.returncode = -15

    def kill(self):
        self.returncode = -9

    async def wait(self):
        return -1


def test_run_pytest_worker_stopped_not_overwritten(tmp_path, monkeypatch):
    """worker 走到终态时：若 meta 已是 stopped，不应被非 0 退出码覆盖。"""
    from web_server.runtime_utils import RUN_STATUS_STOPPED
    from web_server.runner import run_pytest_worker

    monkeypatch.setattr(runner, "DEFAULT_RUN_TIMEOUT_SECONDS", 60)

    session_id = "run_stopped"
    meta_dir = tmp_path / session_id
    meta_dir.mkdir(parents=True, exist_ok=True)
    runner.active_runs[session_id] = {
        "id": session_id,
        "status": RUN_STATUS_STOPPED,
        "started_at": int(time.time()) - 2,
        "ended_at": int(time.time()),
        "logs": [],
        "screenshots": [],
    }
    runner.active_sessions[session_id] = object()

    proc = _NonZeroProcess()
    async def fake_create_subprocess_exec(*args, **kwargs):
        return proc
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    deps = _make_runner_deps(tmp_path, monkeypatch)
    asyncio.run(run_pytest_worker(deps, session_id, str(tmp_path / "fake_script.py"), wait_for_ws=False))

    meta_path = tmp_path / session_id / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert meta["status"] == RUN_STATUS_STOPPED
    runner.active_sessions.pop(session_id, None)
