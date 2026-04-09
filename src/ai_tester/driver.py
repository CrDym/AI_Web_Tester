import os
from typing import Dict, Any

class PlaywrightDriver:
    def __init__(self, page):
        self.page = page

    def get_dom_snapshot(self) -> Dict[str, Any]:
        """
        注入 JS 提取精简的交互元素树。
        这极大地减少了发送给大模型的 Token 数量。
        """
        script_path = os.path.join(os.path.dirname(__file__), "inject", "extract_elements.js")
        with open(script_path, "r", encoding="utf-8") as f:
            script_content = f.read()

        # 注入脚本
        self.page.add_script_tag(content=script_content)
        
        # 执行脚本获取元素树
        elements_data = self.page.evaluate("() => extractInteractiveElements()")
        return elements_data

    def perform_action(self, action: str, target_id: str, value: str = None):
        """
        根据大模型返回的动作（如 click, type）和对应的 AI ID 执行底层 Playwright 操作。
        """
        selector = f"[ai-id='{target_id}']"
        try:
            if action == "click":
                self.page.click(selector)
            elif action == "type":
                self.page.fill(selector, value)
            elif action == "scroll":
                self.page.mouse.wheel(0, 500) # 简单模拟滚动
            elif action == "wait":
                self.page.wait_for_timeout(1000) # 等待 1 秒
            else:
                raise ValueError(f"Unknown action: {action}")
        except Exception as e:
            # 记录异常，后续触发自愈机制
            raise Exception(f"Action {action} failed on element {target_id}: {str(e)}")

    def take_screenshot(self, path: str = "screenshot.png"):
        self.page.screenshot(path=path, full_page=True)
