import os
import json
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from .logger import logger
from .driver import PlaywrightDriver

class DataExtractor:
    """
    智能数据提取器 (Smart Data Extractor)
    基于页面 DOM 和多模态截图，通过自然语言指令提取结构化 JSON 数据。
    """
    def __init__(self, driver: PlaywrightDriver, model_name: str = None, temperature: float = 0.0, use_vision: bool = True):
        self.driver = driver
        self.use_vision = use_vision
        final_model_name = model_name or os.environ.get("OPENAI_MODEL_NAME", "gpt-4o-mini")
        self.llm = ChatOpenAI(
            model=final_model_name,
            temperature=temperature,
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_API_BASE")
        )

        self.system_prompt = """
You are an intelligent Web Data Extraction Agent.
You are given a compressed DOM tree of the current page.
You may also be given a screenshot of the current page if vision is enabled.
Your task is to extract data according to the user's instructions based on the provided DOM and Screenshot.
Return ONLY a valid JSON array or JSON object representing the extracted data.
Do not wrap it in markdown code blocks like ```json, just return the raw JSON.
"""

    def extract(self, query: str) -> Any:
        logger.info(f"🔎 收到智能数据提取请求: '{query}'")
        
        page_data = self.driver.get_dom_snapshot()
        
        # 构建精简 DOM 树
        tree_str = "Current Viewport Elements:\n"
        for el in page_data.get('elements', []):
            tree_str += f"- [{el['id']}] {el['tag']} text:\"{el.get('text', '')}\"\n"
            
        user_prompt = f"Query: {query}\n\nDOM:\n{tree_str}\n\nPlease extract the data and return as JSON."
        
        if self.use_vision:
            b64_img = self.driver.get_screenshot(page_data.get('elements', []))
            human_content = [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}", "detail": "high"}}
            ]
            logger.debug("已附加当前页面高清截图辅助数据提取。")
        else:
            human_content = user_prompt
            
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=human_content)
        ]
        
        logger.info("大脑正在思考并提取数据中...")
        try:
            response = self.llm.invoke(messages)
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            data = json.loads(content)
            count = len(data) if isinstance(data, list) else 1
            logger.info(f"✅ 数据提取成功，提取到 {count} 条/组记录。")
            return data
        except Exception as e:
            logger.error(f"❌ 数据提取失败: {str(e)}\n原始响应: {response.content if 'response' in locals() else 'None'}")
            return None
