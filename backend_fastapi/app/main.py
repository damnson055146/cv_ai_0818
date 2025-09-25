"""Minimal FastAPI backend focussed on Chatbot endpoints.

This file is ASCII-only to avoid accidental non-UTF-8 bytes causing
import-time decoding errors. All long prompts should be stored in DB.
"""

from __future__ import annotations

import os
from typing import Any

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

def _read_rec_create_prompt() -> str:
    """Hardcoded REC creation prompt (base64-encoded UTF-8)."""
    import base64
    REC_PROMPT_B64 = (
        """
IyMg55GZ5o6V5aOK54C55rCr566fDQoNCua1o+eKs+anuOa2k+KCrOa1o+W2h+eyoealoOWxvOi1tOeAteWygOaukSoq6Y6644So5bSY5rWcPyrplJvlsoDnsqHnlK/plZDotJ/mtaPnirPluLTnkZnvuYHnuYPpkKjli6vuhJ/pkKLnhrjmjLXpjZDmrJHniLrnu4zliYHmlZPpkKLlrqDuh6zpjrrjhKjltJjmt4fCsOKCrOWCmee2mOa2k+ODpueJuOmWrOmdm+aDiumOuuOEqOW0mOa1nOm4v+6di+eRmeaOnue0sCoq5rWg5ZGt54aA5rWc5bqd57+w6ZCq5YW85aKN55GZ5L214oKs5L2357+w6Z+s7oKh57Cw6Y2U44Sm5Z6o6ZCp5a2Y5bi06Y2P7oSA57SR54Ge5pug44GaKirpkKjli6vuhJ/pkKLnhrvjgIPpkJzmi4znuZjnkJvlsoPnmI7mtaDlh6TntJ3nvIHmv4XnrInlqJHlpIrlvLfpj4PnirPnobbnkZnlgprnmYLpjZLmia7mrpHpjZDlkbTlhLTnvIHll5rlpq3pjrTmoKvunYbngLXll5Xkv4rpjq3uiJjigqw/Cg0KIyMg6Y+N56i/57i+5rWg6K+y5aefDQoNCumNqei9sOewrOadiOaSs+WPhua3h+KEg+S8hemUm+WxvuWvnOWuuOODpOe2lOWotOS9uuKWvOeAueWxvuWemumUm+awseekjOmPieaEreaao+mQnj/piKs/5r620YXnv7Dpj4vli6zigqw/6YirP+mRu+i+qOaeg+mOuuOEqOW0mOa3h+KEg+aMtemNkD8KDQojIyDpjrrjhKjltJjmt4figLPllZPmtaPmu4jul5Ppj40/Cg0KIyMjIDEuIOeSh+6FoeKWiOmRt+6BhuWKp+aQtO+4veW9gemNlz8KDQoqICoq55KH5baG55y55r625rCt54mx6Y2WPyrplJvmsKvlqIfpkKLjhKXmgpPmtpTlpI7nmJ3pjZzlsoPnuY7mtpTlpI7nmJ3pj4flpLjllKzplrLltoXumLLnkJvjhKjmj6rplJvlsoTkvKnpjY/ltobEgemPieWeruWvsumQpeaboeaKlw0KKiAqKueQm+OEqOaPqueBnuWCm+6CvOa2k+adv+eYnCoq6ZSb5rCs5rmq5reH5r+H5a+U5raT5pKy56yf6Y6s0YXmrpHpjZPltoblvYHmtpPlrLbntJ3plqvlgprntovmtaPot6jmlaTpj4Pjg6XniLbnkofltobnnLnplJvlsoPuhoDnkofuhaHilojpj4fno4vlmpzpkJI/CiogKirlr7Duhrzum77pjZnmqLrlr7LpjrA/KumUm+awq+e2i+mQnOaJrua5oea1nOWThOWVk+a1o+a7heaukemRt+6BhuWKp+a2k+W2heeVrOe8h+W6r+e0nemWrOWeruWOpOadqeWbpuewrOWuuOODpuaao+mQqOWLrOa6gOmNo+OEpuWKhQ0KKiAqKumPgeasj+6En+eRmeWCmueZgumNme+9heaDoioq6ZSb5rCs5Y+P57uL6IOv5Zqc6ZCS5oOw54C66Y2PP+mIpT/mvrbli6jigqzmu4TmmoDnlK/loKPuhofouYfll5vmlYvpkJDlhYnigqzmv4blvZ7lr67lv6XntJ3mtaDjg6XuloPlr67ovbDmsYnpjq/lka3mh5fmtpPluqHlvbLmt4figLPlrrPplJvloJ3um6cgKumIpea3miBzdGlsbCByZW1lbWJlciBob3cgc2hlIGJyb3VnaHQgaGVyIGRyYWZ0cyB3ZWVrIGFmdGVyIHdlZWsg6Yil77i54oKsP+mKhj/piKXmt7JoYXQgaW1wcmVzc2VkIG1lIG1vc3Qgd2FzIG5vdCBvbmx5IHRoZSByZXN1bHQgYnV0IGFsc28gaGVyIHN0ZWFkeSBpbXByb3ZlbWVudC7piKU/6ZSb5aSb57Sd5rWj5Zeb5Lyp6Y2P5baG5LqS6ZCi44SmxIHpj4nlnq7lr7LnkJvjhKjmj6oNCg0KIyMjIDIuIOmNmeODpee0oee8geaStOeAr+a1vOaouuWvsg0KDQoqICoq6ZeA6Leo54Wt6Y2Z44Ok5rCm6Y+HPyrplJvmsLHkvJLlqLLmmI/nuY3pkKLjhKfnlZ3pjZfmm57lvZ7piobkvbjumLLpjZrloJ3lvZ7pjZzlsb3oi5/pjZLmpYDlvZ7plJvlsb3lnrHplqvnirrlpq3mv4Llv5TlioUNCiogKirmvrbmsK3nibHpjZbmoKfntJHmvrY/KumUm+awtuS8qemNj+W2hu6GjOmSgOiXieaLsOmNmeODpeeTmemQqOWLr+WZuOa+tuW2hee0kea+tuWtmMSB5a+uPwoqICoq6ZG37oGG5Yqn5p2p54K05bi0KirplJvmsKzmuarmnZ7uhIHlp4zpjZzlsoPLiemNj+WRre6Yqea1o+i3qOaVpOmOreadv+e2i+mQqOWLru6UmemOuuODqOeYnemUm+WdlG93ZXZlciwgbW9yZW92ZXIsIHBhcnRpY3VsYXJseee7m+Wkm+e0mg0KKiAqKua1oOW6oeW9nua1vOaouuWOmyoq6ZSb5rCr5aiH6ZCi44Sl55W+55KH7oWd57Kg6Y2Z44Oj4oKs5L265ae455KH7oWd57Kg6Y2Z44On55OR6Y+H5aS45ZSs6ZCu5a2Y5aeM6Y2Z5bOw552N5a+u4oKs6ZSb5bG857ma6Y645L2556Wm6ZCj5ZGt5a6zDQoqICoq6Zas5Z6u5Y6k55KH5Yur5Z6O6Y6244Ol5oah6ZG1PyrplJvmsLHmlaTpiKXmu4bunYfngLXnhrLigqzmlr/ltYPnkp7imYDigqzmlr/lnr3pj4LuhZvigqzmv4jmrpHpjZnvvYXmg6LplJvlsorigqzlsoTmvarpiKXmu4TloqbpjZLll4/igqzml4Dmva/pkKnuhrnigqzml4fnmI7nkofuhZvigqzmv4jmrpHpjZnvvYXmg6INCg0KIyMjIDMuIOeSh+6Foeean+mOtuWpg+W4tg0KDQoqICoq5aed772F57Sh5raT7oWe55Sr5rWc5o+S5ouwKirplJvmsK3mmqPmtaPmkrLnuZrpjrjkvbjuhJ/pj4juiJvluLnpkb3mhKrkv4rpkKjli6rlvJfpkbLlhqnigqzRjee0nemNi+i3uueatemNlOeKsuWPhuWok+KVgeaLsOmQqOWLrOWKhemNmeinhOWeqOWvrum4v+eanw0KKiAqKumWrOWeruWOpOmWsuW2he6Ysua/gualhOefvioq6ZSb5rCt55ih5aiI55S15q6R57yB5pK054Cv6Y2c5bKD44CD5p2I54Ks5p+f5a+u5b+T57Cy6Y+I5aSL5aKN5raT5baF5oKTDQoqICoq6ZCq54a355aE6Y6w54a37paD5a+uPyrplJvmsKvntovpkJzniYjluLnpkb3mhKrmsYnpkKjli6rph5zmtZzpuL/unYfngLXnhrfmi7DpkKrnhrfnloTpjrDnhrflvYjplJvmtpjnuYDnkZXkvbnmpILpkKLjhKLigqzmu4TlnpznkZnlgprnmYLpjZI/6Y605oij7oaH5a+wP+mNpuOEpuWenOmQqOWLru6Hs+mNq+WCmeesgumIpea/iOeTkemRt+6BhuWKp+a2k+aYj+6HoumOu+aEruOBmg0KDQojIyMgNC4g5raT44Om54m457uC5L257oSb5rWc5ayu44CNDQoNCiog6YmCP+mNpuOEqeaasemNmeODpOiFkea1o+i3qOaVpOmQruWtmOWnjOmNmeeWr+e5mOeQm+WxveedjeWvruKCrA0KKiDpiYI/6ZCp5a2Y5bi05a+u5pug5pWk54Cb77i+5pWT6ZCo5Yur5bir55KH5r+H5Z6o54C156GF55i9DQoqIOmJgj/pjrvlv5rloKrpjrrjhKjltJjmtZzng5jmo6TlqInmm6HunYfngLXnhrfln4zpkKjli6zlpqfpj4juiJznso/pkbrlgpjigqzkvbjllLTplq7jhKjuhb/nkoHng5jlnqjouYflhqrmgorlqLLor7Llp6kNCiog6YmCP+e8guagreKCrOeKseaNoua1o+abn+aan+mOue6GuuKCrOS9ueWemue8geKUv+KCrOS9ueW4k+mNmuW2huWeqOmPiO6BheW9gemNmeWphOaukemOtOaEreeBiQ0KKiDpiYI/Kirpj4juiJ3uh6Lpjavll5nniKkqKumUm+awtuS8qemNj+W2heWEmua1o+a7gOesn+mOrOiNpOeyqOmWre+9hueJsee8g+algOWeque8geWXme6Vs+mOtuKCrOmPiO6ImuaCleeSh+W2j+e0mea/oeWCl+KCrOa7g+Wakea1o+abnuW9iemOue6drOKCrOS9vdCV6Y2Z5oid5quS6YqG5L247pi/55GZ5Zea7p2X57uv6I2k57K66Yil5r+I55OR6ZSb5aSO4oKs5bG856yJ6Y2L5rCz5YWY6Y2U5raY55yw6ZeI44ii5q6R5p2e7oSD55inDQoNCiMjIOWuuOODpOe2lOWotOS9uuKWvA0KDQojIyMg57uX7oO/56u05aed44Ov57Sw57uu5oOn5Zmv57ux54qz5r2X6Y675oSu5YGnDQoNCioq6ZCp7oa954ijKirplJvmsLHnk6vplqs/LTPmtpPugYbug4HpjZrloJ/luLnpkb3mhKrmsYnnkZnlgprnmYLnkZnll5runZfpkKjli6znibPouYflhqnmmaDmtZw/Cg0KKirnu5vmtqLigqzlpIvniKPpjZE/KumUmz8KDQoqIOmJgT8qKumQqeWtmOW4tOeRmeWCmueZgumNpueDmOarmSoq6ZSb5aCd57mA5qSk6I2k7oOB6Y2a5aCc5LqS5raT5ayt5Zqm54GP5oic56u057uJ5baP57Sa6ZSbPwoNCiAgKiDnkofmg6fniJ7mtZzmjpHlp6nplJvmsK3lvYHpl4Luhrrigqzkvb3uhb/nkoHmgZLigqzkvbnntKjnu4DmgZLigqzkvbjnmqznvIHli6vmgo7mtaPmu4bjgIPpkJw/
"""
    ).strip()
    try:
        return base64.b64decode(REC_PROMPT_B64).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _build_responses_input(system_text: str, user_text: str, file_ids: list[str] | None) -> list[dict]:
    parts = [
        {"role": "system", "content": [{"type": "input_text", "text": system_text or ""}]},
        {"role": "user", "content": [{"type": "input_text", "text": user_text or ""}]},
    ]
    if file_ids:
        for fid in file_ids:
            parts[1]["content"].append({"type": "input_file", "file_id": fid})
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


def _read_cv_create_prompt() -> str:
    """Best-effort CV creation prompt.

    Priority:
    1) DB key agent_act_system_prompt:cv
    2) Repo root cv_sys.md if present
    3) Fallback empty string
    """
    # Try DB key used for agent act
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


def _get_create_prompt(doc_type: str) -> str:
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

    system_text = _get_create_prompt(doc_type)
    model = _get_create_model(doc_type)

    # Bound max tokens
    try:
        max_tokens = int(body.get("max_output_tokens") or 8192)
        max_tokens = max(512, min(max_tokens, 16384))
    except Exception:
        max_tokens = 8192
    effort = str(body.get("reasoning_effort") or "medium").lower()
    if effort not in {"low", "medium", "high"}:
        effort = "medium"

    input_parts = _build_responses_input(system_text, user_prompt, file_ids or None)

    schema = _build_schema()
    schema_name = _get_schema_name(doc_type)

    payload = {
        "model": model,
        "input": input_parts,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        },
        "max_output_tokens": max_tokens,
        "reasoning": {"effort": effort},
        "metadata": {"purpose": f"{doc_type or 'rec'}_create"},
    }

    # Call Responses API with fallback when response_format unsupported
    r = await _post_responses(api_key, payload)
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
            r = await _post_responses(api_key, fallback)
            content_type = r.headers.get("content-type", "application/json")

    if "application/json" not in content_type:
        return JSONResponse(status_code=200, content={"status": "error", "error": {"message": r.text}})

    data = r.json()

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

    return JSONResponse(status_code=200, content={
        "status": "ok",
        "raw": data,
        "output_text": output_text or "",
        "others": others,
    })
@app.post("/api/rec/create")
async def rec_create(req: Request):
    body = await req.json()
    # Back-compat: keep this path but delegate to new generic handler
    return await _create_inner(body, "rec")


@app.post("/api/create")
async def create(req: Request):
    body = await req.json()
    # Accept doc type from body; support aliases
    doc_type = (body.get("doc_type") or body.get("docType") or body.get("type") or "rec").strip().lower()
    if doc_type not in {"cv", "ps", "rec"}:
        doc_type = "rec"
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
