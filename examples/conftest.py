import sys
import os

# 将 src 目录添加到 sys.path 中以便可以导入 ai_tester
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# 注册钩子以生成 HTML 报告
pytest_plugins = ["ai_tester.pytest_plugin"]

import pytest
from playwright.sync_api import sync_playwright

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        # 支持从 main.py 环境变量接收是否以无头模式运行
        headless_mode = os.environ.get("PLAYWRIGHT_HEADLESS") == "1"
        browser = p.chromium.launch(headless=headless_mode, slow_mo=500)
        yield browser
        browser.close()

@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()
