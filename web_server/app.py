import os
import time
import asyncio
import json
import uuid
import base64
import re
import secrets
import shutil
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
try:
    from web_server.auth_utils import (
        extract_bearer_token,
        is_valid_token,
        now_ts,
    )
    from web_server.database import SessionLocal, CaseModel, SuiteModel, RunModel, SuiteRunModel
    from web_server.runtime_utils import (
        DEFAULT_RUN_TIMEOUT_SECONDS,
        RUN_STATUS_COMPLETED,
        RUN_STATUS_FAILED,
        RUN_STATUS_RUNNING,
        RUN_STATUS_STOPPED,
        RUN_STATUS_TIMEOUT,
        RUN_TERMINAL_STATUSES,
        mask_secret,
        safe_child_path,
    )
    from web_server.runner import (
        active_processes,
        active_runs,
        active_runs_lock,
        active_sessions,
        RunnerDeps,
        start_run,
        stop_active_run,
        terminate_process,
        worker_semaphore,
    )
    from web_server.routes_auth import create_auth_router
    from web_server.routes_case_generation import CaseGenerationRouteDeps, create_case_generation_router
    from web_server.routes_cases import CasesRouteDeps, create_cases_router
    from web_server.routes_config import ConfigRouteDeps, create_config_router
    from web_server.routes_runs import RunsRouteDeps, create_runs_router
    from web_server.routes_suites import SuiteRouteDeps, create_suites_router
    from web_server.suite_runner import SuiteRunnerDeps, run_suite_worker, wait_run_finished
except Exception:
    from auth_utils import (
        extract_bearer_token,
        is_valid_token,
        now_ts,
    )
    from database import SessionLocal, CaseModel, SuiteModel, RunModel, SuiteRunModel
    from runtime_utils import (
        DEFAULT_RUN_TIMEOUT_SECONDS,
        RUN_STATUS_COMPLETED,
        RUN_STATUS_FAILED,
        RUN_STATUS_RUNNING,
        RUN_STATUS_STOPPED,
        RUN_STATUS_TIMEOUT,
        RUN_TERMINAL_STATUSES,
        mask_secret,
        safe_child_path,
    )
    from runner import (
        active_processes,
        active_runs,
        active_runs_lock,
        active_sessions,
        RunnerDeps,
        start_run,
        stop_active_run,
        terminate_process,
        worker_semaphore,
    )
    from routes_auth import create_auth_router
    from routes_case_generation import CaseGenerationRouteDeps, create_case_generation_router
    from routes_cases import CasesRouteDeps, create_cases_router
    from routes_config import ConfigRouteDeps, create_config_router
    from routes_runs import RunsRouteDeps, create_runs_router
    from routes_suites import SuiteRouteDeps, create_suites_router
    from suite_runner import SuiteRunnerDeps, run_suite_worker, wait_run_finished

from langchain_core.messages import SystemMessage, HumanMessage
try:
    from src.ai_tester.llm_utils import create_chat_openai
except Exception:
    from llm_utils import create_chat_openai

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

def _parse_csv_env(name: str, default: List[str]) -> List[str]:
    raw = os.environ.get(name)
    if raw is None:
        return default
    values = [x.strip() for x in raw.split(",") if x.strip()]
    return values or default

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_csv_env("AI_TESTER_CORS_ORIGINS", [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_TOKEN = secrets.token_urlsafe(32)
active_tokens: Dict[str, Dict[str, Any]] = {}

def _now_ts() -> int:
    return now_ts()

def _is_valid_token(token: str) -> bool:
    return is_valid_token(active_tokens, token)

def _extract_bearer_token(auth_header: str) -> str:
    return extract_bearer_token(auth_header)

@app.middleware("http")
async def _auth_middleware(request: Request, call_next):
    path = request.url.path or ""
    if not path.startswith("/api"):
        return await call_next(request)
    if path.startswith("/api/auth/"):
        return await call_next(request)
    if path == "/api/recorder/cases":
        token = (request.headers.get("X-Recorder-Token") or "").strip()
        expected = (os.environ.get("AI_TESTER_RECORDER_TOKEN") or "").strip()
        if expected and token != expected:
            return JSONResponse({"error": "unauthorized recorder"}, status_code=401)
        return await call_next(request)
    if path.startswith("/api/internal/"):
        token = (request.headers.get("X-Internal-Token") or "").strip()
        if token != INTERNAL_TOKEN:
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        return await call_next(request)
    token = _extract_bearer_token(request.headers.get("Authorization") or "")
    if not _is_valid_token(token):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return await call_next(request)

app.include_router(create_auth_router(active_tokens))

PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
SCRIPTS_DIR = os.path.join(PROJECT_ROOT, "tests", "recorded_scripts")
os.makedirs(SCRIPTS_DIR, exist_ok=True)
CASES_DIR = os.path.join(PROJECT_ROOT, "tests", "recorded_cases")
os.makedirs(CASES_DIR, exist_ok=True)
RUNS_DIR = os.path.join(PROJECT_ROOT, "tests", "run_history")
os.makedirs(RUNS_DIR, exist_ok=True)
SUITES_DIR = os.path.join(PROJECT_ROOT, "tests", "suites")
os.makedirs(SUITES_DIR, exist_ok=True)
SUITE_RUNS_DIR = os.path.join(PROJECT_ROOT, "tests", "suite_history")
os.makedirs(SUITE_RUNS_DIR, exist_ok=True)
ENVS_FILE = os.path.join(PROJECT_ROOT, "tests", "environments.json")
PROMPTS_DIR = os.environ.get("AI_TESTER_PROMPTS_DIR") or os.path.join(PROJECT_ROOT, "src", "ai_tester", "prompts")

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
except Exception:
    pass

def _load_env() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=True)
    except Exception:
        pass

def _safe_case_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        name = f"case_{int(time.time())}"
    name = name.replace("/", "_").replace("\\", "_").replace("..", "_")
    return name

def _case_path(case_id: str) -> str:
    case_id = _safe_case_name(case_id)
    if not case_id.endswith(".json"):
        case_id += ".json"
    return os.path.join(CASES_DIR, case_id)

def _stable_prefixed_id(prefix: str, suffix: str = "") -> str:
    safe_suffix = _safe_case_name(suffix) if suffix else ""
    tail = f"_{safe_suffix}" if safe_suffix else ""
    return f"{prefix}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}{tail}"

def _stable_case_id(name: str = "") -> str:
    return f"{_stable_prefixed_id('case', name)}.json"

def _stable_suite_id() -> str:
    return _stable_prefixed_id('suite')

def _stable_env_id() -> str:
    return _stable_prefixed_id('env')

def _case_doc_from_model(c: CaseModel) -> Dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "type": c.type,
        "group_name": getattr(c, "group_name", None) or "",
        "start_url": getattr(c, "start_url", None),
        "steps": json.loads(c.steps) if c.steps else [],
        "tags": json.loads(c.tags) if getattr(c, "tags", None) else [],
        "variables": json.loads(c.variables) if getattr(c, "variables", None) else {},
        "dataset": json.loads(c.dataset) if getattr(c, "dataset", None) else [],
        "created_at": getattr(c, "created_at", None),
        "updated_at": getattr(c, "updated_at", None),
    }

def _write_case_backup_file(case_id: str, doc: Dict[str, Any]) -> Optional[str]:
    try:
        p = _case_path(case_id)
        bak = p + ".bak"
        with open(bak, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        return bak
    except Exception:
        return None

def _list_cases() -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        cases = db.query(CaseModel).order_by(CaseModel.updated_at.desc()).all()
        return [{
            "id": c.id,
            "name": c.name,
            "type": c.type,
            "group_name": getattr(c, "group_name", None) or "",
            "tags": json.loads(c.tags) if c.tags else [],
            "updated_at": c.updated_at or c.created_at or 0
        } for c in cases]
    finally:
        db.close()

def _run_dir(run_id: str) -> str:
    run_id = (run_id or "").strip().replace("/", "_").replace("\\", "_").replace("..", "_")
    return os.path.join(RUNS_DIR, run_id)

def _run_meta_path(run_id: str) -> str:
    return os.path.join(_run_dir(run_id), "meta.json")

def _safe_suite_id(suite_id: str) -> str:
    suite_id = (suite_id or "").strip()
    suite_id = suite_id.replace("/", "_").replace("\\", "_").replace("..", "_")
    if not suite_id:
        suite_id = f"suite_{int(time.time())}"
    return suite_id

def _suite_path(suite_id: str) -> str:
    suite_id = _safe_suite_id(suite_id)
    if not suite_id.endswith(".json"):
        suite_id += ".json"
    return os.path.join(SUITES_DIR, suite_id)

def _safe_script_path(name: str) -> str:
    file_path, _ = safe_child_path(SCRIPTS_DIR, name, suffix=".py", error_label="Invalid script name")
    return file_path

def _safe_prompt_path(filename: str) -> str:
    file_path, _ = safe_child_path(PROMPTS_DIR, filename, suffix=".txt", error_label="Invalid filename")
    return file_path

def _suite_doc_from_model(s: SuiteModel) -> Dict[str, Any]:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "env_id": s.env_id,
        "setup_case_id": s.setup_case_id,
        "case_ids": json.loads(s.case_ids) if s.case_ids else [],
        "created_at": s.created_at,
        "updated_at": s.updated_at,
    }

def _normalize_suite_case_ids(raw_case_ids: Any, setup_case_id: Optional[str] = None) -> List[str]:
    case_ids: List[str] = []
    seen = set()
    setup_case_id = str(setup_case_id or "").strip() or None
    if not isinstance(raw_case_ids, list):
        return case_ids
    for cid in raw_case_ids:
        cid = str(cid or "").strip()
        if not cid or cid == setup_case_id or cid in seen:
            continue
        seen.add(cid)
        case_ids.append(cid)
    return case_ids

def _validate_suite_case_refs(db, case_ids: List[str], setup_case_id: Optional[str] = None) -> List[str]:
    wanted = [str(x or "").strip() for x in ([setup_case_id] if setup_case_id else []) + (case_ids or [])]
    wanted = [x for x in wanted if x]
    if not wanted:
        return []
    existing = {row.id for row in db.query(CaseModel).filter(CaseModel.id.in_(wanted)).all()}
    return [cid for cid in wanted if cid not in existing]

def _remove_case_from_suites(db, case_id: str) -> int:
    updated = 0
    now = int(time.time())
    suites = db.query(SuiteModel).all()
    for suite in suites:
        changed = False
        if suite.setup_case_id == case_id:
            suite.setup_case_id = None
            changed = True
        case_ids = json.loads(suite.case_ids) if suite.case_ids else []
        if isinstance(case_ids, list) and case_id in case_ids:
            suite.case_ids = json.dumps([cid for cid in case_ids if cid != case_id])
            changed = True
        if changed:
            suite.updated_at = now
            updated += 1
    return updated

def _list_suites() -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        suites = db.query(SuiteModel).order_by(SuiteModel.updated_at.desc()).all()
        return [{
            "id": s.id,
            "name": s.name,
            "env_id": s.env_id,
            "case_count": len(json.loads(s.case_ids)) if s.case_ids else 0,
            "updated_at": s.updated_at or s.created_at or 0
        } for s in suites]
    finally:
        db.close()

def _suite_run_dir(suite_run_id: str) -> str:
    suite_run_id = (suite_run_id or "").strip().replace("/", "_").replace("\\", "_").replace("..", "_")
    return os.path.join(SUITE_RUNS_DIR, suite_run_id)

def _suite_run_meta_path(suite_run_id: str) -> str:
    return os.path.join(_suite_run_dir(suite_run_id), "meta.json")

def _update_suites_case_ref(old_case_id: str, new_case_id: str) -> None:
    try:
        if not old_case_id or not new_case_id or old_case_id == new_case_id:
            return
        if not os.path.exists(SUITES_DIR):
            return
        for fname in os.listdir(SUITES_DIR):
            if not fname.endswith(".json"):
                continue
            p = os.path.join(SUITES_DIR, fname)
            try:
                with open(p, "r", encoding="utf-8") as fp:
                    doc = json.load(fp)
            except Exception:
                continue
            updated = False
            if doc.get("setup_case_id") == old_case_id:
                doc["setup_case_id"] = new_case_id
                updated = True
            case_ids = doc.get("case_ids") or []
            if isinstance(case_ids, list):
                new_case_ids = []
                for cid in case_ids:
                    if cid == old_case_id:
                        new_case_ids.append(new_case_id)
                        updated = True
                    else:
                        new_case_ids.append(cid)
                doc["case_ids"] = new_case_ids
            if updated:
                doc["updated_at"] = int(time.time())
                with open(p, "w", encoding="utf-8") as fp:
                    json.dump(doc, fp, ensure_ascii=False, indent=2)
    except Exception:
        return

def _migrate_run_meta(meta: Any, meta_path: Optional[str] = None) -> Dict[str, Any]:
    if not isinstance(meta, dict):
        meta = {}
    changed = False
    if "schema_version" not in meta:
        meta["schema_version"] = 2
        changed = True
    if "token_usage" not in meta or not isinstance(meta.get("token_usage"), dict):
        meta["token_usage"] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        changed = True
    if "logs" not in meta or not isinstance(meta.get("logs"), list):
        meta["logs"] = []
        changed = True
    if "screenshots" not in meta or not isinstance(meta.get("screenshots"), list):
        meta["screenshots"] = []
        changed = True
    if "heal_events" not in meta or not isinstance(meta.get("heal_events"), list):
        meta["heal_events"] = []
        changed = True
    if "failure_reason" not in meta:
        meta["failure_reason"] = _infer_failure_reason(meta.get("logs") or []) if meta.get("status") == "failed" else None
        changed = True
    elif meta.get("status") == "failed":
        normalized = _normalize_failure_reason(meta.get("failure_reason"), meta.get("logs") or [])
        if normalized != meta.get("failure_reason"):
            meta["failure_reason"] = normalized
            changed = True
    if "explore" in meta:
        meta.pop("explore", None)
        changed = True
    if changed and meta_path:
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    return meta

def _migrate_suite_run_meta(meta: Any, meta_path: Optional[str] = None) -> Dict[str, Any]:
    if not isinstance(meta, dict):
        meta = {}
    changed = False
    if "schema_version" not in meta:
        meta["schema_version"] = 1
        changed = True
    if "summary" not in meta or not isinstance(meta.get("summary"), dict):
        meta["summary"] = {}
        changed = True
    if changed and meta_path:
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    return meta

def _list_suite_runs(suite_id: Optional[str] = None) -> List[Dict[str, Any]]:
    runs: List[Dict[str, Any]] = []
    if not os.path.exists(SUITE_RUNS_DIR):
        return runs
    for d in os.listdir(SUITE_RUNS_DIR):
        meta_path = os.path.join(SUITE_RUNS_DIR, d, "meta.json")
        if not os.path.exists(meta_path):
            continue
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            continue
        meta = _migrate_suite_run_meta(meta, meta_path)
        if suite_id and meta.get("suite_id") != suite_id:
            continue
        runs.append({
            "id": meta.get("id") or d,
            "suite_id": meta.get("suite_id"),
            "suite_name": meta.get("suite_name"),
            "env_id": meta.get("env_id"),
            "status": meta.get("status"),
            "started_at": meta.get("started_at"),
            "ended_at": meta.get("ended_at"),
            "duration_ms": meta.get("duration_ms"),
            "summary": meta.get("summary") or {},
        })
    runs.sort(key=lambda x: x.get("started_at") or 0, reverse=True)
    return runs

def _rename_case_run_refs(old_case_id: str, new_case_id: str) -> int:
    if not old_case_id or not new_case_id or not os.path.exists(RUNS_DIR):
        return 0
    updated = 0
    for d in os.listdir(RUNS_DIR):
        meta_path = os.path.join(RUNS_DIR, d, "meta.json")
        if not os.path.exists(meta_path):
            continue
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            if not _case_id_matches_run(meta.get("case_id"), old_case_id):
                continue
            meta["case_id"] = new_case_id
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
            updated += 1
        except Exception:
            continue
    return updated

def _case_id_matches_run(meta_case_id: Any, requested_case_id: str) -> bool:
    stored = str(meta_case_id or "").strip()
    requested = str(requested_case_id or "").strip()
    if not stored or not requested:
        return False
    variants = {requested}
    if requested.endswith(".json"):
        variants.add(requested[:-5])
    else:
        variants.add(f"{requested}.json")
    return stored in variants

def _list_runs(case_id: Optional[str] = None) -> List[Dict[str, Any]]:
    runs: List[Dict[str, Any]] = []
    if not os.path.exists(RUNS_DIR):
        return runs
    for d in os.listdir(RUNS_DIR):
        meta_path = os.path.join(RUNS_DIR, d, "meta.json")
        if not os.path.exists(meta_path):
            continue
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            continue
        meta = _migrate_run_meta(meta, meta_path)
        if case_id and not _case_id_matches_run(meta.get("case_id"), case_id):
            continue
        runs.append({
            "id": meta.get("id") or d,
            "case_id": meta.get("case_id"),
            "status": meta.get("status"),
            "started_at": meta.get("started_at"),
            "ended_at": meta.get("ended_at"),
            "duration_ms": meta.get("duration_ms"),
            "token_usage": meta.get("token_usage") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "failure_reason": meta.get("failure_reason"),
        })
    runs.sort(key=lambda x: x.get("started_at") or 0, reverse=True)
    return runs

def _extract_last_step_index_from_logs(logs: List[str]) -> Optional[int]:
    try:
        if not logs:
            return None
        last = None
        for line in logs:
            m = re.search(r"\[Step\s+(\d+)\]", str(line))
            if m:
                last = int(m.group(1))
        if last is None:
            return None
        return max(0, last - 1)
    except Exception:
        return None

_FAILURE_DEFINITIONS = [
    {
        "category": "selector_not_found",
        "label": "元素定位失败",
        "severity": "high",
        "patterns": [
            r"waiting for locator",
            r"locator\(.+\)\.(click|fill|hover|check|uncheck|select_option|dblclick)",
            r"No node found for selector",
            r"Unable to find|not found",
        ],
        "suggestion": "优先检查 selector 是否失效；如果 selector 为空或页面结构变化，建议补充更具体的 intent 后重新运行自愈。",
    },
    {
        "category": "strict_mode",
        "label": "定位命中多个元素",
        "severity": "medium",
        "patterns": [r"strict mode violation", r"resolved to \d+ elements"],
        "suggestion": "当前定位不唯一。建议补充父级区域、按钮文案或 data-testid，让 selector 指向唯一元素。",
    },
    {
        "category": "element_obscured",
        "label": "元素被遮挡",
        "severity": "medium",
        "patterns": [r"intercepts pointer events", r"element is outside of the viewport", r"Element is not visible", r"not visible", r"receives pointer events"],
        "suggestion": "通常是弹窗、遮罩、Toast 或滚动位置导致。建议先关闭遮挡层，或在步骤前增加滚动/等待。",
    },
    {
        "category": "iframe",
        "label": "iframe/上下文问题",
        "severity": "medium",
        "patterns": [r"frame was detached", r"Frame was detached", r"Execution context was destroyed", r"Target closed", r"frame locator|iframe"],
        "suggestion": "目标元素可能在 iframe 或页面上下文已切换。建议确认是否需要 frame_locator，或等待页面稳定后再操作。",
    },
    {
        "category": "timeout",
        "label": "执行超时",
        "severity": "medium",
        "patterns": [r"Timeout(?:Error)?", r"timed out", r"Timeout \d+ms exceeded"],
        "suggestion": "页面响应或接口返回较慢。建议检查环境稳定性，必要时增加显式等待或拆分步骤。",
    },
    {
        "category": "assertion",
        "label": "断言失败",
        "severity": "high",
        "patterns": [r"AssertionError", r"assert .* failed", r"Expected .* to", r"expect\("],
        "suggestion": "页面已执行到断言阶段，但实际结果不符合预期。建议核对预期文案、URL 或业务数据。",
    },
    {
        "category": "navigation",
        "label": "页面导航失败",
        "severity": "high",
        "patterns": [r"net::ERR", r"Navigation timeout", r"page\.goto", r"ERR_CONNECTION", r"ERR_NAME_NOT_RESOLVED"],
        "suggestion": "起始地址或跳转页面不可达。建议检查环境地址、网络、登录态或 base_url 配置。",
    },
    {
        "category": "data_binding",
        "label": "变量/数据绑定错误",
        "severity": "high",
        "patterns": [r"NameError: name '.+' is not defined", r"KeyError", r"缺少变量|placeholder|变量占位符"],
        "suggestion": "用例中引用的变量没有被正确传入。建议检查 variables/dataset 是否包含对应字段。",
    },
    {
        "category": "python_exception",
        "label": "脚本执行异常",
        "severity": "high",
        "patterns": [r"Traceback \(most recent call last\)", r"TypeError", r"ValueError", r"ImportError", r"ModuleNotFoundError"],
        "suggestion": "执行脚本自身出现异常。建议查看日志尾部错误栈，确认步骤类型、依赖或生成脚本是否异常。",
    },
]

def _pick_failure_line(lines: List[str], patterns: List[str]) -> Optional[str]:
    compiled = [re.compile(p, re.I) for p in patterns]
    for line in reversed(lines):
        text = str(line)
        for rx in compiled:
            if rx.search(text):
                return text
    return None

def _infer_failure_reason(logs: List[str]) -> Dict[str, Any]:
    tail = [str(x) for x in (logs or []) if str(x or "").strip()]
    tail = tail[-160:]
    failed_step_index = _extract_last_step_index_from_logs(tail)
    failed_step_no = failed_step_index + 1 if failed_step_index is not None else None
    for definition in _FAILURE_DEFINITIONS:
        line = _pick_failure_line(tail, definition["patterns"])
        if line:
            return {
                "category": definition["category"],
                "label": definition["label"],
                "severity": definition["severity"],
                "message": line,
                "failed_step_index": failed_step_index,
                "failed_step_no": failed_step_no,
                "suggestion": definition["suggestion"],
            }
    return {
        "category": "unknown",
        "label": "未知失败",
        "severity": "low",
        "message": tail[-1] if tail else "",
        "failed_step_index": failed_step_index,
        "failed_step_no": failed_step_no,
        "suggestion": "暂未识别出明确失败类型。建议查看日志尾部，并结合最后一张截图判断页面状态。",
    }

def _normalize_failure_reason(reason: Any, logs: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    if not reason and logs:
        return _infer_failure_reason(logs)
    if not isinstance(reason, dict):
        return None
    category = str(reason.get("category") or "unknown")
    definition = next((d for d in _FAILURE_DEFINITIONS if d["category"] == category), None)
    normalized = dict(reason)
    if definition:
        normalized.setdefault("label", definition["label"])
        normalized.setdefault("severity", definition["severity"])
        normalized.setdefault("suggestion", definition["suggestion"])
    else:
        normalized.setdefault("label", "未知失败")
        normalized.setdefault("severity", "low")
        normalized.setdefault("suggestion", "暂未识别出明确失败类型。建议查看日志尾部，并结合最后一张截图判断页面状态。")
    if "failed_step_index" not in normalized:
        step_idx = _extract_last_step_index_from_logs(logs or [])
        normalized["failed_step_index"] = step_idx
        normalized["failed_step_no"] = step_idx + 1 if step_idx is not None else None
    if "failed_step_no" not in normalized and normalized.get("failed_step_index") is not None:
        normalized["failed_step_no"] = int(normalized["failed_step_index"]) + 1
    normalized.setdefault("message", "")
    return normalized

def _make_ai_fix_suggestion(run_meta: Dict[str, Any], case_doc: Dict[str, Any], force: bool = False) -> Dict[str, Any]:
    if not force and run_meta.get("ai_fix_suggestion"):
        return run_meta["ai_fix_suggestion"]

    _load_env()
    api_key = os.environ.get("OPENAI_API_KEY")
    api_base = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
    model_name = os.environ.get("OPENAI_MODEL_NAME", "gpt-4o-mini")
    if not api_key:
        return {
            "created_at": int(time.time()),
            "root_cause": "未配置 OpenAI API Key",
            "explanation": "请在设置中配置 OpenAI API Key 后重试。",
            "suggestions": [],
            "patched_steps": None,
        }

    logs = run_meta.get("logs") or []
    heal_events = run_meta.get("heal_events") or []
    step_idx = _extract_last_step_index_from_logs(logs)
    step = None
    if step_idx is not None:
        try:
            step = (case_doc.get("steps") or [])[step_idx]
        except Exception:
            step = None

    payload = {
        "run_id": run_meta.get("id"),
        "case_id": run_meta.get("case_id"),
        "status": run_meta.get("status"),
        "failed_step_index": step_idx,
        "failed_step": step,
        "last_heal_event": heal_events[-1] if heal_events else None,
        "log_tail": logs[-60:],
        "all_steps": case_doc.get("steps") or [],
    }

    system = (
        "你是资深自动化测试工程师。你要根据一次测试失败的上下文，输出“用例修复建议”。\n"
        "原则：\n"
        "1) 不要编造页面上不存在的元素或选择器；如果无法确定 selector，请明确建议“重新录制/补充 selector”。\n"
        "2) 如果发现步骤定义不完整（例如 input 缺少 value/selector、复合意图），要明确指出并给出可执行的改法。\n"
        "3) 输出必须是 JSON，且必须可被 json.loads 解析。\n"
        "4) 如果你能给出可直接应用的 patched_steps，请保证其结构与输入 steps 一致（list of step objects）。\n"
    )

    user = (
        "请分析下面的运行失败上下文，给出修复建议。\n"
        "输出 JSON 格式：\n"
        "{\n"
        "  \"root_cause\": \"...\",\n"
        "  \"explanation\": \"...\",\n"
        "  \"suggestions\": [\"...\"],\n"
        "  \"patched_steps\": [ ... ]\n"
        "}\n\n"
        f"运行上下文:\n{json.dumps(payload, ensure_ascii=False)}"
    )

    llm = create_chat_openai(model=model_name, api_key=api_key, base_url=api_base, temperature=0)
    resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    content = (resp.content or "").strip()
    token_usage = None
    try:
        if hasattr(resp, "response_metadata") and isinstance(resp.response_metadata, dict):
            token_usage = resp.response_metadata.get("token_usage")
    except Exception:
        token_usage = None
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
    try:
        obj = json.loads(content)
    except Exception:
        obj = {"root_cause": "AI 输出无法解析", "explanation": content, "suggestions": [], "patched_steps": None}

    suggestion = {
        "created_at": int(time.time()),
        "root_cause": obj.get("root_cause") or "",
        "explanation": obj.get("explanation") or "",
        "suggestions": obj.get("suggestions") or [],
        "patched_steps": obj.get("patched_steps"),
        "token_usage": token_usage,
        "model": model_name,
    }
    return suggestion

def _build_python_script(case: Dict[str, Any]) -> str:
    start_url = case.get("start_url")
    steps = case.get("steps") or []
    variables = case.get("variables") or {}
    dataset = case.get("dataset") or []
    if dataset:
        dataset = [{**variables, **row} for row in dataset]
    else:
        dataset = [variables]

    lines: List[str] = []
    lines.append("import os")
    lines.append("import re")
    lines.append("import sys")
    lines.append("import json")
    lines.append("from datetime import datetime")
    lines.append("import pytest")
    lines.append("from dotenv import load_dotenv")
    lines.append("")
    lines.append("sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), 'src')))")
    lines.append("load_dotenv()")
    lines.append("")
    lines.append("from ai_tester import PlaywrightDriver, AITesterAgent, SelfHealer")
    lines.append("")
    lines.append(f"dataset = {json.dumps(dataset, ensure_ascii=False)}")
    lines.append("")
    lines.append("@pytest.mark.parametrize('dataset_row', dataset)")
    lines.append("def test_recorded_flow(page, dataset_row):")
    lines.append("    driver = PlaywrightDriver(page)")
    lines.append("    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)")
    lines.append("    healer = SelfHealer(use_vision=True) if os.environ.get('OPENAI_API_KEY') else None")
    lines.append("")
    lines.append("    runtime_vars = {")
    lines.append("        'today_ymd': datetime.now().strftime('%y%m%d'),")
    lines.append("        'today_yyyyMMdd': datetime.now().strftime('%Y%m%d'),")
    lines.append("        'today_mmdd': datetime.now().strftime('%m%d'),")
    lines.append("    }")
    lines.append("    dataset_row = {**runtime_vars, **dataset_row}")
    lines.append("")
    lines.append("    def _replace_vars(text):")
    lines.append("        if not isinstance(text, str): return text")
    lines.append("        for k, v in dataset_row.items():")
    lines.append("            text = text.replace(f'${{{k}}}', str(v))")
    lines.append("        return text")
    lines.append("")
    lines.append("    driver.get_screenshot()")
    lines.append("")
    if start_url:
        safe_url = start_url.replace('"', "%22")
        lines.append(f'    resolved_url = _replace_vars("{safe_url}")')
        lines.append(f'    page.goto(resolved_url, wait_until="domcontentloaded", timeout=60000)')
        lines.append("    page.wait_for_timeout(1000)")
        lines.append("    driver.get_screenshot()")
        lines.append("")

    for idx, step in enumerate(steps):
        if step.get("disabled"):
            lines.append(f"    # Step {idx+1} is disabled")
            lines.append("")
            continue

        stype = step.get("type")
        selector = (step.get("selector") or "").replace('"', "'")
        value = step.get("value")
        intent = (step.get("intent") or f"Step {idx+1}").replace('"', "'")

        lines.append(f"    selector_{idx} = _replace_vars(\"{selector}\")")
        value_literal = json.dumps(value if value is not None else "")
        intent_literal = json.dumps(intent)
        lines.append(f"    step_value_{idx} = _replace_vars({value_literal})")
        lines.append(f"    step_intent_{idx} = _replace_vars({intent_literal})")
        if stype == "input":
            lines.append(f"    if not step_value_{idx}:")
            lines.append(f"        m = re.search(r\"输入\\s*[\\\"'“”](.+?)[\\\"'“”]\", step_intent_{idx})")
            lines.append(f"        if m:")
            lines.append(f"            step_value_{idx} = m.group(1)")
            lines.append(f"            print(f\"   💡 [Step {idx+1}] 检测到 input 步骤缺少 value，已从意图推断 value='{{step_value_{idx}}}'\", flush=True)")
            lines.append(f"        else:")
            lines.append(f"            raise Exception(\"步骤定义不完整：input 动作缺少 value（输入内容）。请在用例中补充 value，或将该步骤拆分为『先输入，再选择/点击』两步。\")")
            if "选择" in intent:
                lines.append(f"    print(f\"   💡 [Step {idx+1}] 建议：该意图包含“选择”，更稳的写法是拆分为 2 步：① 对搜索框输入『AI小车』② 点击下拉结果项（text=AI小车）。\", flush=True)")

        display_intent = intent if intent else "无意图"
        lines.append(f"    action_type_{idx} = {json.dumps(stype)}")
        lines.append(f"    action_show_{idx} = action_type_{idx}")
        lines.append(f"    if action_type_{idx} in ['input','wait','assert','hover','select_option','set_checked','press_key','scroll'] and step_value_{idx}:")
        lines.append(f"        action_show_{idx} = action_show_{idx} + f\"({{step_value_{idx}}})\"")

        lines.append(f"    print(f\"\\n▶️  [Step {idx+1}] 🎯 元素：'{{selector_{idx}}}' (意图: {display_intent})，动作：{{action_show_{idx}}}\", flush=True)")
        lines.append("    try:")
        lines.append("        current_page = driver.switch_to_latest_page()")
        if stype == "input":
            lines.append(f"        driver.perform_action(\"type\", f\"SELECTOR:{{selector_{idx}}}\", step_value_{idx})")
        elif stype == "wait":
            lines.append(f"        ms = int(step_value_{idx} or 1000) if str(step_value_{idx}).isdigit() else 1000")
            lines.append(f"        current_page.wait_for_timeout(ms)")
        elif stype == "assert":
            assert_type = step.get("assert_type") or "text"
            if assert_type == "text":
                lines.append("        try:")
                lines.append(f"            driver._get_locator(f'text=\"{{step_value_{idx}}}\"').wait_for(state='visible', timeout=3000)")
                lines.append("        except Exception:")
                lines.append(f"            assert step_value_{idx} in current_page.content(), f'断言失败: 页面不包含文本 \"{{step_value_{idx}}}\"'")
            elif assert_type == "url":
                lines.append(f"        assert step_value_{idx} in current_page.url, f'断言失败: URL 不包含 \"{{step_value_{idx}}}\"'")
            elif assert_type == "visible":
                lines.append(f"        driver._get_locator(selector_{idx}).wait_for(state='visible', timeout=3000)")
        elif stype in ["hover", "select_option", "set_checked", "double_click", "right_click", "press_key", "scroll", "click"]:
            lines.append(f"        driver.perform_action(\"{stype}\", f\"SELECTOR:{{selector_{idx}}}\", step_value_{idx})")
        else:
            lines.append(f"        driver.perform_action(\"click\", f\"SELECTOR:{{selector_{idx}}}\")")

        lines.append("        driver.get_screenshot()")
        lines.append(f"        print(f\"   ✅ [Step {idx+1}] 执行成功\", flush=True)")
        lines.append("    except Exception:")
        lines.append("        if healer is None:")
        lines.append("            raise")

        if stype == "assert" and step.get("assert_type") in ["text", "url"]:
            lines.append("        raise")
            lines.append("")
            continue

        lines.append(f"        print(f\"   🚑 [Step {idx+1}] 原选择器失效，正在触发 AI 自愈引擎...\", flush=True)")
        lines.append("        current_dom = agent.get_dom_tree_str()")
        lines.append("        screenshot = driver.get_screenshot()")
        lines.append(f"        new_id = healer.heal(selector_{idx}, step_intent_{idx}, current_dom, screenshot)")
        lines.append("        if new_id:")
        lines.append(f"            print(f\"   🧪 [Step {idx+1}] AI 已给出候选定位，开始尝试执行验证...\", flush=True)")
        lines.append("            try:")
        if stype == "input":
            lines.append(f"                driver.perform_action(\"type\", new_id, step_value_{idx})")
        elif stype == "wait":
            lines.append("                driver.perform_action(\"wait\", new_id)")
        elif stype == "assert" and step.get("assert_type") == "visible":
            lines.append("                new_sel = new_id.replace('SELECTOR:', '') if str(new_id).startswith('SELECTOR:') else f'[ai-id=\"{new_id}\"]'")
            lines.append("                driver.page.wait_for_selector(new_sel, state='visible', timeout=3000)")
        elif stype in ["hover", "select_option", "set_checked", "double_click", "right_click", "press_key", "scroll", "click"]:
            lines.append(f"                driver.perform_action(\"{stype}\", new_id, step_value_{idx})")
        else:
            lines.append("                driver.perform_action(\"click\", new_id)")
        lines.append(f"                print(f\"   ✨ [Step {idx+1}] AI 候选定位验证通过（执行成功）\", flush=True)")
        lines.append("                driver.get_screenshot()")
        lines.append("            except Exception as _heal_exec_err:")
        lines.append(f"                print(f\"   ❌ [Step {idx+1}] AI 候选定位执行失败：{{_heal_exec_err}}\", flush=True)")
        if stype == "input":
            lines.append(f"                print(f\"   💡 [Step {idx+1}] 可能原因：该步骤是 input 动作，但 AI 返回的候选并不是输入框，或用例本身缺少输入值。建议：补齐输入框 selector + value，或拆分为『输入 + 点击选择项』两步。\", flush=True)")
        else:
            lines.append(f"                print(f\"   💡 [Step {idx+1}] 可能原因：意图描述不够明确或页面结构变化较大。建议：补充更具体的意图/重新录制该步骤。\", flush=True)")
        lines.append("                raise")
        lines.append("        else:")
        lines.append(f"            print(f\"   ❌ [Step {idx+1}] AI 自愈失败\", flush=True)")
        lines.append(f"            raise Exception(\"AI 自愈失败，无法完成步骤 {idx + 1}\")")
        lines.append("")

    return "\n".join(lines) + "\n"

@app.post("/api/upload_script")
async def upload_script(request: Request):
    data = await request.json()
    script_content = data.get("script")
    name = data.get("name", f"test_record_{int(time.time())}.py")

    if not name.endswith(".py"):
        name += ".py"
    file_path = _safe_script_path(name)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(str(script_content or ""))

    return JSONResponse({"status": "success", "file": os.path.basename(file_path)})

app.include_router(create_suites_router(SuiteRouteDeps(
    session_factory=SessionLocal,
    suite_model=SuiteModel,
    stable_suite_id=_stable_suite_id,
    list_suites=_list_suites,
    list_suite_runs=lambda suite_id: _list_suite_runs(suite_id=suite_id),
    normalize_suite_case_ids=_normalize_suite_case_ids,
    validate_suite_case_refs=_validate_suite_case_refs,
    suite_run_dir=_suite_run_dir,
)))

_PLACEHOLDER_RE = re.compile(r"\$\{([^}]+)\}")
_BUILTIN_PLACEHOLDERS = {"today_ymd", "today_yyyyMMdd", "today_mmdd"}

def _extract_placeholders(val: Any) -> List[str]:
    if not isinstance(val, str) or "${" not in val:
        return []
    out: List[str] = []
    for m in _PLACEHOLDER_RE.finditer(val):
        k = (m.group(1) or "").strip()
        if k:
            out.append(k)
    return out

def _collect_case_placeholders(case_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    locs: List[Dict[str, Any]] = []
    for k in _extract_placeholders(case_doc.get("start_url")):
        locs.append({"key": k, "field": "start_url"})
    steps = case_doc.get("steps") or []
    if isinstance(steps, list):
        for i, st in enumerate(steps):
            if not isinstance(st, dict):
                continue
            for field in ("selector", "value", "intent", "url"):
                for k in _extract_placeholders(st.get(field)):
                    locs.append({"key": k, "field": field, "step_index": i})
    return locs

def _validate_case_placeholders_or_raise(case_doc: Dict[str, Any]) -> None:
    variables = case_doc.get("variables") or {}
    if variables is None:
        variables = {}
    if not isinstance(variables, dict):
        raise HTTPException(status_code=400, detail={"error": "variables 必须是 JSON 对象"})

    dataset = case_doc.get("dataset") or []
    if dataset is None:
        dataset = []
    if not isinstance(dataset, list):
        raise HTTPException(status_code=400, detail={"error": "dataset 必须是 JSON 数组"})
    bad_rows = [i for i, row in enumerate(dataset) if not isinstance(row, dict)]
    if bad_rows:
        raise HTTPException(status_code=400, detail={"error": "dataset 每一行必须是 JSON 对象", "bad_rows": bad_rows[:20]})

    locs = _collect_case_placeholders(case_doc)
    if not locs:
        return
    keys = sorted({x["key"] for x in locs if x["key"] not in _BUILTIN_PLACEHOLDERS})
    if not keys:
        return
    missing: List[Dict[str, Any]] = []
    if len(dataset) == 0:
        for k in keys:
            if k not in variables:
                missing.append({"key": k})
    else:
        for row_idx, row in enumerate(dataset):
            merged = {**variables, **row}
            for k in keys:
                if k not in merged:
                    missing.append({"row": row_idx, "key": k})
                    if len(missing) >= 200:
                        break
            if len(missing) >= 200:
                break
    if missing:
        raise HTTPException(status_code=400, detail={
            "error": "数据集中缺少用例所需的变量",
            "placeholders": keys,
            "missing": missing,
            "locations": locs[:50],
        })

def _step_key(step: Any) -> str:
    if not isinstance(step, dict):
        return ""
    return "|".join([
        str(step.get("type") or ""),
        str(step.get("selector") or ""),
        str(step.get("value") or ""),
        str(step.get("assert_type") or ""),
    ])

def _is_short_wait_step(step: Any) -> bool:
    if not isinstance(step, dict) or step.get("type") != "wait":
        return False
    try:
        return int(str(step.get("value") or "0")) < 300
    except Exception:
        return False

def _merge_step_meta(step: Dict[str, Any], rules: List[str]) -> Dict[str, Any]:
    next_step = dict(step)
    meta = next_step.get("meta") if isinstance(next_step.get("meta"), dict) else {}
    existing = meta.get("normalized_rules") if isinstance(meta.get("normalized_rules"), list) else []
    meta["normalized"] = True
    meta["normalized_rules"] = sorted(set([*existing, *rules]))
    next_step["meta"] = meta
    return next_step

def _normalize_recorded_steps(steps: Any) -> Dict[str, Any]:
    if not isinstance(steps, list):
        return {"steps": [], "summary": {"original_count": 0, "normalized_count": 0, "removed_count": 0, "rules": []}}

    cleaned: List[Dict[str, Any]] = []
    rules_used = set()
    removed_count = 0

    for raw in steps:
        if not isinstance(raw, dict):
            removed_count += 1
            rules_used.add("drop_invalid_step")
            continue
        step = dict(raw)
        step_type = step.get("type")

        if _is_short_wait_step(step):
            removed_count += 1
            rules_used.add("drop_short_wait")
            continue

        if cleaned:
            prev = cleaned[-1]
            same_selector = (prev.get("selector") or "") == (step.get("selector") or "")
            same_url = (prev.get("url") or "") == (step.get("url") or "")

            if step_type == "input" and prev.get("type") == "input" and same_selector:
                merged = _merge_step_meta(step, ["merge_consecutive_input"])
                cleaned[-1] = merged
                rules_used.add("merge_consecutive_input")
                removed_count += 1
                continue

            if step_type == "click" and prev.get("type") == "click" and _step_key(prev) == _step_key(step):
                cleaned[-1] = _merge_step_meta(prev, ["drop_duplicate_click"])
                rules_used.add("drop_duplicate_click")
                removed_count += 1
                continue

            if step_type == "wait" and prev.get("type") == "wait":
                try:
                    prev_value = int(str(prev.get("value") or "0"))
                    next_value = int(str(step.get("value") or "0"))
                    merged_wait = dict(prev)
                    merged_wait["value"] = str(max(prev_value, next_value))
                    cleaned[-1] = _merge_step_meta(merged_wait, ["merge_consecutive_wait"])
                    rules_used.add("merge_consecutive_wait")
                    removed_count += 1
                    continue
                except Exception:
                    pass

            if step_type == "assert" and step.get("assert_type") == "url" and prev.get("type") == "assert" and prev.get("assert_type") == "url" and prev.get("value") == step.get("value"):
                cleaned[-1] = _merge_step_meta(prev, ["drop_duplicate_url_assert"])
                rules_used.add("drop_duplicate_url_assert")
                removed_count += 1
                continue

            if step_type == "wait" and prev.get("type") == "assert" and prev.get("assert_type") == "url" and same_url:
                removed_count += 1
                rules_used.add("drop_wait_after_url_assert")
                continue

        cleaned.append(step)

    for idx in range(1, len(cleaned)):
        prev = cleaned[idx - 1]
        step = cleaned[idx]
        if prev.get("type") == "wait" and step.get("type") == "assert" and step.get("assert_type") == "url" and (prev.get("url") or "") == (step.get("url") or ""):
            cleaned[idx - 1] = _merge_step_meta(prev, ["normalize_spa_navigation_wait"])
            cleaned[idx] = _merge_step_meta(step, ["normalize_spa_navigation_assert"])
            rules_used.add("normalize_spa_navigation")

    return {
        "steps": cleaned,
    "summary": {
            "original_count": len(steps),
            "normalized_count": len(cleaned),
            "removed_count": removed_count,
            "rules": sorted(rules_used),
        }
    }

app.include_router(create_case_generation_router(CaseGenerationRouteDeps(
    session_factory=SessionLocal,
    case_model=CaseModel,
    prompts_dir=lambda: PROMPTS_DIR,
    load_env=_load_env,
    stable_case_id=_stable_case_id,
    validate_case_placeholders=_validate_case_placeholders_or_raise,
)))

app.include_router(create_cases_router(CasesRouteDeps(
    session_factory=SessionLocal,
    case_model=CaseModel,
    list_cases=_list_cases,
    stable_case_id=_stable_case_id,
    safe_case_name=_safe_case_name,
    case_doc_from_model=_case_doc_from_model,
    write_case_backup_file=_write_case_backup_file,
    case_path=_case_path,
    remove_case_from_suites=_remove_case_from_suites,
    validate_case_placeholders=_validate_case_placeholders_or_raise,
    build_python_script=_build_python_script,
    normalize_recorded_steps=_normalize_recorded_steps,
)))

app.include_router(create_runs_router(RunsRouteDeps(
    session_factory=SessionLocal,
    case_model=CaseModel,
    list_runs=_list_runs,
    run_meta_path=_run_meta_path,
    migrate_run_meta=_migrate_run_meta,
    make_ai_fix_suggestion=_make_ai_fix_suggestion,
    run_dir=_run_dir,
    runs_dir=lambda: RUNS_DIR,
)))

@app.get("/api/suite_runs")
async def get_suite_runs(suite_id: Optional[str] = None):
    return JSONResponse(_list_suite_runs(suite_id=suite_id))

@app.get("/api/suite_runs/{suite_run_id}")
async def get_suite_run_detail(suite_run_id: str):
    meta_path = _suite_run_meta_path(suite_run_id)
    if not os.path.exists(meta_path):
        return JSONResponse({"error": "Suite run not found"}, status_code=404)
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    meta = _migrate_suite_run_meta(meta, meta_path)
    return JSONResponse(meta)

@app.delete("/api/suite_runs/{suite_run_id}")
async def delete_suite_run(suite_run_id: str):
    d = _suite_run_dir(suite_run_id)
    if not os.path.exists(d):
        return JSONResponse({"error": "Suite run not found"}, status_code=404)
    import shutil
    shutil.rmtree(d, ignore_errors=True)
    return JSONResponse({"status": "success"})

@app.post("/api/suites/{suite_id}/run")
async def run_suite(suite_id: str, env_id: Optional[str] = None):
    db = SessionLocal()
    try:
        suite_model = db.query(SuiteModel).filter_by(id=suite_id).first()
        if not suite_model:
            return JSONResponse({"error": "Suite not found"}, status_code=404)
        suite = _suite_doc_from_model(suite_model)
        setup_case_id = str(suite.get("setup_case_id") or "").strip() or None
        raw_case_ids = suite.get("case_ids") or []
        case_ids = _normalize_suite_case_ids(raw_case_ids, setup_case_id)
        missing = _validate_suite_case_refs(db, case_ids, setup_case_id)
        if missing:
            return JSONResponse({"error": "Suite contains missing cases", "missing_case_ids": missing}, status_code=400)
    finally:
        db.close()

    suite_run_id = f"suite_run_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    resolved_env_id = env_id if env_id is not None else suite.get("env_id")
    display_case_ids = ([setup_case_id] if setup_case_id else []) + case_ids
    suite_meta = {
        "id": suite_run_id,
        "suite_id": suite.get("id") or suite_id,
        "suite_name": suite.get("name") or suite_id,
        "env_id": resolved_env_id,
        "status": RUN_STATUS_RUNNING,
        "started_at": int(time.time()),
        "ended_at": None,
        "duration_ms": None,
        "setup_case_id": setup_case_id,
        "case_ids": display_case_ids,
        "current_index": None,
        "current_case_id": None,
        "items": [],
        "summary": {"total": len(display_case_ids), "passed": 0, "failed": 0, "heal_total": 0},
    }
    os.makedirs(_suite_run_dir(suite_run_id), exist_ok=True)
    with open(_suite_run_meta_path(suite_run_id), "w", encoding="utf-8") as f:
        json.dump(suite_meta, f, ensure_ascii=False, indent=2)

    storage_state_path = os.path.join(_suite_run_dir(suite_run_id), "storage_state.json")
    asyncio.create_task(_run_suite_worker(suite_run_id, display_case_ids, resolved_env_id, storage_state_path=storage_state_path, setup_case_id=setup_case_id))
    return JSONResponse({"status": "starting", "suite_run_id": suite_run_id})

def _suite_runner_deps() -> SuiteRunnerDeps:
    return SuiteRunnerDeps(
        run_meta_path=_run_meta_path,
        suite_run_meta_path=_suite_run_meta_path,
        start_run=_start_run,
    )

async def _wait_run_finished(run_id: str) -> Dict[str, Any]:
    return await wait_run_finished(_suite_runner_deps(), run_id)

async def _run_suite_worker(suite_run_id: str, case_ids: List[str], env_id: Optional[str], storage_state_path: str, setup_case_id: Optional[str]) -> None:
    await run_suite_worker(_suite_runner_deps(), suite_run_id, case_ids, env_id, storage_state_path, setup_case_id)

@app.get("/api/runs/{run_id}/screenshots/{filename}")
async def get_run_screenshot(run_id: str, filename: str):
    filename = (filename or "").replace("/", "_").replace("\\", "_").replace("..", "_")
    p = os.path.join(_run_dir(run_id), "screenshots", filename)
    if not os.path.exists(p):
        return JSONResponse({"error": "Screenshot not found"}, status_code=404)
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return JSONResponse({"data": b64})

@app.post("/api/internal/push_heal_event/{session_id}")
async def push_heal_event(session_id: str, request: Request):
    data = await request.json()
    run_meta = active_runs.get(session_id)
    if run_meta is None:
        return JSONResponse({"status": "ignored"})

    ts_ms = int(time.time() * 1000)
    before_file = None
    try:
        if run_meta.get("screenshots"):
            before_file = run_meta["screenshots"][-1]["file"]
    except Exception:
        before_file = None

    evt = {
        "ts": ts_ms,
        "intent": data.get("intent"),
        "original_selector": data.get("original_selector"),
        "new_id": data.get("new_id"),
        "new_selector": data.get("new_selector"),
        "reason": data.get("reason"),
        "success": bool(data.get("success", False)),
        "source": data.get("source"),
        "token_usage": data.get("token_usage"),
        "model": data.get("model"),
        "before_file": before_file,
        "after_file": None,
    }
    run_meta.setdefault("heal_events", []).append(evt)
    try:
        with open(_run_meta_path(session_id), "w", encoding="utf-8") as f:
            json.dump(run_meta, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    ws = active_sessions.get(session_id)
    if ws:
        try:
            await ws.send_json({"type": "heal_event", "event": evt})
        except Exception:
            pass
    return JSONResponse({"status": "ok"})

@app.get("/api/script/{name}")
async def get_script(name: str):
    file_path = _safe_script_path(name)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    return JSONResponse({"error": "File not found"}, status_code=404)

@app.post("/api/run/{name}")
async def run_script(name: str, env_id: Optional[str] = None):
    result = await _start_run(name=name, env_id=env_id, wait_for_ws=True)
    return JSONResponse({"status": "starting", "session_id": result["session_id"], "run_id": result["run_id"]})

def _runner_deps() -> RunnerDeps:
    return RunnerDeps(
        project_root=PROJECT_ROOT,
        scripts_dir=SCRIPTS_DIR,
        envs_file=ENVS_FILE,
        internal_token=INTERNAL_TOKEN,
        session_factory=SessionLocal,
        case_model=CaseModel,
        build_python_script=_build_python_script,
        validate_case_placeholders=_validate_case_placeholders_or_raise,
        safe_script_path=_safe_script_path,
        run_dir=_run_dir,
        run_meta_path=_run_meta_path,
        load_env=_load_env,
        infer_failure_reason=_infer_failure_reason,
    )

async def _start_run(name: str, env_id: Optional[str], wait_for_ws: bool, extra_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    return await start_run(_runner_deps(), name=name, env_id=env_id, wait_for_ws=wait_for_ws, extra_env=extra_env)

async def run_pytest_worker(session_id: str, script_path: str, cleanup_path: Optional[str] = None, wait_for_ws: bool = True, extra_env: Optional[Dict[str, str]] = None):
    try:
        from web_server.runner import run_pytest_worker as _run_pytest_worker_impl
    except Exception:
        from runner import run_pytest_worker as _run_pytest_worker_impl
    await _run_pytest_worker_impl(_runner_deps(), session_id, script_path, cleanup_path, wait_for_ws=wait_for_ws, extra_env=extra_env)


@app.websocket("/ws/run/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    token = (websocket.query_params.get("token") or "").strip()
    if not _is_valid_token(token):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    active_sessions[session_id] = websocket
    try:
        run_meta = active_runs.get(session_id)
        if run_meta:
            for log in run_meta.get("logs", []):
                try:
                    await websocket.send_json({"type": "log", "message": log})
                except:
                    pass
            screenshots = run_meta.get("screenshots", [])
            if screenshots:
                last_shot = screenshots[-1]["file"]
                shot_path = os.path.join(_run_dir(session_id), "screenshots", last_shot)
                if os.path.exists(shot_path):
                    with open(shot_path, "rb") as f:
                        b64 = base64.b64encode(f.read()).decode("utf-8")
                        try:
                            await websocket.send_json({"type": "screenshot", "data": b64})
                        except:
                            pass
        while True:
            # 接收从底层 driver 发过来的截图或结构化日志 (MVP 中，可以开放一个内部 HTTP 接口供底层调)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        if session_id in active_sessions:
            del active_sessions[session_id]

# 提供一个内部接口供底层 Python Agent 发送截图
@app.post("/api/internal/push_screenshot/{session_id}")
async def push_screenshot(session_id: str, request: Request):
    data = await request.json()
    b64_img = data.get("image")
    ws = active_sessions.get(session_id)
    if ws and b64_img:
        await ws.send_json({"type": "screenshot", "data": b64_img})
    run_meta = active_runs.get(session_id)
    if run_meta is not None and b64_img:
        try:
            run_folder = _run_dir(session_id)
            shots_dir = os.path.join(run_folder, "screenshots")
            os.makedirs(shots_dir, exist_ok=True)
            filename = f"{int(time.time() * 1000)}.jpg"
            p = os.path.join(shots_dir, filename)
            with open(p, "wb") as f:
                f.write(base64.b64decode(b64_img))
            now_ms = int(time.time() * 1000)
            run_meta["screenshots"].append({"file": filename, "ts": now_ms})
            try:
                events = run_meta.get("heal_events") or []
                if events:
                    last_evt = events[-1]
                    if last_evt and last_evt.get("after_file") is None and now_ms - int(last_evt.get("ts") or 0) <= 60000:
                        last_evt["after_file"] = filename
            except Exception:
                pass
            with open(_run_meta_path(session_id), "w", encoding="utf-8") as f:
                json.dump(run_meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    return {"status": "ok"}

app.include_router(create_config_router(ConfigRouteDeps(
    get_project_root=lambda: PROJECT_ROOT,
    get_envs_file=lambda: ENVS_FILE,
    get_prompts_dir=lambda: PROMPTS_DIR,
    stable_env_id=_stable_env_id,
    safe_prompt_path=_safe_prompt_path,
    load_env=_load_env,
)))


# Serve frontend static files
frontend_dist = os.path.join(PROJECT_ROOT, "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
