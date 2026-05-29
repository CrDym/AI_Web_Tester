import asyncio
import json
import time

import pytest

try:
    from web_server import runner
    from web_server.runtime_utils import RUN_STATUS_RUNNING, RUN_STATUS_STOPPED
except Exception:
    import runner
    from runtime_utils import RUN_STATUS_RUNNING, RUN_STATUS_STOPPED


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
    yield
    runner.active_processes.clear()
    runner.active_runs.clear()
    runner.active_sessions.clear()


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
