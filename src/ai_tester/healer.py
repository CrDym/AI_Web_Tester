import os
import json
import os
import hashlib
from typing import Dict, Any, Tuple, Optional
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from .logger import logger

class SelfHealer:
    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.0, use_vision: bool = False, cache_dir: str = ".healer_cache"):
        self.use_vision = use_vision
        self.cache_dir = cache_dir
        
        # 确保缓存目录存在
        if not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)
            
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
4. A screenshot of the current page (if vision is enabled).

Your task is to find the most likely new element in the `current_dom` that corresponds to the missing element.

Return ONLY a JSON object in this exact format:
{
    "success": true/false,
    "new_target_id": "the ID of the matched element, or null if not found",
    "reason": "brief explanation of why you chose this element",
    "new_selector": "If possible, provide a reliable CSS selector for this new element (e.g., '#new-id' or '[data-testid=\"submit\"]')"
}
"""

    def _get_cache_key(self, original_selector: str, element_description: str) -> str:
        """生成缓存的唯一键值"""
        unique_string = f"{original_selector}_{element_description}"
        return hashlib.md5(unique_string.encode('utf-8')).hexdigest()

    def _rewrite_code_file(self, original_selector: str, new_selector: str) -> None:
        """
        自动代码回写机制：将 Python 测试文件中失效的 original_selector 替换为 new_selector
        """
        import inspect
        import os
        
        caller_frame = None
        for frame in inspect.stack():
            # 找到调用 healer.heal 的业务测试代码文件
            if frame.filename.endswith('.py') and not frame.filename.endswith('healer.py') and not frame.filename.endswith('agent.py') and not 'pytest' in frame.filename:
                caller_frame = frame
                break
                
        if not caller_frame:
            return
            
        file_path = caller_frame.filename
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # 简单的字符串替换
            if f'"{original_selector}"' in content or f"'{original_selector}'" in content:
                new_content = content.replace(f'"{original_selector}"', f'"{new_selector}"')
                new_content = new_content.replace(f"'{original_selector}'", f'"{new_selector}"')
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                logger.info(f"✨ [自愈回写] 成功将代码中的失效定位器 '{original_selector}' 永久修复为 '{new_selector}'")
        except Exception as e:
            logger.warning(f"⚠️ [自愈回写] 代码替换失败: {e}")

    def heal(self, original_selector: str, element_description: str, dom_tree_str: str, screenshot_base64: str = None) -> Optional[str]:
        """
        触发元素自愈机制，返回新的 AI ID
        """
        logger.warning(f"🚑 触发 AI 元素自愈机制!")
        logger.info(f"   丢失的定位器: '{original_selector}'")
        logger.info(f"   该元素的意图描述: '{element_description}'")
        
        # 1. 尝试从本地缓存中读取已经自愈过的结果
        cache_key = self._get_cache_key(original_selector, element_description)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                    
                # 如果缓存中有新选择器，这里其实可以进一步验证新选择器是否在当前 DOM 中有效
                # 为了简化，我们假设自愈后的选择器在一段时间内是稳定的
                if cached_data.get("new_selector"):
                    logger.info(f"   ⚡ 命中本地自愈缓存! 直接使用上次自愈成功的选择器: '{cached_data['new_selector']}'")
                    # 这里返回特殊的标记，告诉调用方这是一个 CSS 选择器而不是 AI ID
                    return f"SELECTOR:{cached_data['new_selector']}"
            except Exception as e:
                logger.warning(f"   ⚠️ 读取自愈缓存失败: {str(e)}")

        # 2. 缓存未命中，调用大模型进行自愈推理
        logger.info("   🧠 缓存未命中，正在呼叫大模型分析页面元素...")
        user_prompt = f"""
Original Selector: {original_selector}
Element Intent: {element_description}

Current DOM:
{dom_tree_str}

Please find the new `id` (the number inside the brackets, e.g., 8, 9, 10) for this element. Note that it might be a general text input field or specifically for a username.
"""
        if self.use_vision and screenshot_base64:
            human_content = [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{screenshot_base64}"}}
            ]
            logger.debug("已附加当前页面截图辅助元素自愈。")
        else:
            human_content = user_prompt

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=human_content)
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
                new_id = str(result["new_target_id"])
                new_selector = result.get("new_selector")
                
                logger.info(f"   ✅ 自愈成功! 找到新的元素 ID: [{new_id}]. 原因: {result.get('reason')}")
                
                # 3. 将大模型找到的新选择器写入本地缓存
                if new_selector:
                    logger.info(f"   💾 已将新选择器 '{new_selector}' 写入本地缓存，下次执行将直接使用。")
                    try:
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            json.dump({
                                "original_selector": original_selector,
                                "element_description": element_description,
                                "new_selector": new_selector,
                                "reason": result.get('reason')
                            }, f, ensure_ascii=False, indent=2)
                    except Exception as e:
                        logger.warning(f"   ⚠️ 写入自愈缓存失败: {str(e)}")
                        
                    # 触发自动代码修复
                    self._rewrite_code_file(original_selector, new_selector)
                        
                return new_id
            else:
                logger.error(f"   ❌ 自愈失败. 原因: {result.get('reason')}")
                return None
                
        except Exception as e:
            logger.error(f"   ❌ 自愈引擎发生异常: {str(e)}")
            return None
