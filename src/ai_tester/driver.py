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
        with open(os.path.join(os.path.dirname(__file__), 'inject', 'extract_elements.js'), 'r') as f:
            script = f.read()

        # 始终获取最前端的活跃标签页，以支持多 Tab 环境
        if len(self.page.context.pages) > 0:
            active_page = self.page.context.pages[-1]
            # 同步更新 driver 内部引用的 page
            self.page = active_page
        else:
            active_page = self.page

        all_elements = []
        current_id = 1
        
        # 遍历当前页面的所有 Frame (主页面本身也是第一个 frame，后续的是各种 Iframe)
        for frame in active_page.frames:
            try:
                # 给每个 frame 注入抽取脚本
                frame.evaluate(script)
                # 执行抽取，并传入当前的起始 ID 防止跨 frame 的 ID 冲突
                result = frame.evaluate(f"() => window.extractInteractiveElements({current_id})")
                if result and 'elements' in result:
                    elements = result.get('elements', [])
                    all_elements.extend(elements)
                    current_id += len(elements)
            except Exception:
                # 对于跨域的 iframe (cross-origin)，执行 evaluate 可能会抛出异常，这里做静默降级处理
                pass
                
        return {"elements": all_elements}

    def perform_action(self, action: str, target_id: str, value: str = None):
        """执行动作，支持 Iframe 穿透定位"""
        # 支持传入原生 CSS 选择器，以便于自愈缓存回放
        if target_id.startswith("SELECTOR:"):
            selector = target_id.replace("SELECTOR:", "")
        elif target_id and target_id != "null":
            selector = f"[ai-id='{target_id}']"
        else:
            selector = None
            
        target_locator = None
        if selector:
            target_locator = self._get_locator(selector)

        for attempt in range(2):
            try:
                if action in self.action_registry:
                    self.action_registry[action](target_locator, value)
                else:
                    raise ValueError(f"Unknown action: {action}")
                return
            except Exception as e:
                msg = str(e)
                if attempt == 0 and ("intercepts pointer events" in msg or "cf-modal-wrap" in msg):
                    self._handle_overlay_block()
                    continue
                raise Exception(f"Action {action} failed on element {target_id}: {msg}")

    def _get_locator(self, selector: str):
        """跨 iframe 获取元素的 locator"""
        if self.page.locator(selector).count() > 0:
            return self.page.locator(selector).first
        
        for frame in self.page.frames:
            if frame.locator(selector).count() > 0:
                return frame.locator(selector).first
                
        return self.page.locator(selector)

    def _handle_overlay_block(self):
        """处理遮挡物的通用逻辑"""
        try:
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(500)
            if self.page.locator(".cf-modal-close").count() > 0:
                self.page.locator(".cf-modal-close").first.click()
                self.page.wait_for_timeout(500)
        except Exception:
            pass

    # --- 内置动作处理器 ---
    def _action_click(self, locator, value):
        locator.click()

    def _action_double_click(self, locator, value):
        locator.dblclick()

    def _action_right_click(self, locator, value):
        locator.click(button="right")

    def _action_type(self, locator, value):
        locator.fill(value)

    def _action_hover(self, locator, value):
        locator.hover()

    def _action_select_option(self, locator, value):
        locator.select_option(value)

    def _action_drag_and_drop(self, locator, value):
        # value 是目标元素的 ai-id
        target_selector = f"[ai-id='{value}']"
        target_locator = self._get_locator(target_selector)
        locator.drag_to(target_locator)

    def _action_press_key(self, locator, value):
        self.page.keyboard.press(value)

    def _action_scroll(self, locator, value):
        self.page.mouse.wheel(0, 500)

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
        screenshot_bytes = self.page.screenshot(
            type="jpeg", 
            quality=60,
            scale="css" 
        )
        
        # 如果没有传入元素数据，直接返回原图的 base64
        if not elements_data:
            return base64.b64encode(screenshot_bytes).decode('utf-8')
            
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
                # 过滤掉不可见或过小的元素
                if w <= 0 or h <= 0:
                    continue
                    
                el_id = str(el.get('id', ''))
                if not el_id:
                    continue
                    
                # 画一个红色的边框
                draw.rectangle([x, y, x + w, y + h], outline="red", width=2)
                
                # 准备标签文本
                label_text = f"[{el_id}]"
                
                # 计算标签文本的尺寸 (兼容不同版本的 Pillow)
                if hasattr(font, 'getbbox'):
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
            return base64.b64encode(buffered.getvalue()).decode('utf-8')
            
        except Exception as e:
            # 如果画框失败（比如内存不足或 Pillow 报错），静默降级，返回原始截图
            from .logger import logger
            logger.warning(f"⚠️ 截图画框标注失败: {str(e)}，将降级使用原始截图。")
            return base64.b64encode(screenshot_bytes).decode('utf-8')

    def take_screenshot(self, path: str = "screenshot.png"):
        self.page.screenshot(path=path, full_page=True)
