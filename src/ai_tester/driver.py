import os
import base64
import json
from io import BytesIO
from typing import Dict, Any
from PIL import Image, ImageDraw, ImageFont

class PlaywrightDriver:
    def __init__(self, page):
        self.page = page
        self.action_registry = self._init_action_registry()

    def switch_to_latest_page(self):
        """检查并切换到最新打开的有效标签页"""
        if not getattr(self, 'page', None) or not getattr(self.page, 'context', None):
            return getattr(self, 'page', None)
            
        pages = self.page.context.pages
        if not pages:
            return self.page
            
        # 找到最后一个未关闭的页面
        valid_pages = []
        for p in pages:
            try:
                if not p.is_closed():
                    valid_pages.append(p)
            except Exception:
                pass
                
        if valid_pages:
            candidate = valid_pages[-1]
            if candidate != self.page:
                try:
                    candidate.wait_for_load_state("domcontentloaded", timeout=3000)
                except Exception:
                    pass
                self.page = candidate
                
        return self.page

    def _init_action_registry(self) -> Dict[str, callable]:
        """初始化内置的动作处理器注册表"""
        return {
            "click": self._action_click,
            "double_click": self._action_double_click,
            "right_click": self._action_right_click,
            "type": self._action_type,
            "hover": self._action_hover,
            "select_option": self._action_select_option,
            "drag_and_drop": self._action_drag_and_drop,
            "press_key": self._action_press_key,
            "scroll": self._action_scroll,
            "wait": self._action_wait,
            "done": self._action_done
        }

    def register_action(self, action_name: str, handler: callable):
        """
        向外暴露的注册接口，允许用户自定义业务特有动作。
        handler 需要接受签名: handler(selector: str, value: str)
        """
        self.action_registry[action_name] = handler

    def get_dom_snapshot(self) -> Dict[str, Any]:
        """注入 JS 脚本提取当前视口内所有交互元素，支持 Iframe 穿透和多标签页环境"""
        # 确保使用最新页面
        self.switch_to_latest_page()
        
        with open(os.path.join(os.path.dirname(__file__), 'inject', 'extract_elements.js'), 'r') as f:
            script = f.read()

        active_page = self.page

        all_elements = []
        current_id = 1
        
        # 遍历当前页面的所有 Frame (主页面本身也是第一个 frame，后续的是各种 Iframe)
        for frame in active_page.frames:
            try:
                # 尝试获取 iframe 在视口中的偏移量，以修正视觉红框坐标
                frame_offset_x = 0
                frame_offset_y = 0
                if frame.parent_frame:
                    try:
                        frame_element = frame.frame_element()
                        bbox = frame_element.bounding_box()
                        if bbox:
                            frame_offset_x = bbox['x']
                            frame_offset_y = bbox['y']
                        else:
                            # 如果 iframe 在主视口中完全不可见，则忽略其中的元素
                            continue
                    except Exception:
                        pass
                        
                # 给每个 frame 注入抽取脚本
                frame.evaluate(script)
                # 执行抽取，并传入当前的起始 ID 防止跨 frame 的 ID 冲突
                result = frame.evaluate(f"() => window.extractInteractiveElements({current_id})")
                if result and 'elements' in result:
                    elements = result.get('elements', [])
                    for el in elements:
                        if 'bbox' in el and el['bbox']:
                            # 注意这里不能再简单加 offset 了，如果 iframe 内部元素提取的是相对于 iframe 的相对坐标，
                            # 需要加上 iframe 的 offset。但由于前面我们修改了提取逻辑（加了 scrollX），
                            # 对于主页面，那是对的。但对于 iframe，可能要额外加上 iframe 在主页面中的偏移。
                            el['bbox']['x'] += frame_offset_x
                            el['bbox']['y'] += frame_offset_y
                    all_elements.extend(elements)
                    current_id += len(elements)
            except Exception as e:
                # 对于跨域的 iframe (cross-origin)，执行 evaluate 可能会抛出异常，这里做降级处理，并打印一条日志提醒
                from .logger import logger
                logger.debug(f"   ⚠️ 跳过受限 Iframe ({frame.url}): {str(e)[:50]}...")
                
        return {"elements": all_elements}

    def perform_action(self, action: str, target_id: str, value: str = None):
        """执行动作，支持 Iframe 穿透定位"""
        self.switch_to_latest_page()
        
        # 支持传入原生 CSS 选择器，以便于自愈缓存回放
        if target_id.startswith("SELECTOR:"):
            selector = target_id.replace("SELECTOR:", "")
        elif target_id and target_id != "null":
            selector = f"[ai-id='{target_id}']"
        else:
            selector = None
            
        target_locator = None
        if selector is not None:
            target_locator = self._get_locator(selector)
        else:
            # 修复：防止 action(None, value) 导致的底层库原生的 AttributeError
            # 如果是全局动作（如 scroll / wait），动作函数内部本身不会使用 locator，传 None 没问题
            # 但如果是必须需要定位的动作（如 click / type）但大模型却传了 null，我们这里同样给它一个假锚点触发自愈或报错
            if action not in ["scroll", "wait"]:
                target_locator = self.page.locator("#_trigger_ai_heal_not_exist_999")

        for attempt in range(2):
            try:
                force = (attempt == 1)
                if action in self.action_registry:
                    import inspect
                    sig = inspect.signature(self.action_registry[action])
                    if 'force' in sig.parameters:
                        self.action_registry[action](target_locator, value, force=force)
                    else:
                        self.action_registry[action](target_locator, value)
                else:
                    raise ValueError(f"Unknown action: {action}")
                return
            except Exception as e:
                msg = str(e)
                if attempt == 0:
                    # 尝试处理一下可能的遮挡物（如无用的弹窗背景），然后再试一次 force=True
                    if "intercepts pointer events" in msg or "cf-modal-wrap" in msg or "not visible" in msg:
                        self._handle_overlay_block()
                    continue
                raise Exception(f"Action {action} failed on element {target_id}: {msg}")

    def _get_locator(self, selector: str):
        """跨 iframe 获取元素的 locator"""
        # 对于自然语言生成的测试用例（如 selector 为空或 "[ai-id='null']" ），强制触发自愈，返回一个不存在的 locator
        if not selector or selector == "null" or selector == "[ai-id='null']":
            return self.page.locator("#_trigger_ai_heal_not_exist_999")
            
        try:
            # 移除 `.first`，不再默默使用第一个元素。
            # 这会让 Playwright 在匹配多个元素时抛出 Strict mode violation 错误，从而触发外层的 AI 自愈
            if self.page.locator(selector).count() > 0:
                return self.page.locator(selector)
            
            for frame in self.page.frames:
                if frame.locator(selector).count() > 0:
                    return frame.locator(selector)
        except Exception:
            # 如果选择器语法错误（例如 AI 瞎编的），这里直接捕获并返回 page 根级别的 locator
            # 让后面的操作抛出具体的失败异常，触发自愈，而不是在这里直接挂掉进程
            pass
                    
        return self.page.locator(selector)

    def _handle_overlay_block(self):
        """处理遮挡物的通用逻辑"""
        try:
            # 1. 尝试按 ESC 键
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(500)
            
            # 2. 尝试点击常见的关闭按钮
            close_selectors = [
                ".cf-modal-close",
                ".ant-modal-close",
                ".el-dialog__headerbtn",
                ".modal-close",
                "[aria-label='Close']",
                "[aria-label='关闭']",
                "button[class*='close' i]"
            ]
            for sel in close_selectors:
                if self.page.locator(sel).count() > 0:
                    for i in range(self.page.locator(sel).count()):
                        try:
                            self.page.locator(sel).nth(i).click(timeout=1000, force=True)
                        except Exception:
                            pass
            self.page.wait_for_timeout(500)
            
            # 3. 移除明显的全局 Mask 遮罩 (通过 JS 移除)
            self.page.evaluate('''() => {
                document.querySelectorAll('[class*="mask" i], [class*="overlay" i], [class*="backdrop" i]').forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.position === 'fixed' || style.position === 'absolute') {
                        el.style.display = 'none';
                        el.style.pointerEvents = 'none';
                    }
                });
            }''')
        except Exception:
            pass

    # --- 内置动作处理器 ---
    def _action_click(self, locator, value, force=False):
        # 默认 timeout 为 3000ms，这样如果元素被遮挡或者逻辑不可见，能快速失败并重试 force=True
        try:
            # 移除这段导致“假阳性成功”的容错代码，如果匹配到多个元素，让 Playwright 直接抛出 Strict mode violation 错误，触发自愈
            locator.click(force=force, timeout=3000)
        except Exception as e:
            err_msg = str(e).lower()
            if "strict mode violation" in err_msg:
                # 严禁默默点击第一个元素！这会导致业务逻辑没走到，直接抛出异常让外层自愈
                raise Exception(f"定位器匹配到了多个元素，违反了唯一性原则，无法执行点击: {str(e)}")
            elif "timeout" in err_msg and not force:
                # 第一次尝试超时，直接抛出给外层进行 force=True 的重试
                raise e
            elif "timeout" in err_msg and force:
                # 即使是 force=True 也超时了，说明该元素极大概率由于 DOM 重绘导致 stale (如下拉框关闭、React 重新渲染)
                # 此时我们尝试利用页面上最新的相同 selector 重新获取一遍元素（Stale Element Recovery）
                selector = str(locator).replace("Locator@", "").strip()
                if "ai-id" in selector:
                    # 如果是 ai-id 超时，说明临时注入的 id 已经随着重绘彻底消失了，无法 recovery，只能认命
                    raise Exception(f"元素已失效或不可见 (可能已从 DOM 中移除或发生重绘): {selector}")
                
                try:
                    self.page.locator(selector).first.click(force=True, timeout=1000)
                except Exception:
                    raise e
            else:
                raise e
        self.page.wait_for_timeout(500)  # 等待可能的弹窗/下拉框动画

    def _action_double_click(self, locator, value, force=False):
        locator.dblclick(force=force, timeout=3000)
        self.page.wait_for_timeout(500)

    def _action_right_click(self, locator, value, force=False):
        locator.click(button="right", force=force, timeout=3000)
        self.page.wait_for_timeout(500)

    def _action_type(self, locator, value, force=False):
        # 现代前端框架的输入框有时候用 fill 无法触发下拉搜索，甚至元素是隐藏的(无法 clear/fill)
        # 这里改用点击后全局敲击键盘的方式，这是最贴近人类操作的稳健做法
        try:
            locator.click(force=force, timeout=3000)
            self.page.wait_for_timeout(200)
            try:
                # 如果真的是个 input，尝试清空它，设置短超时防止卡死
                locator.clear(force=force, timeout=1000)
            except Exception:
                pass
            # 直接使用全局键盘敲击，只要元素被 click 聚焦了就能接收到输入
            self.page.keyboard.type(value, delay=50)
        except Exception as e:
            # 兜底方案：如果 click(聚焦) 失败（比如因为是隐藏的 input 或者遮挡），尝试直接用 fill
            # 注意：这里直接用 fill，并且允许 timeout 向上抛出以触发 AI 自愈
            try:
                locator.fill(value, force=force, timeout=3000)
            except Exception as fill_err:
                # 避免 AttributeError 掩盖真实问题
                if "AttributeError" in str(fill_err):
                    raise e # 抛出原来的 click 异常
                raise fill_err
        self.page.wait_for_timeout(500)

    def _action_hover(self, locator, value, force=False):
        locator.hover(force=force)

    def _action_select_option(self, locator, value, force=False):
        locator.select_option(value, force=force)

    def _action_drag_and_drop(self, locator, value, force=False):
        # value 是目标元素的 ai-id
        target_selector = f"[ai-id='{value}']"
        target_locator = self._get_locator(target_selector)
        locator.drag_to(target_locator, force=force)

    def _action_press_key(self, locator, value):
        self.page.keyboard.press(value)

    def _action_scroll(self, locator, value):
        if locator:
            locator.scroll_into_view_if_needed()
            # 如果指定了上下滚动方向并且有 locator，则在该 locator 内部滚动
            if value in ["up", "down"]:
                direction = -500 if value == "up" else 500
                locator.evaluate(f"(el) => el.scrollBy({{ top: {direction}, behavior: 'smooth' }})")
        else:
            direction = -500 if value == "up" else 500
            # 智能滚动：在页面中找到最大的可滚动容器，并在其中滚动
            self.page.evaluate(f'''(dir) => {{
                function getScrollableParent() {{
                    let maxArea = 0;
                    let bestEl = document.scrollingElement || document.body;
                    document.querySelectorAll('*').forEach(el => {{
                        if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {{
                            const style = window.getComputedStyle(el);
                            if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowX === 'auto' || style.overflowX === 'scroll') {{
                                const area = el.clientWidth * el.clientHeight;
                                if (area > maxArea) {{
                                    maxArea = area;
                                    bestEl = el;
                                }}
                            }}
                        }}
                    }});
                    return bestEl;
                }}
                const container = getScrollableParent();
                if (container) {{
                    container.scrollBy({{ top: dir, behavior: 'smooth' }});
                }} else {{
                    window.scrollBy({{ top: dir, behavior: 'smooth' }});
                }}
            }}''', direction)
            self.page.wait_for_timeout(500)

    def _action_wait(self, locator, value):
        self.page.wait_for_timeout(1000)

    def _action_done(self, locator, value):
        pass
    # -----------------------

    def get_screenshot(self, elements_data: list = None) -> str:
        """
        获取当前页面的 base64 截图。
        如果提供了 elements_data，则在截图上使用 Pillow 画出红色边框和数字 ID 标签，
        这能极大地提升视觉模型（如 GPT-4o）定位元素的准确率（类似 Midscene.js 的做法）。
        """
        self.switch_to_latest_page()
        try:
            if os.environ.get("AI_TESTER_SCREENSHOT_WINDOW_STOP") == "1":
                try:
                    self.page.evaluate("() => window.stop()")
                except Exception:
                    pass
                
            # 设置超时时间为 5 秒，并且禁用 animations 保证截图稳定
            screenshot_bytes = self.page.screenshot(
                type="jpeg", 
                quality=60,
                scale="css",
                timeout=5000,
                animations="disabled"
            )
        except Exception as e:
            from .logger import logger
            logger.warning(f"⚠️ Playwright 截图异常: {e}，尝试强制再次截图")
            # 备用截图，忽略字体加载等问题
            screenshot_bytes = self.page.screenshot(
                type="jpeg", 
                quality=50,
                timeout=3000
            )
        
        # 如果没有传入元素数据，直接返回原图的 base64
        b64_str = base64.b64encode(screenshot_bytes).decode('utf-8')
        
        # 将截图推送到 WebSocket Server (如果配置了的话)
        ws_session = os.environ.get("AI_TESTER_WS_SESSION")
        ws_port = os.environ.get("AI_TESTER_WS_PORT", "8000")
        if ws_session:
            try:
                import urllib.request
                import json
                req = urllib.request.Request(
                    f"http://127.0.0.1:{ws_port}/api/internal/push_screenshot/{ws_session}",
                    data=json.dumps({"image": b64_str}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req, timeout=1)
            except Exception:
                pass

        if not elements_data:
            return b64_str
            
        # 否则，使用 Pillow 在截图上绘制 Bounding Box
        try:
            img = Image.open(BytesIO(screenshot_bytes))
            draw = ImageDraw.Draw(img)
            
            # 尝试加载一个默认字体，如果失败则使用内置的默认位图字体
            try:
                # macOS 通常有 Arial，Windows 有 arial.ttf，Linux 有 DejaVuSans.ttf
                # 这里我们稍微调大字体，因为截图可能被压缩
                font = ImageFont.truetype("Arial.ttf", 16)
            except Exception:
                font = ImageFont.load_default()
            
            # 遍历元素，画红框和标签
            for el in elements_data:
                bbox = el.get('bbox')
                if not bbox:
                    continue
                    
                x, y, w, h = bbox.get('x', 0), bbox.get('y', 0), bbox.get('width', 0), bbox.get('height', 0)
                # 如果元素长宽为 0，但传到了这里（说明是放宽提取的隐藏输入框或箭头），
                # 强行给它一个虚拟宽高，以便能画出红框让大模型看到
                if w <= 0: w = 10
                if h <= 0: h = 10
                    
                el_id = str(el.get('id', ''))
                if not el_id:
                    continue
                    
                # 画一个红色的边框
                draw.rectangle([x, y, x + w, y + h], outline="red", width=2)
                
                # 准备标签文本
                label_text = f"[{el_id}]"
                
                # 计算标签文本的尺寸 (兼容不同版本的 Pillow)
                if hasattr(draw, 'textbbox'):
                    text_bbox = draw.textbbox((0, 0), label_text, font=font)
                    text_w = text_bbox[2] - text_bbox[0]
                    text_h = text_bbox[3] - text_bbox[1]
                elif hasattr(font, 'getbbox'):
                    text_bbox = font.getbbox(label_text)
                    text_w = text_bbox[2] - text_bbox[0]
                    text_h = text_bbox[3] - text_bbox[1]
                elif hasattr(font, 'getsize'):
                    text_w, text_h = font.getsize(label_text)
                else:
                    text_w, text_h = 20, 10 # Fallback
                
                # 在框的左上角画一个带红色背景的文本标签
                # 稍微往上偏移一点，防止遮挡元素内容
                label_y = max(0, y - text_h - 4)
                draw.rectangle([x, label_y, x + text_w + 4, label_y + text_h + 4], fill="red")
                draw.text((x + 2, label_y + 2), label_text, fill="white", font=font)
                
            # 将画好框的图片重新转换为 base64
            buffered = BytesIO()
            img.save(buffered, format="JPEG", quality=60)
            final_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            # 同样推送到 WebSocket Server
            if ws_session:
                try:
                    import urllib.request
                    import json
                    req = urllib.request.Request(
                        f"http://127.0.0.1:{ws_port}/api/internal/push_screenshot/{ws_session}",
                        data=json.dumps({"image": final_b64}).encode("utf-8"),
                        headers={"Content-Type": "application/json"}
                    )
                    urllib.request.urlopen(req, timeout=1)
                except Exception:
                    pass
                    
            return final_b64
            
        except Exception as e:
            # 如果画框失败（比如内存不足或 Pillow 报错），静默降级，返回原始截图
            from .logger import logger
            logger.warning(f"⚠️ 截图画框标注失败: {str(e)}，将降级使用原始截图。")
            return base64.b64encode(screenshot_bytes).decode('utf-8')

    def take_screenshot(self, path: str = "screenshot.png"):
        self.page.screenshot(path=path, full_page=True)
