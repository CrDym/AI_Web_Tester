#!/usr/bin/env python3
"""录制器端到端核验（真实 UI 驱动版）。

链路：
  1. 隔离临时沙箱：复制 web_server/src/extension 进 temp，DB/scripts/runs/profile 全部隔离。
  2. loopback 极简 fixture http 页（button#btn1 + input#acc），服务端记录 click/input 观测。
  3. 复制扩展并仅改 popup.js 里 API_BASE/CONSOLE_URL 两个目的字面量 → 指向动态后端/前端端口。
  4. Playwright 加载未打包扩展（临时 profile），直接打开 chrome-extension://<id>/popup/popup.html。
  5. 真实点击 popup「开始录制」→ fixture 页点击按钮 + 输入 → popup「停止并同步」。
  6. 打开真实 SOLO 前端，UI 注册/登录 → 选同步进来的用例 → 「运行测试」。
  7. 轮询 run 到终态；断言 terminal=completed 且 fixture 服务端观测到回放浏览器真实
     点击 btn1 + 输入 "admin"（证明录制的 click/input 被真实回放，而非日志文本巧合）。

隔离：tempfile.TemporaryDirectory 内完成一切；loopback only；不读项目 .env（temp 内无 .env）；
      OPENAI_API_KEY="" 禁用外部 AI；动态端口；不接触既存 8000/5173。
      进程以新 session 启动，按进程组清理（直接 node vite，避免 npm wrapper 孤儿化）。

环境变量：
  RECORDER_HEADLESS=1        无头模式（MV3 service worker 在 --headless=new 下可能不注册，会自动回退有头）
  RECORDER_HEADLESS=0        有头模式（默认）
  兼容旧名 RECORDER_E2E_HEADLESS，同语义。

运行：venv/bin/python tools/recorder_e2e.py
"""
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable
FRONTEND_DIR = ROOT / "frontend"
EXT_SRC = ROOT / "extension"
VITE_BIN = FRONTEND_DIR / "node_modules" / "vite" / "bin" / "vite.js"

USERNAME = "rec_e2e_user"
PASSWORD = "RecE2ePass123!"
TERMINAL = ("completed", "failed", "stopped", "timeout")


# ---------------- 通用工具 ----------------

def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _headless_flag() -> bool:
    for key in ("RECORDER_HEADLESS", "RECORDER_E2E_HEADLESS"):
        if key in os.environ:
            return os.environ[key] == "1"
    return False  # 默认有头，与历史 RECORDER_HEADLESS 语义一致


def _start_proc(cmd: List[str], cwd: Path, env: Dict[str, str], log_path: Path) -> subprocess.Popen:
    # start_new_session=True：子进程独立进程组，便于按组清理（避免 npm/vite 孤儿）。
    log = log_path.open("w", encoding="utf-8")
    return subprocess.Popen(
        cmd, cwd=str(cwd), env=env, stdout=log, stderr=subprocess.STDOUT,
        text=True, start_new_session=True,
    )


def _stop_proc(proc: Optional[subprocess.Popen]) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            proc.kill()
        proc.wait(timeout=5)


def _wait_http(url: str, proc: subprocess.Popen, log_path: Path, timeout: float = 60.0) -> None:
    deadline = time.time() + timeout
    last: Optional[Exception] = None
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"Process exited while waiting for {url}.\n"
                               f"{log_path.read_text(encoding='utf-8', errors='ignore')[-3000:]}")
        try:
            with urllib.request.urlopen(url, timeout=1.5) as r:
                if 200 <= int(r.status) < 500:
                    return
        except urllib.error.HTTPError as e:
            if 200 <= int(e.code) < 500:
                return
            last = e
        except Exception as e:
            last = e
        time.sleep(0.3)
    raise RuntimeError(f"Timed out waiting for {url}: {last}")


def _poll_text(page, selector: str, *, equals: Optional[str] = None,
               contains: Optional[str] = None, timeout: float) -> str:
    deadline = time.time() + timeout / 1000.0
    last = ""
    while time.time() < deadline:
        try:
            last = (page.eval_on_selector(selector, "el => el && el.textContent") or "").strip()
        except Exception as e:
            last = f"<eval err: {e}>"
        if equals is not None and last == equals:
            return last
        if contains is not None and contains in last:
            return last
        time.sleep(0.15)
    want = f"== {equals!r}" if equals is not None else f"contains {contains!r}"
    raise AssertionError(f"timeout waiting {selector!r} text {want}; last={last!r}")


# ---------------- fixture http 页 + 服务端观测 ----------------

class FixtureHandler(BaseHTTPRequestHandler):
    _lock = threading.Lock()
    _observations: List[Dict[str, Any]] = []

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._observations = []

    @classmethod
    def snapshot(cls) -> List[Dict[str, Any]]:
        with cls._lock:
            return list(cls._observations)

    def log_message(self, *a, **k):
        pass

    def do_GET(self):
        if self.path.startswith("/obs"):
            self.send_response(204); self.end_headers(); return
        page = (
            b"<!DOCTYPE html><html><head><meta charset='utf-8'><title>fixture</title></head>"
            b"<body style='padding:320px 40px;font-family:sans-serif'>"
            b"<button id='btn1' onclick=\"fetch('/obs',{method:'POST',headers:{'Content-Type':'application/json'},"
            b"body:JSON.stringify({kind:'click',target:'btn1'})});\">login</button>"
            b"<input id='acc' placeholder='acc' oninput=\"fetch('/obs',{method:'POST',"
            b"headers:{'Content-Type':'application/json'},"
            b"body:JSON.stringify({kind:'input',target:'acc',value:this.value})});\">"
            b"</body></html>"
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        self.wfile.write(page)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(n) if n else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            payload = {"raw": raw.decode("utf-8", "ignore")}
        with self._lock:
            self._observations.append(payload)
        self.send_response(204); self.end_headers()


def start_fixture(port: int) -> HTTPServer:
    srv = HTTPServer(("127.0.0.1", port), FixtureHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def assert_fixture_replayed() -> None:
    obs = FixtureHandler.snapshot()
    clicks = [o for o in obs if o.get("kind") == "click" and o.get("target") == "btn1"]
    inputs = [o for o in obs if o.get("kind") == "input" and o.get("target") == "acc"]
    assert clicks, f"fixture 未观测到回放对 btn1 的点击；obs={obs}"
    assert any(o.get("value") == "admin" for o in inputs), (
        f"fixture 未观测到回放在 acc 输入 'admin'；obs={obs}"
    )


# ---------------- 扩展准备（复制 + 仅改两个目的字面量） ----------------

def prepare_extension(dst: Path, backend_url: str, console_url: str) -> None:
    """复制未打包扩展到 temp，仅替换 popup.js 中 API_BASE 与 CONSOLE_URL 两个目的字面量。"""
    shutil.copytree(EXT_SRC, dst)
    popup_js = dst / "popup" / "popup.js"
    text = popup_js.read_text(encoding="utf-8")
    text = text.replace("http://127.0.0.1:8000", backend_url.rstrip("/"))
    text = text.replace("http://127.0.0.1:5173/", console_url if console_url.endswith("/") else console_url + "/")
    popup_js.write_text(text, encoding="utf-8")


def launch_ext_context(p, profile_dir: Path, ext_path: Path, headless: bool):
    args = [f"--disable-extensions-except={ext_path}", f"--load-extension={ext_path}"]
    if headless:
        args.append("--headless=new")
    return p.chromium.launch_persistent_context(
        str(profile_dir), headless=headless, args=args,
        viewport={"width": 1280, "height": 800},
    )


def get_extension_id(ctx) -> str:
    # Playwright 1.48 的 service_workers 列表可能缺少已注册的 MV3 worker。
    session = ctx.new_cdp_session(ctx.pages[0])
    try:
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            for target in session.send("Target.getTargets")["targetInfos"]:
                url = target["url"]
                if (target["type"] == "service_worker" and url.startswith("chrome-extension://")
                        and url.endswith("/src/background.js")):
                    return url.split("/")[2]
            time.sleep(0.2)
    finally:
        session.detach()
    raise AssertionError("未找到录制器的后台 service worker")


# ---------------- 后端 API 客户端 ----------------

class SoloApi:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.token: Optional[str] = None

    def _req(self, path: str, *, method: str = "GET", body: Optional[Dict[str, Any]] = None) -> Any:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(
            f"{self.base}{path}", method=method,
            data=json.dumps(body).encode() if body is not None else None, headers=h,
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())

    def setup(self) -> None:
        try:
            self._req("/api/auth/setup", method="POST", body={"username": USERNAME, "password": PASSWORD})
        except urllib.error.HTTPError as e:
            if e.code != 409:  # 409 = 已初始化
                raise

    def login(self) -> None:
        data = self._req("/api/auth/login", method="POST", body={"username": USERNAME, "password": PASSWORD})
        self.token = data.get("token") or ""
        assert self.token, f"login 无 token: {data}"

    def get(self, path: str) -> Any:
        return self._req(path)


# ---------------- 主流程 ----------------

def run() -> int:
    headless = _headless_flag()
    backend_port = free_port()
    frontend_port = free_port()
    fixture_port = free_port()
    backend_url = f"http://127.0.0.1:{backend_port}"
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    fixture_url = f"http://127.0.0.1:{fixture_port}/"

    import tempfile
    with tempfile.TemporaryDirectory(prefix="recorder_e2e_") as tmp:
        tmp_path = Path(tmp)
        backend_log = tmp_path / "backend.log"
        frontend_log = tmp_path / "frontend.log"
        profile_dir = tmp_path / "chrome_profile"
        ext_path = tmp_path / "extension"
        sandbox = tmp_path / "sandbox"

        # 复制后端源 + src 到 temp：PROJECT_ROOT 指向 sandbox，SCRIPTS/CASES/RUNS/SUITES 全隔离
        shutil.copytree(ROOT / "web_server", sandbox / "web_server")
        shutil.copytree(ROOT / "src", sandbox / "src")
        # 不复制 .env：temp 内无 .env → _load_env 为 no-op，避免读入真实凭据
        # 复制扩展并仅改两个目的字面量
        prepare_extension(ext_path, backend_url=backend_url, console_url=frontend_url)

        common_env = {
            "OPENAI_API_KEY": "",                    # 禁用外部 AI
            "OPENAI_MODEL_NAME": "test-no-ai",      # 占位（AITesterAgent 构造要求非空，不会被调用）
            "OPENAI_API_BASE": "http://127.0.0.1:1",  # 不会被命中
            "AI_TESTER_DB_PATH": str(tmp_path / "tester.db"),
            "AI_TESTER_RUN_TIMEOUT_SECONDS": "60",
            "AI_TESTER_WS_PORT": str(backend_port),
            "AI_TESTER_CORS_ORIGINS": frontend_url,
        }
        backend_env = os.environ.copy()
        backend_env.update(common_env)
        backend_env["PYTHONPATH"] = os.pathsep.join(
            [str(sandbox), backend_env.get("PYTHONPATH", "")]
        ).strip(os.pathsep)

        frontend_env = os.environ.copy()
        frontend_env.update(common_env)
        frontend_env["VITE_API_TARGET"] = backend_url
        frontend_env["VITE_WS_TARGET"] = backend_url.replace("http", "ws")

        FixtureHandler.reset()
        fixture_srv = start_fixture(fixture_port)

        backend = _start_proc(
            [str(PY), "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(backend_port)],
            sandbox / "web_server", backend_env, backend_log,
        )
        # 直接 node vite（不经 npm wrapper，避免孤儿化）
        frontend = _start_proc(
            ["node", str(VITE_BIN), "--host", "127.0.0.1", "--port", str(frontend_port)],
            FRONTEND_DIR, frontend_env, frontend_log,
        )

        api = SoloApi(backend_url)
        try:
            _wait_http(f"{backend_url}/api/auth/me", backend, backend_log)
            _wait_http(f"{frontend_url}/", frontend, frontend_log)
            api.setup()
            api.login()

            # ===== 1. 扩展 popup UI：开始录制 → 操作 fixture → 停止并同步 =====
            with sync_playwright() as p:
                ctx = None
                try:
                    try:
                        ctx = launch_ext_context(p, profile_dir, ext_path, headless=headless)
                        get_extension_id(ctx)
                    except Exception:
                        if not headless:
                            raise
                        # headless=new 下 MV3 service worker 可能不注册 → 回退有头
                        if ctx is not None:
                            ctx.close(); ctx = None
                        ctx = launch_ext_context(p, profile_dir, ext_path, headless=False)
                        get_extension_id(ctx)
                    ext_id = get_extension_id(ctx)

                    fixture_page = ctx.new_page()
                    fixture_page.goto(fixture_url, wait_until="domcontentloaded")

                    popup_page = ctx.new_page()
                    popup_page.goto(f"chrome-extension://{ext_id}/popup/popup.html",
                                    wait_until="domcontentloaded")
                    popup_page.wait_for_selector("#start-btn", timeout=5000)

                    popup_page.click("#start-btn")
                    # popup CSP 禁用 unsafe-eval → 不能用 wait_for_function，改 CPP 轮询
                    _poll_text(popup_page, "#status-text", equals="录制中...", timeout=5000)
                    assert popup_page.is_disabled("#start-btn"), "录制中 start-btn 应禁用"
                    assert not popup_page.is_disabled("#stop-btn"), "录制中 stop-btn 应可用"
                    time.sleep(1.0)  # 等 content script 收到 STATUS_UPDATE

                    fixture_page.locator("#btn1").click()
                    time.sleep(0.6)  # 规避 recorder click 防抖(500ms)
                    fixture_page.locator("#acc").click()
                    fixture_page.keyboard.type("admin", delay=50)
                    time.sleep(1.2)  # 等 input 防抖(650ms) 落账

                    popup_page.click("#stop-btn")
                    _poll_text(popup_page, "#sync-status", contains="同步成功", timeout=15000)
                finally:
                    if ctx is not None:
                        try: ctx.close()
                        except Exception: pass

            # ===== 2. DB 断言：同步进来的用例含 click(#btn1) + input(#acc='admin') =====
            cases = api.get("/api/cases")
            assert cases, "未同步到用例"
            the_case = cases[0]
            case_id = the_case["id"]
            steps = (api.get(f"/api/cases/{case_id}").get("steps") or [])
            clicks = [s for s in steps if s.get("type") == "click"]
            inputs = [s for s in steps if s.get("type") == "input"]
            assert clicks and "btn1" in (clicks[0].get("selector") or ""), f"缺 click(#btn1): {steps}"
            assert inputs and "acc" in (inputs[0].get("selector") or ""), f"缺 input(#acc): {steps}"
            assert str(inputs[0].get("value")) == "admin", f"input value 应为 admin: {inputs[0]}"

            # 重置观测，仅保留回放阶段证据
            FixtureHandler.reset()

            # ===== 3. 真实 SOLO 前端：UI 登录 → 选用例 → 运行测试 =====
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(base_url=frontend_url)
                try:
                    page.goto("/", wait_until="domcontentloaded")
                    page.get_by_role("button", name="注册").click()
                    page.get_by_placeholder("用户名").fill(USERNAME)
                    page.get_by_placeholder("密码").fill(PASSWORD)
                    page.get_by_role("button", name="创建账号并进入 SOLO").click()
                    page.get_by_role("button", name="让 SOLO 生成用例").wait_for(timeout=15000)

                    page.get_by_title("刷新用例").click()
                    page.get_by_text(the_case["name"], exact=True).first.click(timeout=10000)
                    page.get_by_text(f"CaseID: {case_id}", exact=True).wait_for(timeout=10000)
                    page.get_by_role("button", name="运行测试").click()

                    # ===== 4. 轮询 run 到终态；断言 terminal=completed + fixture 真实回放 =====
                    final: Optional[Dict[str, Any]] = None
                    deadline = time.time() + 90
                    while time.time() < deadline:
                        runs = api.get(f"/api/runs?case_id={case_id}")
                        if runs and runs[0].get("status") in TERMINAL:
                            final = api.get(f"/api/runs/{runs[0]['id']}")
                            break
                        time.sleep(1.0)
                    assert final is not None, "run 90s 内未到终态"
                    status = final.get("status")
                    assert status == "completed", (
                        f"期望 run 终态 completed，实际 {status}；"
                        f"failure_reason={final.get('failure_reason')}"
                    )
                    assert_fixture_replayed()
                finally:
                    browser.close()

            print(f"PASS: recorder E2E  backend={backend_url} frontend={frontend_url} fixture={fixture_url}")
            return 0
        except Exception:
            sys.stderr.write(f"FAIL: recorder E2E\n")
            sys.stderr.write(f"Backend log ({backend_log}):\n")
            sys.stderr.write(backend_log.read_text(encoding="utf-8", errors="ignore")[-3000:] + "\n")
            sys.stderr.write(f"Frontend log ({frontend_log}):\n")
            sys.stderr.write(frontend_log.read_text(encoding="utf-8", errors="ignore")[-2000:] + "\n")
            raise
        finally:
            _stop_proc(frontend)
            _stop_proc(backend)
            try: fixture_srv.shutdown()
            except Exception: pass


if __name__ == "__main__":
    raise SystemExit(run())
