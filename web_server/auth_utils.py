import hashlib
import hmac
import time
from typing import Any, Dict


AUTH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60


def now_ts() -> int:
    return int(time.time())


def hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        (password or "").encode("utf-8"),
        (salt or "").encode("utf-8"),
        120000,
    )
    return dk.hex()


def password_matches(password: str, salt: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), password_hash or "")


def is_valid_token(active_tokens: Dict[str, Dict[str, Any]], token: str) -> bool:
    tok = (token or "").strip()
    if not tok:
        return False
    rec = active_tokens.get(tok)
    if not rec:
        return False
    exp = int(rec.get("exp") or 0)
    if exp and now_ts() >= exp:
        active_tokens.pop(tok, None)
        return False
    return True


def extract_bearer_token(auth_header: str) -> str:
    raw = (auth_header or "").strip()
    if not raw:
        return ""
    if raw.lower().startswith("bearer "):
        return raw[7:].strip()
    return ""
