import sys
import os

# 将 src 目录添加到 sys.path 中以便可以导入 ai_tester
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

# 注册钩子以生成 HTML 报告
pytest_plugins = ["ai_tester.pytest_plugin"]
