import os
from typing import Tuple

from fastapi import HTTPException


RUN_STATUS_PENDING = "pending"
RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_FAILED = "failed"
RUN_STATUS_STOPPED = "stopped"
RUN_STATUS_TIMEOUT = "timeout"
RUN_TERMINAL_STATUSES = {RUN_STATUS_COMPLETED, RUN_STATUS_FAILED, RUN_STATUS_STOPPED, RUN_STATUS_TIMEOUT}
DEFAULT_RUN_TIMEOUT_SECONDS = int(os.environ.get("AI_TESTER_RUN_TIMEOUT_SECONDS", "1800"))


def safe_child_path(root_dir: str, filename: str, *, suffix: str, error_label: str) -> Tuple[str, str]:
    safe_name = os.path.basename((filename or "").strip())
    if not safe_name or safe_name in (".", "..") or safe_name != (filename or "").strip():
        raise HTTPException(status_code=400, detail={"error": error_label})
    if suffix and not safe_name.endswith(suffix):
        raise HTTPException(status_code=400, detail={"error": error_label})
    root = os.path.realpath(root_dir)
    file_path = os.path.realpath(os.path.join(root, safe_name))
    if not file_path.startswith(root + os.sep):
        raise HTTPException(status_code=400, detail={"error": error_label})
    return file_path, safe_name


def mask_secret(value: str) -> str:
    raw = str(value or "")
    if not raw:
        return ""
    if len(raw) <= 8:
        return "*" * len(raw)
    return f"{raw[:4]}...{raw[-4:]}"
