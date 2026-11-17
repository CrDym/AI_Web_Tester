import asyncio
import json
import os
import shutil
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    from web_server.runner import stop_active_run
except Exception:
    from runner import stop_active_run


class RunFixSuggestReq(BaseModel):
    force: bool = False


class BatchDeleteRunsReq(BaseModel):
    run_ids: List[str] = []
    keep: int = 20


@dataclass
class RunsRouteDeps:
    session_factory: Callable[[], Any]
    case_model: Any
    list_runs: Callable[[Optional[str]], List[Dict[str, Any]]]
    run_meta_path: Callable[[str], str]
    migrate_run_meta: Callable[[Any, Optional[str]], Dict[str, Any]]
    make_ai_fix_suggestion: Callable[[Dict[str, Any], Dict[str, Any], bool], Dict[str, Any]]
    run_dir: Callable[[str], str]
    runs_dir: Callable[[], str]


def create_runs_router(deps: RunsRouteDeps) -> APIRouter:
    router = APIRouter()

    @router.get("/api/runs")
    async def get_runs(case_id: Optional[str] = None, include_all: bool = False):
        return JSONResponse(deps.list_runs(case_id=None if include_all else case_id))

    @router.get("/api/runs/{run_id}")
    async def get_run_detail(run_id: str):
        meta_path = deps.run_meta_path(run_id)
        if not os.path.exists(meta_path):
            return JSONResponse({"error": "Run not found"}, status_code=404)
        with open(meta_path, "r", encoding="utf-8") as file:
            meta = json.load(file)
        meta = deps.migrate_run_meta(meta, meta_path)
        return JSONResponse(meta)

    @router.post("/api/runs/{run_id}/stop")
    async def stop_run(run_id: str):
        status_code, payload = await stop_active_run(run_id, deps.run_meta_path)
        return JSONResponse(payload, status_code=status_code)

    @router.post("/api/runs/{run_id}/ai_fix_suggest")
    async def ai_fix_suggest(run_id: str, req: RunFixSuggestReq):
        meta_path = deps.run_meta_path(run_id)
        if not os.path.exists(meta_path):
            return JSONResponse({"error": "Run not found"}, status_code=404)
        with open(meta_path, "r", encoding="utf-8") as file:
            run_meta = json.load(file)
        run_meta = deps.migrate_run_meta(run_meta, meta_path)
        case_id = run_meta.get("case_id")
        if not case_id:
            return JSONResponse({"error": "Missing case_id"}, status_code=400)

        db = deps.session_factory()
        try:
            case_model = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case_model:
                return JSONResponse({"error": "Case not found"}, status_code=404)
            case_doc = {
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

        loop = asyncio.get_event_loop()
        suggestion = await loop.run_in_executor(
            None, lambda: deps.make_ai_fix_suggestion(run_meta, case_doc, bool(req.force))
        )
        run_meta["ai_fix_suggestion"] = suggestion
        try:
            with open(meta_path, "w", encoding="utf-8") as file:
                json.dump(run_meta, file, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return JSONResponse({"status": "ok", "suggestion": suggestion})

    def deleted_runs_dir() -> str:
        path = os.path.join(deps.runs_dir(), "_deleted")
        os.makedirs(path, exist_ok=True)
        return path

    def trash_run_dir(run_id: str) -> bool:
        run_path = deps.run_dir(run_id)
        if not os.path.exists(run_path):
            return False
        target = os.path.join(deleted_runs_dir(), f"{os.path.basename(run_path)}_{int(time.time())}")
        shutil.move(run_path, target)
        return True

    @router.post("/api/runs/cleanup")
    async def cleanup_runs(req: BatchDeleteRunsReq):
        """按数量保留最近的运行（终态），其余软删除到 _deleted。"""
        keep = max(1, int(req.keep or 20))
        # 收集终态运行目录（非 _deleted），按目录 mtime 从新到旧排序
        entries = []
        root = deps.runs_dir()
        deleted_dir = deleted_runs_dir()
        for name in os.listdir(root):
            if name == "_deleted":
                continue
            run_path = os.path.join(root, name)
            meta_path = os.path.join(run_path, "meta.json")
            if not os.path.isdir(run_path) or not os.path.exists(meta_path):
                continue
            # 跳过运行中的任务（active 检查在 app 侧已有，但这里保守按目录 mtime）
            started_at = 0
            try:
                with open(os.path.join(run_path, "meta.json"), "r", encoding="utf-8") as f:
                    started_at = int(json.load(f).get("started_at") or 0)
            except Exception:
                pass
            entries.append((started_at, name, run_path))
        # 运行中的任务保护：从 runner 的 active_runs 不可直接依赖（跨层）——检查 meta.status
        keep_set = []
        trash_list = []
        for mtime, name, run_path in sorted(entries, key=lambda x: -x[0]):
            try:
                with open(os.path.join(run_path, "meta.json"), "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if (meta.get("status") or "") not in ("completed", "failed", "stopped", "timeout"):
                    # 非终态（running/pending）不参与清理也不计入 keep
                    continue
            except Exception:
                pass
            if len(keep_set) < keep:
                keep_set.append(name)
            else:
                trash_list.append(name)
        trashed = []
        for name in trash_list:
            run_path = os.path.join(root, name)
            target = os.path.join(deleted_dir, f"{name}_{int(time.time())}")
            try:
                shutil.move(run_path, target)
                trashed.append(name)
            except Exception:
                pass
        return JSONResponse({"status": "success", "kept": len(keep_set), "trashed": trashed})

    @router.delete("/api/runs/{run_id}")

    async def delete_run(run_id: str):
        if not trash_run_dir(run_id):
            return JSONResponse({"error": "Run not found"}, status_code=404)
        return JSONResponse({"status": "success"})

    @router.post("/api/runs/batch_delete")
    async def batch_delete_runs(req: BatchDeleteRunsReq):
        run_ids = [str(x).strip() for x in (req.run_ids or []) if str(x or "").strip()]
        if not run_ids:
            return JSONResponse({"error": "Missing run_ids"}, status_code=400)
        deleted: List[str] = []
        not_found: List[str] = []
        for run_id in run_ids:
            if not trash_run_dir(run_id):
                not_found.append(run_id)
                continue
            deleted.append(run_id)
        return JSONResponse({"status": "success", "deleted": deleted, "not_found": not_found})

    return router
