import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.ai_tester.llm_utils import CompatChatOpenAI, create_chat_openai

__all__ = ["CompatChatOpenAI", "create_chat_openai"]
