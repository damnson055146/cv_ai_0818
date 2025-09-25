from __future__ import annotations

import os
import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "conversations.db"
REPO_ROOT = Path(__file__).resolve().parents[2]


DDL = """
CREATE TABLE IF NOT EXISTS prompts (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def _read_optional(p: Path | None) -> str:
    try:
        if p and p.exists():
            return p.read_text(encoding="utf-8")
    except Exception:
        pass
    return ""


def _ps_defaults_from_env() -> dict[str, str]:
    out: dict[str, str] = {}
    base = os.getenv("PS_PROMPTS_BASE_DIR", "").strip()
    if not base:
        return out
    base_path = Path(base)
    fname_req = os.getenv("PS_PROMPT_REQUIREMENT", "info_ps_requirement.md").strip() or "info_ps_requirement.md"
    fname_outline = os.getenv("PS_PROMPT_GUIDANCE_OUTLINE", "guidance_outline.md").strip() or "guidance_outline.md"
    fname_element = os.getenv("PS_PROMPT_GUIDANCE_ELEMENT", "guidance_element.md").strip() or "guidance_element.md"
    out["ps_requirement"] = _read_optional(base_path / fname_req)
    out["guidance_outline"] = _read_optional(base_path / fname_outline)
    out["guidance_element"] = _read_optional(base_path / fname_element)
    return out


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH))
    try:
        con.execute(DDL)

        # Seeds: Agent (Chatbot)
        seeds: dict[str, str] = {
            # Global defaults (CN)
            "agent_act_system_prompt": (
                "你是一名面向 Markdown/代码编辑器的编辑规划代理。"
                "在给出修改建议之前，先做简短、可审核的思考（不要输出推理过程本身）。"
                "保守行事：严格保留文档结构、格式、占位符与作者原有语气。"
                "当选择区存在时，以该选择为主要上下文；否则在全文中定位最相关位置（如：标题、首段、经历要点、关键词匹配处）。"
                "在任何情况下，都要给出非空的 result（可以是小幅安全润色）。"
                "输出必须是 JSON 对象，仅包含：steps、targets、result、reasoning_summary，可选 step_details。"
            ),
            "agent_act_global_append": (
                "附加约束：\n"
                "- 若用户使用中文，则 steps 与 reasoning_summary 使用简体中文；result 语言与原文保持一致。\n"
                "- 注意中英文标点与空格规范，避免无意义的同义反复。\n"
                "- 优先并列结构与动词开头的动作描述，避免评价性空话。"
            ),
            # Type-specific from repo root files (if present)
            "agent_act_system_prompt:cv": _read_optional(REPO_ROOT / "cv_sys.md"),
            "agent_act_system_prompt:ps": _read_optional(REPO_ROOT / "ps_sys.md"),
            "agent_act_system_prompt:rec": _read_optional(REPO_ROOT / "rec_sys.md"),
            # Toolbar prompts (EN)
            "toolbar_default_prompt": (
                "Rewrite the selected content so it reads natural, personal, and human. "
                "Preserve all existing structure, markdown, and placeholders. "
                "Keep the information accurate while softening any AI-like tone."
            ),
            "toolbar_system_prompt": (
                "You are an expert writing assistant focussed on subtle human rewrites. "
                "Avoid AI buzzwords, vary sentence lengths, and keep the author voice authentic."
            ),
            # PS system prompts (EN defaults)
            "ps_system_element": (
                "You are preparing materials for a Personal Statement (PS). "
                "Summarize key elements strictly structured by sections: Motivation; Pre-Knowledge; Experience; Why Master's; Why This Program; Career Plan. "
                "Return plain text with clear headings and bullet points. Do NOT fabricate info. Leave fields blank if unknown. Language: English."
            ),
            "ps_system_outline": (
                "You are drafting a PS outline only. Use clear numbered sections and subsections. "
                "Sections must reflect: Motivation; Pre-Knowledge; Experience; Why Master's; Why This Program; Career Plan. "
                "Output concise headings with 1-3 bullet points each. Do not write body paragraphs. Language: English."
            ),
            "ps_system_body": (
                "You are writing a Personal Statement body strictly following the provided outline. Keep paragraphs concise. "
                "Do not invent facts; if information is missing, keep generic placeholders or skip that detail. Language: English."
            ),
        }

        # Merge PS defaults from env-based directory if available
        ps_defaults = _ps_defaults_from_env()
        seeds.update({k: v for k, v in ps_defaults.items() if isinstance(v, str) and v})

        for k, v in seeds.items():
            if not (isinstance(v, str) and v.strip()):
                continue
            con.execute(
                (
                    "INSERT INTO prompts(key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)\n"
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP"
                ),
                (k, v),
            )
        con.commit()
    finally:
        con.close()


if __name__ == "__main__":
    main()

