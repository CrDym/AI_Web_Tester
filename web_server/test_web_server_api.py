import importlib
import json
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def app_client(tmp_path, monkeypatch):
    project_root = Path(__file__).resolve().parents[1]
    web_root = project_root / "web_server"
    monkeypatch.setenv("AI_TESTER_DB_PATH", str(tmp_path / "tester.db"))
    monkeypatch.syspath_prepend(str(project_root))
    monkeypatch.syspath_prepend(str(web_root))

    for name in ["web_server.app", "web_server.database", "app", "database"]:
        sys.modules.pop(name, None)

    app_module = importlib.import_module("web_server.app")
    app_module.CASES_DIR = str(tmp_path / "recorded_cases")
    app_module.SCRIPTS_DIR = str(tmp_path / "recorded_scripts")
    app_module.RUNS_DIR = str(tmp_path / "run_history")
    app_module.SUITES_DIR = str(tmp_path / "suites")
    app_module.SUITE_RUNS_DIR = str(tmp_path / "suite_history")
    app_module.ENVS_FILE = str(tmp_path / "environments.json")
    app_module.PROMPTS_DIR = str(tmp_path / "prompts")
    os.makedirs(app_module.CASES_DIR, exist_ok=True)
    os.makedirs(app_module.SCRIPTS_DIR, exist_ok=True)
    os.makedirs(app_module.RUNS_DIR, exist_ok=True)
    os.makedirs(app_module.PROMPTS_DIR, exist_ok=True)

    env_path = tmp_path / ".env"
    env_path.write_text(
        "OPENAI_API_BASE=https://example.test/v1\n"
        "OPENAI_API_KEY=sk-test-secret-value\n"
        "OPENAI_MODEL_NAME=gpt-test\n",
        encoding="utf-8",
    )
    app_module.PROJECT_ROOT = str(tmp_path)

    token = "test-token"
    app_module.active_tokens[token] = {"username": "tester", "exp": app_module._now_ts() + 3600}
    client = TestClient(app_module.app)
    return app_module, client, {"Authorization": f"Bearer {token}"}


def _create_case(client, headers, **overrides):
    payload = {
        "name": "case",
        "start_url": "https://example.test",
        "steps": [{"type": "click", "selector": "#old", "intent": "点击按钮"}],
        "tags": [],
        "variables": {},
        "dataset": [],
    }
    payload.update(overrides)
    res = client.post("/api/cases", headers=headers, json=payload)
    assert res.status_code == 200, res.text
    return res.json()["id"]


def test_upload_script_rejects_path_traversal(app_client):
    _, client, headers = app_client

    res = client.post(
        "/api/upload_script",
        headers=headers,
        json={"name": "../bad.py", "script": "print('bad')"},
    )

    assert res.status_code == 400


def test_prompt_update_rejects_invalid_filename(app_client):
    _, client, headers = app_client

    res = client.put("/api/prompts/bad.py", headers=headers, json={"content": "x"})

    assert res.status_code == 400


def test_config_masks_key_and_blank_save_preserves_existing_key(app_client, tmp_path):
    _, client, headers = app_client

    res = client.get("/api/config", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["OPENAI_API_KEY_SET"] is True
    assert data["OPENAI_API_KEY"] != "sk-test-secret-value"
    assert "..." in data["OPENAI_API_KEY"]

    res = client.post(
        "/api/config",
        headers=headers,
        json={"OPENAI_API_BASE": "https://changed.test/v1", "OPENAI_MODEL_NAME": "gpt-next"},
    )
    assert res.status_code == 200
    env_text = (tmp_path / ".env").read_text(encoding="utf-8")
    assert "OPENAI_API_KEY=sk-test-secret-value" in env_text
    assert "OPENAI_MODEL_NAME=gpt-next" in env_text


def test_config_save_preserves_unknown_env_keys(app_client, tmp_path):
    _, client, headers = app_client
    env_path = tmp_path / ".env"
    env_path.write_text(
        "# keep me\n"
        "OPENAI_API_BASE=https://example.test/v1\n"
        "CUSTOM_SETTING=still-here\n"
        "OPENAI_API_KEY=sk-test-secret-value\n"
        "OPENAI_MODEL_NAME=gpt-test\n",
        encoding="utf-8",
    )

    res = client.post(
        "/api/config",
        headers=headers,
        json={"OPENAI_API_BASE": "https://changed.test/v1"},
    )

    assert res.status_code == 200
    env_text = env_path.read_text(encoding="utf-8")
    assert "# keep me" in env_text
    assert "CUSTOM_SETTING=still-here" in env_text
    assert "OPENAI_API_BASE=https://changed.test/v1" in env_text
    assert "OPENAI_API_KEY=sk-test-secret-value" in env_text


def test_config_test_uses_saved_key_when_request_key_blank(app_client, monkeypatch):
    _, client, headers = app_client
    import web_server.routes_config as routes_config
    seen = {}

    class FakeLLM:
        def __init__(self, **kwargs):
            seen.update(kwargs)

        def invoke(self, _messages):
            class Resp:
                content = "pong"
                response_metadata = {}

            return Resp()

    monkeypatch.setattr(routes_config, "create_chat_openai", lambda **kwargs: FakeLLM(**kwargs))

    res = client.post(
        "/api/config/test",
        headers=headers,
        json={
            "OPENAI_API_BASE": "https://changed.test/v1",
            "OPENAI_API_KEY": "",
            "OPENAI_MODEL_NAME": "gpt-next",
        },
    )

    assert res.status_code == 200, res.text
    assert res.json()["status"] == "success"
    assert seen["api_key"] == "sk-test-secret-value"
    assert seen["base_url"] == "https://changed.test/v1"
    assert seen["model"] == "gpt-next"


def test_compat_chat_openai_accepts_string_response():
    from src.ai_tester.llm_utils import CompatChatOpenAI

    llm = CompatChatOpenAI(model="gpt-test", api_key="sk-test", base_url="https://example.test/v1")
    result = llm._create_chat_result("pong")

    assert result.generations[0].message.content == "pong"


def test_prompt_update_creates_backup(app_client):
    app_module, client, headers = app_client
    prompt_path = Path(app_module.PROMPTS_DIR) / "demo.txt"
    prompt_path.write_text("old prompt", encoding="utf-8")

    res = client.put("/api/prompts/demo.txt", headers=headers, json={"content": "new prompt"})

    assert res.status_code == 200, res.text
    assert prompt_path.read_text(encoding="utf-8") == "new prompt"
    backup_name = res.json()["backup"]
    assert backup_name and backup_name.startswith("demo.txt.") and backup_name.endswith(".bak")
    assert (Path(app_module.PROMPTS_DIR) / backup_name).read_text(encoding="utf-8") == "old prompt"


def test_recorder_cases_requires_token_when_configured(app_client, monkeypatch):
    _, client, headers = app_client
    monkeypatch.setenv("AI_TESTER_RECORDER_TOKEN", "recorder-secret")

    payload = {
        "name": "recorded",
        "start_url": "https://example.test",
        "steps": [{"type": "click", "selector": "#ok", "intent": "点击确认"}],
    }
    res = client.post("/api/recorder/cases", json=payload)
    assert res.status_code == 401

    res = client.post("/api/recorder/cases", headers={"X-Recorder-Token": "recorder-secret"}, json=payload)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "success"


def test_stop_unknown_run_returns_404(app_client):
    _, client, headers = app_client

    res = client.post("/api/runs/nope/stop", headers=headers)

    assert res.status_code == 404


def test_case_partial_update_preserves_steps(app_client):
    _, client, headers = app_client
    case_id = _create_case(client, headers)

    res = client.put("/api/cases/%s" % case_id, headers=headers, json={"name": "renamed", "tags": ["smoke"]})
    assert res.status_code == 200, res.text

    res = client.get("/api/cases/%s" % case_id, headers=headers)
    assert res.status_code == 200
    doc = res.json()
    assert doc["name"] == "renamed"
    assert doc["tags"] == ["smoke"]
    assert doc["steps"] == [{"type": "click", "selector": "#old", "intent": "点击按钮"}]


def test_create_suite_rejects_missing_case_reference(app_client):
    _, client, headers = app_client

    res = client.post("/api/suites", headers=headers, json={"name": "bad suite", "case_ids": ["missing.json"]})

    assert res.status_code == 400
    assert res.json()["missing_case_ids"] == ["missing.json"]


def test_delete_case_removes_suite_references(app_client):
    _, client, headers = app_client
    case_id = _create_case(client, headers)
    other_id = _create_case(client, headers, name="other")
    res = client.post("/api/suites", headers=headers, json={"name": "suite", "setup_case_id": case_id, "case_ids": [other_id, case_id]})
    assert res.status_code == 200, res.text
    suite_id = res.json()["id"]

    res = client.delete("/api/cases/%s" % case_id, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["affected_suites"] == 1

    res = client.get("/api/suites/%s" % suite_id, headers=headers)
    assert res.status_code == 200
    suite = res.json()
    assert suite["setup_case_id"] is None
    assert suite["case_ids"] == [other_id]


def test_run_suite_rejects_missing_case_reference(app_client):
    app_module, client, headers = app_client
    now = app_module._now_ts()
    db = app_module.SessionLocal()
    try:
        db.add(app_module.SuiteModel(
            id="suite_missing",
            name="missing suite",
            case_ids='["missing.json"]',
            created_at=now,
            updated_at=now,
        ))
        db.commit()
    finally:
        db.close()

    res = client.post("/api/suites/suite_missing/run", headers=headers)

    assert res.status_code == 400
    assert res.json()["missing_case_ids"] == ["missing.json"]


def test_basic_authenticated_case_suite_flow(app_client):
    _, client, headers = app_client
    case_id = _create_case(client, headers, name="flow case")

    res = client.get("/api/cases", headers=headers)
    assert res.status_code == 200
    assert any(item["id"] == case_id for item in res.json())

    res = client.post("/api/suites", headers=headers, json={"name": "flow suite", "case_ids": [case_id]})
    assert res.status_code == 200, res.text
    suite_id = res.json()["id"]

    res = client.get("/api/suites/%s" % suite_id, headers=headers)
    assert res.status_code == 200
    assert res.json()["case_ids"] == [case_id]

    res = client.delete("/api/cases/%s" % case_id, headers=headers)
    assert res.status_code == 200

    res = client.get("/api/suites/%s" % suite_id, headers=headers)
    assert res.status_code == 200
    assert res.json()["case_ids"] == []


def test_heal_approve_updates_old_selector(app_client):
    _, client, headers = app_client
    case_id = _create_case(client, headers)

    res = client.post(
        "/api/cases/%s/heal/approve" % case_id,
        headers=headers,
        json={"old_selector": "#old", "new_selector": "[data-testid='new']"},
    )
    assert res.status_code == 200, res.text

    res = client.get("/api/cases/%s" % case_id, headers=headers)
    steps = res.json()["steps"]
    assert steps[0]["selector"] == "[data-testid='new']"


def test_heal_approve_empty_selector_by_intent(app_client):
    _, client, headers = app_client
    case_id = _create_case(
        client,
        headers,
        steps=[{"type": "click", "selector": "", "intent": "点击保存"}],
    )

    res = client.post(
        "/api/cases/%s/heal/approve" % case_id,
        headers=headers,
        json={"old_selector": "", "new_selector": "#save", "step_intent": "点击保存"},
    )
    assert res.status_code == 200, res.text

    res = client.get("/api/cases/%s" % case_id, headers=headers)
    assert res.json()["steps"][0]["selector"] == "#save"


def test_heal_approve_rejects_ambiguous_empty_selector_intent(app_client):
    _, client, headers = app_client
    case_id = _create_case(
        client,
        headers,
        steps=[
            {"type": "click", "selector": "", "intent": "点击保存"},
            {"type": "click", "selector": "", "intent": "点击保存"},
        ],
    )

    res = client.post(
        "/api/cases/%s/heal/approve" % case_id,
        headers=headers,
        json={"old_selector": "", "new_selector": "#save", "step_intent": "点击保存"},
    )

    assert res.status_code == 409
    assert res.json()["error"] == "Multiple matching steps found for intent"


def test_build_python_script_assert_never_self_heals_and_no_content_fallback(app_client):
    app_module, _, _ = app_client

    case = {
        "name": "assert case",
        "start_url": "https://example.test",
        "steps": [
            {"type": "assert", "assert_type": "text", "value": "成功", "selector": "", "intent": "断言成功"},
            {"type": "assert", "assert_type": "url", "value": "/done", "selector": "", "intent": "断言 URL"},
            {"type": "assert", "assert_type": "visible", "selector": "#x", "intent": "断言可见"},
        ],
        "variables": {},
        "dataset": [],
    }
    script = app_module._build_python_script(case)

    # 不再走 HTML 源码兜底
    assert "page.content()" not in script
    # 断言步骤永不进入自愈
    assert "healer.heal" not in script
    # 文本断言使用 .first + count + wait_for(visible) 语义可见断言
    assert ".first" in script
    assert "AssertionError" in script
    # 生成的脚本可编译
    compile(script, "<gen>", "exec")


def test_build_python_script_intent_injection_compiles(app_client):
    app_module, _, _ = app_client

    malicious_intent = "验证{__import__('os').getpid()}\nnewline'quote\""
    case = {
        "name": "inject case",
        "start_url": "https://example.test",
        "steps": [
            {"type": "click", "selector": "#a", "intent": malicious_intent, "value": ""},
        ],
        "variables": {},
        "dataset": [],
    }
    script = app_module._build_python_script(case)

    # intent 必须只出现在字符串字面量里（repr 转义），不能进入 f-string 花括号外的裸文本
    # 关键安全保证：脚本可编译且 intent 文本被 repr 当作纯数据
    assert "step_intent_display_0" in script
    # display_intent 不再被字面拼接到 print 的 f-string 模板里
    assert "(意图: {display_intent})" not in script
    assert "(意图: {" not in script  # 防止把 intent 直接插入字面文本
    # 必须可编译（注入不能造成 SyntaxError 或代码执行）
    compile(script, "<gen>", "exec")


def test_build_python_script_dataset_true_none_compiles(app_client):
    app_module, _, _ = app_client

    case = {
        "name": "dataset case",
        "start_url": "https://example.test",
        "steps": [{"type": "click", "selector": "#a", "intent": "点击"}],
        "variables": {},
        "dataset": [{"flag": True, "empty": None, "name": "中文"}],
    }
    script = app_module._build_python_script(case)

    # repr 产生 Python 合法字面量 True/None
    assert "True" in script
    assert "None" in script
    assert "true" not in script.replace("True", "").replace("wait_for", "")
    # 可编译
    compile(script, "<gen>", "exec")


def test_build_python_script_does_not_require_openai_key(app_client, monkeypatch):
    """回归：无 OPENAI_API_KEY 环境下，生成的回放脚本可真实执行纯 selector 步骤且不构造 AI。

    产品阻塞点修复：原 `_build_python_script` 无条件生成 `agent = AITesterAgent(...)`，
    其构造 (ChatOpenAI) 校验 OPENAI_API_KEY 非空，导致纯 selector 回放在 page.goto 之前
    即因 pydantic ValidationError 而失败。修复后 agent/healer 与 OPENAI_API_KEY 同条件构造，
    纯回放路径不依赖 AI 凭据；仅当真正触发自愈时才需要 AI（此时若未配置则明确失败，不吞错）。

    本测试行为级：monkeypatch 删除 OPENAI_API_KEY，exec 生成脚本，用桩 page/driver 实际调用
    生成的 test_recorded_flow，断言确定性步骤被执行且 AITesterAgent 从未被构造。
    隔离存储、不读项目 .env、不伪造凭据。
    """
    app_module, _, _ = app_client
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    case = {
        "name": "replay no-ai",
        "start_url": "https://example.test",
        "steps": [
            {"type": "click", "selector": "#btn1", "intent": "点击登录", "value": ""},
            {"type": "input", "selector": "#acc", "intent": "输入账号 admin", "value": "admin"},
        ],
        "variables": {},
        "dataset": [],
    }
    script = app_module._build_python_script(case)

    # 桩 ai_tester：记录 perform_action 调用，并跟踪 AITesterAgent 是否被构造
    performed = []
    ai_constructed = {"count": 0}

    class _StubDriver:
        def __init__(self, page):
            self.page = page

        def perform_action(self, action, target_id, value=None):
            performed.append((action, target_id, value))

        def get_screenshot(self, *a, **k):
            return ""

        def switch_to_latest_page(self):
            return self.page

        def _get_locator(self, selector):
            return self.page.locator(selector)

    class _StubAITesterAgent:
        def __init__(self, *a, **k):
            ai_constructed["count"] += 1
            raise AssertionError("AITesterAgent must not be constructed without OPENAI_API_KEY")

        def get_dom_tree_str(self):
            return ""

    class _StubSelfHealer:
        def __init__(self, *a, **k):
            raise AssertionError("SelfHealer must not be constructed without OPENAI_API_KEY")

    # 桩 pytest / dotenv / page，注入到 exec 的 globals
    class _StubPage:
        def __init__(self):
            self.gotos = []
            self.timeouts = []

        def goto(self, url, **k):
            self.gotos.append(url)

        def wait_for_timeout(self, ms):
            self.timeouts.append(ms)

        def locator(self, selector):
            class _L:
                def count(self_):
                    return 1

                def wait_for(self_, **k):
                    pass

                def first(self_):
                    return self_

            return _L()

    import types as _types
    ai_stub = _types.ModuleType("ai_tester")
    ai_stub.PlaywrightDriver = _StubDriver
    ai_stub.AITesterAgent = _StubAITesterAgent
    ai_stub.SelfHealer = _StubSelfHealer
    ai_stub.__all__ = ["PlaywrightDriver", "AITesterAgent", "SelfHealer"]

    pytest_stub = _types.ModuleType("pytest")
    def _parametrize(*a, **k):
        def deco(fn):
            return fn
        return deco
    pytest_stub.mark = _types.SimpleNamespace(parametrize=_parametrize)

    dotenv_stub = _types.ModuleType("dotenv")
    dotenv_stub.load_dotenv = lambda *a, **k: False

    # 注册到 sys.modules，使生成脚本中的 `from ai_tester import ...` 解析到桩而非真实包
    saved_ai = sys.modules.get("ai_tester")
    saved_pytest = sys.modules.get("pytest")
    saved_dotenv = sys.modules.get("dotenv")
    sys.modules["ai_tester"] = ai_stub
    sys.modules["pytest"] = pytest_stub
    sys.modules["dotenv"] = dotenv_stub
    try:
        sandbox_globals = {
            "__name__": "gen_replay_no_ai",
            "ai_tester": ai_stub,
            "pytest": pytest_stub,
            "dotenv": dotenv_stub,
        }
        # exec 生成的脚本（模块级定义 dataset + test_recorded_flow）
        exec(compile(script, "<gen>", "exec"), sandbox_globals)
        test_fn = sandbox_globals["test_recorded_flow"]
    finally:
        for name, prev in (("ai_tester", saved_ai), ("pytest", saved_pytest), ("dotenv", saved_dotenv)):
            if prev is not None:
                sys.modules[name] = prev
            else:
                sys.modules.pop(name, None)

    # 实际调用生成的测试函数：传入桩 page 与 dataset 中第一行（这里为空 dict 合并 runtime_vars）
    page = _StubPage()
    dataset = sandbox_globals["dataset"]
    assert dataset, "dataset should have at least one row"
    test_fn(page, dataset[0])

    # —— 断言：确定性步骤被执行，AI 从未构造 ——
    assert ai_constructed["count"] == 0, "AITesterAgent was constructed without OPENAI_API_KEY"
    # 起始页被访问
    assert page.gotos == ["https://example.test"], f"unexpected gotos: {page.gotos}"
    # click + input 两个确定性步骤均通过 perform_action 回放
    assert performed == [
        ("click", "SELECTOR:#btn1", ""),
        ("type", "SELECTOR:#acc", "admin"),
    ], f"unexpected performed actions: {performed}"


def test_backup_restore_preserves_variables_and_group(app_client):
    """备份恢复完整性：恢复后 steps 与 variables 都应回到备份版本。"""
    app_module, client, headers = app_client

    # 1. 创建含 variables、group、steps 的用例
    case_id = _create_case(
        client,
        headers,
        name="restore_integrity",
        variables={"account": "a", "token": "t1"},
        steps=[{"type": "click", "selector": "#old", "intent": "点击"}],
        group_name="g1",
    )

    # 2. 修改 steps + variables（触发备份写入当前版本，再更新为新版本）
    res = client.put(
        f"/api/cases/{case_id}",
        headers=headers,
        json={
            "start_url": "https://example.test",
            "steps": [{"type": "input", "selector": "#new", "intent": "输入", "value": "x"}],
            "variables": {"account": "b", "token": "t2"},
            "dataset": [],
            "group_name": "g2",
        },
    )
    assert res.status_code == 200, res.text

    # 3. restore → 应回到第一个备份版本（创建时 + 第一次更新前写入的备份）
    res = client.post(f"/api/cases/{case_id}/restore", headers=headers)
    assert res.status_code == 200, res.text

    # 4. 重新读取，断言 steps 与 variables 都已恢复
    res = client.get(f"/api/cases/{case_id}", headers=headers)
    assert res.status_code == 200, res.text
    case = res.json()
    assert case["steps"] == [{"type": "click", "selector": "#old", "intent": "点击"}]
    assert case["variables"] == {"account": "a", "token": "t1"}


def test_get_cases_without_auth_returns_401(app_client):
    """鉴权拒绝路径：不带 Authorization 头请求 GET /api/cases 应返回 401。"""
    _, client, _ = app_client
    res = client.get("/api/cases")
    assert res.status_code == 401


def test_cleanup_runs_keeps_recent_and_trashes_rest(app_client):
    app_module, client, headers = app_client
    # 造 3 条终态运行目录：2 旧 1 新（started_at 间隔拉大，避免文件系统 mtime 粒度影响）
    def make_run(rid, ts, status):
        d = Path(app_module.RUNS_DIR) / rid
        d.mkdir(parents=True, exist_ok=True)
        (d / "meta.json").write_text(json.dumps({
            "id": rid, "case_id": "c1", "status": status,
            "started_at": ts, "ended_at": ts,
        }), encoding="utf-8")
    base = 1_700_000_000
    make_run("run_old_1", base - 3600, "completed")
    make_run("run_old_2", base - 3500, "completed")
    # pending 运行不应参与清理
    make_run("run_pending1", base - 150, "running")
    make_run("run_new_1", base, "completed")
    res = client.post("/api/runs/cleanup", json={"keep": 1}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert sorted(body["trashed"]) == ["run_old_1", "run_old_2"], body
    # 保留的新目录仍在
    assert (Path(app_module.RUNS_DIR) / "run_new_1").exists()
    # pending 目录不被清理
    assert (Path(app_module.RUNS_DIR) / "run_pending1").exists()
    # 三方都在回收区
    deleted = list((Path(app_module.RUNS_DIR) / "_deleted").iterdir())
    assert len(deleted) == 2
    # 无 token 不可用
    res2 = client.post("/api/runs/cleanup", json={"keep": 5})
    assert res2.status_code == 401
