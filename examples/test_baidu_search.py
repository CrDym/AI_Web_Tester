import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

import pytest
from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter
from dotenv import load_dotenv

load_dotenv()

def test_baidu_search_openai(page):
    """
    Test that the Baidu search functionality works correctly by searching for 'OpenAI' 
    and verifying that the results page displays relevant content.
    """
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, model_name="gpt-4o")
    asserter = SmartAsserter(model_name="gpt-4o")
    
    # Step 1: Navigate to the Baidu homepage
    page.goto("https://www.baidu.com", wait_until="domcontentloaded", timeout=60000)
    
    # Step 2: Input 'OpenAI' into the search box
    success = agent.step("在搜索框中输入 'OpenAI'")
    assert success is True, "AI Agent failed to input 'OpenAI' into the search box"
    
    # Step 3: Click the '百度一下' button to perform the search
    success = agent.step("点击 '百度一下' 按钮")
    assert success is True, "AI Agent failed to click the '百度一下' button"
    
    # Step 4: Verify that the results page displays content related to 'OpenAI'
    current_dom = agent.get_dom_tree_str()
    is_passed = asserter.evaluate(current_dom, "页面展示与 'OpenAI' 相关的搜索结果列表")
    assert is_passed is True, "Assertion failed: The search results page does not display content related to 'OpenAI'"