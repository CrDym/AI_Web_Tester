import json
import shutil
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

try:
    from web_server.runner import active_runs, active_runs_lock
except Exception:
    from runner import active_runs, active_runs_lock


@dataclass
class SuiteRouteDeps:
    session_factory: Callable[[], Any]
    suite_model: Any
    stable_suite_id: Callable[[], str]
    list_suites: Callable[[], List[Dict[str, Any]]]
    list_suite_runs: Callable[[str], List[Dict[str, Any]]]
    normalize_suite_case_ids: Callable[[Any, Any], List[str]]
    validate_suite_case_refs: Callable[[Any, List[str], Any], List[str]]
    suite_run_dir: Callable[[str], str]


def create_suites_router(deps: SuiteRouteDeps) -> APIRouter:
    router = APIRouter()

    @router.get("/api/suites")
    async def get_suites():
        return JSONResponse(deps.list_suites())

    @router.post("/api/suites")
    async def create_suite(request: Request):
        data = await request.json()
        name = str(data.get("name") or "").strip() or f"suite_{int(time.time())}"
        suite_id = deps.stable_suite_id()

        env_id = data.get("env_id")
        setup_case_id = str(data.get("setup_case_id") or "").strip() or None
        case_ids = deps.normalize_suite_case_ids(data.get("case_ids") or [], setup_case_id)

        db = deps.session_factory()
        try:
            if db.query(deps.suite_model).filter_by(id=suite_id).first():
                return JSONResponse({"error": "Suite already exists"}, status_code=400)
            missing = deps.validate_suite_case_refs(db, case_ids, setup_case_id)
            if missing:
                return JSONResponse({"error": "Suite contains missing cases", "missing_case_ids": missing}, status_code=400)

            new_suite = deps.suite_model(
                id=suite_id,
                name=name,
                env_id=env_id,
                setup_case_id=setup_case_id,
                case_ids=json.dumps(case_ids),
                created_at=int(time.time()),
                updated_at=int(time.time()),
            )
            db.add(new_suite)
            db.commit()
            return JSONResponse({"status": "success", "id": suite_id})
        finally:
            db.close()

    @router.get("/api/suites/{suite_id}")
    async def get_suite(suite_id: str):
        db = deps.session_factory()
        try:
            suite = db.query(deps.suite_model).filter_by(id=suite_id).first()
            if not suite:
                return JSONResponse({"error": "Suite not found"}, status_code=404)
            return JSONResponse({
                "id": suite.id,
                "name": suite.name,
                "description": suite.description,
                "env_id": suite.env_id,
                "setup_case_id": suite.setup_case_id,
                "case_ids": json.loads(suite.case_ids) if suite.case_ids else [],
                "created_at": suite.created_at,
                "updated_at": suite.updated_at,
            })
        finally:
            db.close()

    @router.put("/api/suites/{suite_id}")
    async def update_suite(suite_id: str, request: Request):
        data = await request.json()
        db = deps.session_factory()
        try:
            suite = db.query(deps.suite_model).filter_by(id=suite_id).first()
            if not suite:
                return JSONResponse({"error": "Suite not found"}, status_code=404)

            if "name" in data:
                suite.name = data.get("name")
            if "description" in data:
                suite.description = data.get("description")
            if "env_id" in data:
                suite.env_id = data.get("env_id")
            if "setup_case_id" in data:
                suite.setup_case_id = data.get("setup_case_id")

            if "case_ids" in data:
                case_ids = deps.normalize_suite_case_ids(data.get("case_ids") or [], suite.setup_case_id)
                missing = deps.validate_suite_case_refs(db, case_ids, suite.setup_case_id)
                if missing:
                    return JSONResponse({"error": "Suite contains missing cases", "missing_case_ids": missing}, status_code=400)
                suite.case_ids = json.dumps(case_ids)
            else:
                current_case_ids = json.loads(suite.case_ids) if suite.case_ids else []
                missing = deps.validate_suite_case_refs(db, current_case_ids, suite.setup_case_id)
                if missing:
                    return JSONResponse({"error": "Suite contains missing cases", "missing_case_ids": missing}, status_code=400)
            suite.updated_at = int(time.time())
            db.commit()
            return JSONResponse({"status": "success", "message": "Suite updated"})
        finally:
            db.close()

    @router.delete("/api/suites/{suite_id}")
    async def delete_suite(suite_id: str):
        db = deps.session_factory()
        try:
            suite = db.query(deps.suite_model).filter_by(id=suite_id).first()
            if not suite:
                return JSONResponse({"error": "Suite not found"}, status_code=404)
            db.delete(suite)
            db.commit()
        finally:
            db.close()

        runs = deps.list_suite_runs(suite_id)
        async with active_runs_lock:
            for run in runs:
                safe_id = (run["id"] or "").strip().replace("/", "_").replace("\\", "_").replace("..", "_")
                shutil.rmtree(deps.suite_run_dir(safe_id), ignore_errors=True)
                if safe_id in active_runs:
                    del active_runs[safe_id]

        return JSONResponse({"status": "success"})

    return router
