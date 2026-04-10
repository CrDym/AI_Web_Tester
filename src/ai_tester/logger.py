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
    
    logger.setLevel(logging.INFO)

    # 创建格式化器
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    )

    # 为了防止多次调用产生重复的 Console handler
    existing_console = any(isinstance(h, logging.StreamHandler) for h in logger.handlers)
    if not existing_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    run_dir = os.environ.get("AI_TESTER_RUN_DIR")
    if run_dir:
        log_dir = run_dir
        log_file = os.path.join(log_dir, "ai_tester.log")
    else:
        log_dir = os.path.join(os.getcwd(), "logs")
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = os.path.join(log_dir, f"ai_tester_{timestamp}.log")

    os.makedirs(log_dir, exist_ok=True)

    # 在添加新的 FileHandler 之前，先移除旧的 FileHandler，避免由于多次 setup 导致多个文件被同时写入
    existing_file_handlers = [h for h in logger.handlers if isinstance(h, logging.FileHandler)]
    for h in existing_file_handlers:
        # 如果当前已有指向同一个文件的 Handler，直接保留即可
        if getattr(h, "baseFilename", None) == os.path.abspath(log_file):
            continue
        try:
            logger.removeHandler(h)
            h.close()
        except Exception:
            pass

    # 检查是否已经包含了当前这个目标文件的 Handler
    already_has_current_file = any(
        isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", None) == os.path.abspath(log_file)
        for h in logger.handlers
    )

    if not already_has_current_file:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    if not run_dir:
        try:
            log_files = glob.glob(os.path.join(log_dir, "ai_tester_*.log"))
            log_files.sort(key=os.path.getmtime)
            if len(log_files) > 3:
                files_to_delete = log_files[:-3]
                for f in files_to_delete:
                    os.remove(f)
        except Exception:
            pass

    return logger

# 导出一个全局的 logger 实例供其他模块使用
logger = setup_logger()
