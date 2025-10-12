from typing import Any, Iterable, Optional

import os

import httpx
from fastapi import APIRouter, HTTPException
from .db import get_prompt

router = APIRouter(prefix="/api/toolbar", tags=["toolbar-ai"])

# Placeholder preset used by the toolbar until product finalises copywriting.
DEFAULT_PROMPT = (
    "Rewrite the selected content so it reads natural, personal, and human. "
    "Preserve all existing structure, markdown, and placeholders. "
    "Keep the information accurate while softening any AI-like tone."
)

SYSTEM_PROMPT = (
    "You are an expert writing assistant focussed on subtle human rewrites. "
    "Avoid AI buzzwords, vary sentence lengths, and keep the author voice authentic."
)


def _collect_text(node: Any) -> str:
    if isinstance(node, str):
        return node
    if isinstance(node, dict):
        if "text" in node:
            return _collect_text(node["text"])
        if "content" in node:
            return _collect_text(node["content"])
        if "value" in node:
            return _collect_text(node["value"])
        return ""
    if isinstance(node, Iterable):
        parts = []
        for item in node:
            part = _collect_text(item)
            if part:
                parts.append(part)
        return "".join(parts)
    return ""


def _extract_output_text(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ""
    text = payload.get("output_text")
    if isinstance(text, str) and text.strip():
        return text.strip()

    collected = []
    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            part = _collect_text(item)
            if part:
                collected.append(part)

    if collected:
        joined = "\n".join(part.strip() for part in collected if part.strip())
        if joined:
            return joined

    reply = payload.get("reply")
    if isinstance(reply, str) and reply.strip():
        return reply.strip()

    return ""


async def _call_openai(prompt: str, selection: str, *, max_tokens: int, effort: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")

    # Single interaction: call Responses API directly with o3.
    user_prompt = f"{prompt}\n\n<selection>\n{selection}\n</selection>"

    model = os.getenv("TOOLBAR_O3_MODEL", "o3").strip() or "o3"

    sys_prompt = get_prompt("toolbar_system_prompt") or SYSTEM_PROMPT
    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": sys_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
        "max_output_tokens": max_tokens,
        "reasoning": {"effort": effort},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/responses",
            headers=headers,
            json=payload,
        )

    if resp.status_code >= 400:
        try:
            err = resp.json()
        except Exception:
            err = {"error": resp.text}
        raise HTTPException(status_code=resp.status_code, detail=err)

    data = resp.json()
    output_text = _extract_output_text(data)

    return {"provider": "responses", "text": output_text or "", "raw": data}


@router.get("/presets")
async def get_default_prompt():
    return {
        "presets": [
            {"name": "Humanise tone", "prompt": (get_prompt("toolbar_default_prompt") or DEFAULT_PROMPT)},
        ]
    }


@router.post("/rewrite")
async def rewrite(body: dict):
    selection = str(body.get("selection") or "").strip()
    if not selection:
        raise HTTPException(status_code=400, detail="selection is required")

    prompt = str(body.get("prompt") or "").strip() or (get_prompt("toolbar_default_prompt") or DEFAULT_PROMPT)
    max_tokens = body.get("max_tokens") or 1024
    try:
        max_tokens = max(128, min(int(max_tokens), 4096))
    except Exception:
        max_tokens = 1024
    effort = str(body.get("reasoning_effort") or "medium").lower()
    if effort not in {"low", "medium", "high"}:
        effort = "medium"

    result = await _call_openai(prompt, selection, max_tokens=max_tokens, effort=effort)
    if not result.get("text"):
        raise HTTPException(status_code=502, detail="Empty response from OpenAI")
    return {
        "status": "ok",
        "text": result["text"],
        "raw": result.get("raw"),
        "provider": result.get("provider"),
        "prompt": prompt,
    }
