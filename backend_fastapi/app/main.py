from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import os
import httpx

app = FastAPI(title="cv-ai FastAPI backend")


@app.get("/api/ping")
async def ping():
    return {"ok": True}


def get_openai_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")
    return key


def normalize_openai_payload(body: dict) -> tuple[str, dict, bool]:
    endpoint_hint = body.get("endpoint") if isinstance(body.get("endpoint"), str) else None
    payload = body.get("body") or body

    fallback_model = os.getenv("FALLBACK_MODEL", "o3")
    model = str(payload.get("model") or fallback_model)

    use_responses_api = (endpoint_hint == "responses") or (model.lower().startswith("o3"))

    # Normalize reasoning effort aliases
    try:
        allowed = {"low", "medium", "high"}
        alias = {"minimal": "low", "default": "medium", "deep": "high"}
        if isinstance(payload.get("reasoning"), dict):
            eff = str(payload["reasoning"].get("effort", "")).lower()
            if eff and eff not in allowed:
                payload["reasoning"]["effort"] = alias.get(eff, "medium")
        elif isinstance(payload.get("reasoning_effort"), str):
            eff = str(payload["reasoning_effort"]).lower()
            payload["reasoning"] = {"effort": alias.get(eff, eff if eff in allowed else "medium")}
            payload.pop("reasoning_effort", None)
    except Exception:
        pass

    if use_responses_api:
        # responses API prefers input/max_output_tokens
        if not payload.get("input") and isinstance(payload.get("messages"), list):
            payload["input"] = "\n\n".join(
                f"{str(m.get('role','user')).upper()}: {m.get('content','')}" for m in payload["messages"]
            )
            payload.pop("messages", None)
        if payload.get("max_tokens") and not payload.get("max_output_tokens"):
            payload["max_output_tokens"] = payload.pop("max_tokens")
    else:
        # chat completions prefers messages; map input if present
        is_gpt5 = model.lower().startswith("gpt-5")
        is_gpt41 = "gpt-4.1" in model.lower()
        if (is_gpt5 or is_gpt41) and payload.get("max_tokens") and not payload.get("max_completion_tokens"):
            payload["max_completion_tokens"] = payload.pop("max_tokens")
        if not payload.get("messages") and isinstance(payload.get("input"), str):
            payload["messages"] = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": payload.pop("input")},
            ]

    payload["model"] = model
    url = "https://api.openai.com/v1/responses" if use_responses_api else "https://api.openai.com/v1/chat/completions"
    return url, payload, use_responses_api


@app.post("/api/ai")
async def proxy_ai(req: Request):
    body = await req.json()
    url, payload, _ = normalize_openai_payload(body)
    api_key = get_openai_key()
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }, json=payload)
    content_type = r.headers.get("content-type", "application/json")
    if "application/json" in content_type:
        return JSONResponse(status_code=r.status_code, content=r.json())
    return JSONResponse(status_code=r.status_code, content={"text": r.text})


def get_siliconflow_conf():
    key = os.getenv("SILICON_FLOW_API_KEY", "").strip()
    base = os.getenv("SILICON_FLOW_BASE_URL", "https://api.siliconflow.cn/v1").strip()
    model = os.getenv("SILICON_FLOW_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip()
    if not key:
        raise HTTPException(status_code=500, detail="SILICON_FLOW_API_KEY is missing")
    return key, base, model


@app.post("/api/siliconflow")
async def siliconflow(req: Request):
    body = await req.json()
    key, base, default_model = get_siliconflow_conf()
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
    composed = (
        f"指令: {user_prompt}\n\n原文:\n{selected}\n\n只返回修改后的文本。" if selected else f"{user_prompt}\n\n只返回修改后的文本。"
    )

    url, payload, _ = normalize_openai_payload({
        "body": {
            "model": os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-4o-mini"),
            "messages": [{"role": "user", "content": composed}],
            "max_tokens": 2048,
            "temperature": 0.7,
        }
    })
    api_key = get_openai_key()
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }, json=payload)
    if "application/json" in (r.headers.get("content-type", "")):
        data = r.json()
        content = (
            (data.get("choices") or [{}])[0].get("message", {}).get("content")
            or data.get("reply")
            or (data if isinstance(data, str) else "")
        )
    else:
        content = r.text

    content = (content or "").strip()
    if not content:
        raise HTTPException(status_code=500, detail="AI 无有效输出")
    return {"success": True, "content": content, "method": "ai-proxy"}


