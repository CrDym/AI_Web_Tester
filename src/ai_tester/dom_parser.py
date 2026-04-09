import re
from typing import Dict, Any

def compress_dom(html_content: str) -> str:
    """
    将原始 HTML 压缩为适合发给大模型的语义化结构（占位实现）。
    """
    # 移除脚本和样式
    html_content = re.sub(r'<script.*?>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<style.*?>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<svg.*?>.*?</svg>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # 这里我们做一个极其简化的版本作为占位符
    # 实际中我们会注入 JS 提取带有 bounding_box 的交互元素
    return html_content

def build_interactive_tree(page_data: Dict[str, Any]) -> str:
    """
    基于页面注入脚本抽取的元素数据，构造可读的交互元素列表字符串。
    """
    # 这个函数将接收从页面注入的 JS 提取的元素数据
    tree_str = "Interactive Elements:\n"
    for el in page_data.get('elements', []):
        tree_str += f"[{el['id']}] {el['tag']} '{el.get('text', '')}' (role: {el.get('role', '')})\n"
    return tree_str
