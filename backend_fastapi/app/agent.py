from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from .db import ensure_prompts_table, get_prompt, set_prompt, list_prompts, consume_chat_memory
import json


router = APIRouter(tags=["agent"])
ensure_prompts_table()


PROMPT_KEY_AGENT_ACT = "agent_act_system_prompt"
PROMPT_KEY_AGENT_APPEND = "agent_act_global_append"


def _admin_ok(request: Request) -> bool:
    token_env = os.getenv("PROMPTS_ADMIN_TOKEN", "").strip()
    if not token_env:
        # If not set, allow access (dev default)
        return True
    return request.headers.get("x-admin-token", "").strip() == token_env


async def _fetch_editor_state(client_id: str) -> dict[str, Any]:
    """Fetch current editor selection/document state from the Nuxt server.

    GET {NUXT_BASE_URL}/api/editor-state?clientId=... with optional x-mcp-token.
    """
    base = os.getenv("NUXT_BASE_URL", "http://127.0.0.1:3000").strip() or "http://127.0.0.1:3000"
    url = f"{base.rstrip('/')}/api/editor-state"
    headers: dict[str, str] = {}
    token = os.getenv("MCP_QUEUE_TOKEN", "").strip()
    if token:
        headers["x-mcp-token"] = token

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params={"clientId": client_id}, headers=headers)

    ct = r.headers.get("content-type", "application/json")
    data: dict[str, Any]
    try:
        data = r.json() if "application/json" in ct else {"raw": r.text}
    except Exception:
        data = {"raw": r.text}

    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=data)
    return data


def _get_openai_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing")
    return key


async def _post_responses(api_key: str, payload: dict, timeout: float = 120.0):
    # Allow override of base URL/timeouts for Responses API
    try:
        env_timeout = float(os.getenv("OPENAI_RESPONSES_TIMEOUT", "0").strip() or 0)
        if env_timeout > 0:
            timeout = env_timeout
    except Exception:
        pass
    base_url = os.getenv("OPENAI_RESPONSES_URL", "https://api.openai.com/v1/responses").strip() or "https://api.openai.com/v1/responses"
    t = httpx.Timeout(connect=30.0, read=timeout, write=max(60.0, min(timeout, 300.0)), pool=timeout)
    async with httpx.AsyncClient(timeout=t) as client:
        return await client.post(
            base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )


@router.post("/api/agent/act")
async def agent_act(body: dict, request: Request):
    """Plan and decide concrete edits for the current document.

    Body params:
      - clientId: string (required)
      - docId: string (required by product flow; can be empty)
      - instruction: string (required)
      - file_ids?: string[] (optional OpenAI file IDs to attach)
      - inline_text_snippets?: string[] (optional extra text context)
      - session_id?: string (optional for grouping/telemetry)
    """
    client_id = str(body.get("clientId") or "").strip()
    doc_id = str(body.get("docId") or "").strip()
    instruction = str(body.get("instruction") or "").strip()
    file_ids = [str(x) for x in (body.get("file_ids") or []) if isinstance(x, (str, bytes))]
    inline_snippets = [str(x) for x in (body.get("inline_text_snippets") or []) if isinstance(x, str)]
    session_id = str(body.get("session_id") or "").strip() or None
    previous_response_id = str(body.get("previous_response_id") or "").strip() or None

    if not client_id:
        return JSONResponse(status_code=200, content={"ok": False, "error": {"message": "clientId is required"}})
    if not instruction:
        return JSONResponse(status_code=200, content={"ok": False, "error": {"message": "instruction is required"}})

    # Prefer selection provided directly in request body; fallback to Nuxt editor-state
    sel_in = body.get("selection") if isinstance(body, dict) else None
    editor_state = None
    doc_text = ""
    has_selection = False
    selected_text = ""
    if isinstance(sel_in, dict) and bool(sel_in.get("hasSelection")):
        st = str(sel_in.get("text") or "").strip()
        if st:
            has_selection = True
            selected_text = st
    if not has_selection:
        # Read editor state for client (fallback)
        try:
            editor_state = await _fetch_editor_state(client_id)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, (dict, list)) else {"message": str(exc.detail)}
            return JSONResponse(status_code=200, content={"ok": False, "error": detail})
        except httpx.HTTPError as exc:
            return JSONResponse(status_code=200, content={"ok": False, "error": {"message": str(exc)}})
        selection = (editor_state or {}).get("selection") or {}
        doc_text = str((editor_state or {}).get("doc") or "")
        has_selection = bool(selection.get("hasSelection"))
        selected_text = str(selection.get("text") or "")

    # Merge any persisted chat memory for first-message bootstrapping
    memory_candidates: list[str] = []
    explicit_chat = str(body.get("chat_id") or body.get("chatId") or "").strip()
    if explicit_chat:
        memory_candidates.append(explicit_chat)
    if doc_id:
        memory_candidates.append(doc_id)
    appended_memory = False
    for candidate in memory_candidates:
        if not candidate:
            continue
        try:
            memory_payload = consume_chat_memory(candidate)
        except Exception:
            memory_payload = []
        if not memory_payload:
            continue
        for item in memory_payload:
            if isinstance(item, dict):
                text = str(item.get("content") or "").strip()
            else:
                text = str(item or "").strip()
            if text:
                inline_snippets.append(text)
                appended_memory = True
        if appended_memory:
            break

    # ---- Decide doc type (cv|ps|rec) ----
    def _detect_doc_type(instr: str, text: str, sel: str) -> str:
        s = f"{instr}\n{text}\n{sel}".lower()
        # recommendation letter signals
        rec_kw = [
            "recommendation letter", "letter of recommendation", "推荐信", "推荐 人", "referee",
        ]
        if any(k in s for k in rec_kw):
            return "rec"
        # personal statement / statement of purpose
        ps_kw = [
            "personal statement", "statement of purpose", "sop", "ps文书", "个人陈述", "文书",
        ]
        if any(k in s for k in ps_kw):
            return "ps"
        # cv / resume
        cv_kw = [
            "curriculum vitae", "resume", "résumé", "cv", "简历",
        ]
        if any(k in s for k in cv_kw):
            return "cv"
        return "cv"

    # Build model input
    default_system_prompt = (
        "You are an edit-planning agent for a Markdown/code editor. "
        "Work step-by-step with short, audit-friendly reasoning (no chain-of-thought). "
        "Operate conservatively: preserve structure, formatting, placeholders, and author voice. "
        "Interpret the user's instruction and decide WHAT to reference and WHERE to modify: "
        "(1) If a selection is provided, use it as the primary focus; (2) Otherwise, locate the most relevant sections (e.g., heading, first paragraph, experience bullets, matching keywords); (3) When needed, reference the broader document for consistency. "
        "Always provide a non-empty revised candidate for 'result' (even a minimal, safe polishing). "
        "Return a JSON object with: steps (string[]), targets (object[]), result (string), reasoning_summary (string), and optionally step_details (array). "
        "Each step_details item may include: title, analysis, decision, evidence (array of brief strings referencing the selection/document snippets). "
        "Do not include any text outside of the JSON object."
    )
    # Compose final system prompt from DB-backed segments (typed + global + session)
    def _read_text_file(path: str | None) -> str:
        if not path:
            return ""
        try:
            p = str(path).strip()
            if not p:
                return ""
            with open(p, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return ""

    # Repo root helper
    def _repo_root() -> str:
        here = os.path.dirname(__file__)
        return os.path.abspath(os.path.join(here, "..", ".."))

    def _typed_file(dt: str) -> str:
        fn = {"cv": "cv_sys.md", "ps": "ps_sys.md", "rec": "rec_sys.md"}.get(dt, "cv_sys.md")
        path = os.path.join(_repo_root(), fn)
        return _read_text_file(path)

    doc_type = (str(body.get("doc_type") or "").strip().lower()) or _detect_doc_type(instruction, doc_text, selected_text)

    # 1) Typed base: DB → env file → repo default for this type → fall back main default
    typed_key = f"{PROMPT_KEY_AGENT_ACT}:{doc_type}"
    env_file_map = {
        "cv": os.getenv("AGENT_ACT_PROMPT_FILE_CV", ""),
        "ps": os.getenv("AGENT_ACT_PROMPT_FILE_PS", ""),
        "rec": os.getenv("AGENT_ACT_PROMPT_FILE_REC", ""),
    }
    global_prompt = (
        get_prompt(typed_key)
        or get_prompt(PROMPT_KEY_AGENT_ACT)
        or _read_text_file(env_file_map.get(doc_type))
        or _read_text_file(os.getenv("AGENT_ACT_PROMPT_FILE", ""))
        or _typed_file(doc_type)
        or default_system_prompt
    )

    # 2) Append: typed DB/ENV/file → global DB/ENV/file → empty
    typed_append_key = f"{PROMPT_KEY_AGENT_APPEND}:{doc_type}"
    env_append_map = {
        "cv": os.getenv("AGENT_ACT_APPEND_FILE_CV", ""),
        "ps": os.getenv("AGENT_ACT_APPEND_FILE_PS", ""),
        "rec": os.getenv("AGENT_ACT_APPEND_FILE_REC", ""),
    }
    append_prompt = (
        get_prompt(typed_append_key)
        or _read_text_file(env_append_map.get(doc_type))
        or get_prompt(PROMPT_KEY_AGENT_APPEND)
        or _read_text_file(os.getenv("AGENT_ACT_APPEND_FILE", ""))
        or ""
    )
    session_prompt = ""
    if session_id:
        try:
            session_key = f"agent_act_session_prompt:{session_id}"
            sp = get_prompt(session_key)
            if isinstance(sp, str) and sp.strip():
                session_prompt = sp
        except Exception:
            session_prompt = ""
    # Build concatenation order: configurable per-type via DB key
    # Keys: agent_act_concat_order:<doc_type> or agent_act_concat_order (JSON array of: "system"|"append"|"session")
    order_raw = (
        get_prompt(f"agent_act_concat_order:{doc_type}")
        or get_prompt("agent_act_concat_order")
        or ""
    )
    order: list[str] = []
    if isinstance(order_raw, str) and order_raw.strip():
        try:
            obj = json.loads(order_raw)
            if isinstance(obj, list):
                order = [str(x) for x in obj if str(x) in {"system", "append", "session"}]
        except Exception:
            order = []
    if not order:
        order = ["system", "append", "session"]

    parts_map = {
        "system": global_prompt,
        "append": append_prompt,
        "session": session_prompt,
    }
    parts = [parts_map[k] for k in order if parts_map.get(k)]
    system_prompt = "\n\n".join([p for p in parts if isinstance(p, str) and p.strip()])

    # Provide editor context. Prefer selection if available; include limited doc preview for safety.
    ctx_lines = [
        f"clientId: {client_id}",
        f"docId: {doc_id}",
        f"hasSelection: {has_selection}",
        "instruction:",
        instruction,
    ]
    if inline_snippets:
        ctx_lines.append("inline_text_snippets:")
        for s in inline_snippets[:8]:
            ctx_lines.append(f"- {s}")
    if has_selection and selected_text:
        ctx_lines.append("<selection>")
        ctx_lines.append(selected_text)
        ctx_lines.append("</selection>")
    else:
        # Limit document excerpt to avoid over-long requests
        doc_excerpt = doc_text if len(doc_text) <= 12000 else (doc_text[:6000] + "\n...\n" + doc_text[-4000:])
        ctx_lines.append("<document>")
        ctx_lines.append(doc_excerpt)
        ctx_lines.append("</document>")

    # Encourage explicit targets for downstream application (UI expects 'strategy')
    ctx_lines.append(
        "When building targets array, use objects of these forms: "
        "{ strategy: 'selection' } (apply to current selection), "
        "{ strategy: 'match', text: '<exact-substring-to-replace>' } (find-and-replace first occurrence), or "
        "{ strategy: 'document' } (apply to whole document)."
    )

    user_text = "\n".join(ctx_lines)

    # Build Responses API payload
    input_parts = [
        {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
        {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
    ]
    if file_ids:
        # Attach files to the user message as input_file parts
        for fid in file_ids:
            input_parts[1]["content"].append({"type": "input_file", "file_id": fid})

    # Bound output tokens
    try:
        cap_env = int(os.getenv("AGENT_MAX_OUTPUT_TOKENS", "2048"))
    except Exception:
        cap_env = 2048
    max_tokens = max(256, min(cap_env, 4096))

    # Reasoning effort (low|medium|high)
    effort = str(body.get("reasoning_effort") or "medium").lower()
    if effort not in {"low", "medium", "high"}:
        effort = "medium"

    payload = {
        "model": os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5"),
        "input": input_parts,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "agent_act",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["steps", "targets", "result", "reasoning_summary"],
                    "properties": {
                        "steps": {"type": "array", "items": {"type": "string"}},
                        "targets": {"type": "array", "items": {"type": "object"}},
                        "result": {"type": "string"},
                        "reasoning_summary": {"type": "string"},
                        "step_details": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "title": {"type": "string"},
                                    "analysis": {"type": "string"},
                                    "decision": {"type": "string"},
                                    "evidence": {"type": "array", "items": {"type": "string"}}
                                }
                            }
                        }
                    }
                }
            }
        },
        "max_output_tokens": max_tokens,
        "reasoning": {"effort": effort},
        "metadata": {"purpose": "agent_act", "clientId": client_id, "docId": doc_id, "session_id": session_id},
    }

    if previous_response_id:
        payload["previous_response_id"] = previous_response_id

    # Compute timeout with sane bounds [120, 300]
    try:
        timeout_env = float(os.getenv("OPENAI_RESPONSES_TIMEOUT", "0").strip() or 0)
    except Exception:
        timeout_env = 0
    timeout = timeout_env if 120.0 <= timeout_env <= 300.0 else 180.0

    try:
        api_key = _get_openai_key()
        r = await _post_responses(api_key, payload, timeout=timeout)
        content_type = r.headers.get("content-type", "application/json")
    except httpx.ConnectTimeout:
        return JSONResponse(status_code=200, content={
            "ok": False,
            "error": {
                "code": "connect_timeout",
                "message": "Connection to Responses API timed out",
            }
        })
    except httpx.ReadTimeout:
        return JSONResponse(status_code=200, content={
            "ok": False,
            "error": {
                "code": "read_timeout",
                "message": "Responses API took too long to return a result",
                "timeout_seconds": timeout,
            }
        })
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, (dict, list)) else {"message": str(exc.detail)}
        return JSONResponse(status_code=200, content={"ok": False, "error": detail})
    except httpx.HTTPError as exc:
        return JSONResponse(status_code=200, content={"ok": False, "error": {"message": str(exc)}})

    # Fallback if response_format unsupported by upstream
    if r.status_code >= 400 and "application/json" in content_type:
        try:
            err = r.json()
            msg = (
                (err.get("error") or {}).get("message")
                if isinstance(err.get("error"), dict)
                else err.get("message")
            ) or ""
        except Exception:
            msg = ""
        if "Unsupported parameter" in msg and "response_format" in msg:
            fallback = dict(payload)
            fallback.pop("response_format", None)
            # Ask explicitly for JSON via text.format
            extra_instruction = {
                "role": "system",
                "content": [{"type": "input_text", "text": "Return ONLY a valid JSON object with keys: steps, targets, result, reasoning_summary."}],
            }
            fallback["input"] = input_parts + [extra_instruction]
            fallback["text"] = {"format": {"type": "json_object"}}
            r = await _post_responses(api_key, fallback, timeout=180.0)
            content_type = r.headers.get("content-type", "application/json")

    if "application/json" not in content_type:
        return JSONResponse(status_code=200, content={"ok": False, "error": {"message": r.text}})

    data = r.json()
    # Extract structured JSON if available
    structured: dict[str, Any] | None = None
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
    if structured is None:
        # Fallback: try parse output_text as JSON
        try:
            txt = (data.get("output_text") or "").strip()
            if txt.startswith("{") and txt.endswith("}"):
                import json as _json
                structured = _json.loads(txt)
        except Exception:
            structured = None

    # Best-effort raw text for display when structured is missing/empty
    raw_text_guess = ""
    try:
        if isinstance(data.get("output_text"), str) and data["output_text"].strip():
            raw_text_guess = data["output_text"].strip()
        elif isinstance(data.get("reply"), str) and data["reply"].strip():
            raw_text_guess = data["reply"].strip()
        elif isinstance(data.get("choices"), list) and data["choices"]:
            raw_text_guess = str(((data["choices"][0] or {}).get("message") or {}).get("content") or "").strip()
        elif isinstance(data.get("output"), list):
            parts: list[str] = []
            for it in (data.get("output") or []):
                for c in (it.get("content") or []):
                    if isinstance(c, dict) and isinstance(c.get("text"), str):
                        parts.append(c["text"])
            raw_text_guess = ("".join(parts)).strip()
    except Exception:
        raw_text_guess = ""

    steps = []
    targets = []
    result_text = ""
    reasoning_summary = ""
    step_details = None
    if isinstance(structured, dict):
        steps = structured.get("steps") or []
        targets = structured.get("targets") or []
        result_text = structured.get("result") or ""
        reasoning_summary = structured.get("reasoning_summary") or ""
        if isinstance(structured.get("step_details"), list):
            step_details = structured.get("step_details")

    # Ensure we always have something meaningful to display
    if not (isinstance(result_text, str) and result_text.strip()):
        result_text = raw_text_guess or ""

    if r.status_code >= 400:
        # Return structured error for frontend
        try:
            err = data
        except Exception:
            err = {"message": "Upstream error"}
        return JSONResponse(status_code=200, content={"ok": False, "error": err})

    # Success: normalised preview shape
    response_id = None
    try:
        response_id = data.get("id")
    except Exception:
        response_id = None
    return JSONResponse(status_code=200, content={
        "ok": True,
        "preview": {"targets": targets, "result": result_text},
        "reasoning_summary": reasoning_summary,
        "steps": steps,
        "step_details": step_details,
        "raw_text": raw_text_guess,
        "meta": {"response_id": response_id, "session_id": session_id},
    })


@router.get("/api/prompts/{key}")
async def get_prompt_value(key: str):
    """Fetch a stored prompt by key."""
    val = get_prompt(key)
    return JSONResponse(status_code=200, content={"ok": True, "key": key, "value": val})


@router.post("/api/prompts/{key}")
async def set_prompt_value(key: str, body: dict, request: Request):
    """Set or update a prompt value by key. Protected by x-admin-token when PROMPTS_ADMIN_TOKEN is set."""
    if not _admin_ok(request):
        raise HTTPException(status_code=401, detail="unauthorized")
    value = str(body.get("value") or "")
    if not value:
        raise HTTPException(status_code=400, detail="value is required")
    set_prompt(key, value)
    return JSONResponse(status_code=200, content={"ok": True})


@router.get("/api/prompts")
async def list_prompt_keys(prefix: str | None = None, exclude: str | None = None):
    keys = list_prompts(prefix=prefix)
    if exclude:
        ex = exclude.split(",")
        keys = [k for k in keys if not any(str(k["key"]).startswith(e.strip()) for e in ex if e.strip())]
    return JSONResponse(status_code=200, content={"ok": True, "items": keys})


@router.post("/api/prompts/seed-ps-system")
async def seed_ps_system_from_files(request: Request, body: dict | None = None):
    """Seed PS three-stage system prompts into DB from existing files or raw text.

    Accepts JSON body (all fields optional, but at least one must resolve to non-empty):
      - element_file / outline_file / body_file: absolute or repo-relative file paths to read
      - element_text / outline_text / body_text: raw text content to save

    If neither file nor text provided, falls back to environment variables:
      PS_SYSTEM_ELEMENT_FILE / PS_SYSTEM_OUTLINE_FILE / PS_SYSTEM_BODY_FILE

    Protected by admin token (same as other prompt writes). Returns count of saved keys.
    """
    if not _admin_ok(request):
        raise HTTPException(status_code=401, detail="unauthorized")

    body = body or {}

    def _read_path(p: str | None) -> str:
        if not p:
            return ""
        try:
            path = p.strip()
            if not path:
                return ""
            # If repo-relative, make absolute based on this file location
            if not os.path.isabs(path):
                base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                path = os.path.abspath(os.path.join(base, path))
            if os.path.exists(path) and os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
            return ""
        except Exception:
            return ""

    element_text = str(body.get("element_text") or "")
    outline_text = str(body.get("outline_text") or "")
    body_text = str(body.get("body_text") or "")

    if not element_text:
        element_text = _read_path(str(body.get("element_file") or os.getenv("PS_SYSTEM_ELEMENT_FILE", "")))
    if not outline_text:
        outline_text = _read_path(str(body.get("outline_file") or os.getenv("PS_SYSTEM_OUTLINE_FILE", "")))
    if not body_text:
        body_text = _read_path(str(body.get("body_file") or os.getenv("PS_SYSTEM_BODY_FILE", "")))

    saved = 0
    if element_text and element_text.strip():
        set_prompt("ps_system_element", element_text)
        saved += 1
    if outline_text and outline_text.strip():
        set_prompt("ps_system_outline", outline_text)
        saved += 1
    if body_text and body_text.strip():
        set_prompt("ps_system_body", body_text)
        saved += 1

    if saved == 0:
        raise HTTPException(status_code=400, detail="no content resolved from files or text")
    return JSONResponse(status_code=200, content={"ok": True, "saved": saved})
