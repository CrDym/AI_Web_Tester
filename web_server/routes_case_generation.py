import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel


class GenerateCaseReq(BaseModel):
    name: str
    start_url: str
    instruction: str


class ImportNaturalLanguagePreviewReq(BaseModel):
    text: str
    default_group: Optional[str] = None
    default_start_url: Optional[str] = None


class ImportNaturalLanguageConfirmReq(BaseModel):
    cases: List[Dict[str, Any]]


@dataclass
class CaseGenerationRouteDeps:
    session_factory: Callable[[], Any]
    case_model: Any
    prompts_dir: Callable[[], str]
    load_env: Callable[[], None]
    stable_case_id: Callable[[str], str]
    validate_case_placeholders: Callable[[Dict[str, Any]], None]


SUPPORTED_STEP_TYPES = {"click", "input", "wait", "assert", "hover", "select_option", "set_checked", "double_click", "right_click", "press_key", "scroll"}


def _prompt_file_path(prompts_dir: str, filename: str) -> str:
    safe_name = os.path.basename((filename or "").strip())
    if not safe_name.endswith(".txt") or safe_name != (filename or "").strip():
        raise ValueError("Invalid prompt filename")
    prompts_root = os.path.realpath(prompts_dir)
    path = os.path.realpath(os.path.join(prompts_root, safe_name))
    if not path.startswith(prompts_root + os.sep):
        raise ValueError("Invalid prompt filename")
    return path


def _load_prompt_preset(prompts_dir: str, filename: str, fallback: str = "") -> str:
    try:
        path = _prompt_file_path(prompts_dir, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as file:
                content = file.read().strip()
            if content:
                return content
    except Exception:
        pass
    return fallback


def _strip_json_markdown(content: str) -> str:
    content = (content or "").strip()
    if content.startswith("```json"):
        return content[7:-3].strip()
    if content.startswith("```"):
        return content[3:-3].strip()
    return content


def _normalize_import_step(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {"type": "click", "selector": "", "intent": str(raw or "").strip(), "value": ""}
    step_type = str(raw.get("type") or "click").strip()
    if step_type not in SUPPORTED_STEP_TYPES:
        step_type = "click"
    step = {
        "type": step_type,
        "selector": str(raw.get("selector") or ""),
        "intent": str(raw.get("intent") or raw.get("description") or "").strip(),
        "value": "" if raw.get("value") is None else str(raw.get("value")),
    }
    if raw.get("url") is not None:
        step["url"] = str(raw.get("url") or "")
    if step_type == "assert":
        assert_type = str(raw.get("assert_type") or "text").strip()
        step["assert_type"] = assert_type if assert_type in {"text", "url", "visible"} else "text"
    return step


def _is_open_page_step(step: Dict[str, Any]) -> bool:
    if not isinstance(step, dict):
        return False
    text = f"{step.get('intent') or ''} {step.get('value') or ''}".strip().lower()
    if not text:
        return False
    patterns = [
        r"打开.+页",
        r"打开.+url",
        r"访问.+页",
        r"访问.+url",
        r"进入.+页",
        r"进入.+url",
        r"打开登录页",
        r"访问登录页",
        r"进入登录页",
    ]
    return any(re.search(pattern, text) for pattern in patterns)


def _normalize_import_case(raw: Any, idx: int, default_group: str = "", default_start_url: str = "") -> Dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    name = str(raw.get("name") or raw.get("title") or f"导入用例 {idx + 1}").strip()
    group_name = str(raw.get("group_name") or raw.get("module") or default_group or "导入用例").strip()
    start_url = str(raw.get("start_url") or default_start_url or "").strip()
    steps = [step for step in (_normalize_import_step(step) for step in (raw.get("steps") or [])) if not _is_open_page_step(step)]
    variables = raw.get("variables") if isinstance(raw.get("variables"), dict) else {}
    dataset = raw.get("dataset") if isinstance(raw.get("dataset"), list) else []
    tags = raw.get("tags") if isinstance(raw.get("tags"), list) else []
    tags = [str(tag).strip() for tag in tags if str(tag or "").strip()]
    for tag in ("imported", "nl_import"):
        if tag not in tags:
            tags.append(tag)
    return {
        "name": name,
        "group_name": group_name,
        "type": "json",
        "start_url": start_url,
        "steps": steps,
        "tags": tags,
        "variables": variables,
        "dataset": dataset,
    }


def create_case_generation_router(deps: CaseGenerationRouteDeps) -> APIRouter:
    router = APIRouter()

    def validate_import_case(case_doc: Dict[str, Any]) -> List[str]:
        errors: List[str] = []
        if not str(case_doc.get("name") or "").strip():
            errors.append("用例名称不能为空")
        if not isinstance(case_doc.get("steps"), list) or len(case_doc.get("steps") or []) == 0:
            errors.append("至少需要 1 个步骤")
        for i, step in enumerate(case_doc.get("steps") or []):
            if step.get("type") not in SUPPORTED_STEP_TYPES:
                errors.append(f"第 {i + 1} 步类型不支持")
            if not str(step.get("intent") or "").strip() and step.get("type") not in {"wait", "assert"}:
                errors.append(f"第 {i + 1} 步缺少操作意图")
        try:
            deps.validate_case_placeholders(case_doc)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
            errors.append(str(detail.get("error") or detail))
        return errors

    def parse_nl_import_response(content: str, default_group: str, default_start_url: str) -> List[Dict[str, Any]]:
        data = json.loads(_strip_json_markdown(content))
        raw_cases = data.get("cases") if isinstance(data, dict) else data
        if isinstance(raw_cases, dict):
            raw_cases = [raw_cases]
        if not isinstance(raw_cases, list):
            raw_cases = []
        return [_normalize_import_case(raw, i, default_group, default_start_url) for i, raw in enumerate(raw_cases)]

    def create_import_case(case_doc: Dict[str, Any]) -> str:
        now = int(time.time())
        case_id = deps.stable_case_id(case_doc.get("name") or "imported")
        db = deps.session_factory()
        try:
            case = deps.case_model(
                id=case_id,
                name=case_doc.get("name") or "导入用例",
                group_name=case_doc.get("group_name") or "导入用例",
                type="json",
                start_url=case_doc.get("start_url") or "",
                steps=json.dumps(case_doc.get("steps") or []),
                tags=json.dumps(case_doc.get("tags") or []),
                variables=json.dumps(case_doc.get("variables") or {}),
                dataset=json.dumps(case_doc.get("dataset") or []),
                created_at=now,
                updated_at=now,
            )
            db.add(case)
            db.commit()
            return case_id
        finally:
            db.close()

    @router.post("/api/cases/generate")
    async def generate_case(req: GenerateCaseReq):
        deps.load_env()
        api_key = os.environ.get("OPENAI_API_KEY")
        api_base = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
        model_name = os.environ.get("OPENAI_MODEL_NAME", "gpt-4o")

        if not api_key:
            return JSONResponse({"error": "请先在设置中配置 OpenAI API Key"}, status_code=400)

        try:
            llm = ChatOpenAI(
                model=model_name,
                api_key=api_key,
                base_url=api_base,
                temperature=0.1,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
            system_prompt = _load_prompt_preset(deps.prompts_dir(), "nl2case_system_prompt.txt", "你是一个自动化的测试用例生成专家。请将用户的自然语言测试指令转换为结构化 JSON。")
            user_prompt = f"初始URL: {req.start_url}\n自然语言指令:\n{req.instruction}"
            response = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
            token_usage = None
            try:
                if hasattr(response, "response_metadata") and isinstance(response.response_metadata, dict):
                    token_usage = response.response_metadata.get("token_usage")
            except Exception:
                token_usage = None
            data = json.loads(response.content)
            case_id = deps.stable_case_id(req.name or "natural")
            db = deps.session_factory()
            try:
                case = deps.case_model(
                    id=case_id,
                    name=req.name or "自然语言生成的用例",
                    group_name="",
                    type="json",
                    start_url=req.start_url,
                    steps=json.dumps(data.get("steps", [])),
                    tags=json.dumps(["auto_generated"]),
                    variables=json.dumps({}),
                    dataset=json.dumps([]),
                    created_at=int(time.time()),
                    updated_at=int(time.time()),
                )
                db.add(case)
                db.commit()
            finally:
                db.close()
            return {"status": "ok", "id": case_id, "token_usage": token_usage, "model": model_name}
        except Exception as exc:
            return JSONResponse({"error": str(exc)}, status_code=500)

    @router.post("/api/cases/import_nl/preview")
    async def import_natural_language_preview(req: ImportNaturalLanguagePreviewReq):
        text = (req.text or "").strip()
        if not text:
            return JSONResponse({"error": "请输入自然语言用例内容"}, status_code=400)
        if len(text) > 60000:
            return JSONResponse({"error": "导入内容过长，请拆分后再导入"}, status_code=400)

        deps.load_env()
        api_key = os.environ.get("OPENAI_API_KEY")
        api_base = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
        model_name = os.environ.get("OPENAI_MODEL_NAME", "gpt-4o")
        if not api_key:
            return JSONResponse({"error": "请先在设置中配置 OpenAI API Key"}, status_code=400)

        default_group = (req.default_group or "导入用例").strip()
        default_start_url = (req.default_start_url or "").strip()
        try:
            llm = ChatOpenAI(
                model=model_name,
                api_key=api_key,
                base_url=api_base,
                temperature=0.1,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
            system_prompt = _load_prompt_preset(deps.prompts_dir(), "nl_import_system_prompt.txt", "你是资深测试工程师。请把用户粘贴的自然语言测试用例批量转换为结构化 JSON。")
            user_prompt = f"默认分组: {default_group}\n默认起始URL: {default_start_url}\n自然语言用例内容:\n{text}"
            resp = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
            token_usage = None
            try:
                if hasattr(resp, "response_metadata") and isinstance(resp.response_metadata, dict):
                    token_usage = resp.response_metadata.get("token_usage")
            except Exception:
                token_usage = None
            cases = parse_nl_import_response(resp.content or "", default_group, default_start_url)
            items = []
            for i, case_doc in enumerate(cases):
                errors = validate_import_case(case_doc)
                items.append({"index": i, "case": case_doc, "valid": len(errors) == 0, "errors": errors})
            return JSONResponse({"status": "ok", "items": items, "token_usage": token_usage, "model": model_name})
        except Exception as exc:
            return JSONResponse({"error": str(exc)}, status_code=500)

    @router.post("/api/cases/import_nl/confirm")
    async def import_natural_language_confirm(req: ImportNaturalLanguageConfirmReq):
        if not isinstance(req.cases, list) or not req.cases:
            return JSONResponse({"error": "请选择要导入的用例"}, status_code=400)
        imported = []
        failed = []
        for i, raw in enumerate(req.cases):
            case_doc = _normalize_import_case(raw, i, raw.get("group_name") if isinstance(raw, dict) else "", raw.get("start_url") if isinstance(raw, dict) else "")
            errors = validate_import_case(case_doc)
            if errors:
                failed.append({"index": i, "name": case_doc.get("name"), "errors": errors})
                continue
            try:
                case_id = create_import_case(case_doc)
                imported.append({"index": i, "id": case_id, "name": case_doc.get("name")})
            except Exception as exc:
                failed.append({"index": i, "name": case_doc.get("name"), "errors": [str(exc)]})
        return JSONResponse({"status": "success", "imported": imported, "failed": failed})

    return router
