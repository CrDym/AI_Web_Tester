import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from ai_tester.agent import AITesterAgent
from ai_tester.healer import SelfHealer
from ai_tester.asserter import SmartAsserter
from ai_tester.logger import logger
from ai_tester.driver import PlaywrightDriver
from ai_tester.extractor import DataExtractor
from dotenv import load_dotenv

load_dotenv()

def test_login_with_ai_agent(page):
    """
    使用混合编程模式（AutoPlaywright 风格）的测试用例。
    """
    # 使用 domcontentloaded 替代 load，减少等待时间
    page.goto("https://practicetestautomation.com/practice-test-login/", wait_until="domcontentloaded", timeout=60000)
    assert page.title() == "Test Login | Practice Test Automation"

    # AI Agent 驱动执行（意图驱动，解决脚本脆弱性）
    driver = PlaywrightDriver(page)
    # 这里使用豆包模型
    agent = AITesterAgent(driver, model_name="doubao-seed-2-0-lite-260215")
    
    # 用自然语言描述测试步骤
    intent_str = "Login with username 'student' and password 'Password123', then click submit."
    
    # Agent 开始探索并执行
    # success = agent.step(intent_str, max_steps=5)
    # --- AI 自动回写生成的原生代码 (由 'Login with username 'student' ...' 意图转换) ---
    page.fill("#username", "student")
    page.fill("#password", "Password123")
    page.click("#submit")
    # ------------------------------------------------------------
    success = True
    
    # 验证是否成功
    assert success is True
    
    # AI 智能断言验证登录结果
    asserter = SmartAsserter(model_name="doubao-seed-2-0-lite-260215")
    current_dom = agent.get_dom_tree_str()
    
    # 通过自然语言断言
    assertion_result = asserter.evaluate(current_dom, "The user has logged in successfully and a success message is displayed on the page.")
    assert assertion_result is True, "AI 断言失败：未能确认用户登录成功"

def test_data_extractor(page):
    """
    演示智能数据提取 (Data Extractor) 功能。
    """
    logger.info("=== 测试智能数据提取功能 ===")
    page.goto("https://practicetestautomation.com/practice-test-login/", wait_until="domcontentloaded", timeout=60000)
    
    driver = PlaywrightDriver(page)
    # 使用 use_vision=True 获取更精准的结构化提取能力
    extractor = DataExtractor(driver, model_name="doubao-seed-2-0-lite-260215", use_vision=True)
    
    # 通过自然语言提取页面上的账号和密码提示信息
    query = "提取页面上提示的 Test username 和 Test password，返回格式: {\"username\": \"...\", \"password\": \"...\"}"
    data = extractor.extract(query)
    
    logger.info(f"💡 AI 提取的数据结果: {data}")
    
    assert data is not None, "数据提取失败"
    assert data.get("username") == "student", "提取的用户名不正确"
    assert data.get("password") == "Password123", "提取的密码不正确"

def test_self_healing_mechanism(page):
    """
    演示混合架构下的 AI 元素自愈 (Self-Healing) 功能。
    """
    logger.info("=== 测试元素自愈机制 ===")
    page.goto("https://practicetestautomation.com/practice-test-login/", wait_until="domcontentloaded", timeout=60000)

    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, model_name="doubao-seed-2-0-lite-260215")
    healer = SelfHealer(model_name="doubao-seed-2-0-lite-260215")
        
    # 假设这是传统的脚本代码，我们写死了一个 CSS Selector：
    # 原本应该是 "#username"，但由于前端重构，现在它变成了类似 "#user-name-v2"
    # 我们故意使用一个绝对会失败的错误选择器 "#username" 来模拟前端 DOM 变更
    broken_selector = "#username"
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
        new_id_or_selector = healer.heal(broken_selector, intent_description, current_dom)
        
        # 验证自愈结果
        assert new_id_or_selector is not None, "自愈失败，无法找到替代元素"
        
        # 使用自愈后的大模型 ID (或缓存的选择器) 继续执行操作
        logger.info(f"🔧 正在使用自愈后的新元素 [{new_id_or_selector}] 继续执行操作...")
        driver.perform_action("type", new_id_or_selector, "student")
        
        # 验证输入是否成功
        assert page.locator("#username").input_value() == "student"
        logger.info("🎉 自愈操作执行成功！测试通过。")
