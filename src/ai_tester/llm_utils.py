import json
from typing import Any

from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_openai import ChatOpenAI


class CompatChatOpenAI(ChatOpenAI):
    """ChatOpenAI wrapper that tolerates string responses from compatible APIs."""

    def _create_chat_result(self, response: Any, generation_info: Any = None) -> ChatResult:
        if isinstance(response, str):
            content = response.strip()
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = None

            if isinstance(parsed, dict):
                if "error" in parsed:
                    raise ValueError(parsed.get("error"))
                choices = parsed.get("choices")
                if isinstance(choices, list) and choices:
                    return super()._create_chat_result(parsed, generation_info)

            return ChatResult(
                generations=[
                    ChatGeneration(
                        message=AIMessage(content=content),
                        generation_info=generation_info,
                    )
                ]
            )

        return super()._create_chat_result(response, generation_info)


def create_chat_openai(**kwargs: Any) -> ChatOpenAI:
    return CompatChatOpenAI(**kwargs)
