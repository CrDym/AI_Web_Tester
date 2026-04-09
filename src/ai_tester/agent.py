import os
import json
from typing import Dict, Any, Tuple
from .driver import PlaywrightDriver
from .logger import logger
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage, SystemMessage

class AITesterAgent:
    def __init__(self, driver: PlaywrightDriver, model_name: str = "gpt-5", temperature: float = 0.0):
        self.driver = driver
        
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
You are also given a history of your previous actions in this task.

Your goal is to execute the user's intent step by step. Look at the history and the current DOM to decide the *next* logical action.
DO NOT repeat the same action if it was already performed successfully.

Choose exactly one of the following actions:
1. `{"action": "click", "target_id": "1"}` - Click an element.
2. `{"action": "type", "target_id": "2", "value": "hello"}` - Type text into an input field.
3. `{"action": "scroll", "target_id": "null"}` - Scroll the page.
4. `{"action": "wait", "target_id": "null"}` - Wait for elements to load.
5. `{"action": "done", "target_id": "null"}` - Intent is completed.

Output strictly in JSON format. Do not include markdown backticks like ```json.
"""

    def _build_tree_str(self, page_data: Dict[str, Any]) -> str:
        """将提取的字典转换为大模型易读的字符串"""
        tree_str = "Current Page Interactive Elements:\n"
        for el in page_data.get('elements', []):
            role_text = el.get('role', '') or el.get('type', '')
            text_desc = f"'{el.get('text', '')}'" if el.get('text') else ""
            if not text_desc:
                attrs = []
                if el.get('placeholder'): attrs.append(f"placeholder='{el['placeholder']}'")
                if el.get('name'): attrs.append(f"name='{el['name']}'")
                if el.get('id_attr'): attrs.append(f"id='{el['id_attr']}'")
                text_desc = ", ".join(attrs)

            tree_str += f"[{el['id']}] {el['tag']} {text_desc} (role: {role_text})\n"
        return tree_str

    def get_dom_tree_str(self) -> str:
        """提取并返回当前页面的无障碍树字符串"""
        page_data = self.driver.get_dom_snapshot()
        return self._build_tree_str(page_data)

    def step(self, intent: str, max_steps: int = 5) -> bool:
        """
        基于自然语言意图，自主探索并执行多步操作，直到完成或超出步数。
        这是 Browser-use 和 AutoPlaywright 的核心思想混合体。
        """
        logger.info(f"🎯 开始执行意图: '{intent}'")
        
        action_history = []
        
        for step_idx in range(max_steps):
            logger.info(f"--- 步骤 {step_idx + 1} ---")
            
            # 1. 提取当前页面状态（核心：DOM压缩降维）
            page_data = self.driver.get_dom_snapshot()
            dom_tree_str = self._build_tree_str(page_data)
            
            # 这里截取一部分打印，避免刷屏
            logger.debug("页面 DOM 快照已提取（为大模型压缩过）。")
            # print(dom_tree_str[:200] + "...") 
            
            history_str = "历史动作记录:\n" + ("\n".join(action_history) if action_history else "无")
            
            # 2. 构造 Prompt 发送给大模型
            user_prompt = f"用户意图: {intent}\n\n{history_str}\n\n{dom_tree_str}\n\nWhat is the NEXT action?"
            
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=user_prompt)
            ]
            
            logger.info("大模型正在思考中...")
            try:
                response = self.llm.invoke(messages)
                content = response.content.strip()
                
                # 打印 Token 消耗情况
                if hasattr(response, 'response_metadata') and 'token_usage' in response.response_metadata:
                    usage = response.response_metadata['token_usage']
                    logger.info(f"📊 Token 消耗: Prompt={usage.get('prompt_tokens', 0)}, Completion={usage.get('completion_tokens', 0)}, 总计={usage.get('total_tokens', 0)}")
                
                # 尝试清理可能的 Markdown 格式
                if content.startswith("```json"):
                    content = content[7:-3].strip()
                elif content.startswith("```"):
                    content = content[3:-3].strip()
                    
                action_data = json.loads(content)
            except Exception as e:
                logger.error(f"❌ 解析大模型响应失败: {str(e)}\n原始响应: {response.content if 'response' in locals() else 'None'}")
                return False
                
            action = action_data.get("action")
            target_id = action_data.get("target_id")
            value = action_data.get("value")
            
            logger.info(f"🤖 大模型决策: 动作={action}, 目标ID=[{target_id}], 输入值={value}")
            
            if action == "done":
                logger.info(f"✅ 意图执行成功: '{intent}'")
                return True
                
            # 3. 执行动作
            try:
                self.driver.perform_action(action, str(target_id), value)
                action_record = f"动作: {action}, 目标ID: [{target_id}], 输入值: {value}"
                action_history.append(action_record)
                # 等待页面稳定
                self.driver.page.wait_for_timeout(1000)
            except Exception as e:
                logger.warning(f"⚠️ 动作执行失败: {str(e)}")
                action_history.append(f"执行失败: {action} 于 [{target_id}] - 错误: {str(e)}")
                # 在真实框架中，这里可以触发“自愈（Self-Healing）”机制或抛出异常
                
        logger.error(f"❌ 达到最大步数 ({max_steps}) 限制，意图未能完成: '{intent}'")
        return False
