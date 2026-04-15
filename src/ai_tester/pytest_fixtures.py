import os
import pytest
from playwright.sync_api import sync_playwright
from . import run_context

pytest_plugins = ["ai_tester.pytest_plugin"]


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        headless_mode = os.environ.get("PLAYWRIGHT_HEADLESS") == "1"
        browser = p.chromium.launch(
            headless=headless_mode,
            slow_mo=1000,
            args=["--window-size=1920,1080"],
        )
        yield browser
        browser.close()


@pytest.fixture
def page(browser, request):
    storage_state_path = os.environ.get("AI_TESTER_STORAGE_STATE_PATH")
    if storage_state_path:
        storage_state_path = os.path.abspath(storage_state_path)
    if storage_state_path and os.path.exists(storage_state_path):
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            storage_state=storage_state_path,
        )
    else:
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = context.new_page()
    run_context.set_current_test(request.node.nodeid)
    yield page

    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        base_dir = os.environ.get("AI_TESTER_RUN_DIR") or os.path.join(os.getcwd(), "logs")
        screenshot_dir = os.path.join(base_dir, "failure_screenshots")
        os.makedirs(screenshot_dir, exist_ok=True)
        screenshot_path = os.path.join(screenshot_dir, f"{request.node.name}_failed.png")
        try:
            page.screenshot(path=screenshot_path)
            print(f"\n📸 测试用例 [{request.node.name}] 失败！截图已保存至: {screenshot_path}")
        except Exception as e:
            print(f"\n⚠️ 保存失败截图时发生异常: {e}")

    run_context.clear_current_test()
    if storage_state_path:
        try:
            os.makedirs(os.path.dirname(storage_state_path), exist_ok=True)
            context.storage_state(path=storage_state_path)
        except Exception as e:
            print(f"\n⚠️ 保存 storageState 失败: {e}")
    context.close()

