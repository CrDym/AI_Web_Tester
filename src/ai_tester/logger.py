import logging
import sys
import os
from datetime import datetime

def setup_logger():
    """
    配置并返回全局的 logger
    日志将同时输出到控制台和文件
    """
    logger = logging.getLogger("ai_tester")
    
    # 如果已经配置过，直接返回避免重复添加 handler
    if logger.handlers:
        return logger
        
    logger.setLevel(logging.INFO)

    # 创建格式化器
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    )

    # 1. 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. 文件处理器
    # 确保 logs 目录存在
    log_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, f"ai_tester_{datetime.now().strftime('%Y%m%d')}.log")
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

# 导出一个全局的 logger 实例供其他模块使用
logger = setup_logger()
