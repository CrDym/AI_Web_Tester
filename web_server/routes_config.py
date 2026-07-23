import asyncio
import json
import os
import shutil
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

try:
    from src.ai_tester.llm_utils import create_chat_openai
    from web_server.runtime_utils import mask_secret
except Exception:
    from llm_utils import create_chat_openai
    from runtime_utils import mask_secret


class PromptUpdateReq(BaseModel):
    content: str


@dataclass
class ConfigRouteDeps:
    get_project_root: Callable[[], str]
    get_envs_file: Callable[[], str]
    get_prompts_dir: Callable[[], str]
    stable_env_id: Callable[[], str]
    safe_prompt_path: Callable[[str], str]
    load_env: Callable[[], None]


def _normalize_environments(data: Any, stable_env_id: Callable[[], str]) -> List[Dict[str, Any]]:
    if not isinstance(data, list):
        return []
    normalized = []
    seen = set()
    for item in data:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        base_url = str(item.get("base_url") or "").strip()
        if not name and not base_url:
            continue
        env_id = str(item.get("id") or "").strip()
        if not env_id or not env_id.startswith("env_"):
            env_id = stable_env_id()
        while env_id in seen:
            env_id = stable_env_id()
        seen.add(env_id)
        normalized.append({"id": env_id, "name": name or env_id, "base_url": base_url})
    return normalized


def _write_backup_copy(filepath: str) -> Optional[str]:
    if not os.path.exists(filepath):
        return None
    backup_path = f"{filepath}.{int(time.time())}.bak"
    shutil.copy2(filepath, backup_path)
    return backup_path


def _read_env_lines(path: str) -> List[str]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as file:
        return file.read().splitlines()


def _parse_env_values(lines: List[str]) -> Dict[str, str]:
    cfg: Dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, val = stripped.split("=", 1)
        cfg[key] = val
    return cfg


def _write_env_preserving_lines(path: str, updates: Dict[str, str]) -> None:
    lines = _read_env_lines(path)
    seen = set()
    out: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            out.append(line)
            continue
        key, _ = stripped.split("=", 1)
        if key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, val in updates.items():
        if key not in seen:
            out.append(f"{key}={val}")
    with open(path, "w", encoding="utf-8") as file:
        file.write("\n".join(out).rstrip() + "\n")


def create_config_router(deps: ConfigRouteDeps) -> APIRouter:
    router = APIRouter()

    @router.get("/api/environments")
    async def get_environments():
        envs_file = deps.get_envs_file()
        if not os.path.exists(envs_file):
            return JSONResponse([])
        with open(envs_file, "r", encoding="utf-8") as file:
            envs = _normalize_environments(json.load(file), deps.stable_env_id)
        with open(envs_file, "w", encoding="utf-8") as file:
            json.dump(envs, file, ensure_ascii=False, indent=2)
        return JSONResponse(envs)

    @router.post("/api/environments")
    async def save_environments(request: Request):
        data = await request.json()
        envs = _normalize_environments(data, deps.stable_env_id)
        with open(deps.get_envs_file(), "w", encoding="utf-8") as file:
            json.dump(envs, file, ensure_ascii=False, indent=2)
        return JSONResponse({"status": "success", "environments": envs})

    @router.get("/api/prompts")
    async def get_prompts():
        prompts_dir = deps.get_prompts_dir()
        os.makedirs(prompts_dir, exist_ok=True)
        prompts = {}
        for filename in os.listdir(prompts_dir):
            if filename.endswith(".txt"):
                try:
                    with open(os.path.join(prompts_dir, filename), "r", encoding="utf-8") as file:
                        prompts[filename] = file.read()
                except Exception:
                    pass
        return JSONResponse(prompts)

    @router.put("/api/prompts/{filename}")
    async def update_prompt(filename: str, req: PromptUpdateReq):
        os.makedirs(deps.get_prompts_dir(), exist_ok=True)
        filepath = deps.safe_prompt_path(filename)
        try:
            backup = _write_backup_copy(filepath)
            with open(filepath, "w", encoding="utf-8") as file:
                file.write(req.content)
            return JSONResponse({"status": "success", "backup": os.path.basename(backup) if backup else None})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    @router.get("/api/config")
    async def get_config():
        env_path = os.path.join(deps.get_project_root(), ".env")
        cfg = {"OPENAI_API_BASE": "https://models.inference.ai.azure.com", "OPENAI_API_KEY": "", "OPENAI_MODEL_NAME": "gpt-4o-mini"}
        cfg.update({k: v for k, v in _parse_env_values(_read_env_lines(env_path)).items() if k in cfg})
        masked = dict(cfg)
        masked["OPENAI_API_KEY"] = mask_secret(cfg.get("OPENAI_API_KEY", ""))
        masked["OPENAI_API_KEY_SET"] = bool(cfg.get("OPENAI_API_KEY"))
        return JSONResponse(masked)

    @router.post("/api/config")
    async def save_config(request: Request):
        data = await request.json()
        env_path = os.path.join(deps.get_project_root(), ".env")
        cfg = {"OPENAI_API_BASE": "https://models.inference.ai.azure.com", "OPENAI_API_KEY": "", "OPENAI_MODEL_NAME": "gpt-4o-mini"}
        cfg.update({k: v for k, v in _parse_env_values(_read_env_lines(env_path)).items() if k in cfg})

        if "OPENAI_API_BASE" in data:
            cfg["OPENAI_API_BASE"] = data["OPENAI_API_BASE"]
        if "OPENAI_API_KEY" in data:
            next_key = str(data.get("OPENAI_API_KEY") or "")
            if next_key and "*" not in next_key:
                cfg["OPENAI_API_KEY"] = next_key
        if "OPENAI_MODEL_NAME" in data:
            cfg["OPENAI_MODEL_NAME"] = data["OPENAI_MODEL_NAME"]

        _write_env_preserving_lines(env_path, cfg)
        deps.load_env()
        return JSONResponse({"status": "success"})

    @router.post("/api/config/test")
    async def test_config(request: Request):
        try:
            data = await request.json()
        except Exception:
            data = {}

        env_path = os.path.join(deps.get_project_root(), ".env")
        saved_cfg = _parse_env_values(_read_env_lines(env_path))
        api_base = str(data.get("OPENAI_API_BASE") or saved_cfg.get("OPENAI_API_BASE") or "https://api.openai.com/v1").strip()
        api_key = str(data.get("OPENAI_API_KEY") or saved_cfg.get("OPENAI_API_KEY") or "").strip()
        model_name = str(data.get("OPENAI_MODEL_NAME", "gpt-4o-mini") or "gpt-4o-mini").strip()

        if not api_base:
            return JSONResponse({"error": "请提供 Base URL"}, status_code=400)
        if not api_key:
            return JSONResponse({"error": "请提供 API Key"}, status_code=400)

        try:
            t0 = time.time()
            llm = create_chat_openai(
                model=model_name,
                api_key=api_key,
                base_url=api_base,
                max_retries=1,
                timeout=10,
            )
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: llm.invoke([HumanMessage(content="ping")]))
            token_usage = None
            try:
                if hasattr(resp, "response_metadata") and isinstance(resp.response_metadata, dict):
                    token_usage = resp.response_metadata.get("token_usage")
            except Exception:
                token_usage = None

            latency_ms = int((time.time() - t0) * 1000)
            reply = str(getattr(resp, "content", "")).strip()
            msg = f"连接成功 · {model_name} · {latency_ms}ms"
            if reply:
                msg = msg + f" · {reply[:40]}"
            return JSONResponse({"status": "success", "message": msg, "latency_ms": latency_ms, "token_usage": token_usage, "model": model_name})
        except Exception as e:
            return JSONResponse({"error": f"连接失败: {str(e)}"}, status_code=400)

    return router
