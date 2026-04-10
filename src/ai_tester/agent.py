import os
import json
from typing import Dict, Any, Tuple
from .driver import PlaywrightDriver
from .logger import logger
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage, SystemMessage

class AITesterAgent:
    def __init__(self, driver: PlaywrightDriver, model_name: str = "doubao-seed-2-0-lite-260215", temperature: float = 0.0, use_vision: bool = False, auto_vision: bool = True, interactive_mode: bool = False):
        self.driver = driver
        # 默认模式：是否始终强制开启多模态视觉
        self.use_vision = use_vision
        # 自动视觉回退模式：当纯文本尝试多次失败或卡住时，自动开启视觉
        self.auto_vision = auto_vision
        # 是否开启交互式调试模式 (失败时触发 page.pause())
        self.interactive_mode = interactive_mode
        # 统计整个 Agent 生命周期的 Token 消耗
        self.total_tokens = 0
        
        # 允许从环境变量读取，或默认使用 OpenAI (国内可替换代理)
        self.llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=os.environ.get("OPENAI_API_KEY", "your-api-key-here"),
            base_url=os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
        )

        self.system_prompt = """
You are an intelligent Web Automation Testing Agent.
You are given a compressed DOM tree (Accessibility Tree) containing only interactive elements on the page, each marked with an ID like [1].
You may also be given a screenshot of the current page if vision is enabled.
You are also given a history of your previous actions in this task.

Your goal is to execute the user's intent step by step. Look at the history, the current DOM, and the screenshot (if provided) to decide the *next* logical action.
DO NOT repeat the same action if it was already performed successfully.

If you are using the screenshot, you will see interactive elements surrounded by RED BOXES with RED LABELS. 
The number inside the red label is the EXACT `target_id` you must use in your JSON action.
For example, if you see a button with a red box labeled "[14]", you MUST use `{"action": "click", "target_id": "14"}`.

Choose exactly one of the following actions:
1. `{"action": "click", "target_id": "1"}` - Click an element. MUST use the numeric ID.
2. `{"action": "type", "target_id": "2", "value": "hello"}` - Type text into an input field. MUST use the numeric ID.
3. `{"action": "hover", "target_id": "3"}` - Hover over an element. MUST use the numeric ID.
4. `{"action": "select_option", "target_id": "4", "value": "option_value"}` - Select an option. MUST use the numeric ID.
5. `{"action": "drag_and_drop", "target_id": "5", "value": "6"}` - Drag element 5 to 6. MUST use the numeric ID.
6. `{"action": "press_key", "target_id": "null", "value": "Enter"}` - Press a keyboard key.
7. `{"action": "scroll", "target_id": "null"}` - Scroll the page.
8. `{"action": "wait", "target_id": "null"}` - Wait for 1 second.
9. `{"action": "done", "target_id": "null"}` - Intent is completed.

CRITICAL: `target_id` MUST be the exact numeric ID found inside the brackets `[]` in the provided DOM tree. Do NOT use string names or HTML ids.
Note: You are only seeing elements currently visible in the viewport. If you cannot find the element you need, you should return `{"action": "scroll", "target_id": "null"}` to look further down.
Output strictly in JSON format. Do not include markdown backticks like ```json.
"""

    def _build_tree_str(self, page_data: Dict[str, Any]) -> str:
        """将提取的字典转换为大模型易读且极度省 Token 的 YAML/Markdown 混合字符串"""
        tree_str = "Viewport Interactive Elements:\n"
        for el in page_data.get('elements', []):
            role_text = el.get('role', '') or el.get('type', '')
            # 精简：移除冗长属性，只保留关键的辅助信息
            text_desc = f"\"{el.get('text', '')}\"" if el.get('text') else ""
            if not text_desc:
                attrs = []
                if el.get('placeholder'): attrs.append(f"pl:\"{el['placeholder']}\"")
                if el.get('name'): attrs.append(f"name:\"{el['name']}\"")
                if el.get('id_attr'): attrs.append(f"id:\"{el['id_attr']}\"")
                text_desc = " ".join(attrs)
            
            # 使用类似于 agent-browser 的紧凑文本格式
            # 格式例如: - [1] button "Login"
            role_str = f"({role_text})" if role_text else ""
            tree_str += f"- [{el['id']}] {el['tag']} {text_desc} {role_str}\n"
        return tree_str

    def get_dom_tree_str(self) -> str:
        """提取并返回当前页面的无障碍树字符串"""
        page_data = self.driver.get_dom_snapshot()
        return self._build_tree_str(page_data)

    def _rewrite_code_file(self, intent: str, action_sequence: list) -> None:
        """
        自动代码回写机制：在成功执行意图后，找到调用该意图的测试文件，
        将原生 Playwright 代码自动注入到文件中，从而在代码层面固化 AI 的探索成果。
        """
        import inspect
        import traceback
        import re
        
        # 通过调用栈找到是谁调用了 agent.step
        caller_frame = None
        for frame in inspect.stack():
            if frame.filename.endswith('.py') and not frame.filename.endswith('agent.py') and not 'pytest' in frame.filename:
                caller_frame = frame
                break
                
        if not caller_frame:
            logger.warning("⚠️ 无法定位调用方，取消代码回写。")
            return
            
        file_path = caller_frame.filename
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            # 找到调用 agent.step 的那一行
            step_line_idx = -1
            for i, line in enumerate(lines):
                if 'agent.step(' in line and intent[:20] in line: # 简单匹配意图前缀
                    step_line_idx = i
                    break
            
            # 如果单行匹配失败，尝试寻找上文的 intent 变量定义
            if step_line_idx == -1:
                for i, line in enumerate(lines):
                    if 'agent.step(' in line:
                        step_line_idx = i
                        break
                        
            if step_line_idx == -1:
                logger.warning(f"⚠️ 在 {file_path} 中未找到 agent.step 调用点，取消代码回写。")
                return
                
            # 获取该行的缩进
            indent_match = re.match(r'^(\s*)', lines[step_line_idx])
            indent = indent_match.group(1) if indent_match else ""
            
            # 生成原生 Playwright 代码
            generated_code = []
            generated_code.append(f"{indent}# --- AI 自动回写生成的原生代码 (由 '{intent[:30]}...' 意图转换) ---\n")
            for act in action_sequence:
                action = act['action']
                selector = act['selector']
                value = act.get('value')
                
                # 处理不同类型的动作
                if action == "click":
                    generated_code.append(f"{indent}page.click(\"{selector}\")\n")
                elif action == "type":
                    generated_code.append(f"{indent}page.fill(\"{selector}\", \"{value}\")\n")
                elif action == "hover":
                    generated_code.append(f"{indent}page.hover(\"{selector}\")\n")
                elif action == "select_option":
                    generated_code.append(f"{indent}page.select_option(\"{selector}\", \"{value}\")\n")
                elif action == "scroll":
                    generated_code.append(f"{indent}page.mouse.wheel(0, 500)\n")
                elif action == "wait":
                    generated_code.append(f"{indent}page.wait_for_timeout(1000)\n")
                elif action == "press_key":
                    generated_code.append(f"{indent}page.keyboard.press(\"{value}\")\n")
            
            generated_code.append(f"{indent}# ------------------------------------------------------------\n")
            
            # 将 agent.step 那行注释掉
            # 改进正则，处理 `success = agent.step(...)` 的情况
            if not lines[step_line_idx].strip().startswith('#'):
                lines[step_line_idx] = re.sub(r'(^|\s)([\w\s,]*=\s*)?agent\.step', r'\1# \2agent.step', lines[step_line_idx], count=1)
                
            # 插入生成的代码
            lines.insert(step_line_idx + 1, "".join(generated_code))
            
            # 写回文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
                
            logger.info(f"✨ 成功将 AI 探索成果自动回写至代码: {os.path.basename(file_path)}")
            
        except Exception as e:
            logger.warning(f"⚠️ 代码回写失败: {e}")
        """生成意图的缓存唯一键值"""
        import hashlib
        return hashlib.md5(intent.encode('utf-8')).hexdigest()

    def _get_intent_cache_key(self, intent: str) -> str:
        """生成意图的缓存唯一键值"""
        import hashlib
        return hashlib.md5(intent.encode('utf-8')).hexdigest()

    def step(self, intent: str, max_steps: int = 10) -> bool:
        """
        基于自然语言意图，自主探索并执行多步操作，直到完成或超出步数。
        支持稳定脚本缓存回放，跳过大模型。
        """
        logger.info(f"🎯 开始执行意图: '{intent}'")
        
        # 0. 尝试缓存回放机制 (Record & Replay)
        cache_dir = ".intent_cache"
        os.makedirs(cache_dir, exist_ok=True)
        cache_key = self._get_intent_cache_key(intent)
        cache_file = os.path.join(cache_dir, f"{cache_key}.json")
        
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_actions = json.load(f)
                logger.info(f"⚡ 命中稳定运行的脚本缓存！直接重放之前的 {len(cached_actions)} 个动作，跳过大模型分析。")
                replay_success = True
                for act in cached_actions:
                    action = act["action"]
                    selector = act["selector"]
                    value = act.get("value")
                    logger.info(f"   🔄 重放动作: {action} 元素: '{selector}' 值: {value}")
                    try:
                        if selector == "body" and action in ["scroll", "wait"]:
                            # 全局动作直接执行，忽略 selector
                            self.driver.perform_action(action, "null", value)
                        else:
                            self.driver.perform_action(action, f"SELECTOR:{selector}", value)
                        self.driver.page.wait_for_timeout(1000)
                    except Exception as e:
                        logger.warning(f"   ⚠️ 重放动作失败: {e}，将回退到大模型自主探索模式。")
                        replay_success = False
                        break
                
                if replay_success:
                    logger.info(f"✅ 缓存重放执行成功！")
                    return True
            except Exception as e:
                logger.warning(f"⚠️ 读取或执行缓存失败: {e}")

        # 缓存回放失败或没有缓存，走大模型
        action_history = []
        action_sequence_for_cache = [] # 记录用来后续缓存的动作序列
        consecutive_failures = 0
        current_use_vision = self.use_vision
        intent_tokens = 0
        
        for step_idx in range(max_steps):
            logger.info(f"--- 步骤 {step_idx + 1} ---")
            
            # 智能视觉回退 (Auto Vision Fallback)
            # 如果连续失败(或者连续执行了重复无效动作)达到了 2 次，且允许自动开启视觉
            if self.auto_vision and not current_use_vision and consecutive_failures >= 2:
                logger.warning("👀 纯文本 DOM 分析连续受挫，框架已自动开启【多模态视觉+红框标注】进行降维打击！")
                current_use_vision = True
                consecutive_failures = 0 # 重置计数器
                
            # 1. 提取当前页面状态（核心：DOM压缩降维）
            page_data = self.driver.get_dom_snapshot()
            dom_tree_str = self._build_tree_str(page_data)
            
            # 这里截取一部分打印，避免刷屏
            # 计算 token 大致数量（1 token 约等于 4 字符）
            approx_tokens = len(dom_tree_str) // 4
            logger.debug(f"当前视口 DOM 快照已提取，约 {approx_tokens} Tokens。")
            
            history_str = "历史动作记录:\n" + ("\n".join(action_history) if action_history else "无")
            
            # 2. 构造 Prompt 发送给大模型
            user_prompt = f"用户意图: {intent}\n\n{history_str}\n\n{dom_tree_str}\n\nWhat is the NEXT action?"
            
            if current_use_vision:
                import base64
                debug_dir = "logs/debug_screenshots"
                os.makedirs(debug_dir, exist_ok=True)
                
                # 如果 b64_img 还没生成，则在这里生成（避免重复调用 screenshot）
                # 这里为了简化，我们调整一下逻辑顺序，先生成截图再构造 prompt 和保存调试图
                b64_img = self.driver.get_screenshot(page_data.get('elements', []))
                
                with open(f"{debug_dir}/step_{step_idx+1}.jpg", "wb") as f:
                    f.write(base64.b64decode(b64_img))
                logger.debug(f"带框截图已保存至 {debug_dir}/step_{step_idx+1}.jpg")
                
                human_content = [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url", 
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_img}",
                            "detail": "high" 
                        }
                    }
                ]
                logger.debug("已附加当前页面高清截图(带画框标注)进入多模态分析。")
            else:
                human_content = [{"type": "text", "text": user_prompt}]

            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=human_content)
            ]
            
            logger.info("大模型正在思考中...")
            try:
                response = self.llm.invoke(messages)
                content = response.content.strip()
                
                # 打印 Token 消耗情况
                if hasattr(response, 'response_metadata') and 'token_usage' in response.response_metadata:
                    usage = response.response_metadata['token_usage']
                    step_tokens = usage.get('total_tokens', 0)
                    intent_tokens += step_tokens
                    self.total_tokens += step_tokens
                    logger.info(f"📊 本步 Token 消耗: Prompt={usage.get('prompt_tokens', 0)}, Completion={usage.get('completion_tokens', 0)}, 总计={step_tokens}")
                
                # 尝试清理可能的 Markdown 格式
                if content.startswith("```json"):
                    content = content[7:-3].strip()
                elif content.startswith("```"):
                    content = content[3:-3].strip()
                    
                action_data = json.loads(content)
            except Exception as e:
                logger.error(f"❌ 解析大模型响应失败: {str(e)}\n原始响应: {response.content if 'response' in locals() else 'None'}")
                logger.info(f"🏁 本次意图累计消耗 Token: {intent_tokens}, Agent 全局累计消耗: {self.total_tokens}")
                return False
                
            action = action_data.get("action")
            target_id = action_data.get("target_id")
            value = action_data.get("value")
            
            logger.info(f"🤖 大模型决策: 动作={action}, 目标ID=[{target_id}], 输入值={value}")
            
            # 找到对应 target_id 的 css_selector，供缓存记录使用
            css_selector = None
            if str(target_id) and str(target_id) != "null":
                for el in page_data.get('elements', []):
                    if str(el.get('id')) == str(target_id):
                        css_selector = el.get('css_selector')
                        break
            
            if action == "done":
                # 保存成功的动作序列缓存并触发代码回写
                if action_sequence_for_cache:
                    try:
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            json.dump(action_sequence_for_cache, f, ensure_ascii=False, indent=2)
                        logger.info(f"💾 已将该稳定意图的 {len(action_sequence_for_cache)} 个动作保存至本地缓存。")
                        
                        # 触发自动代码回写
                        self._rewrite_code_file(intent, action_sequence_for_cache)
                        
                    except Exception as e:
                        logger.warning(f"⚠️ 缓存/回写动作序列失败: {e}")
                        
                logger.info(f"✅ 意图执行成功: '{intent}'")
                logger.info(f"🏁 本次意图累计消耗 Token: {intent_tokens}, Agent 全局累计消耗: {self.total_tokens}")
                return True
                
            # 3. 执行动作
            try:
                self.driver.perform_action(action, str(target_id), value)
                action_record = f"动作: {action}, 目标ID: [{target_id}], 输入值: {value}"
                
                # 执行成功，则将它加入到缓存队列中
                action_sequence_for_cache.append({
                    "action": action,
                    "selector": css_selector or "body",
                    "value": value
                })
                
                # 检查是否陷入死循环 (比如连续3次点击同一个元素却没有完成意图)
                if len(action_history) >= 2 and all(record == action_record for record in action_history[-2:]):
                    consecutive_failures += 1
                    logger.warning(f"⚠️ 检测到大模型可能陷入重复动作的死循环 ({action_record})")
                else:
                    # 动作看起来是新的，稍微减少一点失败计数，但如果之前是连续报错的则保留
                    if consecutive_failures > 0:
                        consecutive_failures -= 0.5
                
                action_history.append(action_record)
                # 等待页面稳定
                self.driver.page.wait_for_timeout(1000)
            except Exception as e:
                logger.warning(f"⚠️ 动作执行失败: {str(e)}")
                action_history.append(f"执行失败: {action} 于 [{target_id}] - 错误: {str(e)}")
                consecutive_failures += 1
                # 在真实框架中，这里可以触发“自愈（Self-Healing）”机制或抛出异常
                
        logger.error(f"❌ 达到最大步数 ({max_steps}) 限制，意图未能完成: '{intent}'")
        logger.info(f"🏁 本次意图累计消耗 Token: {intent_tokens}, Agent 全局累计消耗: {self.total_tokens}")
        
        if self.interactive_mode:
            logger.warning("⏸️ 进入交互式调试模式！已暂停 Playwright，请在弹出的 Inspector 中进行操作或查看问题，操作完成后点击 Resume 继续。")
            self.driver.page.pause()
            
        return False
