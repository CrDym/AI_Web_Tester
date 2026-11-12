import os
import socket
import subprocess
import sys
import tempfile
import time
import shutil
from pathlib import Path
from typing import Dict, List, Optional

from playwright.sync_api import Page, expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / "venv" / "bin" / "python"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _wait_http(url: str, proc: subprocess.Popen, log_path: Path, timeout: float = 60.0) -> None:
    import urllib.request
    import urllib.error

    deadline = time.time() + timeout
    last_error: Optional[Exception] = None
    while time.time() < deadline:
        if proc.poll() is not None:
            log_tail = log_path.read_text(encoding="utf-8", errors="ignore")[-4000:]
            raise RuntimeError(f"Process exited while waiting for {url}.\n{log_tail}")
        try:
            with urllib.request.urlopen(url, timeout=1.5) as resp:
                if 200 <= int(resp.status) < 500:
                    return
        except urllib.error.HTTPError as exc:
            if 200 <= int(exc.code) < 500:
                return
            last_error = exc
        except Exception as exc:
            last_error = exc
        time.sleep(0.3)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


def _start(cmd: List[str], cwd: Path, env: Dict[str, str], log_path: Path) -> subprocess.Popen:
    log = log_path.open("w", encoding="utf-8")
    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
    )


def _stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def _setup_or_login(page: Page, username: str, password: str) -> None:
    page.goto("/", wait_until="domcontentloaded")
    expect(page.get_by_role("button", name="注册")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="注册").click()
    page.get_by_placeholder("用户名").fill(username)
    page.get_by_placeholder("密码").fill(password)
    page.get_by_role("button", name="创建账号并进入 SOLO").click()

    expect(page.get_by_role("heading", name="SOLO 测试工作台")).to_be_visible(timeout=10000)
    expect(page.get_by_role("button", name="设置")).to_be_visible(timeout=10000)


def _create_case(page: Page, name: str) -> None:
    page.get_by_role("button", name="让 SOLO 生成用例").click()
    expect(page.get_by_role("heading", name="自然语言生成用例 (NL2Case)")).to_be_visible(timeout=10000)
    page.get_by_placeholder("例如：登录并验证欢迎提示").fill(name)
    page.get_by_placeholder("例如：https://example.com/login").fill("https://example.test/login")
    page.get_by_placeholder("请输入您的测试步骤，大模型会自动拆解为结构化动作。").fill(
        "1. 点击登录按钮\n2. 断言页面包含欢迎"
    )
    page.get_by_role("button", name="取消").click()

    token = page.evaluate("localStorage.getItem('auth_token')")
    res = page.request.post(
        "/api/cases",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "name": name,
            "start_url": "https://example.test/login",
            "steps": [{"type": "click", "selector": "#login", "intent": "点击登录按钮"}],
            "tags": ["e2e"],
            "variables": {},
            "dataset": [],
        },
    )
    assert res.ok, res.text()
    page.get_by_title("刷新用例").click()
    page.get_by_text(name, exact=True).click()
    expect(page.get_by_text(f"CaseID: {res.json()['id']}")).to_be_visible(timeout=10000)
    expect(page.get_by_placeholder("可选：Playwright selector").first).to_have_value("#login")
    page.get_by_role("button", name="新增步骤").click()
    expect(page.get_by_text("STEP 2")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="保存", exact=True).click()
    expect(page.get_by_role("button", name="保存", exact=True)).to_be_disabled(timeout=10000)


def _create_suite(page: Page, suite_name: str, case_name: str) -> None:
    page.get_by_role("button", name="套件", exact=True).click()
    page.get_by_title("新建套件").click()
    expect(page.get_by_role("heading", name="新建测试套件")).to_be_visible(timeout=10000)
    page.get_by_placeholder("例如：Smoke 回归 / 登录链路").fill(suite_name)
    page.get_by_role("button", name="创建套件").click()
    expect(page.get_by_text(f"SuiteID:")).to_be_visible(timeout=10000)
    page.locator("select").nth(2).select_option(label=case_name)
    page.get_by_role("button", name="添加").click()
    expect(page.locator("div.text-sm", has_text=case_name)).to_be_visible(timeout=10000)
    page.get_by_role("button", name="保存套件").click()
    expect(page.get_by_text("已保存")).to_be_visible(timeout=10000)


def run() -> int:
    backend_port = _free_port()
    frontend_port = _free_port()
    username = "e2e_user"
    password = "E2ePass123!"

    with tempfile.TemporaryDirectory(prefix="solo_e2e_") as tmp:
        tmp_path = Path(tmp)
        prompts_src = ROOT / "src" / "ai_tester" / "prompts"
        prompts_dst = tmp_path / "prompts"
        shutil.copytree(prompts_src, prompts_dst)
        env = os.environ.copy()
        env.update(
            {
                "AI_TESTER_DB_PATH": str(tmp_path / "tester.db"),
                "AI_TESTER_RUN_TIMEOUT_SECONDS": "30",
                "OPENAI_API_KEY": "",
                "VITE_API_TARGET": f"http://127.0.0.1:{backend_port}",
                "VITE_WS_TARGET": f"ws://127.0.0.1:{backend_port}",
                "AI_TESTER_PROMPTS_DIR": str(prompts_dst),
                "AI_TESTER_CORS_ORIGINS": f"http://127.0.0.1:{frontend_port}",
            }
        )
        backend_log = tmp_path / "backend.log"
        frontend_log = tmp_path / "frontend.log"
        backend = _start(
            [str(PYTHON), "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(backend_port)],
            ROOT / "web_server",
            env,
            backend_log,
        )
        frontend = _start(
            ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(frontend_port)],
            ROOT / "frontend",
            env,
            frontend_log,
        )
        try:
            _wait_http(f"http://127.0.0.1:{backend_port}/api/auth/me", backend, backend_log)
            _wait_http(f"http://127.0.0.1:{frontend_port}/", frontend, frontend_log)
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(base_url=f"http://127.0.0.1:{frontend_port}")
                _setup_or_login(page, username, password)
                expect(page.get_by_role("button", name="用例", exact=True)).to_be_visible()
                expect(page.get_by_role("button", name="套件", exact=True)).to_be_visible()
                expect(page.get_by_role("button", name="历史", exact=True)).to_be_visible()
                page.get_by_role("button", name="设置", exact=True).click()
                expect(page.get_by_text("OPENAI_API_BASE")).to_be_visible(timeout=10000)
                page.get_by_role("button", name="保存设置").click()
                expect(page.get_by_role("heading", name="SOLO 测试工作台")).to_be_visible(timeout=10000)
                case_name = "E2E 保存用例"
                suite_name = "E2E 回归套件"
                _create_case(page, case_name)
                _create_suite(page, suite_name, case_name)
                browser.close()
            print(f"E2E smoke passed: frontend=http://127.0.0.1:{frontend_port} backend=http://127.0.0.1:{backend_port}")
            return 0
        except Exception:
            _stop(frontend)
            _stop(backend)
            print("E2E smoke failed.", file=sys.stderr)
            print(f"Backend log: {backend_log}", file=sys.stderr)
            print(backend_log.read_text(encoding="utf-8", errors="ignore")[-4000:], file=sys.stderr)
            print(f"Frontend log: {frontend_log}", file=sys.stderr)
            print(frontend_log.read_text(encoding="utf-8", errors="ignore")[-4000:], file=sys.stderr)
            raise
        finally:
            _stop(frontend)
            _stop(backend)


if __name__ == "__main__":
    raise SystemExit(run())
