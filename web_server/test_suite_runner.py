import asyncio
import json
from pathlib import Path

try:
    from web_server.suite_runner import SuiteRunnerDeps, run_suite_worker, wait_run_finished
    from web_server.runtime_utils import RUN_STATUS_COMPLETED, RUN_STATUS_FAILED, RUN_STATUS_TIMEOUT
except Exception:
    from suite_runner import SuiteRunnerDeps, run_suite_worker, wait_run_finished
    from runtime_utils import RUN_STATUS_COMPLETED, RUN_STATUS_FAILED, RUN_STATUS_TIMEOUT


def _write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def test_wait_run_finished_returns_timeout_when_meta_missing(tmp_path):
    deps = SuiteRunnerDeps(
        run_meta_path=lambda run_id: str(tmp_path / "runs" / run_id / "meta.json"),
        suite_run_meta_path=lambda suite_id: str(tmp_path / "suites" / suite_id / "meta.json"),
        start_run=None,
    )

    meta = asyncio.run(wait_run_finished(deps, "missing", attempts=1, interval=0))

    assert meta["status"] == RUN_STATUS_TIMEOUT
    assert meta["failure_reason"]["category"] == "timeout"


def test_run_suite_worker_summarizes_completed_runs(tmp_path):
    suite_id = "suite_run_1"
    _write_json(tmp_path / "suites" / suite_id / "meta.json", {"id": suite_id, "status": "running"})
    runs = {
        "case_a": {"id": "run_a", "status": RUN_STATUS_COMPLETED, "duration_ms": 100, "heal_events": [{}], "token_usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}},
        "case_b": {"id": "run_b", "status": RUN_STATUS_COMPLETED, "duration_ms": 200, "heal_events": [], "token_usage": {"prompt_tokens": 4, "completion_tokens": 5, "total_tokens": 9}},
    }

    async def start_run(name, env_id, wait_for_ws, extra_env):
        run_meta = runs[name]
        _write_json(tmp_path / "runs" / run_meta["id"] / "meta.json", run_meta)
        return {"run_id": run_meta["id"], "session_id": run_meta["id"]}

    deps = SuiteRunnerDeps(
        run_meta_path=lambda run_id: str(tmp_path / "runs" / run_id / "meta.json"),
        suite_run_meta_path=lambda suite_id: str(tmp_path / "suites" / suite_id / "meta.json"),
        start_run=start_run,
    )

    asyncio.run(run_suite_worker(deps, suite_id, ["case_a", "case_b"], None, str(tmp_path / "state.json"), None))

    meta = json.loads((tmp_path / "suites" / suite_id / "meta.json").read_text(encoding="utf-8"))
    assert meta["status"] == RUN_STATUS_COMPLETED
    assert meta["summary"]["passed"] == 2
    assert meta["summary"]["failed"] == 0
    assert meta["summary"]["heal_total"] == 1
    assert meta["summary"]["token_total"] == 12
    assert meta["items"][0]["status"] == RUN_STATUS_COMPLETED


def test_run_suite_worker_stops_when_setup_case_fails(tmp_path):
    suite_id = "suite_run_setup"
    _write_json(tmp_path / "suites" / suite_id / "meta.json", {"id": suite_id, "status": "running"})
    calls = []

    async def start_run(name, env_id, wait_for_ws, extra_env):
        calls.append(name)
        run_id = f"run_{name}"
        _write_json(tmp_path / "runs" / run_id / "meta.json", {"id": run_id, "status": RUN_STATUS_FAILED, "duration_ms": 1, "heal_events": []})
        return {"run_id": run_id, "session_id": run_id}

    deps = SuiteRunnerDeps(
        run_meta_path=lambda run_id: str(tmp_path / "runs" / run_id / "meta.json"),
        suite_run_meta_path=lambda suite_id: str(tmp_path / "suites" / suite_id / "meta.json"),
        start_run=start_run,
    )

    asyncio.run(run_suite_worker(deps, suite_id, ["setup", "case_after"], None, str(tmp_path / "state.json"), "setup"))

    meta = json.loads((tmp_path / "suites" / suite_id / "meta.json").read_text(encoding="utf-8"))
    assert calls == ["setup"]
    assert meta["status"] == RUN_STATUS_FAILED
    assert meta["current_case_id"] is None
