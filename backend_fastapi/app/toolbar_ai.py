from typing import Optional

import os

import httpx
from fastapi import APIRouter, HTTPException

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


async def _call_openai(prompt: str, selection: str, *, max_tokens: int, effort: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")

    # Single interaction: call Responses API directly with o3.
    user_prompt = f"{prompt}\n\n<selection>\n{selection}\n</selection>"

    model = os.getenv("TOOLBAR_O3_MODEL", "o3").strip() or "o3"

    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
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
    output_text = data.get("output_text")
    if not output_text:
        output = data.get("output") or []
        for item in output:
            if item.get("type") == "message":
                for chunk in item.get("content", []) or []:
                    if isinstance(chunk, dict) and chunk.get("type") in ("output_text", "text"):
                        output_text = chunk.get("text")
                        break
                if output_text:
                    break
        if not output_text and isinstance(data.get("reply"), str):
            output_text = data["reply"]

    return {"provider": "responses", "text": output_text or "", "raw": data}


@router.get("/presets")
async def get_default_prompt():
    return {
        "presets": [
            {"name": "Humanise tone", "prompt": DEFAULT_PROMPT},
        ]
    }


@router.post("/rewrite")
async def rewrite(body: dict):
    selection = str(body.get("selection") or "").strip()
    if not selection:
        raise HTTPException(status_code=400, detail="selection is required")

    prompt = str(body.get("prompt") or "").strip() or DEFAULT_PROMPT
    max_tokens = body.get("max_tokens") or 512
    try:
        max_tokens = max(64, min(int(max_tokens), 2048))
    except Exception:
        max_tokens = 512
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

