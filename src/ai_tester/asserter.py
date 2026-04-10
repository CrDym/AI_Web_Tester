import os
import json
from typing import Dict, Any, Tuple
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from .logger import logger

class SmartAsserter:
    def __init__(self, model_name: str = "doubao-seed-2-0-lite-260215", temperature: float = 0.0, use_vision: bool = False):
        self.use_vision = use_vision
        self.llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_API_BASE")
        )

        self.system_prompt = """
You are an expert Web Automation QA Engineer.
You will be provided with a compressed DOM tree (Accessibility Tree) of the current web page.
You may also be provided with a screenshot of the current page if vision is enabled.
You need to evaluate whether a specific assertion condition (natural language) is TRUE or FALSE based entirely on the provided DOM and screenshot.

Return ONLY a JSON object in this exact format:
{
    "result": true or false,
    "reason": "a brief explanation of your judgment based on the DOM elements found or missing (and visual evidence if provided)"
}
"""

    def evaluate(self, dom_tree_str: str, assertion_condition: str, screenshot_base64: str = None) -> bool:
        """
        根据页面 DOM (和可选的截图) 以及自然语言断言条件，返回判断结果
        """
        logger.info(f"🔍 触发智能断言: '{assertion_condition}'")
        
        user_prompt = f"""
Assertion Condition: {assertion_condition}

Current DOM:
{dom_tree_str}

Is the assertion condition true based on the DOM/screenshot?
"""
        if self.use_vision and screenshot_base64:
            human_content = [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{screenshot_base64}"}}
            ]
            logger.debug("已附加当前页面截图辅助智能断言。")
        else:
            human_content = user_prompt

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=human_content)
        ]
        
        try:
            logger.info("智能断言正在思考中...")
            response = self.llm.invoke(messages)
            content = response.content.strip()
            
            # 打印 Token 消耗情况
            if hasattr(response, 'response_metadata') and 'token_usage' in response.response_metadata:
                usage = response.response_metadata['token_usage']
                logger.info(f"📊 Token 消耗: Prompt={usage.get('prompt_tokens', 0)}, Completion={usage.get('completion_tokens', 0)}, 总计={usage.get('total_tokens', 0)}")
            
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            result = json.loads(content)
            
            is_true = result.get("result", False)
            reason = result.get("reason", "No reason provided")
            
            if is_true:
                logger.info(f"✅ 断言通过 (PASSED). 理由: {reason}")
            else:
                logger.error(f"❌ 断言失败 (FAILED). 理由: {reason}")
                
            return is_true
            
        except Exception as e:
            logger.error(f"❌ 智能断言引擎发生异常: {str(e)}")
            return False
