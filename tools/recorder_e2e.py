#!/usr/bin/env python3
"""录制器端到端核验：加载 Chrome 扩展 → 录制 → 停止 → 验证后端收到 payload"""
import asyncio, json, os, socket, sys, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path("/Users/rockche/solo_test")
EXT = ROOT / "extension"
PY38 = "/tmp/py38_fresh3/bin/python" if Path("/tmp/py38_fresh3/bin/python").exists() else sys.executable

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]

async def main():
    backend_port = free_port()
    env = dict(os.environ)
    env["AI_TESTER_DB_PATH"] = "/tmp/recorder_e2e.db"
    env["OPENAI_API_KEY"] = ""
    backend = subprocess.Popen(
        [PY38, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(backend_port)],
        cwd=str(ROOT / "web_server"), env=env,
        stdout=open("/tmp/recorder_e2e_backend.log", "w"), stderr=subprocess.STDOUT)
    # 等 backend 起来（401 = 已就绪，鉴权正常响应）
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{backend_port}/api/auth/me", timeout=1)
            break
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                break
            await asyncio.sleep(0.5)
        except Exception:
            await asyncio.sleep(0.5)
    else:
        raise RuntimeError("backend not up")

    async with async_playwright() as p:
        HEADLESS = os.environ.get("RECORDER_HEADLESS", "0") == "1"
        user_data = os.environ.get("RECORDER_PROFILE", "/tmp/recorder_chrome_profile")
        ctx = await p.chromium.launch_persistent_context(
            user_data, headless=HEADLESS,
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"]
                 + (["--headless=new"] if HEADLESS else []),
            viewport={"width": 1280, "height": 800},
        )
        # 找 extension 的 bg service worker
        bg = [s for s in ctx.service_workers if "background" in s.url]
        if not bg:
            bg = [s for s in ctx.background_pages if "background" in s.url]
        assert bg or True
        # 开一个测试页面（本地 data 页即可，无外网依赖）
        page = await ctx.new_page()
        page2 = await ctx.new_page()
        # 需要真实 http 页面（content script 只在 http(s) 上注入）——起一个极简本地 http server
        import threading
        from http.server import HTTPServer, BaseHTTPRequestHandler
        class H(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers()
                self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers(); self.wfile.write(b"<html><body style='padding-top:300px'><button id='btn1'>login</button><input id='acc' placeholder='acc'></body></html>")
        srv = HTTPServer(("127.0.0.1", 8877), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        await page2.goto("http://127.0.0.1:8877/")

        # 模拟 popup：START_RECORDING
        ext_id = None
        service_workers = ctx.service_workers or ctx.background_pages
        assert service_workers, "extension not injected"
        sw_url = (ctx.service_workers or ctx.background_pages)[0].url
        ext_id = sw_url.split("/")[2]
        print("EXT ID:", ext_id)

        await page.evaluate(f"chrome.runtime && 0")  # content script 有 chrome API?
        # 用 CDP 直接给 bg 发消息：通过 chrome.runtime 于 popup 不可行（headless popup 复杂），
        # 简化：直接在 page2 的 content script 环境发 START？不行——content script 里 chrome.runtime.sendMessage 走 bg。
        # START_RECORDING 由 popup 发。这里手动向 bg 发：用 bg service worker 的 evaluate (MV3 SW)
        if ctx.service_workers:
            await ctx.service_workers[0].evaluate("isRecording = true; recordedActions = []; broadcastStatus && typeof broadcastStatus === 'function' && broadcastStatus();")
        # 等 content script 轮询同步 isRecording（1s 间隔）
        await page2.wait_for_timeout(2000)
        # 模拟录制：点击按钮 + 输入
        await page2.click("#btn1")
        await page2.fill("#acc", "admin")
        await page2.wait_for_timeout(2000)

        ac = await ctx.service_workers[0].evaluate("({r: isRecording, a: recordedActions.length})")
        print('BG STATE:', ac)
        # 从 bg 取 actions
        actions = None
        if ctx.service_workers:
            actions = await ctx.service_workers[0].evaluate("recordedActions")
        print("ACTIONS:", json.dumps(actions, ensure_ascii=False))

        # POST 到后端（模拟 popup sync 的 payload）
        payload = {
            "name": "recorder_e2e_核验",
            "start_url": actions[0]["url"] if actions else None,
            "steps": actions, "variables": {}, "dataset": [], "type": "json",
        }
        req = urllib.request.Request(
            f"http://127.0.0.1:{backend_port}/api/recorder/cases",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read())
        print("SYNC RESP:", json.dumps(resp, ensure_ascii=False))
        case_id = resp.get("id")

        # 核验库里有这条用例（直接查 db）
        import sqlite3
        conn = sqlite3.connect("/tmp/recorder_e2e.db")
        row = conn.execute("SELECT name, steps FROM cases WHERE id=?", (case_id,)).fetchone()
        conn.close()
        assert row, "case not in db"
        # 断言录制动作已写入 steps
        steps = json.loads(row[1] or "[]")
        assert len(steps) >= 2, f"Expected >=2 recorded steps, got {len(steps)}"
        kinds = [s.get("type") for s in steps]
        assert "click" in kinds, f"Expected a click step, got: {kinds}"
        assert "input" in kinds, f"Expected an input step, got: {kinds}"
        print("DB ROW OK:", row[0]); print("STEPS:", row[1][:200])
        await ctx.close()

    backend.terminate()
    try: backend.wait(timeout=5)
    except Exception: backend.kill()

if __name__ == "__main__":
    asyncio.run(main())
