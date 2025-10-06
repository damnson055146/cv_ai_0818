"""Minimal FastAPI backend focussed on Chatbot endpoints.

This file is ASCII-only to avoid accidental non-UTF-8 bytes causing
import-time decoding errors. All long prompts should be stored in DB.
"""

from __future__ import annotations

import os
import json
import re
from typing import Any

import logging

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .toolbar_ai import router as toolbar_router
from .agent import router as agent_router
from .db import ensure_prompts_table, ensure_ps_tables, get_prompt


# Load envs from backend_fastapi/.env if present
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
except Exception:
    pass


app = FastAPI(title="cv-ai FastAPI backend")
ensure_prompts_table()
ensure_ps_tables()
app.include_router(toolbar_router)
app.include_router(agent_router)


# CORS for frontend dev (Nuxt at :3000)
# Expand simple host entries (e.g. "example.com" or "example.com:3000")
# into both http:// and https:// variants to reduce CORS misconfiguration.
def _expand_cors_token(token: str) -> list[str]:
    token = token.strip()
    if not token:
        return []
    if token == "*":
        return ["*"]
    token = token.rstrip("/")
    lowered = token.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return [token]
    if lowered.startswith("//"):
        host = token[2:]
    else:
        host = token
    host = host.lstrip("/")
    if not host:
        return []
    return [f"http://{host}", f"https://{host}"]


def _load_cors_origins(env_value: str | None) -> list[str]:
    value = (env_value or "").strip()
    if not value:
        return []
    seen: set[str] = set()
    expanded: list[str] = []
    for raw in value.split(","):
        for item in _expand_cors_token(raw):
            normalized = item.strip()
            if not normalized:
                continue
            if normalized == "*":
                return ["*"]
            if normalized not in seen:
                seen.add(normalized)
                expanded.append(normalized)
    return expanded


_cors_origins_env = os.getenv("FASTAPI_CORS_ALLOW_ORIGINS", "")
_default_cors_tokens = "127.0.0.1:3000,localhost:3000,101.201.60.17:3000"
_default_origins = _load_cors_origins(_default_cors_tokens)
_origins = _load_cors_origins(_cors_origins_env) or _default_origins
_allow_credentials = True
_allow_origin_regex = None
if "*" in _origins:
    # Switch to regex mode so we can echo the request origin even with
    # allow_credentials enabled. FastAPI will reject "*" + credentials, so
    # we keep the broad match via regex instead.
    _allow_origin_regex = ".*"
    _origins = []

_logger = logging.getLogger("uvicorn.error")
try:
    _logger.info(
        "Loaded CORS allow_origins=%s allow_origin_regex=%s allow_credentials=%s",
        _origins,
        _allow_origin_regex,
        _allow_credentials,
    )
except Exception:
    pass

def _init_rec_logger() -> logging.Logger:
    logger = logging.getLogger("rec.create")
    logger.setLevel(logging.INFO)
    if logger.handlers:
        return logger
    log_path = os.getenv("REC_CREATE_LOG_PATH", "").strip()
    try:
        if not log_path:
            here = os.path.dirname(__file__)
            repo_root = os.path.abspath(os.path.join(here, "..", ".."))
            log_dir = os.path.join(repo_root, "logs")
            os.makedirs(log_dir, exist_ok=True)
            log_path = os.path.join(log_dir, "rec_create.log")
        handler = logging.FileHandler(log_path, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
    except Exception:
        logger = _logger
        _logger.warning("rec_create log setup failed", exc_info=True)
    return logger


_rec_logger = _init_rec_logger()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_allow_origin_regex,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_openai_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")
    return key


async def upload_base64_to_openai_file(
    name: str,
    b64: str,
    purpose: str,
    api_key: str,
    content_type: str | None = None,
) -> dict:
    if not b64:
        raise HTTPException(status_code=400, detail="contentBase64 is required")

    import base64

    payload = b64.strip()
    if "," in payload and payload.startswith("data:"):
        header, payload = payload.split(",", 1)
        if not content_type:
            try:
                content_type = header.split(":", 1)[1].split(";", 1)[0]
            except Exception:
                content_type = None
    try:
        file_bytes = base64.b64decode(payload, validate=True)
    except Exception:
        padded = payload + ("=" * (-len(payload) % 4))
        try:
            file_bytes = base64.urlsafe_b64decode(padded)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid base64 content") from exc

    files = {
        "file": (name, file_bytes, content_type or "application/octet-stream"),
        "purpose": (None, purpose or "user_data"),
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/files",
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
        )

    resp_ct = r.headers.get("content-type", "")
    data = r.json() if "application/json" in resp_ct else {"text": r.text}
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=data)
    return data


@app.post("/api/files/upload")
async def files_upload(req: Request):
    body = await req.json()
    name = str(body.get("name") or "upload.bin")
    b64 = str(body.get("contentBase64") or "")
    ctype = str(body.get("contentType") or "application/octet-stream")
    purpose = str(body.get("purpose") or "user_data")
    api_key = get_openai_key()
    data = await upload_base64_to_openai_file(name, b64, purpose, api_key, content_type=ctype)
    # Wrap to match frontend expectation: { status: 'ok', file: { ... } }
    return {"status": "ok", "file": data}


@app.get("/api/files/meta/{file_id}")
async def files_meta(file_id: str):
    api_key = get_openai_key()
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"https://api.openai.com/v1/files/{file_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if r.status_code >= 400:
        try:
            err = r.json()
        except Exception:
            err = {"error": r.text}
        raise HTTPException(status_code=r.status_code, detail=err)
    return r.json()


@app.get("/api/files/content/{file_id}")
async def files_content(file_id: str):
    api_key = get_openai_key()
    async with httpx.AsyncClient(timeout=None) as client:
        r = await client.get(
            f"https://api.openai.com/v1/files/{file_id}/content",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return StreamingResponse(iter([r.content]), media_type=r.headers.get("content-type") or "application/octet-stream")


def get_rec_prompt() -> str:
    try:
        val = get_prompt("rec_prompt_main")
        if isinstance(val, str) and val.strip():
            return val
    except Exception:
        pass
    # Fallback to file at repo root (rec_gen.md) if present
    try:
        here = os.path.dirname(__file__)
        repo_root = os.path.abspath(os.path.join(here, "..", ".."))
        candidate = os.path.join(repo_root, "rec_gen.md")
        if os.path.exists(candidate):
            with open(candidate, "r", encoding="utf-8") as f:
                return f.read()
    except Exception:
        pass
    return ""


# ---- Recommendation creation (REC) ----

def _read_rec_create_prompt() -> dict[str, str]:
    """Return the Prompt resource reference used for recommendation creation."""

    prompt_id = os.getenv(
        "REC_PROMPT_ID",
        "pmpt_68c1963af49081948e0b1a7d51152a530b1e5a4c68ba8796",
    ).strip()
    prompt_version = os.getenv("REC_PROMPT_VERSION", "4").strip()
    ref: dict[str, str] = {}
    if prompt_id:
        ref["prompt_id"] = prompt_id
    if prompt_version:
        ref["version"] = prompt_version
    return ref


def _build_responses_input(system_text: str | None, user_text: str, file_ids: list[str] | None) -> list[dict]:
    parts: list[dict] = []
    if isinstance(system_text, str) and system_text.strip():
        parts.append(
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_text}],
            }
        )
    user_entry = {"role": "user", "content": []}
    user_entry["content"].append({"type": "input_text", "text": user_text or ""})
    if file_ids:
        for fid in file_ids:
            user_entry["content"].append({"type": "input_file", "file_id": fid})
    parts.append(user_entry)
    return parts


def _read_ps_create_prompt() -> str:
    """Best-effort PS creation prompt.

    Priority:
    1) DB keys (ps_system_body -> ps_system_outline -> ps_system_element)
    2) Repo root ps_sys.md if present
    3) Fallback to empty string
    """
    # Try DB keys first
    try:
        for key in ("ps_system_body", "ps_system_outline", "ps_system_element"):
            val = get_prompt(key)
            if isinstance(val, str) and val.strip():
                return val
    except Exception:
        pass
    # Fallback to repo file
    try:
        here = os.path.dirname(__file__)
        repo_root = os.path.abspath(os.path.join(here, "..", ".."))
        candidate = os.path.join(repo_root, "ps_sys.md")
        if os.path.exists(candidate):
            with open(candidate, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()
    except Exception:
        pass
    return ""


def _read_cv_create_prompt() -> Any:
    """Resolve the prompt configuration for CV creation.

    Priority:
    1) Environment variables CV_PROMPT_ID / CV_PROMPT_VERSION (defaults to
       pmpt_68d9f3fe3eb48197abd642d6984d6d3e01709ceef551872c)
    2) DB key agent_act_system_prompt:cv
    3) Repo root cv_sys.md if present
    4) Empty string fallback
    """

    default_prompt_id = "pmpt_68d9f3fe3eb48197abd642d6984d6d3e01709ceef551872c"
    env_val = os.getenv("CV_PROMPT_ID")
    prompt_id = env_val.strip() if isinstance(env_val, str) else default_prompt_id
    if prompt_id:
        ref: dict[str, str] = {"prompt_id": prompt_id}
        prompt_version = os.getenv("CV_PROMPT_VERSION", "").strip()
        if prompt_version:
            ref["version"] = prompt_version
        return ref

    # Try DB key used for agent act (when env blank)
    try:
        val = get_prompt("agent_act_system_prompt:cv")
        if isinstance(val, str) and val.strip():
            return val
    except Exception:
        pass
    # Fallback to repo file
    try:
        here = os.path.dirname(__file__)
        repo_root = os.path.abspath(os.path.join(here, "..", ".."))
        candidate = os.path.join(repo_root, "cv_sys.md")
        if os.path.exists(candidate):
            with open(candidate, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()
    except Exception:
        pass
    return ""


def _get_create_prompt(doc_type: str) -> Any:
    dt = (doc_type or "").lower().strip()
    if dt == "ps":
        return _read_ps_create_prompt()
    if dt == "cv":
        return _read_cv_create_prompt()
    # default rec
    return _read_rec_create_prompt()


def _get_create_model(doc_type: str) -> str:
    dt = (doc_type or "").lower().strip()
    if dt == "cv":
        return os.getenv("CV_CREATE_MODEL", os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5")).strip() or "gpt-5"
    if dt == "ps":
        return os.getenv("PS_CREATE_MODEL", os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5")).strip() or "gpt-5"
    return os.getenv("REC_CREATE_MODEL", os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5")).strip() or "gpt-5"


def _get_create_agent_id(doc_type: str) -> str | None:
    dt = (doc_type or "").lower().strip()
    env_key = {
        "cv": "CV_AGENT_ID",
        "ps": "PS_AGENT_ID",
        "rec": "REC_AGENT_ID",
    }.get(dt, "")
    value = os.getenv(env_key or "", "").strip() if env_key else ""
    return value or None


def _get_schema_name(doc_type: str) -> str:
    dt = (doc_type or "").lower().strip()
    return {"cv": "resume_create", "ps": "personal_statement_create", "rec": "recommendation_create"}.get(dt, "document_create")


def _build_schema() -> dict:
    # Use a common schema across doc types to simplify client parsing
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["result"],
        "properties": {
            "material": {"type": "string"},
            "outline": {"type": "string"},
            "checks": {
                "oneOf": [
                    {"type": "string"},
                    {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "perspective_consistency": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}]},
                            "language_quality": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}]},
                            "content_completeness": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}]},
                            "structure_logic": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}]},
                        },
                    },
                ]
            },
            "result": {
                "oneOf": [
                    {"type": "string"},
                    {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "letter_en": {"type": "string"},
                            "letter_zh": {"type": "string"},
                        },
                    },
                ]
            },
            "reasoning_summary": {"type": "string"},
            "steps": {"type": "array", "items": {"type": "string"}},
        },
    }


def _extract_resume_markdown(data: Any) -> str:
    """Walk structured outputs to find the primary resume Markdown."""

    def pick(text: Any) -> str:
        if not isinstance(text, str):
            return ""
        candidate = text.strip()
        if not candidate:
            return ""
        if "\n" in candidate or candidate.startswith("#"):
            return candidate
        return ""

    def walk(node: Any, depth: int = 0) -> str:
        if depth > 8:
            return ""
        direct = pick(node)
        if direct:
            return direct
        if isinstance(node, dict):
            preferred_keys = [
                "english_letter",
                "letter_en",
                "english_text",
                "resume_markdown",
                "cv_markdown",
                "markdown",
                "resume",
                "cv",
                "content",
                "text",
                "body",
                "result",
            ]
            for key in preferred_keys:
                if key in node:
                    found = walk(node[key], depth + 1)
                    if found:
                        return found
            for value in node.values():
                found = walk(value, depth + 1)
                if found:
                    return found
        if isinstance(node, list):
            for item in node:
                found = walk(item, depth + 1)
                if found:
                    return found
        return ""

    return walk(data)


def _ensure_cv_heading(markdown: str) -> str:
    """Ensure the resume starts with a level-2 heading for the candidate name."""

    if not markdown:
        return ""
    lines = markdown.splitlines()
    first_idx = None
    for idx, line in enumerate(lines):
        if line.strip():
            first_idx = idx
            break
    if first_idx is None:
        return markdown.strip()
    first_line = lines[first_idx]
    if first_line.lstrip().startswith("##"):
        return markdown.strip()
    match = re.match(r"^#+\s*(.*)$", first_line.strip())
    if match:
        name_part = match.group(1).strip()
        lines[first_idx] = f"## {name_part}" if name_part else "##"
    else:
        lines[first_idx] = f"## {first_line.strip()}" if first_line.strip() else "##"
    return "\n".join(lines).strip()


async def _post_responses(api_key: str, payload: dict, timeout: float = 180.0):
    base_url = os.getenv("OPENAI_RESPONSES_URL", "https://api.openai.com/v1/responses").strip() or "https://api.openai.com/v1/responses"
    # Allow env override for read timeout (prefer CREATE_TIMEOUT, fallback REC_CREATE_TIMEOUT)
    try:
        env_to = float((os.getenv("CREATE_TIMEOUT", "").strip() or os.getenv("REC_CREATE_TIMEOUT", "0").strip() or "0"))
        if env_to and env_to > 0:
            timeout = env_to
    except Exception:
        pass
    t = httpx.Timeout(connect=30.0, read=timeout, write=max(60.0, min(timeout, 300.0)), pool=timeout)
    async with httpx.AsyncClient(timeout=t) as client:
        return await client.post(
            base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )


def _summarize_openai_payload(doc_type: str, payload: dict) -> dict:
    summary = {
        "doc_type": doc_type,
        "model": payload.get("model"),
        "max_output_tokens": payload.get("max_output_tokens"),
        "reasoning_effort": (payload.get("reasoning") or {}).get("effort"),
        "has_response_format": "response_format" in payload,
        "input_count": len(payload.get("input") or []),
        "input_preview": [],
    }
    if payload.get("agent_id"):
        summary["agent_id"] = payload.get("agent_id")
    prompt_meta = payload.get("prompt")
    if isinstance(prompt_meta, dict):
        summary["prompt_id"] = prompt_meta.get("id")
        if prompt_meta.get("version"):
            summary["prompt_version"] = prompt_meta.get("version")
    try:
        for item in (payload.get("input") or [])[:5]:
            if not isinstance(item, dict):
                continue
            entry: dict[str, Any] = {}
            role = item.get("role")
            if isinstance(role, str):
                entry["role"] = role
            content_types: list[str] = []
            for content in item.get("content") or []:
                if not isinstance(content, dict):
                    continue
                ctype = content.get("type")
                if isinstance(ctype, str):
                    content_types.append(ctype)
                    if ctype in {"input_text", "text"} and "text_preview" not in entry:
                        text = content.get("text")
                        if isinstance(text, str) and text:
                            preview = text[:120]
                            if len(text) > 120:
                                preview += "..."
                            entry["text_preview"] = preview
            if content_types:
                entry["content_types"] = content_types
            summary["input_preview"].append(entry)
    except Exception:
        summary = {
            "doc_type": doc_type,
            "payload_keys": sorted(payload.keys()) if isinstance(payload, dict) else None,
        }
    return summary


async def _create_inner(body: dict, doc_type: str) -> JSONResponse:
    api_key = get_openai_key()

    user_prompt = str(body.get("prompt") or "")
    # Optional language hint appended to user prompt
    language = str(body.get("language") or "").strip()
    if language:
        if user_prompt:
            user_prompt = f"{user_prompt}\n\nLanguage: {language}"
        else:
            user_prompt = f"Language: {language}"

    file_ids = [str(x) for x in (body.get("file_ids") or []) if isinstance(x, (str, bytes))]
    if not (user_prompt.strip() or file_ids):
        raise HTTPException(status_code=400, detail="prompt or file_ids is required")

    prompt_ref: dict[str, str] | None = None
    system_prompt = _get_create_prompt(doc_type)
    system_text: str | None = ""
    if isinstance(system_prompt, dict):
        prompt_id = system_prompt.get("prompt_id") or system_prompt.get("id")
        if prompt_id:
            prompt_ref = {"id": prompt_id}
            version = system_prompt.get("version")
            if isinstance(version, str) and version.strip():
                prompt_ref["version"] = version.strip()
            system_text = None
        else:
            system_text = ""
    else:
        system_text = str(system_prompt or "")
    model = _get_create_model(doc_type)
    agent_id = _get_create_agent_id(doc_type)
    use_agent = bool(agent_id)

    # Bound max tokens
    try:
        max_tokens = int(body.get("max_output_tokens") or 8192)
        max_tokens = max(512, min(max_tokens, 16384))
    except Exception:
        max_tokens = 8192
    effort = str(body.get("reasoning_effort") or "medium").lower()
    if effort not in {"low", "medium", "high"}:
        effort = "medium"

    prompt_preview = user_prompt[:200]
    if len(user_prompt) > 200:
        prompt_preview += "..."
    request_log = {
        "doc_type": doc_type,
        "language": language,
        "file_ids": file_ids,
        "prompt_length": len(user_prompt),
        "prompt_preview": prompt_preview,
        "max_tokens": max_tokens,
        "effort": effort,
    }
    try:
        _rec_logger.info("request %s", json.dumps(request_log, ensure_ascii=False))
    except Exception:
        _rec_logger.info(
            "request doc_type=%s prompt_len=%d files=%s",
            doc_type,
            len(user_prompt),
            file_ids,
        )

    input_parts = _build_responses_input(system_text, user_prompt, file_ids or None)

    schema = _build_schema()
    schema_name = _get_schema_name(doc_type)
    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name,
            "strict": True,
            "schema": schema,
        },
    }

    if use_agent:
        payload = {
            "agent_id": agent_id,
            "input": input_parts,
            "response_format": response_format,
            "max_output_tokens": max_tokens,
            "reasoning": {"effort": effort},
            "metadata": {"purpose": f"{doc_type or 'rec'}_create"},
        }
    else:
        payload = {
            "model": model,
            "input": input_parts,
            "response_format": response_format,
            "max_output_tokens": max_tokens,
            "reasoning": {"effort": effort},
            "metadata": {"purpose": f"{doc_type or 'rec'}_create"},
        }
        if prompt_ref:
            payload["prompt"] = prompt_ref
    if use_agent and prompt_ref:
        payload["prompt"] = prompt_ref

    try:
        _rec_logger.info(
            "openai_payload %s",
            json.dumps(payload, ensure_ascii=False),
        )
    except Exception:
        _rec_logger.info("openai_payload %s", str(payload))

    try:
        _rec_logger.info(
            "openai_request %s",
            json.dumps(_summarize_openai_payload(doc_type, payload), ensure_ascii=False),
        )
    except Exception:
        _rec_logger.info(
            "openai_request doc_type=%s model=%s input_count=%d",
            doc_type,
            model,
            len(payload.get("input") or []),
        )

    # Call Responses API with fallback when response_format unsupported
    try:
        r = await _post_responses(api_key, payload)
    except httpx.HTTPError as exc:
        try:
            _rec_logger.error(
                "response_http_error %s",
                json.dumps(
                    {
                        "doc_type": doc_type,
                        "payload_keys": list(payload.keys()),
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                    },
                    ensure_ascii=False,
                ),
            )
        except Exception:
            _rec_logger.error("response_http_error doc_type=%s %s", doc_type, exc)
        raise HTTPException(status_code=502, detail={"message": "Upstream request failed", "error": str(exc)}) from exc
    content_type = r.headers.get("content-type", "application/json")
    if r.status_code >= 400:
        # If unsupported response_format, fall back to text JSON
        try:
            msg = (r.json() or {}).get("error", {}).get("message", "")
        except Exception:
            msg = r.text or ""
        if "Unsupported parameter" in msg and "response_format" in msg:
            fallback = dict(payload)
            fallback.pop("response_format", None)
            extra_instruction = {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "Return ONLY a valid JSON object with keys: "
                            "material, outline, checks, result, reasoning_summary, steps. "
                            "checks must be an object with keys: perspective_consistency, language_quality, content_completeness, structure_logic; "
                            "each value may be a string or an array of strings. "
                            "result should be an object with fields english_letter and chinese_translation when possible."
                        ),
                    }
                ],
            }
            fallback["input"] = input_parts + [extra_instruction]
            fallback["text"] = {"format": {"type": "json_object"}}
            try:
                _rec_logger.info(
                    "openai_payload_fallback %s",
                    json.dumps(fallback, ensure_ascii=False),
                )
            except Exception:
                _rec_logger.info("openai_payload_fallback %s", str(fallback))
            try:
                _rec_logger.info(
                    "openai_request_fallback %s",
                    json.dumps(_summarize_openai_payload(doc_type, fallback), ensure_ascii=False),
                )
            except Exception:
                _rec_logger.info(
                    "openai_request_fallback doc_type=%s input_count=%d",
                    doc_type,
                    len(fallback.get("input") or []),
                )
            try:
                r = await _post_responses(api_key, fallback)
            except httpx.HTTPError as exc:
                try:
                    _rec_logger.error(
                        "response_http_error %s",
                        json.dumps(
                            {
                                "doc_type": doc_type,
                                "payload_keys": list(fallback.keys()),
                                "error": str(exc),
                                "error_type": type(exc).__name__,
                            },
                            ensure_ascii=False,
                        ),
                    )
                except Exception:
                    _rec_logger.error("response_http_error doc_type=%s %s", doc_type, exc)
                raise HTTPException(status_code=502, detail={"message": "Upstream request failed", "error": str(exc)}) from exc
            content_type = r.headers.get("content-type", "application/json")

    try:
        response_text = r.text
    except Exception:
        response_text = ""

    if "application/json" not in content_type:
        try:
            _rec_logger.error(
                "response_error %s",
                json.dumps(
                    {
                        "doc_type": doc_type,
                        "status_code": r.status_code,
                        "content_type": content_type,
                    },
                    ensure_ascii=False,
                ),
            )
        except Exception:
            _rec_logger.error(
                "response_error doc_type=%s status=%s content_type=%s",
                doc_type,
                r.status_code,
                content_type,
            )
        try:
            _rec_logger.info(
                "openai_response_raw %s",
                response_text or "",
            )
        except Exception:
            _rec_logger.info("openai_response_raw <unavailable>")
        return JSONResponse(status_code=200, content={"status": "error", "error": {"message": r.text}})

    data = r.json()

    try:
        _rec_logger.info(
            "openai_response_raw %s",
            json.dumps(data, ensure_ascii=False),
        )
    except Exception:
        try:
            _rec_logger.info("openai_response_raw %s", r.text)
        except Exception:
            _rec_logger.info("openai_response_raw <unavailable>")

    # Extract output_text for convenience
    output_text = data.get("output_text") or ""
    if not output_text:
        try:
            output = data.get("output") or []
            for item in output:
                if item.get("type") == "message":
                    for chunk in item.get("content", []) or []:
                        if isinstance(chunk, dict) and chunk.get("type") in ("output_text", "text"):
                            output_text = chunk.get("text") or ""
                            break
                    if output_text:
                        break
        except Exception:
            output_text = ""
    if not output_text and isinstance(data.get("reply"), str):
        output_text = data.get("reply")

    # Extract structured JSON (material/outline/checks/result/...)
    structured = None
    try:
        outs = data.get("output") or []
        for it in outs:
            for c in (it.get("content") or []):
                if isinstance(c, dict) and isinstance(c.get("json"), dict):
                    structured = c["json"]
                    raise StopIteration
    except StopIteration:
        pass
    except Exception:
        structured = None
    # Also try parse output_text as JSON
    if structured is None:
        # Try parsing "output_text" (either top-level or the one we derived above)
        try:
            txt = (data.get("output_text") or output_text or "").strip()
            if txt:
                import json as _json
                structured = _json.loads(txt)
        except Exception:
            structured = None

    others = {}
    if isinstance(structured, dict):
        try:
            # Prefer new fields if present; fall back to older names
            # Fields may be at top-level or nested under result
            res_obj = structured.get("result") if isinstance(structured.get("result"), dict) else {}
            inner_res = res_obj.get("result") if isinstance(res_obj.get("result"), dict) else {}
            checks = structured.get("checks") if isinstance(structured.get("checks"), dict) else {}
            others = {
                "perspective_consistency": inner_res.get("perspective_consistency") or res_obj.get("perspective_consistency") or structured.get("perspective_consistency") or (checks.get("perspective_consistency") if isinstance(checks, dict) else None),
                "language_quality": inner_res.get("language_quality") or res_obj.get("language_quality") or structured.get("language_quality") or (checks.get("language_quality") if isinstance(checks, dict) else None),
                "content_completeness": inner_res.get("content_completeness") or res_obj.get("content_completeness") or structured.get("content_completeness") or (checks.get("content_completeness") if isinstance(checks, dict) else None),
                "structure_logic": inner_res.get("structure_logic") or res_obj.get("structure_logic") or structured.get("structure_logic") or (checks.get("structure_logic") if isinstance(checks, dict) else None),
                # Back-compat
                "material": structured.get("material"),
                "outline": structured.get("outline"),
                "checks": structured.get("checks"),
                # Common extras
                "reasoning_summary": structured.get("reasoning_summary"),
                "steps": structured.get("steps") if isinstance(structured.get("steps"), list) else None,
            }
        except Exception:
            others = {}

    response_log = {
        "doc_type": doc_type,
        "status_code": r.status_code,
        "response_id": data.get("id"),
        "output_text_length": len(output_text or ""),
        "structured_keys": sorted(list(others.keys())) if isinstance(others, dict) else None,
    }
    usage = data.get("usage") if isinstance(data, dict) else None
    if isinstance(usage, dict):
        response_log["usage"] = {k: usage.get(k) for k in ("input_tokens", "output_tokens", "total_tokens") if k in usage}
    try:
        _rec_logger.info(
            "openai_response %s",
            json.dumps(response_log, ensure_ascii=False),
        )
    except Exception:
        _rec_logger.info(
            "openai_response doc_type=%s status=%s output_len=%d",
            doc_type,
            r.status_code,
            len(output_text or ""),
        )

    return JSONResponse(status_code=200, content={
        "status": "ok",
        "raw": data,
        "output_text": output_text or "",
        "others": others,
    })


async def _create_cv(body: dict) -> JSONResponse:
    api_key = get_openai_key()

    user_prompt = str(body.get("prompt") or "")
    language = str(body.get("language") or "").strip()
    if language:
        if user_prompt:
            user_prompt = f"{user_prompt}\n\nLanguage: {language}"
        else:
            user_prompt = f"Language: {language}"

    file_ids = [str(x) for x in (body.get("file_ids") or []) if isinstance(x, (str, bytes))]
    if not (user_prompt.strip() or file_ids):
        raise HTTPException(status_code=400, detail="prompt or file_ids is required")

    prompt_ref: dict[str, str] | None = None
    system_prompt = _get_create_prompt("cv")
    system_text: str | None = ""
    if isinstance(system_prompt, dict):
        prompt_id = system_prompt.get("prompt_id") or system_prompt.get("id")
        if prompt_id:
            prompt_ref = {"id": prompt_id}
            version = system_prompt.get("version")
            if isinstance(version, str) and version.strip():
                prompt_ref["version"] = version.strip()
            system_text = None
        else:
            system_text = ""
    else:
        system_text = str(system_prompt or "")

    model = _get_create_model("cv")
    agent_id = _get_create_agent_id("cv")
    use_agent = bool(agent_id)

    try:
        max_tokens = int(body.get("max_output_tokens") or 8192)
        max_tokens = max(512, min(max_tokens, 16384))
    except Exception:
        max_tokens = 8192
    effort = str(body.get("reasoning_effort") or "medium").lower()
    if effort not in {"low", "medium", "high"}:
        effort = "medium"

    prompt_preview = user_prompt[:200]
    if len(user_prompt) > 200:
        prompt_preview += "..."
    request_log = {
        "doc_type": "cv",
        "language": language,
        "file_ids": file_ids,
        "prompt_length": len(user_prompt),
        "prompt_preview": prompt_preview,
        "max_tokens": max_tokens,
        "effort": effort,
    }
    try:
        _rec_logger.info("request %s", json.dumps(request_log, ensure_ascii=False))
    except Exception:
        _rec_logger.info(
            "request doc_type=cv prompt_len=%d files=%s",
            len(user_prompt),
            file_ids,
        )

    input_parts = _build_responses_input(system_text, user_prompt, file_ids or None)

    if use_agent:
        payload = {
            "agent_id": agent_id,
            "input": input_parts,
            "max_output_tokens": max_tokens,
            "reasoning": {"effort": effort},
            "metadata": {"purpose": "cv_create"},
        }
    else:
        payload = {
            "model": model,
            "input": input_parts,
            "max_output_tokens": max_tokens,
            "reasoning": {"effort": effort},
            "metadata": {"purpose": "cv_create"},
        }
        if prompt_ref:
            payload["prompt"] = prompt_ref
    if use_agent and prompt_ref:
        payload["prompt"] = prompt_ref

    try:
        _rec_logger.info(
            "openai_payload %s",
            json.dumps(payload, ensure_ascii=False),
        )
    except Exception:
        _rec_logger.info("openai_payload %s", str(payload))

    try:
        _rec_logger.info(
            "openai_request %s",
            json.dumps(_summarize_openai_payload("cv", payload), ensure_ascii=False),
        )
    except Exception:
        _rec_logger.info(
            "openai_request doc_type=cv model=%s input_count=%d",
            model,
            len(payload.get("input") or []),
        )

    try:
        r = await _post_responses(api_key, payload)
    except httpx.HTTPError as exc:
        try:
            _rec_logger.error(
                "response_http_error %s",
                json.dumps(
                    {
                        "doc_type": "cv",
                        "payload_keys": list(payload.keys()),
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                    },
                    ensure_ascii=False,
                ),
            )
        except Exception:
            _rec_logger.error("response_http_error doc_type=cv %s", exc)
        raise HTTPException(status_code=502, detail={"message": "Upstream request failed", "error": str(exc)}) from exc

    content_type = r.headers.get("content-type", "application/json")
    if r.status_code >= 400:
        try:
            err = r.json()
        except Exception:
            err = {"error": r.text or ""}
        raise HTTPException(status_code=r.status_code, detail=err)

    try:
        response_text = r.text
    except Exception:
        response_text = ""

    data = r.json()

    try:
        _rec_logger.info(
            "openai_response_raw %s",
            json.dumps(data, ensure_ascii=False),
        )
    except Exception:
        try:
            _rec_logger.info("openai_response_raw %s", response_text)
        except Exception:
            _rec_logger.info("openai_response_raw <unavailable>")

    output_text = data.get("output_text") or ""
    if not output_text:
        try:
            output = data.get("output") or []
            for item in output:
                if item.get("type") == "message":
                    for chunk in item.get("content", []) or []:
                        if isinstance(chunk, dict) and chunk.get("type") in ("output_text", "text"):
                            output_text = chunk.get("text") or ""
                            break
                    if output_text:
                        break
        except Exception:
            output_text = ""
    if not output_text and isinstance(data.get("reply"), str):
        output_text = data.get("reply")

    resume_markdown = (output_text or "").replace("\r\n", "\n").strip()
    if not resume_markdown:
        try:
            resume_markdown = _extract_resume_markdown(data)
        except Exception:
            resume_markdown = ""
    if not resume_markdown:
        raise HTTPException(status_code=502, detail={"message": "No resume content returned"})

    resume_markdown = _ensure_cv_heading(resume_markdown)

    try:
        _rec_logger.info(
            "cv_result_summary %s",
            json.dumps({"length": len(resume_markdown)}, ensure_ascii=False),
        )
    except Exception:
        pass

    return JSONResponse(status_code=200, content={"result": resume_markdown})


@app.post("/api/rec/create")
async def rec_create(req: Request):
    body = await req.json()
    # Back-compat: keep this path but delegate to new generic handler
    return await _create_inner(body, "rec")


@app.post("/api/cv/create")
async def cv_create(req: Request):
    body = await req.json()
    return await _create_cv(body)


@app.post("/api/create")
async def create(req: Request):
    body = await req.json()
    # Accept doc type from body; support aliases
    doc_type = (body.get("doc_type") or body.get("docType") or body.get("type") or "rec").strip().lower()
    if doc_type not in {"cv", "ps", "rec"}:
        doc_type = "rec"
    if doc_type == "cv":
        return await _create_cv(body)
    return await _create_inner(body, doc_type)


@app.post("/api/translate")
async def translate_text(req: Request):
    """Translate input text to a target language (default: zh).

    Body: { text: string, target?: 'zh'|'en' }
    Returns: { ok: true, text: string }
    """
    body = await req.json()
    text = str(body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    target = (str(body.get("target") or "zh").strip() or "zh").lower()
    if target not in {"zh", "en"}:
        target = "zh"
    api_key = get_openai_key()
    system_prompt = (
        "You are a precise translator. Translate the user's text into "
        + ("Chinese (Simplified)" if target == "zh" else "English")
        + ". Preserve paragraph breaks and formatting."
    )
    payload = {
        "model": os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5"),
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": text}]},
        ],
        "max_output_tokens": 4096,
        "text": {"format": {"type": "plain_text"}},
    }
    r = await _post_responses(api_key, payload, timeout=60.0)
    if r.status_code >= 400:
        try:
            err = r.json()
        except Exception:
            err = {"error": r.text}
        raise HTTPException(status_code=r.status_code, detail=err)
    data = r.json()
    out = data.get("output_text") or ""
    if not out:
        try:
            for it in data.get("output") or []:
                if it.get("type") == "message":
                    for c in it.get("content") or []:
                        if isinstance(c, dict) and c.get("type") in ("text", "output_text"):
                            out = c.get("text") or ""
                            break
                    if out:
                        break
        except Exception:
            out = ""
    return JSONResponse(status_code=200, content={"ok": True, "text": out or ""})
