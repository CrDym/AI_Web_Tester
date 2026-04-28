import os
import json
from typing import Dict, Any, Tuple
from .driver import PlaywrightDriver
from .logger import logger
from . import run_context
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage, SystemMessage

class AITesterAgent:
    def __init__(self, driver: PlaywrightDriver, model_name: str = None, temperature: float = 0.0, use_vision: bool = False, auto_vision: bool = True, interactive_mode: bool = False, enable_code_rewrite: bool = False):
        self.driver = driver
        # 默认模式：是否始终强制开启多模态视觉
        self.use_vision = use_vision
        # 自动视觉回退模式：当纯文本尝试多次失败或卡住时，自动开启视觉
        self.auto_vision = auto_vision
        # 是否开启交互式调试模式 (失败时触发 page.pause())
        self.interactive_mode = interactive_mode
        # 统计整个 Agent 生命周期的 Token 消耗
        self.total_tokens = 0
        self.enable_code_rewrite = enable_code_rewrite
        
        final_model_name = model_name or os.environ.get("OPENAI_MODEL_NAME")
        if not final_model_name:
            raise ValueError("未配置大模型名称。请在环境变量或代码中配置 OPENAI_MODEL_NAME。")

        # 允许从环境变量读取，或默认使用 OpenAI (国内可替换代理)
        self.llm = ChatOpenAI(
            model=final_model_name,
            temperature=temperature,
            max_tokens=2048,
            api_key=os.environ.get("OPENAI_API_KEY", "your-api-key-here"),
            base_url=os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1"),
            model_kwargs={"response_format": {"type": "json_object"}}
        )

        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """加载系统提示词模板，支持外部传入或读取默认文件"""
        prompt_path = os.environ.get("AI_TESTER_AGENT_PROMPT_PATH")
        if not prompt_path:
            # 默认读取同目录下的 prompts/agent_system_prompt.txt
            prompt_path = os.path.join(os.path.dirname(__file__), 'prompts', 'agent_system_prompt.txt')
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception as e:
            logger.warning(f"⚠️ 无法加载系统提示词文件 {prompt_path}: {e}，将使用内置的 Fallback 提示词。")
            return "You are a Web Automation Agent. Output JSON format."

    def _build_tree_str(self, page_data: Dict[str, Any], max_length: int = 20000) -> str:
        """将提取的字典转换为大模型易读且极度省 Token 的 YAML/Markdown 混合字符串"""
        tree_str = "Viewport Interactive Elements:\n"
        
        elements = page_data.get('elements', [])
        # 如果 elements 带有 weight 属性，按重要性排序；否则按原本顺序
        if elements and "weight" in elements[0]:
            elements = sorted(elements, key=lambda x: x.get("weight", 0), reverse=True)
            
        for el in elements:
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
            
            # 增加层级/容器提示 (如果存在)
            container_hint = ""
            if el.get('in_iframe'): container_hint += " [iframe内]"
            if el.get('container_hint'): container_hint += f" [{el['container_hint']}]"
            
            line = f"- [{el['id']}] {el['tag']} {text_desc} {role_str}{container_hint}\n"
            if len(tree_str) + len(line) > max_length:
                tree_str += f"\n...[内容过长，已截断并丢弃权重较低的 {len(elements) - elements.index(el)} 个元素]..."
                break
            tree_str += line
            
        return tree_str

    def get_dom_tree_str(self) -> str:
        """提取并返回当前页面的无障碍树字符串"""
        page_data = self.driver.get_dom_snapshot()
        return self._build_tree_str(page_data)

    def _rewrite_code_file(self, intent: str, action_sequence: list) -> None:
        """
        自动代码回写机制：在成功执行意图后，找到调用该意图的测试文件，
        将原生 Playwright 代码自动注入到文件中，从而在代码层面固化 AI 的自动执行成果。
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
            # 改进：利用 inspect 获取实际的调用行号，防止字符串匹配错误覆盖其他用例
            target_line_number = caller_frame.lineno - 1  # lineno 是 1-based，转为 0-based
            if 0 <= target_line_number < len(lines):
                if 'agent.step' in lines[target_line_number]:
                    step_line_idx = target_line_number
                else:
                    # 如果是多行调用，向上寻找 `agent.step` 所在的起始行
                    for i in range(target_line_number, max(-1, target_line_number - 10), -1):
                        if 'agent.step' in lines[i]:
                            step_line_idx = i
                            break
            
            if step_line_idx == -1:
                # Fallback：用原来的字符串匹配方式
                for i, line in enumerate(lines):
                    if 'agent.step(' in line and intent[:20] in line: # 简单匹配意图前缀
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
            intent_preview = " ".join(intent.split())
            intent_preview = intent_preview[:30] + ("..." if len(intent_preview) > 30 else "")
            generated_code.append(f"{indent}# --- AI 自动回写生成的原生代码 (由 '{intent_preview}' 意图转换) ---\n")
            for act in action_sequence:
                action = act['action']
                selector = act['selector']
                value = act.get('value')
                selector_lit = json.dumps(selector, ensure_ascii=False)
                value_lit = json.dumps(value, ensure_ascii=False) if value is not None else "None"
                
                # 处理不同类型的动作
                if action == "click":
                    generated_code.append(f"{indent}page.click({selector_lit})\n")
                elif action == "double_click":
                    generated_code.append(f"{indent}page.dblclick({selector_lit})\n")
                elif action == "right_click":
                    generated_code.append(f"{indent}page.click({selector_lit}, button='right')\n")
                elif action == "type":
                    generated_code.append(f"{indent}page.fill({selector_lit}, {value_lit})\n")
                elif action == "hover":
                    generated_code.append(f"{indent}page.hover({selector_lit})\n")
                elif action == "select_option":
                    generated_code.append(f"{indent}page.select_option({selector_lit}, {value_lit})\n")
                elif action == "drag_and_drop":
                    # ⚠️ 修复：不能将临时的 ai-id 写死到原生代码中，因为下次执行必定找不到
                    # 由于我们在 `action_sequence` 缓存里只存了源元素的 css_selector，这里简单降级为拖拽到 body
                    # 如果后续业务需要精准拖拽，建议在 agent 返回时额外要求附带目标元素的特征
                    target_selector = "body"
                    generated_code.append(f"{indent}page.drag_and_drop({selector_lit}, {json.dumps(target_selector)})\n")
                elif action == "scroll":
                    generated_code.append(f"{indent}page.mouse.wheel(0, 500)\n")
                elif action == "wait":
                    generated_code.append(f"{indent}page.wait_for_timeout(1000)\n")
                elif action == "press_key":
                    generated_code.append(f"{indent}page.keyboard.press({value_lit})\n")
            
            generated_code.append(f"{indent}# ------------------------------------------------------------\n")
            
            # 将 agent.step 那行注释掉
            if not lines[step_line_idx].strip().startswith('#'):
                # 提取原有的缩进和可能的变量赋值 (如 `success = `)
                match = re.match(r'^(\s*)([\w\s,]*=\s*)?agent\.step', lines[step_line_idx])
                if match:
                    prefix = match.group(1) or ""
                    assignment = match.group(2) or ""
                    # 重新拼接并加上注释符号
                    lines[step_line_idx] = f"{prefix}# {assignment}agent.step" + lines[step_line_idx][match.end():]
                
            # 插入生成的代码
            lines.insert(step_line_idx + 1, "".join(generated_code))
            
            # 写回文件（使用原子写入保护防止崩溃清空文件）
            import tempfile
            import shutil
            fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(file_path))
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                shutil.move(temp_path, file_path)
            except Exception as write_err:
                os.remove(temp_path)
                raise write_err
                
            logger.info(f"✨ 成功将 AI 自动执行成果回写至代码: {os.path.basename(file_path)}")
            
        except Exception as e:
            logger.warning(f"⚠️ 代码回写失败: {e}")

    def _get_intent_cache_key(self, intent: str, url: str) -> str:
        """生成意图的缓存唯一键值，结合当前页面的基础URL，防止不同页面的同名意图冲突"""
        import hashlib
        from urllib.parse import urlparse
        
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        key_str = f"{base_url}::{intent}"
        
        return hashlib.md5(key_str.encode('utf-8')).hexdigest()

    def step(self, intent: str, max_steps: int = 10) -> bool:
        """
        基于自然语言意图，自主推导并执行多步操作，直到完成或超出步数。
        支持稳定脚本缓存回放，跳过大模型。
        """
        logger.info(f"🎯 开始执行意图: '{intent}'")
        run_context.record_event("intent_start", intent)
        
        # 0. 尝试缓存回放机制 (Record & Replay)
        cache_dir = ".intent_cache"
        os.makedirs(cache_dir, exist_ok=True)
        
        # 获取当前基础 URL 以构建缓存键
        current_url = self.driver.page.url
        cache_key = self._get_intent_cache_key(intent, current_url)
        cache_file = os.path.join(cache_dir, f"{cache_key}.json")
        
        # 允许外部通过环境变量强制绕过缓存 (用于调试特定步骤)
        ignore_cache = os.environ.get("AI_TESTER_IGNORE_CACHE", "0") == "1"
        
        if not ignore_cache and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_actions = json.load(f)
                logger.info(f"⚡ 命中稳定运行的脚本缓存！直接重放之前的 {len(cached_actions)} 个动作，跳过大模型分析。")
                run_context.record_event("intent_replay_start", f"{intent} (actions={len(cached_actions)})")
                replay_success = True
                for act in cached_actions:
                    action = act["action"]
                    selector = act["selector"]
                    value = act.get("value")
                    logger.info(f"   🔄 重放动作: {action} 元素: '{selector}' 值: {value}")
                    run_context.record_event("replay_action", f"{action} {selector} {value}")
                    try:
                        if selector == "body" and action in ["scroll", "wait"]:
                            # 全局动作直接执行，忽略 selector
                            self.driver.perform_action(action, "null", value)
                        else:
                            # 修复：防止 selector 为 None 时拼出 "SELECTOR:None" 导致定位崩溃
                            safe_selector = selector if selector else "body"
                            self.driver.perform_action(action, f"SELECTOR:{safe_selector}", value)
                        self.driver.page.wait_for_timeout(1000)
                    except Exception as e:
                        logger.warning(f"   ⚠️ 重放动作失败: {e}，将回退到大模型自主推导模式。")
                        replay_success = False
                        break
                
                if replay_success:
                    logger.info(f"✅ 缓存重放执行成功！")
                    run_context.record_event("intent_end", f"{intent} (replay_success)")
                    return True
            except Exception as e:
                logger.warning(f"⚠️ 读取或执行缓存失败: {e}")
                run_context.record_event("intent_replay_failed", str(e))

        # 缓存回放失败或没有缓存，走大模型
        action_history = []
        action_sequence_for_cache = [] # 记录用来后续缓存的动作序列
        consecutive_failures = 0
        current_use_vision = self.use_vision
        intent_tokens = 0
        
        for step_idx in range(max_steps):
            logger.info(f"--- 步骤 {step_idx + 1} ---")
            run_context.record_event("step_start", f"{intent} / step {step_idx + 1}")
            
            # 全局熔断机制：如果该 Agent 的总 Token 消耗已经超过 50 万，则强行熔断，防止账单爆炸
            if getattr(self, 'total_tokens', 0) > 500000:
                logger.error("🛑 全局 Token 消耗超过 500k 限制，触发硬性熔断！请检查是否有死循环。")
                run_context.record_event("token_limit_exceeded", f"Total tokens: {self.total_tokens}")
                return False
            
            # 智能视觉回退 (Auto Vision Fallback)
            # 如果连续失败(或者连续执行了重复无效动作)达到了 2 次，且允许自动开启视觉
            if self.auto_vision and not current_use_vision and consecutive_failures >= 2:
                logger.warning("👀 纯文本 DOM 分析连续受挫，框架已自动开启【多模态视觉+红框标注】进行降维打击！")
                current_use_vision = True
                consecutive_failures = 0
                run_context.record_event("auto_vision_on", f"{intent} / step {step_idx + 1}")
                
            # 1. 提取当前页面状态（核心：DOM压缩降维）
            page_data = self.driver.get_dom_snapshot()
            if os.environ.get("AI_TESTER_LIVE_SNAPSHOT") == "1":
                try:
                    self.driver.get_screenshot([])
                except Exception:
                    pass
            dom_tree_str = self._build_tree_str(page_data, max_length=20000)
            
            # 计算 token 大致数量（1 token 约等于 4 字符）
            approx_tokens = len(dom_tree_str) // 4
            logger.debug(f"当前视口 DOM 快照已提取，约 {approx_tokens} Tokens。")
            
            # 为了防止历史记录过长影响大模型的判断和 Token 消耗，只保留最近的 5 次动作
            recent_history = action_history[-5:] if action_history else []
            history_str = "最近动作记录:\n" + ("\n".join(recent_history) if recent_history else "无")
            
            # 2. 构造 Prompt 发送给大模型
            user_prompt = f"用户意图: {intent}\n\n{history_str}\n\n{dom_tree_str}\n\nWhat is the NEXT action? Remember to provide your `thought` process first."
            
            if current_use_vision:
                import base64
                base_dir = os.environ.get("AI_TESTER_RUN_DIR") or os.path.join(os.getcwd(), "logs")
                test_nodeid = run_context.get_current_test() or "unknown"
                debug_dir = os.path.join(base_dir, "debug_screenshots", run_context.sanitize_for_path(test_nodeid))
                os.makedirs(debug_dir, exist_ok=True)
                
                # 如果 b64_img 还没生成，则在这里生成（避免重复调用 screenshot）
                # 这里为了简化，我们调整一下逻辑顺序，先生成截图再构造 prompt 和保存调试图
                try:
                    b64_img = self.driver.get_screenshot(page_data.get('elements', []))
                    
                    if b64_img:
                        screenshot_path = os.path.join(debug_dir, f"step_{step_idx+1}.jpg")
                        with open(screenshot_path, "wb") as f:
                            f.write(base64.b64decode(b64_img))
                        logger.debug(f"带框截图已保存至 {screenshot_path}")
                        run_context.record_event("debug_screenshot", screenshot_path)
                        
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
                        logger.warning("⚠️ 截图返回为空，降级为纯文本模式。")
                        human_content = [{"type": "text", "text": user_prompt}]
                except Exception as e:
                    logger.warning(f"⚠️ 获取截图失败，降级为纯文本模式: {e}")
                    human_content = [{"type": "text", "text": user_prompt}]
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
                step_usage = None
                
                # 打印 Token 消耗情况
                if hasattr(response, 'response_metadata') and 'token_usage' in response.response_metadata:
                    usage = response.response_metadata['token_usage']
                    step_usage = usage
                    step_tokens = usage.get('total_tokens', 0)
                    intent_tokens += step_tokens
                    self.total_tokens += step_tokens
                    logger.info(f"📊 本步 Token 消耗: Prompt={usage.get('prompt_tokens', 0)}, Completion={usage.get('completion_tokens', 0)}, 总计={step_tokens}")
                
                # 使用正则安全提取 JSON，优先匹配 ```json 块，否则匹配最外层的 {} (非贪婪)
                import re
                json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', content)
                if json_match:
                    content = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*?\}', content)
                    if json_match:
                        content = json_match.group(0)
                    else:
                        # 终极兜底：如果模型完全没输出 {}，尝试手动给它包一层
                        if content.startswith('"thought"'):
                            content = "{" + content + "}"
                    
                action_data = json.loads(content)
                
                # 提取思维链并打印
                thought = action_data.get("thought", "")
                if thought:
                    logger.info(f"🧠 AI 思考过程: {thought}")
                    
            except Exception as e:
                logger.error(f"❌ 解析大模型响应失败: {str(e)}\n原始响应: {response.content if 'response' in locals() else 'None'}")
                logger.info(f"🏁 本次意图累计消耗 Token: {intent_tokens}, Agent 全局累计消耗: {self.total_tokens}")
                run_context.record_event("llm_parse_error", str(e))
                return False
                
            action = action_data.get("action")
            target_id_raw = action_data.get("target_id")
            target_id = "null" if target_id_raw is None else str(target_id_raw)
            value = action_data.get("value")
            step_intent = action_data.get("intent")
            
            logger.info(f"🤖 大模型决策: 动作={action}, 目标ID=[{target_id}], 输入值={value}")
            if thought:
                run_context.record_event("llm_thought", thought)
            run_context.record_event("llm_action", f"action={action} target_id={target_id} value={value}", token_usage=step_usage or None)
            
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
                        
                        if self.enable_code_rewrite:
                            self._rewrite_code_file(intent, action_sequence_for_cache)
                        
                    except Exception as e:
                        logger.warning(f"⚠️ 缓存/回写动作序列失败: {e}")
                        
                logger.info(f"✅ 意图执行成功: '{intent}'")
                logger.info(f"🏁 本次意图累计消耗 Token: {intent_tokens}, Agent 全局累计消耗: {self.total_tokens}")
                run_context.record_event("intent_end", f"{intent} (success)", extra={"intent_tokens": intent_tokens, "agent_total_tokens": self.total_tokens})
                return True
                
            # 3. 执行动作
            try:
                prev_url = self.driver.page.url
                self.driver.perform_action(action, target_id, value)
                action_record = f"动作: {action}, 目标ID: [{target_id}], 输入值: {value}"
                new_url = self.driver.page.url
                
                # 执行成功，则将它加入到缓存队列中
                if action != "done":
                    # 如果是全局动作(如按键、滚动页面)，target_id 是 null，不需要默认降级为 body
                    fallback_selector = "" if target_id == "null" else "body"
                    action_sequence_for_cache.append({
                        "action": action,
                        "selector": css_selector or fallback_selector,
                        "value": value,
                        "intent": step_intent
                    })
                
                if prev_url != new_url and consecutive_failures > 0:
                    from urllib.parse import urlparse
                    prev_parsed = urlparse(prev_url)
                    new_parsed = urlparse(new_url)
                    # 只有 path 及以上级别的改变，或者强业务跳转才重置死循环计数。如果只是 hash 改变 (#tab1) 不清空计数，防止在同一个页面死循环
                    if f"{prev_parsed.scheme}://{prev_parsed.netloc}{prev_parsed.path}" != f"{new_parsed.scheme}://{new_parsed.netloc}{new_parsed.path}":
                        consecutive_failures = 0

                # 检查是否陷入死循环 (比如连续3次点击同一个元素却没有完成意图)
                # 修复：死循环检测不应该使用包含临时 ai-id 的 target_id，而应该使用 css_selector，防止页面重绘导致同一个元素被分配了不同的 ai-id 从而绕过死循环检测
                loop_detect_key = f"{action}|{css_selector or target_id}|{value}"
                
                recent_loop_keys = [record.split(" (⚠️")[0] for record in action_history[-3:]] if action_history else []
                
                if len(recent_loop_keys) >= 2 and all(r == loop_detect_key for r in recent_loop_keys[-2:]):
                    consecutive_failures += 1.5
                    logger.warning(f"⚠️ 检测到大模型可能陷入重复动作的死循环 ({loop_detect_key})")
                    action_record += " (⚠️ 警告: 该动作未产生预期效果，陷入死循环！请尝试滚动页面、更换策略或返回 done)"
                    run_context.record_event("dead_loop", action_record)
                # 检测交替动作死循环 (A -> B -> A -> B)
                elif len(recent_loop_keys) == 3 and recent_loop_keys[0] == recent_loop_keys[2] and recent_loop_keys[1] == loop_detect_key:
                    consecutive_failures += 1.5
                    logger.warning(f"⚠️ 检测到大模型陷入交替动作死循环 (A->B->A->B)")
                    action_record += " (⚠️ 警告: 动作在两个元素间来回交替未见进展，请更换策略！)"
                    run_context.record_event("dead_loop", action_record)
                else:
                    # 动作看起来是新的，清空失败计数，避免历史累积导致误判
                    consecutive_failures = 0
                
                # action_history 存入带特征的 loop_detect_key 作为开头，方便下次取用比对，后续接上中文描述给大模型看
                action_history.append(f"{loop_detect_key} (⚠️ {action_record})") if "⚠️" in action_record else action_history.append(f"{loop_detect_key} -- {action_record}")
                # 等待页面稳定
                # 这里如果动作是 type，我们额外多等一会儿，因为下拉框搜索往往有防抖延迟
                if action == "type":
                    self.driver.page.wait_for_timeout(2000)
                else:
                    self.driver.page.wait_for_timeout(1000)
                
                if consecutive_failures >= 3:
                    logger.error("❌ 连续失败/死循环次数过多，自动终止当前意图的推导执行。")
                    run_context.record_event("intent_end", f"{intent} (aborted)", extra={"intent_tokens": intent_tokens, "agent_total_tokens": self.total_tokens})
                    return False
            except Exception as e:
                err_msg = str(e)
                logger.warning(f"⚠️ 动作执行失败: {err_msg}")
                # 如果是 Stale Element (元素失效) 或 Timeout 错误，我们在历史记录里提示大模型，防止它一直死磕
                if "timeout" in err_msg.lower() or "已失效或不可见" in err_msg:
                    action_history.append(f"执行失败: {action} 于 [{target_id}] - 错误: 元素可能已被遮挡或由于页面重绘而消失。请尝试滚动页面、重新打开下拉框，或选择页面上最新生成的其他元素。")
                else:
                    action_history.append(f"执行失败: {action} 于 [{target_id}] - 错误: {err_msg}")
                
                consecutive_failures += 1
                run_context.record_event("action_error", f"{action} target_id={target_id} err={err_msg}")
                
                # 如果遇到错误且开启了智能视觉，自动开启视觉并重试
                if self.auto_vision and not current_use_vision and consecutive_failures >= 2:
                    logger.warning("👀 纯文本 DOM 分析连续受挫，框架已自动开启【多模态视觉+红框标注】进行降维打击！")
                    current_use_vision = True
                    consecutive_failures = 0
                    run_context.record_event("auto_vision_on", f"{intent} / step {step_idx + 1}")
                elif consecutive_failures >= 3:
                    logger.error("❌ 连续执行失败次数过多，自动终止当前意图的推导执行。")
                    run_context.record_event("intent_end", f"{intent} (aborted)", extra={"intent_tokens": intent_tokens, "agent_total_tokens": self.total_tokens})
                    return False
                # 在真实框架中，这里可以触发“自愈（Self-Healing）”机制或抛出异常
                
        logger.error(f"❌ 达到最大步数 ({max_steps}) 限制，意图未能完成: '{intent}'")
        logger.info(f"🏁 本次意图累计消耗 Token: {intent_tokens}, Agent 全局累计消耗: {self.total_tokens}")
        
        if self.interactive_mode:
            logger.warning("⏸️ 进入交互式调试模式！已暂停 Playwright，请在弹出的 Inspector 中进行操作或查看问题，操作完成后点击 Resume 继续。")
            self.driver.page.pause()
            
        return False
