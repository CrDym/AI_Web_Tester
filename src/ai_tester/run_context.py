import contextvars
import re
import time
from typing import Any, Dict, List, Optional

_current_test_nodeid: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("ai_tester_test_nodeid", default=None)
_events_by_test: Dict[str, List[Dict[str, Any]]] = {}
_token_by_test: Dict[str, Dict[str, int]] = {}


def set_current_test(nodeid: str) -> None:
    _current_test_nodeid.set(nodeid)
    _events_by_test.setdefault(nodeid, [])
    _token_by_test.setdefault(nodeid, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})


def clear_current_test() -> None:
    _current_test_nodeid.set(None)


def get_current_test() -> Optional[str]:
    return _current_test_nodeid.get()


def sanitize_for_path(value: str) -> str:
    value = re.sub(r"[^0-9A-Za-z._-]+", "_", value).strip("_")
    return value[:120] or "unknown"


def record_event(
    kind: str,
    message: str,
    token_usage: Optional[Dict[str, int]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    nodeid = get_current_test()
    if not nodeid:
        return

    event: Dict[str, Any] = {
        "ts": time.time(),
        "kind": kind,
        "message": message,
    }
    if extra:
        event["extra"] = extra
    if token_usage:
        event["token_usage"] = {
            "prompt_tokens": int(token_usage.get("prompt_tokens", 0) or 0),
            "completion_tokens": int(token_usage.get("completion_tokens", 0) or 0),
            "total_tokens": int(token_usage.get("total_tokens", 0) or 0),
        }
        totals = _token_by_test.setdefault(nodeid, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
        totals["prompt_tokens"] += event["token_usage"]["prompt_tokens"]
        totals["completion_tokens"] += event["token_usage"]["completion_tokens"]
        totals["total_tokens"] += event["token_usage"]["total_tokens"]

    _events_by_test.setdefault(nodeid, []).append(event)


def get_events(nodeid: str) -> List[Dict[str, Any]]:
    return list(_events_by_test.get(nodeid, []))


def get_token_totals(nodeid: str) -> Dict[str, int]:
    return dict(_token_by_test.get(nodeid, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}))

