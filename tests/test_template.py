from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter

def test_custom_feature(page):
    """
    这是一个预置的测试用例模板。
    您可以基于此模板，手动编写自己的意图驱动测试。
    """
    # 1. 初始化 AI 驱动与引擎
    # 推荐使用 gpt-4o 或 claude-3.5-sonnet 等强力模型
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, model_name="gpt-4o")
    asserter = SmartAsserter(model_name="gpt-4o")
    
    # 2. 跳转到测试目标网页
    # 提示: 使用 domcontentloaded 替代 load 可以让页面更快准备好被测试
    page.goto("https://example.com", wait_until="domcontentloaded", timeout=60000)
    
    # 3. 使用自然语言意图操作页面
    # 例如: agent.step("点击右上角的登录按钮，在弹出的表单中输入账号 admin，密码 123456，然后点击确认")
    success = agent.step("请用自然语言描述您的操作步骤")
    
    # 验证 Agent 是否成功执行了您的指令
    assert success is True, "AI Agent 未能成功执行操作"
    
    # 4. 智能断言验证结果
    # 提取操作完成后的页面 DOM 树
    current_dom = agent.get_dom_tree_str()
    
    # 用自然语言描述您期望看到的页面状态
    # 例如: "页面提示登录成功，且右上角显示了用户名 admin"
    is_passed = asserter.evaluate(current_dom, "请用自然语言描述期望的结果")
    
    # 验证断言是否通过
    assert is_passed is True, "智能断言失败：页面状态与预期不符"

