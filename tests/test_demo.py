import os
import pytest
from playwright.sync_api import sync_playwright
from ai_tester.driver import PlaywrightDriver
from ai_tester.agent import AITesterAgent
from ai_tester.healer import SelfHealer
from ai_tester.asserter import SmartAsserter
from ai_tester.logger import logger
from dotenv import load_dotenv

load_dotenv()

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        yield browser
        browser.close()

@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()

def test_login_with_ai_agent(page):
    """
    使用混合编程模式（AutoPlaywright 风格）的测试用例。
    """
    # 使用 domcontentloaded 替代 load，减少等待时间
    page.goto("https://practicetestautomation.com/practice-test-login/", wait_until="domcontentloaded", timeout=60000)
    assert page.title() == "Test Login | Practice Test Automation"

    # AI Agent 驱动执行（意图驱动，解决脚本脆弱性）
    driver = PlaywrightDriver(page)
    # 这里使用 GitHub Models 提供的免费 gpt-4o 模型
    agent = AITesterAgent(driver, model_name="gpt-4o")
    
    # 用自然语言描述测试步骤
    intent_str = "Login with username 'student' and password 'Password123', then click submit."
    
    # Agent 开始探索并执行
    success = agent.step(intent_str, max_steps=5)
    
    # 验证是否成功
    assert success is True
    
    # AI 智能断言验证登录结果
    asserter = SmartAsserter(model_name="gpt-4o")
    current_dom = agent.get_dom_tree_str()
    
    # 通过自然语言断言
    assertion_result = asserter.evaluate(current_dom, "The user has logged in successfully and a success message is displayed on the page.")
    assert assertion_result is True, "AI 断言失败：未能确认用户登录成功"

def test_self_healing_mechanism(page):
        """
        演示混合架构下的 AI 元素自愈 (Self-Healing) 功能。
        """
        logger.info("=== 测试元素自愈机制 ===")
        page.goto("https://practicetestautomation.com/practice-test-login/", wait_until="domcontentloaded", timeout=60000)
        
        driver = PlaywrightDriver(page)
        agent = AITesterAgent(driver, model_name="gpt-4o")
        healer = SelfHealer(model_name="gpt-4o")
        
        # 假设这是传统的脚本代码，我们写死了一个 CSS Selector：
        # 原本应该是 "#username"，但由于前端重构，现在它变成了类似 "#user-name-v2"
        # 我们故意使用一个绝对会失败的错误选择器 "#old-username-input" 来模拟前端 DOM 变更
        broken_selector = "#old-username-input"
        intent_description = "The username input field for login"
        
        # 尝试传统方式定位元素
        try:
            # Playwright 的严格定位，如果找不到会抛出 TimeoutError
            page.fill(broken_selector, "student", timeout=2000)
            logger.info("✅ 传统脚本执行成功 (元素未变更)")
        except Exception as e:
            logger.warning(f"⚠️ 传统脚本执行失败，触发 AI 自愈机制！错误信息: {str(e)[:50]}...")
            
            # 获取当前页面的压缩 DOM 树
            current_dom = agent.get_dom_tree_str()
            
            # 呼叫自愈引擎
            new_id = healer.heal(broken_selector, intent_description, current_dom)
            
            # 验证自愈结果
            assert new_id is not None, "自愈失败，无法找到替代元素"
            
            # 使用自愈后的大模型 ID 继续执行操作
            logger.info(f"🔧 正在使用自愈后的新元素 ID [{new_id}] 继续执行操作...")
            driver.perform_action("type", new_id, "student")
            
            # 验证输入是否成功
            assert page.locator("#username").input_value() == "student"
            logger.info("🎉 自愈操作执行成功！测试通过。")
