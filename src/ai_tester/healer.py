import re
from typing import Optional

def _sanitize_css_selector(selector: Optional[str]) -> Optional[str]:
    if not isinstance(selector, str):
        return None
    s = selector.strip()
    if not s:
        return None
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1].strip()
    s = s.replace('\\"', '"').replace("\\'", "'")
    if not s:
        return None
    if len(s) > 500:
        return None
    if any(c in s for c in ("\n", "\r", "\t")):
        return None
    if s.endswith("\\"):
        return None
    if s.count('"') % 2 == 1:
        return None
    if s.count("'") % 2 == 1:
        return None
    if s.count("[") != s.count("]"):
        return None
    if s.count("(") != s.count(")"):
        return None
    if ":has-text" in s:
        if not re.search(r":has-text\(\s*(['\"]).+?\1\s*\)", s):
            return None
    return s

def _derive_selector_from_dom_tree(dom_tree_str: str, target_id: str) -> Optional[str]:
    if not isinstance(dom_tree_str, str) or not isinstance(target_id, str):
        return None
    m = re.search(rf"^\s*-\s*\[{re.escape(target_id)}\]\s+([a-zA-Z0-9_-]+)\s+(.*)$", dom_tree_str, re.MULTILINE)
    if not m:
        return None
    tag = (m.group(1) or "").strip()
    rest = (m.group(2) or "").strip()
    idm = re.search(r'id:"([^"]+)"', rest)
    if idm:
        v = idm.group(1).strip()
        if v:
            return f"#{v}"
    namem = re.search(r'name:"([^"]+)"', rest)
    if namem:
        v = namem.group(1).strip()
        if v:
            return f'[name="{v}"]'
    plm = re.search(r'pl:"([^"]+)"', rest)
    if plm and tag:
        v = plm.group(1).strip()
        if v:
            return f'{tag}[placeholder="{v}"]'
    textm = re.search(r'^"([^"]+)"', rest)
    if textm:
        v = textm.group(1).strip()
        if v:
            return f'text="{v}"'
    return None
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
            max_tokens=8192,
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_API_BASE")
        )

        prompt_path = os.path.join(os.path.dirname(__file__), 'prompts', 'healer_system_prompt.txt')
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                self.system_prompt = f.read().strip()
        except Exception as e:
            logger.warning(f"⚠️ 无法加载系统提示词文件 {prompt_path}: {e}，将使用内置的 Fallback 提示词。")
            self.system_prompt = "You are a Web Automation Self-Healing Engine. Output JSON."

    def _push_heal_event(self, payload: Dict[str, Any]) -> None:
        try:
            session_id = os.environ.get("AI_TESTER_WS_SESSION")
            port = os.environ.get("AI_TESTER_WS_PORT", "8000")
            if not session_id:
                return
            import urllib.request
            internal_token = os.environ.get("AI_TESTER_INTERNAL_TOKEN")
            headers = {"Content-Type": "application/json"}
            if internal_token:
                headers["X-Internal-Token"] = internal_token
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/internal/push_heal_event/{session_id}",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers=headers,
            )
            urllib.request.urlopen(req, timeout=1)
        except Exception:
            return

    def _get_cache_key(self, original_selector: str, element_description: str) -> str:
        """生成缓存的唯一键值"""
        unique_string = f"{original_selector}_{element_description}"
        return hashlib.md5(unique_string.encode('utf-8')).hexdigest()

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
        ignore_cache = os.environ.get("AI_TESTER_IGNORE_CACHE") == "1"
        
        if not ignore_cache and original_selector and str(original_selector).strip() and str(original_selector).strip() != "null":
            cache_key = self._get_cache_key(original_selector, element_description)
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
            
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached_data = json.load(f)
                        
                    # 如果缓存中的新选择器和原本失效的选择器一模一样，说明这个缓存是无意义的“脏数据”，忽略它
                    if cached_data.get("new_selector") and cached_data.get("new_selector") != original_selector:
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
                
            # 引入健壮的 JSON 解析
            import re
            raw = (content or "").strip()
            fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
            if fence_match:
                raw = fence_match.group(1).strip()
            raw = raw.strip("\ufeff").strip()

            candidates = []
            try:
                inner = json.loads(raw)
                if isinstance(inner, str):
                    candidates.append(inner.strip())
            except Exception:
                pass
            candidates.append(raw)
            if "{" in raw and "}" in raw:
                candidates.append(raw[raw.find("{"):raw.rfind("}") + 1])
                
            idx = raw.find('"success"')
            if idx != -1:
                frag = raw[idx:].strip()
                if not frag.startswith("{"):
                    frag = "{" + frag
                if not frag.endswith("}"):
                    frag = frag + "}"
                candidates.append(frag)

            decoder = json.JSONDecoder()
            result = None
            
            for cand in candidates:
                try:
                    s = (cand or "").strip()
                    if not s:
                        continue
                    if not (s.startswith("{") or s.startswith("[")):
                        if "{" in s:
                            s = s[s.find("{") :]
                        else:
                            if not s.startswith("{"):
                                s = "{" + s
                            if not s.endswith("}"):
                                s = s + "}"
                    obj, _ = decoder.raw_decode(s)
                    if isinstance(obj, dict):
                        result = obj
                        break
                except Exception:
                    continue

            if not isinstance(result, dict):
                try:
                    lines = [ln.strip() for ln in (raw or "").splitlines() if ln.strip()]
                    obj = {}
                    for ln in lines:
                        m = re.match(r'^"([^"]+)"\s*:\s*(.+?)\s*,?$', ln)
                        if not m:
                            continue
                        k = m.group(1)
                        v_raw = m.group(2).strip()
                        if v_raw in ("true", "false", "null"):
                            v = {"true": True, "false": False, "null": None}[v_raw]
                        else:
                            try:
                                v = json.loads(v_raw)
                            except Exception:
                                v = v_raw.strip('"')
                        obj[k] = v
                    if obj:
                        if "success" not in obj:
                            nt = obj.get("new_target_id")
                            obj["success"] = bool(nt)
                        result = obj
                except Exception:
                    result = None

            if not isinstance(result, dict):
                logger.error(f"❌ 自愈引擎 JSON 解析彻底失败: 无法从大模型输出中提取 JSON 对象。原始输出:\n{content}")
                raise ValueError("JSON parse failed")
            
            if result.get("success") and result.get("new_target_id"):
                new_id = str(result["new_target_id"])
                new_selector = _sanitize_css_selector(result.get("new_selector"))
                derived_selector = _derive_selector_from_dom_tree(dom_tree_str, new_id)
                if derived_selector:
                    # 如果 AI 给出的 new_selector 和失效的 original_selector 一模一样，这说明 AI 虽然找到了元素，但生成新选择器的能力不行
                    # 此时必须强制使用底层反推出来的 derived_selector
                    if new_selector == original_selector:
                        logger.warning(f"⚠️ AI 生成的新选择器 '{new_selector}' 与失效的旧选择器完全相同！已强制回退使用底层 DOM 反推选择器: '{derived_selector}'")
                        new_selector = derived_selector
                    elif not new_selector:
                        new_selector = derived_selector
                    elif new_selector == "#basic":
                        new_selector = derived_selector
                    elif derived_selector.startswith("#") and (not new_selector or (new_selector.startswith("#basic") and derived_selector.startswith("#basic_") and len(derived_selector) > len(new_selector))):
                        new_selector = derived_selector
                    elif any(k in new_selector for k in ("nth-child", "last-child", ">")) and not any(k in derived_selector for k in ("nth-child", "last-child", ">")):
                        new_selector = derived_selector
                
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
                    # 如果新选择器和旧的完全一样，坚决不写入缓存，防止产生脏缓存
                    if new_selector == original_selector:
                        logger.warning(f"   ⚠️ 新选择器与原选择器一致 ('{new_selector}')，拒绝写入本地自愈缓存。")
                    elif score >= 50:
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
                    else:
                        logger.warning(f"   ⚠️ 新选择器 '{new_selector}' 稳定性评分过低 ({score})，本次生效但拒绝自动写入缓存与回写。")
                        
                return f"SELECTOR:{new_selector}" if new_selector else str(new_id)
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
