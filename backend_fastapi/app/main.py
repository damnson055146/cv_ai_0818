from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import httpx

# Load envs from backend_fastapi/.env if present
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
except Exception:
    pass

app = FastAPI(title="cv-ai FastAPI backend")

# CORS for frontend dev (Nuxt at :3000)
_cors_origins_env = os.getenv("FASTAPI_CORS_ALLOW_ORIGINS", "").strip()
if _cors_origins_env:
    _origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
else:
    _origins = [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Responses API helpers ===
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def get_openai_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")
    return key


def _normalize_content_item(item):
    if item is None:
        return None
    if isinstance(item, dict):
        normalized: dict = {}
        raw_type = item.get("type")
        if isinstance(raw_type, str):
            type_clean = raw_type.strip()
            if type_clean:
                normalized["type"] = "input_text" if type_clean.lower() == "text" else type_clean
        for key, value in item.items():
            if key == "type" or value is None:
                continue
            if key == "text":
                normalized[key] = str(value)
            else:
                normalized[key] = value
        if "type" not in normalized:
            if "text" in normalized or "text" in item:
                normalized = {
                    "type": "input_text",
                    "text": str(normalized.get("text", item.get("text", ""))),
                }
            else:
                text_val = str(item)
                return {"type": "input_text", "text": text_val} if text_val else None
        if normalized.get("type") == "input_text":
            normalized["text"] = str(normalized.get("text", ""))
        return normalized
    if isinstance(item, str):
        return {"type": "input_text", "text": item}
    text_val = str(item)
    return {"type": "input_text", "text": text_val} if text_val else None


def _normalize_content(raw):
    normalized_list: list[dict] = []
    if isinstance(raw, list):
        raw_items = raw
    elif raw is None:
        raw_items = []
    else:
        raw_items = [raw]
    for item in raw_items:
        normalized_item = _normalize_content_item(item)
        if normalized_item:
            normalized_list.append(normalized_item)
    return normalized_list


def build_responses_input(
    messages: list[dict] | None = None,
    system_text: str | None = None,
    user_text: str | None = None,
    file_ids: list[str] | None = None,
):

    input_msgs: list[dict] = []
    if isinstance(messages, list) and messages:
        for m in messages:
            if not isinstance(m, dict):
                continue
            role = str(m.get("role") or "user")
            content = _normalize_content(m.get("content"))
            if not content:
                txt = m.get("text")
                if isinstance(txt, str):
                    content = [{"type": "input_text", "text": txt}]
            input_msgs.append({"role": role, "content": content})
    if not input_msgs:
        input_msgs = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": system_text or "You are a helpful assistant.",
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": user_text or "",
                    }
                ],
            },
        ]

    if file_ids:
        _ensure_file_ids_on_user_message(input_msgs, file_ids)
    return input_msgs


async def post_responses(api_key: str, payload: dict, timeout: float = 120.0):
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(
            OPENAI_RESPONSES_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    return r


def _ensure_file_ids_on_user_message(input_msgs, file_ids):
    if not isinstance(input_msgs, list) or not file_ids:
        return input_msgs

    user_msg = None
    for m in reversed(input_msgs):
        if isinstance(m, dict) and str(m.get("role") or "").lower() == "user":
            user_msg = m
            break
    if user_msg is None:
        user_msg = {"role": "user", "content": []}
        input_msgs.append(user_msg)

    content_list = user_msg.get("content")
    if not isinstance(content_list, list):
        content_list = _normalize_content(content_list)
        user_msg["content"] = content_list
    if content_list is None:
        content_list = []
        user_msg["content"] = content_list

    existing_ids: set[str] = set()
    for item in list(content_list):
        if not isinstance(item, dict):
            continue
        if str(item.get("type") or "").lower() != "input_file":
            continue
        fid = item.get("file_id")
        if isinstance(fid, str) and fid:
            existing_ids.add(fid)

    for raw_fid in file_ids:
        if raw_fid is None:
            continue
        fid = raw_fid.decode() if isinstance(raw_fid, bytes) else str(raw_fid)
        fid = fid.strip()
        if not fid or fid in existing_ids:
            continue
        content_list.append({"type": "input_file", "file_id": fid})
        existing_ids.add(fid)

    return input_msgs


def build_responses_payload(body: dict) -> dict:
    model = str(body.get("model") or os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5"))

    file_ids: list[str] = []
    if isinstance(body.get("file_ids"), list):
        file_ids = [str(x) for x in body["file_ids"] if isinstance(x, (str, bytes))]

    messages = body.get("messages") if isinstance(body.get("messages"), list) else None
    system_text = body.get("instructions")
    user_text = None
    if isinstance(body.get("input"), str):
        user_text = body.get("input")
    elif isinstance(body.get("prompt"), str):
        user_text = body.get("prompt")

    input_payload = body.get("input") if isinstance(body.get("input"), list) else None
    if not input_payload:
        input_payload = build_responses_input(messages, system_text, user_text, file_ids)
    else:
        _ensure_file_ids_on_user_message(input_payload, file_ids)

    response_format = body.get("response_format")
    max_out = body.get("max_output_tokens")
    if max_out is None:
        max_out = body.get("max_tokens", body.get("max_completion_tokens"))

    reasoning = body.get("reasoning")
    if reasoning is None and isinstance(body.get("reasoning_effort"), str):
        eff = body["reasoning_effort"].lower()
        alias = {"minimal": "low", "default": "medium", "deep": "high"}
        reasoning = {"effort": alias.get(eff, eff if eff in {"low", "medium", "high"} else "medium")}

    out = {"model": model, "input": input_payload}
    if isinstance(body.get("attachments"), list):
        out["attachments"] = body["attachments"]
    if response_format and isinstance(response_format, dict):
        fmt_type = response_format.get("type")
        if fmt_type:
            text_fmt = {"format": fmt_type}
            if fmt_type == "json_schema" and isinstance(response_format.get("json_schema"), dict):
                text_fmt["json_schema"] = response_format["json_schema"]
            out["text"] = text_fmt
    if max_out is not None:
        try:
            cap = int(os.getenv("RESPONSES_MAX_OUTPUT_TOKENS", "4096"))
        except Exception:
            cap = 4096
        try:
            req = int(max_out)
        except Exception:
            req = 2048
        out["max_output_tokens"] = max(16, min(req, cap))
    if reasoning:
        out["reasoning"] = reasoning
    if isinstance(body.get("metadata"), dict):
        out["metadata"] = body["metadata"]
    if isinstance(body.get("previous_response_id"), str) and body["previous_response_id"]:
        out["previous_response_id"] = body["previous_response_id"]
    return out


@app.post("/api/ai")
async def proxy_ai(req: Request):
    body = await req.json()
    body.pop("use_agents", None)
    api_key = get_openai_key()

    has_input_list = isinstance(body.get("input"), list)
    has_messages = isinstance(body.get("messages"), list)
    has_prompt_like = isinstance(body.get("input"), str) or isinstance(body.get("prompt"), str)
    if not (has_input_list or has_messages or has_prompt_like):
        raise HTTPException(status_code=400, detail="input(list) or messages or prompt/input(string) is required")

    payload = build_responses_payload(body)
    # Default schema if frontend didn't provide one
    if "text" not in payload:
        payload["text"] = {
            "format": "json_schema",
            "json_schema": {
                "name": "DefaultOutput",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["result"],
                    "properties": {
                        "result": {"type": "string"},
                        "reasoning_summary": {"type": "string"}
                    }
                }
            }
        }

    r = await post_responses(api_key, payload, timeout=120.0)
    content_type = r.headers.get("content-type", "application/json")
    if "application/json" in content_type:
        return JSONResponse(status_code=r.status_code, content=r.json())
    return JSONResponse(status_code=r.status_code, content={"text": r.text})


@app.post("/api/siliconflow")
async def siliconflow(req: Request):
    body = await req.json()
    key = os.getenv("SILICON_FLOW_API_KEY", "").strip()
    base = os.getenv("SILICON_FLOW_BASE_URL", "https://api.siliconflow.cn/v1").strip()
    default_model = os.getenv("SILICON_FLOW_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip()
    if not key:
        raise HTTPException(status_code=500, detail="SILICON_FLOW_API_KEY is missing")
    payload = {
        "model": body.get("model") or default_model,
        "messages": body.get("messages") or [{"role": "user", "content": body.get("input") or body.get("prompt") or ""}],
        "temperature": body.get("temperature") or 0.1,
        "max_tokens": body.get("max_tokens") or 1024,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{base}/chat/completions", headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }, json=payload)
    if r.status_code >= 400:
        return JSONResponse(status_code=r.status_code, content={
            "error": f"SiliconFlow API error: {r.status_code}",
            "details": r.text,
            "statusCode": r.status_code,
            "isApiError": True,
        })
    return JSONResponse(status_code=r.status_code, content=r.json())


@app.post("/api/intent-parse")
async def intent_parse(req: Request):
    body = await req.json()
    template = body.get("template")
    intent_type = "modify"
    if template == "translate":
        intent_type = "translate"
    elif template == "format":
        intent_type = "format"
    return {
        "status": "ok",
        "intent": {
            "intentType": intent_type,
            "targetType": "paragraph",
            "sectionTag": (body.get("context") or {}).get("sectionTag"),
            "operations": [],
            "confidence": 0.9,
        },
    }


@app.post("/api/content-generate")
async def content_generate(req: Request):
    body = await req.json()
    user_prompt = str(body.get("prompt") or "")
    context = body.get("context") or {}
    selected = str(context.get("selectedText") or "")
    model = str(body.get("model") or os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5"))
    max_tokens = int(body.get("maxTokensPerChunk") or 1536)

    if not user_prompt and not selected:
        raise HTTPException(status_code=400, detail="prompt or selectedText is required")

    composed = (
        f"指令: {user_prompt}\n\n原文:\n{selected}\n\n只返回修改后的文本。"
        if selected else f"{user_prompt}\n\n只返回修改后的文本。"
    )

    api_key = get_openai_key()
    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "text", "text": "You are a professional editor. Return ONLY the final text."}]},
            {"role": "user", "content": [{"type": "text", "text": composed}]}
        ],
        "max_output_tokens": max_tokens
    }

    r = await post_responses(api_key, payload, timeout=60.0)
    if "application/json" in (r.headers.get("content-type", "")):
        data = r.json()
        output_text = data.get("output_text")
        if not output_text:
            try:
                chunks = data.get("output", [])
                output_text = "".join(
                    c_part.get("text", "")
                    for item in chunks
                    for c_part in (item.get("content") or [])
                    if isinstance(c_part, dict)
                )
            except Exception:
                output_text = ""
    else:
        output_text = r.text

    output_text = (output_text or "").strip()
    if not output_text:
        raise HTTPException(status_code=500, detail="AI 无有效输出")
    return {"success": True, "content": output_text, "method": "responses"}

# Upload file to OpenAI Files API (base64 body)
@app.post("/api/files/upload")
async def files_upload(req: Request):
    body = await req.json()
    name = str(body.get("name") or "upload.bin")
    b64 = str(body.get("contentBase64") or "")
    purpose_raw = body.get("purpose")
    purpose = str(purpose_raw or "").strip().lower() or "assistants"
    # Responses/Assistants APIs require files uploaded with specific purposes.
    # Accept a small allowlist and coerce legacy aliases (e.g. "user_data")
    allowed_purposes = {"assistants", "responses", "vision"}
    legacy_aliases = {"user_data": "assistants"}
    if purpose in legacy_aliases:
        purpose = legacy_aliases[purpose]
    elif purpose not in allowed_purposes:
        purpose = "assistants"
    if not b64:
        raise HTTPException(status_code=400, detail="contentBase64 is required")

    api_key = get_openai_key()
    try:
        file_bytes = httpx._models.b64decode(b64)  # type: ignore
    except Exception:
        try:
            import base64
            file_bytes = base64.b64decode(b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 content")

    files = {
        "file": (name, file_bytes, "application/octet-stream"),
        "purpose": (None, purpose),
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/files",
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
        )
    if "application/json" in (r.headers.get("content-type", "")):
        data = r.json()
    else:
        data = {"text": r.text}
    if r.status_code >= 400:
        return JSONResponse(status_code=r.status_code, content={"status": "error", "error": data})
    return {"status": "ok", "file": data}


# Convert to Markdown using AI (FastAPI version)
@app.post("/api/convert-to-md")
async def convert_to_md(req: Request):
    body = await req.json()
    raw = str(body.get("text") or "")
    if not raw.strip():
        return {"ok": False, "error": "empty_text"}

    hint = str(body.get("hint") or "auto")
    model = str(body.get("model") or os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-4o-mini"))
    max_tokens = int(body.get("maxTokensPerChunk") or 1536)

    # simple paragraph chunking
    paras = raw.split("\n\n")
    chunks = []
    MAX_CHARS = 2000
    buf = ""
    for p in paras:
        add = ("\n\n" + p) if buf else p
        if len(buf + add) > MAX_CHARS:
            if buf:
                chunks.append(buf)
            buf = p
        else:
            buf = buf + add
    if buf:
        chunks.append(buf)

    system_prompt = (
        "You are a professional document formatter. "
        "Convert the given input to clean, valid Markdown ONLY. "
        "Preserve: headings (#), lists, tables, links, emphasis, code blocks. "
        "Keep original language and factual content. Do NOT invent content. "
        "Do not add explanations or code fences. Return Markdown only."
    )
    api_key = get_openai_key()

    outputs = []
    payload = {"body": {"model": model}}
    for i, piece in enumerate(chunks):
        user_prompt = f"Document type hint: {hint}.\nReturn ONLY Markdown for this chunk {i + 1}/{len(chunks)}.\n\n<INPUT>\n{piece}\n</INPUT>"
        payload["body"]["messages"] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        payload["body"]["max_output_tokens"] = max_tokens

        r = await post_responses(api_key, payload, timeout=60.0)
        if "application/json" in (r.headers.get("content-type", "")):
            data = r.json()
            md = (
                (data.get("choices") or [{}])[0].get("message", {}).get("content")
                or data.get("reply")
                or ""
            )
        else:
            md = r.text
        outputs.append((md or piece).strip())

    markdown = "\n\n".join(outputs)
    return {"ok": True, "markdown": markdown, "model": model}

