import os
import json
from typing import Dict, Any, Tuple, Optional
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from .logger import logger

class SelfHealer:
    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.0):
        # 独立的 LLM 实例，专用于自愈推理
        self.llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_API_BASE")
        )

        self.system_prompt = """
You are an expert Web Automation Self-Healing Engine.
A test script failed to locate an element using the provided `original_selector` because the UI has changed.
You will be given:
1. `original_selector`: The selector that used to work (e.g., '#btn-submit-v1').
2. `element_description`: A natural language description of what the element is supposed to do (e.g., 'The login submit button').
3. `current_dom`: A compressed DOM tree (Accessibility Tree) of the current page, where each element has an `[id]`.

Your task is to find the most likely new element in the `current_dom` that corresponds to the missing element.

Return ONLY a JSON object in this exact format:
{
    "success": true/false,
    "new_target_id": "the ID of the matched element, or null if not found",
    "reason": "brief explanation of why you chose this element"
}
"""

    def heal(self, original_selector: str, element_description: str, dom_tree_str: str) -> Optional[str]:
        """
        触发元素自愈机制，返回新的 AI ID
        """
        logger.warning(f"🚑 触发 AI 元素自愈机制!")
        logger.info(f"   丢失的定位器: '{original_selector}'")
        logger.info(f"   该元素的意图描述: '{element_description}'")
        
        user_prompt = f"""
Original Selector: {original_selector}
Element Intent: {element_description}

Current DOM:
{dom_tree_str}

Please find the new `id` (the number inside the brackets, e.g., 8, 9, 10) for this element. Note that it might be a general text input field or specifically for a username.
"""
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = response.content.strip()
            
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            result = json.loads(content)
            
            if result.get("success") and result.get("new_target_id"):
                logger.info(f"   ✅ 自愈成功! 找到新的元素 ID: [{result['new_target_id']}]. 原因: {result.get('reason')}")
                return str(result["new_target_id"])
            else:
                logger.error(f"   ❌ 自愈失败. 原因: {result.get('reason')}")
                return None
                
        except Exception as e:
            logger.error(f"   ❌ 自愈引擎发生异常: {str(e)}")
            return None
