import os
import time
import asyncio
import json
import uuid
import tempfile
import base64
import re
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# 存储活跃的 websocket 连接，用于向前端推送日志
active_sessions = {}
active_runs: Dict[str, Dict[str, Any]] = {}

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

def _list_cases() -> List[Dict[str, Any]]:
    cases: List[Dict[str, Any]] = []
    if os.path.exists(CASES_DIR):
        for f in os.listdir(CASES_DIR):
            if f.endswith(".json"):
                p = os.path.join(CASES_DIR, f)
                try:
                    with open(p, "r", encoding="utf-8") as fp:
                        doc = json.load(fp)
                except Exception:
                    continue
                cases.append({
                    "id": f, 
                    "name": doc.get("name") or f, 
                    "type": "json",
                    "tags": doc.get("tags") or [],
                    "updated_at": doc.get("updated_at") or doc.get("created_at") or 0
                })
    cases.sort(key=lambda x: x.get("updated_at") or 0, reverse=True)
    return cases

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

def _list_suites() -> List[Dict[str, Any]]:
    suites: List[Dict[str, Any]] = []
    if not os.path.exists(SUITES_DIR):
        return suites
    for f in os.listdir(SUITES_DIR):
        if not f.endswith(".json"):
            continue
        p = os.path.join(SUITES_DIR, f)
        try:
            with open(p, "r", encoding="utf-8") as fp:
                doc = json.load(fp)
        except Exception:
            continue
        suites.append({
            "id": f,
            "name": doc.get("name") or f,
            "env_id": doc.get("env_id"),
            "case_count": len(doc.get("case_ids") or []),
            "updated_at": doc.get("updated_at") or doc.get("created_at"),
        })
    suites.sort(key=lambda x: x.get("updated_at") or 0, reverse=True)
    return suites

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
        if case_id and meta.get("case_id") != case_id:
            continue
        runs.append({
            "id": meta.get("id") or d,
            "case_id": meta.get("case_id"),
            "status": meta.get("status"),
            "started_at": meta.get("started_at"),
            "ended_at": meta.get("ended_at"),
            "duration_ms": meta.get("duration_ms"),
            "token_usage": meta.get("token_usage") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
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

    llm = ChatOpenAI(model=model_name, api_key=api_key, base_url=api_base, temperature=0)
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

    lines: List[str] = []
    lines.append("import os")
    lines.append("import re")
    lines.append("import sys")
    lines.append("from dotenv import load_dotenv")
    lines.append("")
    lines.append("sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), 'src')))")
    lines.append("load_dotenv()")
    lines.append("")
    lines.append("from ai_tester import PlaywrightDriver, AITesterAgent, SelfHealer")
    lines.append("")
    lines.append("")
    lines.append("def test_recorded_flow(page):")
    lines.append("    driver = PlaywrightDriver(page)")
    lines.append("    agent = AITesterAgent(driver, use_vision=False, auto_vision=True)")
    lines.append("    healer = SelfHealer(use_vision=True) if os.environ.get('OPENAI_API_KEY') else None")
    lines.append("")
    lines.append("    driver.get_screenshot()")
    lines.append("")
    if start_url:
        safe_url = start_url.replace('"', "%22")
        lines.append(f'    page.goto("{safe_url}", wait_until="domcontentloaded", timeout=60000)')
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

        lines.append(f"    selector_{idx} = \"{selector}\"")
        value_literal = json.dumps(value if value is not None else "")
        intent_literal = json.dumps(intent)
        lines.append(f"    step_value_{idx} = {value_literal}")
        lines.append(f"    step_intent_{idx} = {intent_literal}")
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
        display_action = stype
        if stype in ["input", "wait", "assert", "hover", "select_option", "press_key", "scroll"] and value:
            display_action += f"({value})"

        lines.append(f"    print(f\"\\n▶️  [Step {idx+1}] 🎯 元素：'{{selector_{idx}}}' (意图: {display_intent})，动作：{display_action}\", flush=True)")
        lines.append("    try:")
        lines.append("        current_page = driver.switch_to_latest_page()")
        if stype == "input":
            lines.append(f"        driver.perform_action(\"type\", f\"SELECTOR:{{selector_{idx}}}\", step_value_{idx})")
        elif stype == "wait":
            ms = int(value or 1000)
            lines.append(f"        current_page.wait_for_timeout({ms})")
        elif stype == "assert":
            assert_type = step.get("assert_type") or "text"
            safe_val = (value or "").replace('\"', '\\\\\"')
            if assert_type == "text":
                lines.append("        try:")
                lines.append(f"            driver._get_locator('text=\"{safe_val}\"').wait_for(state='visible', timeout=3000)")
                lines.append("        except Exception:")
                lines.append(f"            assert \"{safe_val}\" in current_page.content(), '断言失败: 页面不包含文本 \"{safe_val}\"'")
            elif assert_type == "url":
                lines.append(f"        assert \"{safe_val}\" in current_page.url, '断言失败: URL 不包含 \"{safe_val}\"'")
            elif assert_type == "visible":
                lines.append(f"        driver._get_locator(selector_{idx}).wait_for(state='visible', timeout=3000)")
        elif stype in ["hover", "select_option", "double_click", "right_click", "press_key", "scroll", "click"]:
            safe_val = (value or "").replace('\"', '\\\\\"')
            lines.append(f"        driver.perform_action(\"{stype}\", f\"SELECTOR:{{selector_{idx}}}\", \"{safe_val}\")")
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
        elif stype in ["hover", "select_option", "double_click", "right_click", "press_key", "scroll", "click"]:
            safe_val = (value or "").replace('\"', '\\\\\"')
            lines.append(f"                driver.perform_action(\"{stype}\", new_id, \"{safe_val}\")")
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
        
    file_path = os.path.join(SCRIPTS_DIR, name)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(script_content)
        
    return JSONResponse({"status": "success", "file": name})

class GenerateCaseReq(BaseModel):
    name: str
    start_url: str
    instruction: str

@app.post("/api/cases/generate")
async def generate_case(req: GenerateCaseReq):
    _load_env()
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
            model_kwargs={"response_format": {"type": "json_object"}}
        )
        
        system_prompt = """你是一个自动化的测试用例生成专家。
请将用户的自然语言测试指令，转换为结构化的测试步骤 JSON 格式。
必须输出一个包含 `steps` 数组的纯 JSON 对象，格式要求如下：
{
  "steps": [
    {
      "type": "click", // 必须是 click, input, wait, assert 中的一种
      "selector": "", // 保持为空字符串，运行时将由AI自愈引擎动态寻找
      "value": "...", // 针对 input 填入输入值，针对 wait 填入等待的毫秒数，针对 assert 填入断言内容
      "intent": "...", // 极其重要：描述这个操作的意图，这是运行时找元素的唯一依据！例如："点击右上角的登录按钮"、"在用户名输入框输入账号"
      "assert_type": "text" // 如果 type 是 assert，此项必填：text(断言页面文本), url(断言URL包含), visible(断言元素可见)
    }
  ]
}
"""
        user_prompt = f"初始URL: {req.start_url}\n自然语言指令:\n{req.instruction}"
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = llm.invoke(messages)
        content = response.content
        token_usage = None
        try:
            if hasattr(response, "response_metadata") and isinstance(response.response_metadata, dict):
                token_usage = response.response_metadata.get("token_usage")
        except Exception:
            token_usage = None
        data = json.loads(content)
        
        # 构造用例结构
        case_id = f"demo_case_{int(time.time() * 1000)}"
        case_data = {
            "id": case_id,
            "name": req.name or "自然语言生成的用例",
            "type": "recorded",
            "start_url": req.start_url,
            "steps": data.get("steps", []),
            "llm_usage": {"token_usage": token_usage, "model": model_name},
        }
        
        case_path = os.path.join(CASES_DIR, f"{case_id}.json")
        with open(case_path, 'w', encoding='utf-8') as f:
            json.dump(case_data, f, ensure_ascii=False, indent=2)
            
        return {"status": "ok", "id": case_id, "token_usage": token_usage, "model": model_name}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/cases")
async def get_cases():
    return JSONResponse(_list_cases())

@app.get("/api/suites")
async def get_suites():
    return JSONResponse(_list_suites())

@app.post("/api/suites")
async def create_suite(request: Request):
    data = await request.json()
    name = str(data.get("name") or "").strip() or f"suite_{int(time.time())}"
    suite_id = _safe_suite_id(data.get("id") or name)
    env_id = data.get("env_id")
    setup_case_id = str(data.get("setup_case_id") or "").strip() or None
    raw_case_ids = data.get("case_ids") or []
    case_ids: List[str] = []
    seen = set()
    for cid in raw_case_ids:
        cid = str(cid or "").strip()
        if not cid or cid == setup_case_id or cid in seen:
            continue
        seen.add(cid)
        case_ids.append(cid)
    doc = {
        "id": f"{suite_id}.json" if not suite_id.endswith(".json") else suite_id,
        "name": name,
        "env_id": env_id,
        "setup_case_id": setup_case_id,
        "case_ids": case_ids,
        "created_at": int(time.time()),
        "updated_at": int(time.time()),
    }
    p = _suite_path(suite_id)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    return JSONResponse({"status": "success", "id": os.path.basename(p)})

@app.get("/api/suites/{suite_id}")
async def get_suite(suite_id: str):
    p = _suite_path(suite_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Suite not found"}, status_code=404)
    with open(p, "r", encoding="utf-8") as f:
        return JSONResponse(json.load(f))

@app.put("/api/suites/{suite_id}")
async def update_suite(suite_id: str, request: Request):
    p = _suite_path(suite_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Suite not found"}, status_code=404)
    data = await request.json()
    with open(p, "r", encoding="utf-8") as f:
        doc = json.load(f)
    name = str(data.get("name") or doc.get("name") or "").strip() or doc.get("name") or suite_id
    env_id = data.get("env_id", doc.get("env_id"))
    setup_case_id = str(data.get("setup_case_id", doc.get("setup_case_id") or "") or "").strip() or None
    raw_case_ids = data.get("case_ids", doc.get("case_ids") or [])
    case_ids: List[str] = []
    seen = set()
    for cid in raw_case_ids:
        cid = str(cid or "").strip()
        if not cid or cid == setup_case_id or cid in seen:
            continue
        seen.add(cid)
        case_ids.append(cid)
    doc["name"] = name
    doc["env_id"] = env_id
    doc["setup_case_id"] = setup_case_id
    doc["case_ids"] = case_ids
    doc["updated_at"] = int(time.time())
    with open(p, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    return JSONResponse({"status": "success"})

@app.delete("/api/suites/{suite_id}")
async def delete_suite(suite_id: str):
    p = _suite_path(suite_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Suite not found"}, status_code=404)
    os.unlink(p)
    return JSONResponse({"status": "success"})

@app.post("/api/cases")
async def create_case(request: Request):
    data = await request.json()
    name = _safe_case_name(data.get("name") or f"case_{int(time.time())}")
    steps = data.get("steps") or []
    start_url = data.get("start_url")
    meta = data.get("meta") or {}
    case: Dict[str, Any] = {
        "id": f"{name}.json",
        "name": name,
        "created_at": int(time.time()),
        "start_url": start_url,
        "steps": steps,
        "meta": meta,
    }
    p = _case_path(name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(case, f, ensure_ascii=False, indent=2)
    return JSONResponse({"status": "success", "id": os.path.basename(p)})

@app.get("/api/cases/{case_id}")
async def get_case(case_id: str):
    p = _case_path(case_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Case not found"}, status_code=404)
    with open(p, "r", encoding="utf-8") as f:
        return JSONResponse(json.load(f))

@app.put("/api/cases/{case_id}")
async def update_case(case_id: str, request: Request):
    p = _case_path(case_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Case not found"}, status_code=404)
    data = await request.json()
    with open(p, "r", encoding="utf-8") as f:
        case = json.load(f)
    case["start_url"] = data.get("start_url")
    case["steps"] = data.get("steps") or []
    if "tags" in data:
        case["tags"] = data.get("tags")
    case["updated_at"] = int(time.time())
    with open(p, "w", encoding="utf-8") as f:
        json.dump(case, f, ensure_ascii=False, indent=2)
    return JSONResponse({"status": "success"})

@app.post("/api/cases/{case_id}/rename")
async def rename_case(case_id: str, request: Request):
    old_path = _case_path(case_id)
    if not os.path.exists(old_path):
        return JSONResponse({"error": "Case not found"}, status_code=404)

    data = await request.json()
    raw_name = data.get("name")
    if not raw_name or not str(raw_name).strip():
        return JSONResponse({"error": "Missing name"}, status_code=400)

    safe_name = _safe_case_name(str(raw_name))
    if safe_name.endswith(".json"):
        safe_name = safe_name[:-5]
    new_filename = f"{safe_name}.json"
    new_path = os.path.join(CASES_DIR, new_filename)

    if os.path.exists(new_path) and os.path.abspath(new_path) != os.path.abspath(old_path):
        return JSONResponse({"error": "Target already exists"}, status_code=409)

    with open(old_path, "r", encoding="utf-8") as f:
        case = json.load(f)
    case["id"] = new_filename
    case["name"] = safe_name
    case["updated_at"] = int(time.time())

    if os.path.abspath(new_path) != os.path.abspath(old_path):
        os.replace(old_path, new_path)

    with open(new_path, "w", encoding="utf-8") as f:
        json.dump(case, f, ensure_ascii=False, indent=2)

    try:
        old_filename = os.path.basename(old_path)
        _update_suites_case_ref(old_filename, new_filename)
    except Exception:
        pass

    return JSONResponse({"status": "success", "case": {"id": new_filename, "name": new_filename, "type": "json"}})

@app.post("/api/cases/{case_id}/heal/approve")
async def approve_heal(case_id: str, request: Request):
    data = await request.json()
    old_selector = (data.get("old_selector") or "").strip()
    new_selector = (data.get("new_selector") or "").strip()
    step_intent = (data.get("step_intent") or "").strip()
    if not new_selector:
        return JSONResponse({"error": "Missing parameters"}, status_code=400)
        
    p = _case_path(case_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Case not found"}, status_code=404)
        
    with open(p, "r", encoding="utf-8") as f:
        case = json.load(f)

    already_updated = any((step.get("selector") or "") == new_selector for step in case.get("steps", []))
    updated = False
    steps = case.get("steps", []) or []
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
        case["updated_at"] = int(time.time())
        with open(p, "w", encoding="utf-8") as f:
            json.dump(case, f, ensure_ascii=False, indent=2)
        return JSONResponse({"status": "success", "message": "Selector updated"})
    if already_updated:
        return JSONResponse({"status": "success", "message": "Selector already updated"})
    return JSONResponse({"error": f"Selector '{old_selector}' not found in current case steps"}, status_code=404)

@app.delete("/api/cases/{case_id}")
async def delete_case(case_id: str):
    p = _case_path(case_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Case not found"}, status_code=404)
    os.unlink(p)
    return JSONResponse({"status": "success"})

@app.get("/api/cases/{case_id}/script")
async def get_case_script(case_id: str):
    p = _case_path(case_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Case not found"}, status_code=404)
    with open(p, "r", encoding="utf-8") as f:
        case = json.load(f)
    return JSONResponse({"content": _build_python_script(case)})

@app.get("/api/runs")
async def get_runs(case_id: Optional[str] = None):
    return JSONResponse(_list_runs(case_id=case_id))

@app.get("/api/runs/{run_id}")
async def get_run_detail(run_id: str):
    meta_path = _run_meta_path(run_id)
    if not os.path.exists(meta_path):
        return JSONResponse({"error": "Run not found"}, status_code=404)
    with open(meta_path, "r", encoding="utf-8") as f:
        return JSONResponse(json.load(f))

class RunFixSuggestReq(BaseModel):
    force: bool = False

@app.post("/api/runs/{run_id}/ai_fix_suggest")
async def ai_fix_suggest(run_id: str, req: RunFixSuggestReq):
    meta_path = _run_meta_path(run_id)
    if not os.path.exists(meta_path):
        return JSONResponse({"error": "Run not found"}, status_code=404)
    with open(meta_path, "r", encoding="utf-8") as f:
        run_meta = json.load(f)
    case_id = run_meta.get("case_id")
    if not case_id:
        return JSONResponse({"error": "Missing case_id"}, status_code=400)
    case_path = _case_path(case_id)
    if not os.path.exists(case_path):
        return JSONResponse({"error": "Case not found"}, status_code=404)
    with open(case_path, "r", encoding="utf-8") as f:
        case_doc = json.load(f)
    suggestion = _make_ai_fix_suggestion(run_meta, case_doc, force=bool(req.force))
    run_meta["ai_fix_suggestion"] = suggestion
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(run_meta, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return JSONResponse({"status": "ok", "suggestion": suggestion})

@app.delete("/api/runs/{run_id}")
async def delete_run(run_id: str):
    d = _run_dir(run_id)
    if not os.path.exists(d):
        return JSONResponse({"error": "Run not found"}, status_code=404)
    import shutil
    shutil.rmtree(d, ignore_errors=True)
    return JSONResponse({"status": "success"})

@app.get("/api/suite_runs")
async def get_suite_runs(suite_id: Optional[str] = None):
    return JSONResponse(_list_suite_runs(suite_id=suite_id))

@app.get("/api/suite_runs/{suite_run_id}")
async def get_suite_run_detail(suite_run_id: str):
    meta_path = _suite_run_meta_path(suite_run_id)
    if not os.path.exists(meta_path):
        return JSONResponse({"error": "Suite run not found"}, status_code=404)
    with open(meta_path, "r", encoding="utf-8") as f:
        return JSONResponse(json.load(f))

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
    p = _suite_path(suite_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "Suite not found"}, status_code=404)
    with open(p, "r", encoding="utf-8") as f:
        suite = json.load(f)

    suite_run_id = f"suite_run_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    resolved_env_id = env_id if env_id is not None else suite.get("env_id")
    setup_case_id = str(suite.get("setup_case_id") or "").strip() or None
    raw_case_ids = suite.get("case_ids") or []
    case_ids = [str(x).strip() for x in raw_case_ids if str(x or "").strip() and str(x).strip() != setup_case_id]
    display_case_ids = ([setup_case_id] if setup_case_id else []) + case_ids
    suite_meta = {
        "id": suite_run_id,
        "suite_id": os.path.basename(p),
        "suite_name": suite.get("name") or os.path.basename(p),
        "env_id": resolved_env_id,
        "status": "running",
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

async def _wait_run_finished(run_id: str) -> Dict[str, Any]:
    meta_path = _run_meta_path(run_id)
    for _ in range(7200):
        try:
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if meta.get("status") in ("completed", "failed"):
                    return meta
        except Exception:
            pass
        await asyncio.sleep(0.25)
    try:
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {"id": run_id, "status": "failed", "duration_ms": None, "heal_events": []}

async def _run_suite_worker(suite_run_id: str, case_ids: List[str], env_id: Optional[str], storage_state_path: str, setup_case_id: Optional[str]) -> None:
    meta_path = _suite_run_meta_path(suite_run_id)
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
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(suite_meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        try:
            run_info = await _start_run(name=case_id, env_id=env_id, wait_for_ws=False, extra_env=extra_env)
            run_id = run_info["run_id"]
            item = {"case_id": case_id, "run_id": run_id, "status": "running", "duration_ms": None, "heal_count": None}
            items.append(item)
            suite_meta["items"] = items
            try:
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(suite_meta, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            run_meta = await _wait_run_finished(run_id)
        except Exception:
            run_id = f"run_failed_{uuid.uuid4().hex[:8]}"
            run_meta = {"id": run_id, "status": "failed", "duration_ms": None, "heal_events": []}
            items.append({"case_id": case_id, "run_id": run_id, "status": "failed", "duration_ms": None, "heal_count": 0})

        status = run_meta.get("status") or "failed"
        duration_ms = run_meta.get("duration_ms")
        heal_count = len(run_meta.get("heal_events") or [])
        token_usage = run_meta.get("token_usage") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        token_prompt_total += int(token_usage.get("prompt_tokens", 0) or 0)
        token_completion_total += int(token_usage.get("completion_tokens", 0) or 0)
        token_total += int(token_usage.get("total_tokens", 0) or 0)
        heal_total += heal_count
        if status == "completed":
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
        suite_meta["summary"] = {
            "total": len(case_ids),
            "passed": passed,
            "failed": failed,
            "heal_total": heal_total,
            "token_prompt": token_prompt_total,
            "token_completion": token_completion_total,
            "token_total": token_total,
        }
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(suite_meta, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        if setup_case_id and case_id == setup_case_id and status != "completed":
            suite_meta["status"] = "failed"
            suite_meta["ended_at"] = int(time.time())
            suite_meta["duration_ms"] = int((time.time() - started_ts) * 1000)
            suite_meta["current_index"] = None
            suite_meta["current_case_id"] = None
            try:
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(suite_meta, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            return

    suite_meta["status"] = "completed"
    suite_meta["ended_at"] = int(time.time())
    suite_meta["duration_ms"] = int((time.time() - started_ts) * 1000)
    suite_meta["current_index"] = None
    suite_meta["current_case_id"] = None
    suite_meta["items"] = items
    suite_meta["summary"] = {
        "total": len(case_ids),
        "passed": passed,
        "failed": failed,
        "heal_total": heal_total,
        "token_prompt": token_prompt_total,
        "token_completion": token_completion_total,
        "token_total": token_total,
    }
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(suite_meta, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

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
    file_path = os.path.join(SCRIPTS_DIR, name)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    return JSONResponse({"error": "File not found"}, status_code=404)

@app.post("/api/run/{name}")
async def run_script(name: str, env_id: Optional[str] = None):
    result = await _start_run(name=name, env_id=env_id, wait_for_ws=True)
    return JSONResponse({"status": "starting", "session_id": result["session_id"], "run_id": result["run_id"]})

async def _start_run(name: str, env_id: Optional[str], wait_for_ws: bool, extra_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    json_path = _case_path(name)
    file_path = os.path.join(SCRIPTS_DIR, name)
    resolved_script_path: Optional[str] = None
    temp_file: Optional[tempfile.NamedTemporaryFile] = None
    case_id: Optional[str] = None

    base_url_override = None
    if env_id and os.path.exists(ENVS_FILE):
        with open(ENVS_FILE, "r", encoding="utf-8") as f:
            envs = json.load(f)
            for e in envs:
                if e.get("id") == env_id:
                    base_url_override = e.get("base_url")
                    break

    if os.path.exists(json_path):
        case_id = os.path.basename(json_path)
        with open(json_path, "r", encoding="utf-8") as f:
            case = json.load(f)
            
        if base_url_override and case.get("start_url"):
            su = case["start_url"]
            if su.startswith("/"):
                case["start_url"] = base_url_override.rstrip("/") + su
            else:
                # If it's absolute but we want to override domain, simple replace:
                # for MVP, just replace if they chose an environment
                from urllib.parse import urlparse
                parsed_base = urlparse(base_url_override)
                parsed_su = urlparse(su)
                if parsed_base.scheme and parsed_base.netloc:
                    case["start_url"] = parsed_su._replace(scheme=parsed_base.scheme, netloc=parsed_base.netloc).geturl()
                    
        script_content = _build_python_script(case)
        os.makedirs(SCRIPTS_DIR, exist_ok=True)
        temp_file = tempfile.NamedTemporaryFile(dir=SCRIPTS_DIR, mode="w", suffix=".py", prefix="test_case_", delete=False, encoding="utf-8")
        temp_file.write(script_content)
        temp_file.flush()
        resolved_script_path = temp_file.name
    elif os.path.exists(file_path):
        resolved_script_path = file_path
    else:
        raise FileNotFoundError("File not found")

    run_id = f"run_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    session_id = run_id

    run_folder = _run_dir(run_id)
    os.makedirs(os.path.join(run_folder, "screenshots"), exist_ok=True)
    meta = {
        "id": run_id,
        "case_id": case_id or name,
        "status": "running",
        "started_at": int(time.time()),
        "ended_at": None,
        "duration_ms": None,
        "logs": [],
        "screenshots": [],
        "heal_events": [],
        "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
    active_runs[run_id] = meta
    with open(_run_meta_path(run_id), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    
    # 异步启动 pytest 进程
    asyncio.create_task(run_pytest_worker(session_id, resolved_script_path, temp_file.name if temp_file else None, wait_for_ws=wait_for_ws, extra_env=extra_env))
    return {"run_id": run_id, "session_id": session_id}

async def run_pytest_worker(session_id: str, script_path: str, cleanup_path: Optional[str] = None, wait_for_ws: bool = True, extra_env: Optional[Dict[str, str]] = None):
    if wait_for_ws:
        for _ in range(50):
            if session_id in active_sessions:
                break
            await asyncio.sleep(0.1)
    ws = active_sessions.get(session_id)
    _load_env()
    
    # 设置环境变量，让底层的 agent.py 和 driver.py 知道要往哪个 WS 发送截图和日志
    # 为了 MVP 演示，我们直接劫持 stdout，并通过截屏插件推送
    env = os.environ.copy()
    env["PLAYWRIGHT_HEADLESS"] = "1"
    env["AI_TESTER_WS_SESSION"] = session_id
    env["AI_TESTER_WS_PORT"] = "8000"
    env["AI_TESTER_RUN_HISTORY_DIR"] = _run_dir(session_id)
    env["PYTHONPATH"] = os.pathsep.join(
        [os.path.join(PROJECT_ROOT, "src"), env.get("PYTHONPATH", "")]
    ).strip(os.pathsep)
    if os.environ.get("OPENAI_API_KEY") and not env.get("OPENAI_API_KEY"):
        env["OPENAI_API_KEY"] = os.environ["OPENAI_API_KEY"]
    if extra_env:
        for k, v in extra_env.items():
            if v is None:
                continue
            env[str(k)] = str(v)
    
    if ws:
        await ws.send_json({"type": "log", "message": f"🚀 开始执行用例: {os.path.basename(script_path)}"})
        if not env.get("OPENAI_API_KEY"):
            await ws.send_json({"type": "log", "message": "⚠️ 未检测到 OPENAI_API_KEY，本次运行将禁用 AI 自愈，仅按录制的 selector 执行。"})
    run_meta = active_runs.get(session_id)
    
    try:
        process = await asyncio.create_subprocess_exec(
            "pytest", "-q", "-s", "--tb=short", "--disable-warnings", script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
            cwd=PROJECT_ROOT
        )
        
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            
            decoded_line = line.decode('utf-8').rstrip()
            if not decoded_line:
                continue
                
            # 过滤掉 pytest 烦人的干扰日志
            if decoded_line.startswith("=========================") or decoded_line.startswith("-------------------------"):
                continue
            if decoded_line.startswith("collected ") or "passed in " in decoded_line or "warnings summary" in decoded_line or "test_case_" in decoded_line:
                continue
            if "short test summary info" in decoded_line or "FAILED tests/" in decoded_line or "PASSED tests/" in decoded_line:
                continue
                
            current_ws = active_sessions.get(session_id)
            if current_ws:
                try:
                    await current_ws.send_json({"type": "log", "message": decoded_line})
                except Exception:
                    pass
            if run_meta is not None:
                run_meta["logs"].append(decoded_line)
                
        await process.wait()
        
        current_ws = active_sessions.get(session_id)
        if current_ws:
            status = "completed" if process.returncode == 0 else "failed"
            try:
                await current_ws.send_json({"type": "status", "status": status})
            except Exception:
                pass
        if run_meta is not None:
            run_meta["status"] = "completed" if process.returncode == 0 else "failed"
            run_meta["ended_at"] = int(time.time())
            if run_meta.get("started_at"):
                run_meta["duration_ms"] = (run_meta["ended_at"] - run_meta["started_at"]) * 1000
            try:
                token_path = os.path.join(_run_dir(session_id), "token_usage.json")
                if os.path.exists(token_path):
                    with open(token_path, "r", encoding="utf-8") as f:
                        token_summary = json.load(f)
                    run_meta["token_usage"] = token_summary.get("totals") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    run_meta["token_summary"] = token_summary
            except Exception:
                pass
            
    except Exception as e:
        current_ws = active_sessions.get(session_id)
        if current_ws:
            try:
                await current_ws.send_json({"type": "log", "message": f"❌ 执行异常: {str(e)}"})
                await current_ws.send_json({"type": "status", "status": "failed"})
            except Exception:
                pass
        if run_meta is not None:
            run_meta["status"] = "failed"
            run_meta["ended_at"] = int(time.time())
            if run_meta.get("started_at"):
                run_meta["duration_ms"] = (run_meta["ended_at"] - run_meta["started_at"]) * 1000
            run_meta["logs"].append(f"❌ 执行异常: {str(e)}")
            try:
                token_path = os.path.join(_run_dir(session_id), "token_usage.json")
                if os.path.exists(token_path):
                    with open(token_path, "r", encoding="utf-8") as f:
                        token_summary = json.load(f)
                    run_meta["token_usage"] = token_summary.get("totals") or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                    run_meta["token_summary"] = token_summary
            except Exception:
                pass
    finally:
        if run_meta is not None:
            try:
                with open(_run_meta_path(session_id), "w", encoding="utf-8") as f:
                    json.dump(run_meta, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            if session_id in active_runs:
                del active_runs[session_id]
        if cleanup_path:
            try:
                os.unlink(cleanup_path)
            except Exception:
                pass


@app.websocket("/ws/run/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
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

ENVS_FILE = os.path.join(PROJECT_ROOT, "tests", "environments.json")

@app.get("/api/environments")
async def get_environments():
    if not os.path.exists(ENVS_FILE):
        return JSONResponse([])
    with open(ENVS_FILE, "r", encoding="utf-8") as f:
        return JSONResponse(json.load(f))

@app.post("/api/environments")
async def save_environments(request: Request):
    data = await request.json()
    with open(ENVS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return JSONResponse({"status": "success"})

@app.get("/api/config")
async def get_config():
    p = os.path.join(PROJECT_ROOT, ".env")
    cfg = {"OPENAI_API_BASE": "https://models.inference.ai.azure.com", "OPENAI_API_KEY": "", "OPENAI_MODEL_NAME": "gpt-4o-mini"}
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("OPENAI_API_BASE="):
                    cfg["OPENAI_API_BASE"] = line[len("OPENAI_API_BASE="):]
                elif line.startswith("OPENAI_API_KEY="):
                    val = line[len("OPENAI_API_KEY="):]
                    cfg["OPENAI_API_KEY"] = val
                elif line.startswith("OPENAI_MODEL_NAME="):
                    val = line[len("OPENAI_MODEL_NAME="):]
                    cfg["OPENAI_MODEL_NAME"] = val
    return JSONResponse(cfg)

@app.post("/api/config")
async def save_config(request: Request):
    data = await request.json()
    p = os.path.join(PROJECT_ROOT, ".env")
    
    cfg = {"OPENAI_API_BASE": "https://models.inference.ai.azure.com", "OPENAI_API_KEY": "", "OPENAI_MODEL_NAME": "gpt-4o-mini"}
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("OPENAI_API_BASE="):
                    cfg["OPENAI_API_BASE"] = line[len("OPENAI_API_BASE="):]
                elif line.startswith("OPENAI_API_KEY="):
                    cfg["OPENAI_API_KEY"] = line[len("OPENAI_API_KEY="):]
                elif line.startswith("OPENAI_MODEL_NAME="):
                    cfg["OPENAI_MODEL_NAME"] = line[len("OPENAI_MODEL_NAME="):]
                    
    if "OPENAI_API_BASE" in data:
        cfg["OPENAI_API_BASE"] = data["OPENAI_API_BASE"]
    if "OPENAI_API_KEY" in data:
        cfg["OPENAI_API_KEY"] = data["OPENAI_API_KEY"]
    if "OPENAI_MODEL_NAME" in data:
        cfg["OPENAI_MODEL_NAME"] = data["OPENAI_MODEL_NAME"]
        
    with open(p, "w", encoding="utf-8") as f:
        f.write(f"OPENAI_API_BASE={cfg['OPENAI_API_BASE']}\n")
        f.write(f"OPENAI_API_KEY={cfg['OPENAI_API_KEY']}\n")
        f.write(f"OPENAI_MODEL_NAME={cfg['OPENAI_MODEL_NAME']}\n")

    _load_env()
    return JSONResponse({"status": "success"})

@app.post("/api/config/test")
async def test_config(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
        
    api_base = data.get("OPENAI_API_BASE", "https://api.openai.com/v1")
    api_key = data.get("OPENAI_API_KEY", "")
    model_name = data.get("OPENAI_MODEL_NAME", "gpt-4o-mini")
    
    api_base = str(api_base or "").strip()
    api_key = str(api_key or "").strip()
    model_name = str(model_name or "gpt-4o-mini").strip()

    if not api_base:
        return JSONResponse({"error": "请提供 Base URL"}, status_code=400)
    if not api_key:
        return JSONResponse({"error": "请提供 API Key"}, status_code=400)
        
    try:
        t0 = time.time()
        llm = ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=api_base,
            max_retries=1,
            timeout=10 # 设置超时防止卡住
        )
        
        # 兼容旧版本 Python (3.8) 没有 asyncio.to_thread 的问题
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: llm.invoke([HumanMessage(content="ping")]))
        token_usage = None
        try:
            if hasattr(resp, "response_metadata") and isinstance(resp.response_metadata, dict):
                token_usage = resp.response_metadata.get("token_usage")
        except Exception:
            token_usage = None
        
        latency_ms = int((time.time() - t0) * 1000)
        reply = str(getattr(resp, "content", "")).strip()
        msg = f"连接成功 · {model_name} · {latency_ms}ms"
        if reply:
            msg = msg + f" · {reply[:40]}"
        return JSONResponse({"status": "success", "message": msg, "latency_ms": latency_ms, "token_usage": token_usage, "model": model_name})
    except Exception as e:
        return JSONResponse({"error": f"连接失败: {str(e)}"}, status_code=400)
