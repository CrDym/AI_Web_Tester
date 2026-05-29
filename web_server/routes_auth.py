import secrets
from typing import Any, Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    from web_server.auth_utils import AUTH_TOKEN_TTL_SECONDS, extract_bearer_token, hash_password, is_valid_token, now_ts, password_matches
    from web_server.database import SessionLocal, UserModel
except Exception:
    from auth_utils import AUTH_TOKEN_TTL_SECONDS, extract_bearer_token, hash_password, is_valid_token, now_ts, password_matches
    from database import SessionLocal, UserModel


class AuthSetupReq(BaseModel):
    username: str
    password: str


class AuthLoginReq(BaseModel):
    username: str
    password: str


def create_auth_router(active_tokens: Dict[str, Dict[str, Any]]) -> APIRouter:
    router = APIRouter()

    @router.post("/api/auth/setup")
    async def auth_setup(req: AuthSetupReq):
        username = (req.username or "").strip()
        password = str(req.password or "")
        if not username or not password:
            return JSONResponse({"error": "Missing parameters"}, status_code=400)
        db = SessionLocal()
        try:
            if db.query(UserModel).count() > 0:
                return JSONResponse({"error": "Already initialized"}, status_code=409)
            if db.query(UserModel).filter_by(username=username).first():
                return JSONResponse({"error": "User already exists"}, status_code=409)
            salt = secrets.token_hex(16)
            user = UserModel(
                username=username,
                password_hash=hash_password(password, salt),
                salt=salt,
                created_at=now_ts(),
                last_login_at=None,
            )
            db.add(user)
            db.commit()
            return JSONResponse({"status": "success"})
        finally:
            db.close()

    @router.post("/api/auth/login")
    async def auth_login(req: AuthLoginReq):
        username = (req.username or "").strip()
        password = str(req.password or "")
        if not username or not password:
            return JSONResponse({"error": "Missing parameters"}, status_code=400)
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter_by(username=username).first()
            if not user:
                return JSONResponse({"error": "Invalid credentials"}, status_code=401)
            if not password_matches(password, getattr(user, "salt", "") or "", getattr(user, "password_hash", "") or ""):
                return JSONResponse({"error": "Invalid credentials"}, status_code=401)
            user.last_login_at = now_ts()
            db.commit()
            token = secrets.token_urlsafe(32)
            active_tokens[token] = {"username": username, "exp": now_ts() + AUTH_TOKEN_TTL_SECONDS}
            return JSONResponse({"status": "success", "token": token, "username": username})
        finally:
            db.close()

    @router.get("/api/auth/me")
    async def auth_me(request: Request):
        token = extract_bearer_token(request.headers.get("Authorization") or "")
        if not is_valid_token(active_tokens, token):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        rec = active_tokens.get(token) or {}
        return JSONResponse({"status": "success", "username": rec.get("username")})

    return router
