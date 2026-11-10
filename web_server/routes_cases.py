import json
import os
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse


@dataclass
class CasesRouteDeps:
    session_factory: Callable[[], Any]
    case_model: Any
    list_cases: Callable[[], List[Dict[str, Any]]]
    stable_case_id: Callable[[str], str]
    safe_case_name: Callable[[str], str]
    case_doc_from_model: Callable[[Any], Dict[str, Any]]
    write_case_backup_file: Callable[[str, Dict[str, Any]], Any]
    case_path: Callable[[str], str]
    remove_case_from_suites: Callable[[Any, str], int]
    validate_case_placeholders: Callable[[Dict[str, Any]], None]
    build_python_script: Callable[[Dict[str, Any]], str]
    normalize_recorded_steps: Callable[[Any], Dict[str, Any]]


def create_cases_router(deps: CasesRouteDeps) -> APIRouter:
    router = APIRouter()

    def create_case_from_payload(data: Dict[str, Any], normalize_recorded: bool = False) -> JSONResponse:
        name = deps.safe_case_name(data.get("name") or f"case_{int(time.time())}")
        tags = data.get("tags", [])
        steps = data.get("steps", [])
        recorder_normalize_summary = None
        if normalize_recorded:
            normalized = deps.normalize_recorded_steps(steps)
            steps = normalized["steps"]
            recorder_normalize_summary = normalized["summary"]
            tag_set = set(tags if isinstance(tags, list) else [])
            tag_set.add("auto_generated")
            tag_set.add("normalized")
            tags = sorted(tag_set)

        deps.validate_case_placeholders({
            "start_url": data.get("start_url"),
            "steps": steps,
            "variables": data.get("variables", {}),
            "dataset": data.get("dataset", []),
        })

        db = deps.session_factory()
        try:
            final_case_id = deps.stable_case_id(name)
            final_name = name
            while db.query(deps.case_model).filter_by(id=final_case_id).first():
                final_case_id = deps.stable_case_id(name)

            new_case = deps.case_model(
                id=final_case_id,
                name=final_name,
                group_name=str(data.get("group_name") or "").strip(),
                type="json",
                start_url=data.get("start_url"),
                steps=json.dumps(steps),
                tags=json.dumps(tags),
                variables=json.dumps(data.get("variables", {})),
                dataset=json.dumps(data.get("dataset", [])),
                created_at=int(time.time()),
                updated_at=int(time.time()),
            )
            db.add(new_case)
            db.commit()
            response = {"status": "success", "id": final_case_id}
            if recorder_normalize_summary is not None:
                response["normalized"] = recorder_normalize_summary
            return JSONResponse(response)
        finally:
            db.close()

    @router.get("/api/cases")
    async def get_cases():
        db = deps.session_factory()
        try:
            db.query(deps.case_model).filter(deps.case_model.type == "recorded").update({"type": "json"})
            db.query(deps.case_model).filter(deps.case_model.type == None).update({"type": "json"})
            db.commit()
        except Exception:
            pass
        finally:
            db.close()
        return JSONResponse(deps.list_cases())

    @router.post("/api/recorder/cases")
    async def create_case_from_recorder(request: Request):
        data = await request.json()
        return create_case_from_payload(data, normalize_recorded=True)

    @router.post("/api/cases")
    async def create_case(request: Request):
        data = await request.json()
        return create_case_from_payload(data)

    @router.get("/api/cases/{case_id}")
    async def get_case(case_id: str):
        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "Case not found"}, status_code=404)
            return JSONResponse({
                "id": case.id,
                "name": case.name,
                "type": case.type,
                "start_url": getattr(case, "start_url", None),
                "steps": json.loads(case.steps) if case.steps else [],
                "tags": json.loads(case.tags) if case.tags else [],
                "variables": json.loads(case.variables) if getattr(case, "variables", None) else {},
                "dataset": json.loads(case.dataset) if getattr(case, "dataset", None) else [],
                "created_at": case.created_at,
                "updated_at": case.updated_at,
            })
        finally:
            db.close()

    @router.put("/api/cases/{case_id}")
    async def update_case(case_id: str, request: Request):
        data = await request.json()
        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "Case not found"}, status_code=404)

            next_doc = deps.case_doc_from_model(case)
            if "steps" in data:
                next_doc["steps"] = data.get("steps", [])
            if "variables" in data:
                next_doc["variables"] = data.get("variables", {})
            if "dataset" in data:
                next_doc["dataset"] = data.get("dataset", [])
            if "start_url" in data:
                next_doc["start_url"] = data.get("start_url")
            deps.validate_case_placeholders(next_doc)

            backup_path = deps.write_case_backup_file(case_id, deps.case_doc_from_model(case))
            if "steps" in data:
                case.steps = json.dumps(data.get("steps", []))
            if "tags" in data:
                case.tags = json.dumps(data.get("tags", []))
            if "variables" in data:
                case.variables = json.dumps(data.get("variables", {}))
            if "dataset" in data:
                case.dataset = json.dumps(data.get("dataset", []))
            if "name" in data:
                case.name = data.get("name")
            if "start_url" in data:
                case.start_url = data.get("start_url")
            if "group_name" in data:
                case.group_name = str(data.get("group_name") or "").strip()
            case.updated_at = int(time.time())
            db.commit()
            return JSONResponse({"status": "success", "message": "Case updated", "backup_saved": bool(backup_path)})
        finally:
            db.close()

    @router.post("/api/cases/batch_group")
    async def batch_group_cases(request: Request):
        data = await request.json()
        case_ids = data.get("case_ids") or []
        group_name = str(data.get("group_name") or "").strip()
        if not isinstance(case_ids, list) or not case_ids:
            return JSONResponse({"error": "请选择要移动的用例"}, status_code=400)
        db = deps.session_factory()
        try:
            now = int(time.time())
            updated = 0
            cases = db.query(deps.case_model).filter(deps.case_model.id.in_(case_ids)).all()
            for case in cases:
                deps.write_case_backup_file(case.id, deps.case_doc_from_model(case))
                case.group_name = group_name
                case.updated_at = now
                updated += 1
            db.commit()
            return JSONResponse({"status": "success", "updated": updated, "group_name": group_name})
        finally:
            db.close()

    @router.post("/api/cases/{case_id}/rename")
    async def rename_case(case_id: str, request: Request):
        data = await request.json()
        raw_name = data.get("new_name") if data.get("new_name") is not None else data.get("name")
        new_name = deps.safe_case_name(str(raw_name or ""))
        if not new_name:
            return JSONResponse({"error": "用例名称不能为空"}, status_code=400)
        if new_name.endswith(".json"):
            new_name = new_name[:-5]
        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "用例不存在"}, status_code=404)
            if db.query(deps.case_model).filter(deps.case_model.id != case_id, deps.case_model.name == new_name).first():
                return JSONResponse({"error": "同名用例已存在"}, status_code=409)
            deps.write_case_backup_file(case_id, deps.case_doc_from_model(case))
            case.name = new_name
            case.updated_at = int(time.time())
            db.commit()
            return JSONResponse({"status": "success", "case": deps.case_doc_from_model(case)})
        finally:
            db.close()

    @router.post("/api/cases/{case_id}/restore")
    async def restore_case(case_id: str):
        backup_path = deps.case_path(case_id) + ".bak"
        if not os.path.exists(backup_path):
            return JSONResponse({"error": "Backup not found"}, status_code=404)
        try:
            with open(backup_path, "r", encoding="utf-8") as file:
                backup_doc = json.load(file)
        except Exception:
            return JSONResponse({"error": "Backup is invalid"}, status_code=400)

        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "Case not found"}, status_code=404)
            current_doc = deps.case_doc_from_model(case)

            if not isinstance(backup_doc, dict):
                return JSONResponse({"error": "Backup is invalid"}, status_code=400)

            steps_val = backup_doc.get("steps", [])
            if isinstance(steps_val, str):
                try:
                    steps_val = json.loads(steps_val)
                except Exception:
                    steps_val = []
            if not isinstance(steps_val, list):
                steps_val = []

            deps.write_case_backup_file(case_id, current_doc)
            case.steps = json.dumps(steps_val)
            if "start_url" in backup_doc:
                case.start_url = backup_doc.get("start_url")
            if "name" in backup_doc and backup_doc.get("name"):
                case.name = backup_doc.get("name")
            if "tags" in backup_doc:
                tags_val = backup_doc.get("tags") or []
                if isinstance(tags_val, str):
                    try:
                        tags_val = json.loads(tags_val)
                    except Exception:
                        tags_val = []
                if isinstance(tags_val, list):
                    case.tags = json.dumps(tags_val)
            if "dataset" in backup_doc:
                dataset_val = backup_doc.get("dataset") or []
                if isinstance(dataset_val, str):
                    try:
                        dataset_val = json.loads(dataset_val)
                    except Exception:
                        dataset_val = []
                if isinstance(dataset_val, list):
                    case.dataset = json.dumps(dataset_val)
            if "type" in backup_doc and backup_doc.get("type"):
                case.type = backup_doc.get("type")
            # 恢复完整性：补回 variables 与 group_name，避免恢复后丢失这两项
            if "variables" in backup_doc:
                variables_val = backup_doc.get("variables") or {}
                if isinstance(variables_val, str):
                    try:
                        variables_val = json.loads(variables_val)
                    except Exception:
                        variables_val = {}
                if isinstance(variables_val, dict):
                    case.variables = json.dumps(variables_val, ensure_ascii=False)
            if "group_name" in backup_doc:
                group_name_val = backup_doc.get("group_name")
                if isinstance(group_name_val, str):
                    case.group_name = group_name_val

            case.updated_at = int(time.time())
            db.commit()
            return JSONResponse({"status": "success", "message": "已恢复到上一个用例版本（并已将当前版本写入备份）"})
        finally:
            db.close()

    @router.post("/api/cases/{case_id}/heal/approve")
    async def approve_heal(case_id: str, request: Request):
        data = await request.json()
        old_selector = (data.get("old_selector") or "").strip()
        new_selector = (data.get("new_selector") or "").strip()
        step_intent = (data.get("step_intent") or "").strip()
        if not new_selector:
            return JSONResponse({"error": "Missing parameters"}, status_code=400)

        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "Case not found"}, status_code=404)

            deps.write_case_backup_file(case_id, deps.case_doc_from_model(case))
            steps = json.loads(case.steps) if case.steps else []
            already_updated = any((step.get("selector") or "") == new_selector for step in steps)
            updated = False

            if old_selector:
                for step in steps:
                    step_sel = step.get("selector")
                    if step_sel == old_selector or (step_sel or "").replace('"', "'") == old_selector:
                        step["selector"] = new_selector
                        updated = True
            else:
                if not step_intent:
                    return JSONResponse({"error": "Missing parameters"}, status_code=400)
                candidates: List[int] = []
                for i, step in enumerate(steps):
                    if (step.get("intent") or "").strip() == step_intent and not (step.get("selector") or "").strip():
                        candidates.append(i)
                if len(candidates) == 0:
                    return JSONResponse({"error": "No matching step found for intent (selector empty required)"}, status_code=404)
                if len(candidates) > 1:
                    return JSONResponse({"error": "Multiple matching steps found for intent", "indices": candidates}, status_code=409)
                steps[candidates[0]]["selector"] = new_selector
                updated = True

            if updated:
                case.steps = json.dumps(steps)
                case.updated_at = int(time.time())
                db.commit()
                return JSONResponse({"status": "success", "message": "Selector updated"})
            if already_updated:
                return JSONResponse({"status": "success", "message": "Selector already updated"})
            return JSONResponse({"error": f"Selector '{old_selector}' not found in current case steps"}, status_code=404)
        finally:
            db.close()

    @router.delete("/api/cases/{case_id}")
    async def delete_case(case_id: str):
        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "Case not found"}, status_code=404)
            affected_suites = deps.remove_case_from_suites(db, case_id)
            db.delete(case)
            db.commit()
            return JSONResponse({"status": "success", "affected_suites": affected_suites})
        finally:
            db.close()

    @router.get("/api/cases/{case_id}/script")
    async def get_case_script(case_id: str):
        db = deps.session_factory()
        try:
            case = db.query(deps.case_model).filter_by(id=case_id).first()
            if not case:
                return JSONResponse({"error": "Case not found"}, status_code=404)
            case_doc = {
                "id": case.id,
                "name": case.name,
                "start_url": case.start_url,
                "steps": json.loads(case.steps) if case.steps else [],
                "variables": json.loads(case.variables) if getattr(case, "variables", None) else {},
                "dataset": json.loads(case.dataset) if getattr(case, "dataset", None) else [],
                "type": case.type,
            }
            return JSONResponse({"content": deps.build_python_script(case_doc)})
        finally:
            db.close()

    return router
