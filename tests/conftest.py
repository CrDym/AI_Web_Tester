import sys
import os

# 将 src 目录添加到 sys.path 中以便可以导入 ai_tester
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# 注册钩子以生成 HTML 报告
pytest_plugins = ["ai_tester.pytest_plugin"]

import pytest
from playwright.sync_api import sync_playwright
from ai_tester import run_context

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        # 支持从 main.py 环境变量接收是否以无头模式运行
        headless_mode = os.environ.get("PLAYWRIGHT_HEADLESS") == "1"
        browser = p.chromium.launch(
            headless=headless_mode, 
            slow_mo=1000, # 减慢执行速度方便我们看清 UI
            args=['--window-size=1920,1080']
        )
        yield browser
        browser.close()

@pytest.fixture
def page(browser, request):
    # 使用 1920x1080 视口，防止侧边栏或顶部导航被折叠
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    run_context.set_current_test(request.node.nodeid)
    yield page
    
    # 检查测试用例是否失败，如果失败则截图
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        base_dir = os.environ.get("AI_TESTER_RUN_DIR") or os.path.join(os.getcwd(), "logs")
        screenshot_dir = os.path.join(base_dir, "failure_screenshots")
        os.makedirs(screenshot_dir, exist_ok=True)
        # 用测试用例名称生成截图文件名
        screenshot_path = os.path.join(screenshot_dir, f"{request.node.name}_failed.png")
        try:
            page.screenshot(path=screenshot_path)
            print(f"\n📸 测试用例 [{request.node.name}] 失败！截图已保存至: {screenshot_path}")
        except Exception as e:
            print(f"\n⚠️ 保存失败截图时发生异常: {e}")
            
    run_context.clear_current_test()
    context.close()
