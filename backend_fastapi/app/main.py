from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
import os
import httpx
from .toolbar_ai import router as toolbar_router


# Load envs from backend_fastapi/.env if present
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
except Exception:
    pass

app = FastAPI(title="cv-ai FastAPI backend")
app.include_router(toolbar_router)

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

# Preset prompt for recommendation letter creation (used only by /api/rec/create)
REC_PROMPT = (
    """## 角色定义

你是一位经验丰富的**推荐人**，经常为你接触过的学生撰写研究生申请推荐信。你严格遵循推荐人视角：**仅基于亲眼所见、亲身互动或直接公开展示**的学生表现进行评价，绝不涉及无法观察到的内部细节或私密信息。

## 核心任务

基于输入信息，按工作流程完成：素材整理 → 大纲构思 → 英文推荐信撰写

## 推荐信写作风格

### 1. 语言自然度提升

* **词汇多样化**：使用同义词和近义词替代重复表达，避免模板化痕迹
* **表达层次丰富**：在保持专业性的前提下，适当使用日常词汇，让语言更自然
* **微妙变化感**：体现真人写作的自然不完美，避免过于工整的机器感
* **教学观察口吻**：全稿自然融入1–2处“教师记忆锚点”句式，以增强人情味与可信度（如 *“I still remember how she brought her drafts week after week …”*、*“What impressed me most was not only the result but also her steady improvement.”*），但避免滥用模板化表达

### 2. 句式结构优化

* **长短句交替**：灵活运用简单句、复合句和并列句，创造节奏感
* **多样化开头**：避免段落和句子的重复开头模式
* **自然连接**：在转折和补充处使用恰当的衔接词（however, moreover, particularly等）
* **从句优先**：使用定语从句、状语从句等替代破折号展开，保持流畅度
* **避免评分报告腔**：用“观察—印象—判断”的口吻，而非“打分—条目—评语”的口吻

### 3. 语调把控

* **正式中带亲和**：整体保持学术推荐信的严肃性，偶尔加入温和的感叹或强调
* **避免重复套路**：每段的结构和表达方式应有所不同
* **真实感增强**：体现推荐人的个人观察和真实感受；必要时用“我观察到/我记得/在我的课堂上”等自然主语提示

### 4. 严格禁止事项

* ❌ 在长句中使用破折号进行展开
* ❌ 直接引用学生的原话或对话
* ❌ 描述推荐人无法观察到的技术细节、内部讨论或心理活动
* ❌ 编造任何数据、成绩、排名或未提及的成果
* ❌ **术语堆砌**：避免像作业总结那样罗列细碎技术名词（如“几何变换、触发器、多视角系统”等）而不做能力层面的转译

## 工作流程

### 第一步：精准素材提炼

**目标**：筛选2-3个符合推荐人观察视角的核心故事

**筛选标准**：

* ✅ **直接观察场景**（必须符合以下至少一种）：

  * 课堂互动：提问、讨论、演示、小组合作表现
  * 实验指导：实验操作、数据分析讨论、结果汇报
  * 办公室/课后交流：答疑、学术讨论、项目进展汇报
  * 公开展示：答辩、演讲、作品展示、同伴协助
  * 书面材料：作业、报告、论文草稿的质量体现
  * 日常观察：学习态度、同伴关系、责任心表现

* ✅ **能力体现重点**：

  * 学术能力：分析思维、创新见解、学习能力
  * 解决问题：面对挑战的应对方式和效果
  * 个人品质：责任心、协作精神、自我驱动力
  * 成长轨迹：从初期到后期的明显进步

* ✅ **概括技术细节（能力化转译）**：

  * 技术描述应符合“推荐人几个月后仍能回忆”的 granularity。每个故事最多保留 1–2 个肉眼可见或演示时明显的要点；**将技术名词转译为能力与效果**（如“组织复杂场景、保证演示连贯性、关注体验的一致性”），避免底层算法/参数细节。
  * 主要记录学生的行动、迭代过程、与师生互动以及可量化或可现场感知的结果；若必须提及技术名词，用上位概念或效果性措辞总结（如“system-level thinking”“user experience awareness”）

**合理补充原则**：

* 可基于提供信息进行符合逻辑的细节扩展
* 补充内容必须是推荐人可能观察到的场景
* 示例：学习积极 → 经常在课后讨论问题 → 某次就XX理论进行深入探讨的具体场景

**输出格式**（STAR）：

* **Situation**：具体的观察场景和背景
* **Task**：学生面临的任务或挑战
* **Action**：推荐人直接观察到的学生行为和表现
* **Result**：可观察到的结果与所体现的能力/品质（**用能力化语言收束**）

### 第二步：结构化大纲生成

**写作原则**：

* **Show, don't tell**：通过具体叙述展现能力，而非抽象概括
* **故事驱动**：每个故事指向一个明确的学生优势
* **推荐人视角**：始终以观察者身份进行评价和称赞
* **逻辑递进**：从具体表现到能力总结，层次清晰
* **观察句嵌入**：在开头或主体中自然嵌入1–2处教学观察句式，避免模板化重复

**大纲结构**：

1. **开头段**：推荐人身份、与学生关系、课程/项目背景、总体印象
2. **主体段落**（2–3段）：每段对应一个核心故事

   * 场景描述（简洁）
   * 表现叙述（详细，少术语、重行动与迭代）
   * 能力体现（明确，系统化思维/沟通协调/稳定改进等）
   * 推荐人评价（真诚，避免评分类口吻）
3. **结尾段**：综合评价与**更具人情味的强推荐**（如 *“I am confident that she will excel in graduate studies, and I would be glad to see her join your program.”*），并保留可联系意愿

### 第三步：推荐信撰写

**写作要求**：

* 语言：英文，符合学术推荐信规范，避免评分报告腔
* 数据一致：所有人名(中文名用拼音)、课程、成绩等信息与输入完全一致
* **技术细节转译**：若出现具体技术名词，统一转写为能力与效果层面的描述
* **观察句与结尾**：全稿包含1–2处教学观察句式；结尾加入温度更高的个人态度句（如 *“I would be glad to see her join your program.”*）
* 风格参考：严格按照提供的"推荐信示例"风格
* 格式：纯文本输出，无Markdown格式

## 质量检查清单

撰写完成后，逐项检查：

### 视角一致性检查

* [ ] 所有描述内容均为推荐人可直接观察
* [ ] 未出现学生内心想法或私人对话
* [ ] 未涉及不可观察的技术实现细节或团队内部讨论

### 语言质量检查

* [ ] 未使用破折号进行长句展开
* [ ] 未直接引用学生原话
* [ ] 句式长短搭配合理，表达自然流畅
* [ ] 至少包含1–2处自然的教学观察句式，且不显模板化
* [ ] 全文避免“评分报告”口吻

### 内容完整性检查

* [ ] 每段经历后都有清晰的能力与品质评价（能力化转译到位）
* [ ] 未出现术语堆砌与作业式罗列
* [ ] 信息准确，未编造任何数据或成果

### 结构逻辑检查

* [ ] 开头、主体、结尾结构完整
* [ ] 段落间过渡自然，逻辑清晰
* [ ] 结尾含更具人情味的强推荐句（如 *“I would be glad to see her join your program.”*）

## 输出要求

**格式**：纯文本，结构如下

【素材提炼】
故事1：\\[STAR格式]
故事2：\\[STAR格式]
故事3：\\[STAR格式]

【写作大纲】
\\[结构化大纲内容]

【推荐信全文】长度：约320词
\\[完整的英文推荐信]
\\[中文翻译]

【质量检查确认】
\\[确认通过的检查项目清单]


## 输入信息
{{学生信息、推荐人信息、相关经历等}}

## 推荐信示例
{{推荐信参考示例}}
"""
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


def build_responses_input(
    messages: list[dict] | None = None,
    system_text: str | None = None,
    user_text: str | None = None,
    file_ids: list[str] | None = None,
):
    input_msgs: list[dict] = []
    if isinstance(messages, list) and messages:
        for m in messages:
            role = str(m.get("role") or "user")
            txt = str(m.get("content") or "")
            content = ([{"type": "input_text", "text": txt}] if txt else [])
            input_msgs.append({"role": role, "content": content})
    else:
        input_msgs = [
            {"role": "system", "content": [{"type": "input_text", "text": (system_text or "You are a helpful assistant.")}]} ,
            {"role": "user", "content": [{"type": "input_text", "text": (user_text or "")}]} ,
        ]
    if file_ids:
        for m in reversed(input_msgs):
            if m.get("role") == "user":
                m["content"].extend({"type": "input_file", "file_id": fid} for fid in file_ids)
                break
    return input_msgs


async def post_responses(api_key: str, payload: dict, timeout: float = 120.0):
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(
            OPENAI_RESPONSES_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    return r


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
    # Structured Outputs forward top-level response_format for Responses API
    if response_format and isinstance(response_format, dict):
        fmt_type = response_format.get("type")
        if fmt_type:
            out["response_format"] = {"type": fmt_type}
            if fmt_type == "json_schema" and isinstance(response_format.get("json_schema"), dict):
                out["response_format"]["json_schema"] = response_format["json_schema"]
    if max_out is not None:
        try:
            cap = int(os.getenv("RESPONSES_MAX_OUTPUT_TOKENS", "8192"))
        except Exception:
            cap = 8192
        try:
            req = int(max_out)
        except Exception:
            req = 8192
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
    if "response_format" not in payload:
        # Default to strict schema expected by the app (steps, targets, result, reasoning_summary)
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": "recommendation_pipeline",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["steps", "targets", "result", "reasoning_summary"],
                    "properties": {
                        "steps": {"type": "array", "items": {"type": "string"}},
                        "targets": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "strategy": {"type": "string", "enum": ["selection", "match", "section"]},
                                    "text": {"type": "string"},
                                    "section": {"type": "string"}
                                },
                                "required": ["strategy"],
                                "additionalProperties": False
                            }
                        },
                        "result": {"type": "string"},
                        "reasoning_summary": {"type": "string"}
                    }
                }
            }
        }

    r = await post_responses(api_key, payload, timeout=120.0)
    content_type = r.headers.get("content-type", "application/json")
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
        # Fallback: if response_format unsupported, retry with JSON mode only
        if "Unsupported parameter" in msg and "response_format" in msg:
            fallback = dict(payload)
            fallback.pop("response_format", None)
            # Use json_object per Responses API supported values
            fallback["text"] = {"format": {"type": "json_object"}}
            r2 = await post_responses(api_key, fallback, timeout=120.0)
            ct2 = r2.headers.get("content-type", "application/json")
            if "application/json" in ct2:
                return JSONResponse(status_code=r2.status_code, content=r2.json())
            return JSONResponse(status_code=r2.status_code, content={"text": r2.text})

    if "application/json" in content_type:
        return JSONResponse(status_code=r.status_code, content=r.json())
    return JSONResponse(status_code=r.status_code, content={"text": r.text})


@app.post("/api/rec/create")
async def rec_create(req: Request):
    body = await req.json()
    api_key = get_openai_key()

    # Inputs
    user_prompt = str(body.get("prompt") or "")
    file_ids = [str(x) for x in (body.get("file_ids") or []) if isinstance(x, (str, bytes))]
    # Force GPT‑5 for creation as requested
    model = "gpt-5"
    max_tokens = int(body.get("max_output_tokens") or 8192)

    # Build Responses API input
    input_parts = build_responses_input(
        messages=None,
        system_text=REC_PROMPT,
        user_text=user_prompt,
        file_ids=file_ids or None,
    )

    # Prefer Structured Outputs via response_format; backend has fallback to text.format
    # Prefer Structured Outputs via JSON Schema to get: material, outline, result (full letter), checks, reasoning_summary
    payload = {
        "model": model,
        "input": input_parts,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recommendation_create",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["result"],
                    "properties": {
                        "material": {"type": "string"},
                        "outline": {"type": "string"},
                        "checks": {"type": "string"},
                        "result": {
                            "oneOf": [
                                {"type": "string"},
                                {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "letter_en": {"type": "string"},
                                        "letter_zh": {"type": "string"}
                                    }
                                }
                            ]
                        },
                        "reasoning_summary": {"type": "string"},
                        "steps": {"type": "array", "items": {"type": "string"}}
                    }
                }
            }
        },
        "max_output_tokens": max_tokens,
        "reasoning": {"effort": (body.get("reasoning_effort") or "medium")},
        "metadata": {"purpose": "rec_create"}
    }

    r = await post_responses(api_key, payload, timeout=120.0)
    content_type = r.headers.get("content-type", "application/json")
    if r.status_code >= 400 and "application/json" in content_type:
        # If response_format unsupported, fall back to text.format json_object and explicitly request JSON
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
            # Append an extra instruction containing the word 'json'
            extra_instruction = {
                "role": "system",
                "content": [{"type": "input_text", "text": "Return a valid JSON object with keys: material, outline, checks, result, reasoning_summary."}]
            }
            new_input = list(input_parts) + [extra_instruction]
            fallback["input"] = new_input
            fallback["text"] = {"format": {"type": "json_object"}}
            r = await post_responses(api_key, fallback, timeout=120.0)
            content_type = r.headers.get("content-type", "application/json")
            if r.status_code >= 400 and "application/json" in content_type:
                return JSONResponse(status_code=r.status_code, content=r.json())

    if "application/json" in content_type:
        data = r.json()
        # Try extract structured object first (json parts)
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
        if structured is None:
            # Fallback: try parse output_text as JSON
            try:
                txt = data.get("output_text") or ""
                import json
                structured = json.loads(txt) if isinstance(txt, str) and txt.strip().startswith("{") else None
            except Exception:
                structured = None
        # Prepare outputs
        result_text = ""
        others = {}
        if isinstance(structured, dict):
            res_field = structured.get("result")
            if isinstance(res_field, str):
                result_text = res_field
            elif isinstance(res_field, dict):
                # Join bilingual letters if present
                en = (
                    res_field.get("letter_en")
                    or res_field.get("recommendation_en")
                    or res_field.get("english_letter")
                    or res_field.get("english_text")
                    or res_field.get("english")
                    or res_field.get("en")
                    or ""
                )
                zh = (
                    res_field.get("letter_zh")
                    or res_field.get("recommendation_zh")
                    or res_field.get("chinese_translation")
                    or res_field.get("chinese_letter")
                    or res_field.get("chinese")
                    or res_field.get("zh")
                    or res_field.get("zh_cn")
                    or res_field.get("cn")
                    or ""
                )
                if en and zh:
                    result_text = f"{en}\n\n---\n\n{zh}"
                else:
                    # 如果没有识别到常用键，则避免把对象原样 JSON 化给前端，交由后续回退逻辑处理
                    result_text = ""
            others = {
                "material": structured.get("material") or "",
                "outline": structured.get("outline") or "",
                "checks": structured.get("checks") or "",
                "reasoning_summary": structured.get("reasoning_summary") or "",
                "steps": structured.get("steps") or [],
            }
        if not result_text:
            # As last resort, flatten text parts
            try:
                chunks = data.get("output", [])
                result_text = "".join(
                    c.get("text", "") if isinstance(c, dict) else str(c)
                    for item in chunks
                    for c in (item.get("content") or [])
                )
            except Exception:
                result_text = data.get("output_text") or data.get("reply") or ""

        # Second-chance: If the flattened text itself is a JSON object, parse it to extract fields
        try:
            txt_trim = (result_text or "").strip()
            if txt_trim.startswith("{") and txt_trim.endswith("}"):
                import json
                structured2 = json.loads(txt_trim)
                if isinstance(structured2, dict):
                    new_result_text = None
                    res2 = structured2.get("result")
                    if isinstance(res2, str):
                        new_result_text = res2
                    elif isinstance(res2, dict):
                        en2 = (
                            res2.get("letter_en")
                            or res2.get("recommendation_en")
                            or res2.get("english_letter")
                            or res2.get("english_text")
                            or res2.get("english")
                            or res2.get("en")
                            or ""
                        )
                        zh2 = (
                            res2.get("letter_zh")
                            or res2.get("recommendation_zh")
                            or res2.get("chinese_translation")
                            or res2.get("chinese_letter")
                            or res2.get("chinese")
                            or res2.get("zh")
                            or res2.get("zh_cn")
                            or res2.get("cn")
                            or ""
                        )
                        if en2 and zh2:
                            new_result_text = f"{en2}\n\n---\n\n{zh2}"
                        elif en2 or zh2:
                            new_result_text = en2 or zh2
                    if new_result_text:
                        result_text = new_result_text
                        others = {
                            "material": structured2.get("material") or "",
                            "outline": structured2.get("outline") or "",
                            "checks": structured2.get("checks") or "",
                            "reasoning_summary": structured2.get("reasoning_summary") or "",
                            "steps": structured2.get("steps") or [],
                        }
        except Exception:
            pass
        return JSONResponse(status_code=200, content={
            "ok": True,
            "model": data.get("model"),
            "output_text": (result_text or "").strip(),
            "others": others,
            "raw": data,
        })
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
    max_tokens = int(body.get("maxTokensPerChunk") or 8192)

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
            {"role": "system", "content": [{"type": "input_text", "text": "You are a professional editor. Return ONLY the final text."}]},
            {"role": "user", "content": [{"type": "input_text", "text": composed}]}
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
    purpose = str(body.get("purpose") or "user_data")
    content_type = body.get("contentType")

    api_key = get_openai_key()
    try:
        data = await upload_base64_to_openai_file(name, b64, purpose, api_key, str(content_type or '') or None)
    except HTTPException as exc:
        detail = exc.detail
        status = exc.status_code
        payload = detail if isinstance(detail, dict) else {"detail": detail}
        return JSONResponse(status_code=status, content={"status": "error", "error": payload})
    return {"status": "ok", "file": data}


# Get OpenAI File metadata
@app.get("/api/files/meta/{file_id}")
async def files_meta(file_id: str):
    api_key = get_openai_key()
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(
            f"https://api.openai.com/v1/files/{file_id}",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if "application/json" in (r.headers.get("content-type", "")):
        return JSONResponse(status_code=r.status_code, content=r.json())
    return JSONResponse(status_code=r.status_code, content={"text": r.text})


# Stream OpenAI File content (for preview/download)
@app.get("/api/files/content/{file_id}")
async def files_content(file_id: str):
    api_key = get_openai_key()
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(
            f"https://api.openai.com/v1/files/{file_id}/content",
            headers={"Authorization": f"Bearer {api_key}"},
            follow_redirects=True,
        )
    if r.status_code >= 400:
        try:
            return JSONResponse(status_code=r.status_code, content=r.json())
        except Exception:
            return JSONResponse(status_code=r.status_code, content={"error": r.text})
    # Pass-through with best-effort content type
    content_type = r.headers.get("content-type", "application/octet-stream")
    disposition = r.headers.get("content-disposition")
    headers = {"Content-Type": content_type}
    if disposition:
        headers["Content-Disposition"] = disposition
    return Response(content=r.content, headers=headers, status_code=200)


# Extract plain text from an uploaded file via OpenAI Responses API
@app.post("/api/files/extract-text")
async def files_extract_text(req: Request):
    body = await req.json()
    name = str(body.get("name") or "upload.bin")
    b64 = str(body.get("contentBase64") or "")
    language_hint = str(body.get("language") or "").strip()
    model = str(body.get("model") or os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-5"))
    max_tokens = int(body.get("max_output_tokens") or 4096)
    content_type = body.get("contentType")

    api_key = get_openai_key()
    try:
        file_data = await upload_base64_to_openai_file(name, b64, "user_data", api_key, str(content_type or '') or None)
    except HTTPException as exc:
        detail = exc.detail
        status = exc.status_code
        payload = detail if isinstance(detail, dict) else {"detail": detail}
        return JSONResponse(status_code=status, content={"ok": False, "error": payload})

    file_id = str(file_data.get("id") or "").strip()
    if not file_id:
        raise HTTPException(status_code=500, detail="upload_failed")

    system_bits = [
        "You are a meticulous document transcription assistant.",
        "Return ONLY the readable textual content as UTF-8 plain text.",
        "Preserve headings, bullet markers (- or •), and blank lines between paragraphs.",
        "Do not summarise, translate, or omit sections."
    ]
    if language_hint:
        system_bits.append(f"Document language hint: {language_hint}.")
    system_prompt = " ".join(system_bits)
    user_prompt = "Extract the text from the attached file. Keep original language, punctuation, and structure."

    input_payload = build_responses_input(
        messages=[{"role": "user", "content": user_prompt}],
        system_text=system_prompt,
        user_text=None,
        file_ids=[file_id],
    )

    payload = {
        "model": model,
        "input": input_payload,
        "max_output_tokens": max(256, min(max_tokens, 8192)),
        "metadata": {"purpose": "extract_text"},
    }

    r = await post_responses(api_key, payload, timeout=120.0)
    content_type_resp = r.headers.get("content-type", "")
    if r.status_code >= 400:
        if "application/json" in content_type_resp:
            return JSONResponse(status_code=r.status_code, content=r.json())
        return JSONResponse(status_code=r.status_code, content={"error": r.text})

    model_used = None
    text_output = ""
    if "application/json" in content_type_resp:
        data = r.json()
        model_used = data.get("model")
        text_output = (data.get("output_text") or "").strip()
        if not text_output:
            try:
                chunks = data.get("output", [])
                pieces: list[str] = []
                for item in chunks:
                    for content in (item.get("content") or []):
                        if isinstance(content, dict):
                            if isinstance(content.get("text"), str):
                                pieces.append(content["text"])
                text_output = "".join(pieces).strip()
            except Exception:
                text_output = (data.get("reply") or "").strip()
    else:
        text_output = r.text.strip()

    # Best-effort cleanup of uploaded file
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.delete(
                f"https://api.openai.com/v1/files/{file_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
    except Exception:
        pass

    if not text_output:
        raise HTTPException(status_code=500, detail="extract_text_empty")

    return {"ok": True, "text": text_output, "file_id": file_id, "model": model_used}

# Convert to Markdown using AI (FastAPI version)
@app.post("/api/convert-to-md")
async def convert_to_md(req: Request):
    body = await req.json()
    raw = str(body.get("text") or "")
    if not raw.strip():
        return {"ok": False, "error": "empty_text"}

    hint = str(body.get("hint") or "auto")
    model = str(body.get("model") or os.getenv("DEFAULT_FASTAPI_MODEL", "gpt-4o-mini"))
    max_tokens = int(body.get("maxTokensPerChunk") or 8192)

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

