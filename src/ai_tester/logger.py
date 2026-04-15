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

    # 创建格式化器 - 简化用于 Web UI 显示，去掉了冗长的日期和行号，只保留时间、级别和内容
    formatter = logging.Formatter(
        '[%(asctime)s] %(message)s',
        datefmt='%H:%M:%S'
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

    # 尝试清理旧日志文件，最多保留 0 个（因为如果有了 run_dir，全局的 ai_tester_*.log 完全不需要保留）
    # 当还没有 run_dir 时（比如单脚本测试不走 pytest），保留最多 3 个
    try:
        global_log_dir = os.path.join(os.getcwd(), "logs")
        log_files = glob.glob(os.path.join(global_log_dir, "ai_tester_*.log"))
        log_files.sort(key=os.path.getmtime)
        
        # 如果当前在 run_dir 模式下，外层全局的 ai_tester_*.log 是没有价值的（都是 collection 产生的），可以直接全删
        # 如果不是 run_dir 模式，则保留最近的 3 个
        keep_count = 0 if run_dir else 3
        
        if len(log_files) > keep_count:
            files_to_delete = log_files[:-keep_count] if keep_count > 0 else log_files
            for f in files_to_delete:
                # 排除正在使用的那个文件
                if os.path.abspath(f) != os.path.abspath(log_file):
                    os.remove(f)
    except Exception:
        pass

    return logger

# 导出一个全局的 logger 实例供其他模块使用
logger = setup_logger()
