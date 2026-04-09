import os
import json
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from .logger import logger

class TestCaseGenerator:
    def __init__(self, model_name: str = "gpt-4o", temperature: float = 0.2):
        self.llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_API_BASE")
        )

        self.system_prompt = """
You are an expert Test Automation Engineer. 
Your task is to read a natural language Product Requirement Document (PRD) or a feature description and automatically generate executable Python test code using the `ai_tester` framework.

The generated code MUST use the `ai_tester` framework (PlaywrightDriver, AITesterAgent, SmartAsserter) instead of traditional CSS selectors.
It should be formatted as a valid `pytest` script.

Here is the template you MUST follow for the generated code:

```python
import pytest
from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter
from dotenv import load_dotenv

load_dotenv()

def test_[feature_name](page):
    \"\"\"
    Test description based on the PRD.
    \"\"\"
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, model_name="gpt-4o")
    asserter = SmartAsserter(model_name="gpt-4o")
    
    # Step 1: Navigate to the target page (You must extract the URL from the PRD or use a placeholder like "https://example.com" if not provided)
    page.goto("URL_HERE", wait_until="domcontentloaded", timeout=60000)
    
    # Step 2: Use agent.step() with natural language to perform actions
    success = agent.step("Natural language instruction extracted from PRD")
    assert success is True, "AI Agent failed to execute the step"
    
    # Step 3: Use asserter.evaluate() to verify the expected outcome
    current_dom = agent.get_dom_tree_str()
    is_passed = asserter.evaluate(current_dom, "Expected outcome extracted from PRD")
    assert is_passed is True, "Assertion failed: [Reason]"
```

Rules:
1. Do NOT write traditional locators like `page.fill("#id", "value")`. ALWAYS use `agent.step("intent")`.
2. Do NOT use exact string assertions like `assert "text" in page.content()`. ALWAYS use `asserter.evaluate(dom, "intent")`.
3. If the PRD contains multiple distinct scenarios, generate multiple `def test_xxx(page):` functions.
4. Return ONLY the raw Python code. Do not include markdown backticks like ```python.
"""

    def generate_from_prd(self, prd_content: str, output_file: str) -> bool:
        """
        根据 PRD 内容生成测试脚本并保存到文件
        """
        logger.info("⚙️ 开始根据需求文档自动生成测试脚本...")
        
        user_prompt = f"""
Please generate the pytest script for the following PRD or natural language test scenario:

--- REQUIREMENT / SCENARIO START ---
{prd_content}
--- REQUIREMENT / SCENARIO END ---
"""
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        try:
            logger.info("大脑正在阅读需求文档并编写代码...")
            response = self.llm.invoke(messages)
            content = response.content.strip()
            
            # 清理可能的 Markdown 格式
            if content.startswith("```python"):
                content = content[9:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            # 确保输出目录存在
            os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
            
            # 写入文件
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(content)
                
            logger.info(f"✅ 测试脚本已成功生成并保存至: {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 测试用例生成失败: {str(e)}")
            return False
