import logging
import sys
import os
import glob
from datetime import datetime

def setup_logger():
    """
    配置并返回全局的 logger
    日志将同时输出到控制台和文件。每次运行生成新文件，最多保留 10 个。
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
    
    # 每次测试生成一个新的带有时间戳的日志文件
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = os.path.join(log_dir, f"ai_tester_{timestamp}.log")
    
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # 3. 清理旧日志文件，最多保留 10 个
    try:
        log_files = glob.glob(os.path.join(log_dir, "ai_tester_*.log"))
        # 按修改时间排序，最旧的在前面
        log_files.sort(key=os.path.getmtime)
        
        # 如果超过 10 个，删除最旧的
        if len(log_files) > 10:
            files_to_delete = log_files[:-10]
            for f in files_to_delete:
                os.remove(f)
    except Exception as e:
        print(f"⚠️ 清理旧日志文件时发生异常: {e}")

    return logger

# 导出一个全局的 logger 实例供其他模块使用
logger = setup_logger()
