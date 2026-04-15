import os
import json
import os
import hashlib
from typing import Dict, Any, Tuple, Optional
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from .logger import logger
from . import run_context

class SelfHealer:
    def __init__(self, model_name: str = None, temperature: float = 0.0, use_vision: bool = False, cache_dir: str = ".healer_cache"):
        self.use_vision = use_vision
        self.cache_dir = cache_dir
        
        # 确保缓存目录存在
        if not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)
            
        final_model_name = model_name or os.environ.get("OPENAI_MODEL_NAME")
        if not final_model_name:
            raise ValueError("未配置大模型名称。请在环境变量或代码中配置 OPENAI_MODEL_NAME。")

        # 独立的 LLM 实例，专用于自愈推理
        self.llm = ChatOpenAI(
            model=final_model_name,
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
    "new_selector": "Provide a reliable CSS selector for this new element. Prioritize data-testid, role, or aria attributes. Avoid overly complex structural paths if possible. Ensure it is unique."
}
"""

    def _push_heal_event(self, payload: Dict[str, Any]) -> None:
        try:
            session_id = os.environ.get("AI_TESTER_WS_SESSION")
            port = os.environ.get("AI_TESTER_WS_PORT", "8000")
            if not session_id:
                return
            import urllib.request
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/internal/push_heal_event/{session_id}",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=1)
        except Exception:
            return

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
            if new_selector == original_selector:
                return
                
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
        # 优化: 如果 original_selector 为空（自然语言新建的用例），我们不使用缓存，强制让大模型重新走一遍推理
        cache_file = None
        if original_selector and str(original_selector).strip() and str(original_selector).strip() != "null":
            cache_key = self._get_cache_key(original_selector, element_description)
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
            
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached_data = json.load(f)
                        
                    if cached_data.get("new_selector"):
                        logger.info(f"   ⚡ 命中本地自愈缓存! 直接使用上次自愈成功的选择器: '{cached_data['new_selector']}'")
                        token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                        self._push_heal_event({
                            "success": True,
                            "source": "cache",
                            "intent": element_description,
                            "original_selector": original_selector,
                            "new_id": None,
                            "new_selector": cached_data.get("new_selector"),
                            "reason": cached_data.get("reason"),
                            "token_usage": token_usage,
                            "model": os.environ.get("OPENAI_MODEL_NAME"),
                        })
                        run_context.record_event("llm_heal_cache", f"intent={element_description}", token_usage=token_usage)
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

Please find the new `id` (the number inside the brackets, e.g., 8, 9, 10) for this element. Ensure that the returned `new_selector` is as simple and stable as possible.
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
            token_usage = None
            try:
                if hasattr(response, "response_metadata") and isinstance(response.response_metadata, dict):
                    token_usage = response.response_metadata.get("token_usage")
            except Exception:
                token_usage = None
            
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            result = json.loads(content)
            
            if result.get("success") and result.get("new_target_id"):
                new_id = str(result["new_target_id"])
                new_selector = result.get("new_selector")
                
                # 简单评分机制：如果包含特定属性，则认为比较稳定
                score = 50
                if new_selector:
                    if 'data-testid' in new_selector or 'data-test-id' in new_selector or 'aria-label' in new_selector:
                        score += 30
                    elif 'text=' in new_selector or ':has-text' in new_selector:
                        score += 20
                    elif 'nth-child' in new_selector or '>' in new_selector:
                        score -= 20
                
                logger.info(f"   ✅ 自愈成功! 找到新的元素 ID: [{new_id}]. 稳定性评分: {score}. 原因: {result.get('reason')}")
                self._push_heal_event({
                    "success": True,
                    "source": "llm",
                    "intent": element_description,
                    "original_selector": original_selector,
                    "new_id": new_id,
                    "new_selector": new_selector,
                    "reason": f"[Score: {score}] " + (result.get("reason") or ""),
                    "token_usage": token_usage,
                    "model": os.environ.get("OPENAI_MODEL_NAME"),
                })
                if token_usage:
                    run_context.record_event("llm_heal", f"intent={element_description}", token_usage=token_usage)
                
                # 3. 将大模型找到的新选择器写入本地缓存（低分不自动缓存与回写）
                if new_selector and cache_file:
                    if score >= 50:
                        logger.info(f"   💾 已将新选择器 '{new_selector}' 写入本地缓存，下次执行将直接使用。")
                        try:
                            with open(cache_file, 'w', encoding='utf-8') as f:
                                json.dump({
                                    "original_selector": original_selector,
                                    "element_description": element_description,
                                    "new_selector": new_selector,
                                    "reason": result.get('reason'),
                                    "score": score
                                }, f, ensure_ascii=False, indent=2)
                        except Exception as e:
                            logger.warning(f"   ⚠️ 写入自愈缓存失败: {str(e)}")
                            
                        # 触发自动代码修复
                        if new_selector != original_selector:
                            self._rewrite_code_file(original_selector, new_selector)
                    else:
                        logger.warning(f"   ⚠️ 新选择器 '{new_selector}' 稳定性评分过低 ({score})，本次生效但拒绝自动写入缓存与回写。")
                        
                return f"SELECTOR:{new_selector}" if new_selector else new_id
            else:
                logger.error(f"   ❌ 自愈失败. 原因: {result.get('reason')}")
                self._push_heal_event({
                    "success": False,
                    "source": "llm",
                    "intent": element_description,
                    "original_selector": original_selector,
                    "new_id": None,
                    "new_selector": None,
                    "reason": result.get("reason"),
                    "token_usage": token_usage,
                    "model": os.environ.get("OPENAI_MODEL_NAME"),
                })
                if token_usage:
                    run_context.record_event("llm_heal_fail", f"intent={element_description}", token_usage=token_usage)
                return None
                
        except Exception as e:
            logger.error(f"   ❌ 自愈引擎发生异常: {str(e)}")
            self._push_heal_event({
                "success": False,
                "source": "exception",
                "intent": element_description,
                "original_selector": original_selector,
                "new_id": None,
                "new_selector": None,
                "reason": str(e),
                "token_usage": token_usage if "token_usage" in locals() else None,
                "model": os.environ.get("OPENAI_MODEL_NAME"),
            })
            return None
