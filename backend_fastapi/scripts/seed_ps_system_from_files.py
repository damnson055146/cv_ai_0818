from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "conversations.db"
DDL = """
CREATE TABLE IF NOT EXISTS prompts (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def _read_optional(p: Path | None) -> str:
    try:
        if p and p.exists() and p.is_file():
            return p.read_text(encoding="utf-8")
    except Exception:
        pass
    return ""


def set_prompt(con: sqlite3.Connection, key: str, value: str) -> None:
    con.execute(
        (
            "INSERT INTO prompts(key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)\n"
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP"
        ),
        (key, value),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed PS 3-stage system prompts into DB from files")
    parser.add_argument("--element", type=str, default=os.getenv("PS_SYSTEM_ELEMENT_FILE", ""), help="Path to element stage system prompt file")
    parser.add_argument("--outline", type=str, default=os.getenv("PS_SYSTEM_OUTLINE_FILE", ""), help="Path to outline stage system prompt file")
    parser.add_argument("--body", type=str, default=os.getenv("PS_SYSTEM_BODY_FILE", ""), help="Path to body stage system prompt file")
    parser.add_argument("--base", type=str, default="", help="Optional base directory to resolve relative file names")
    args = parser.parse_args()

    base = Path(args.base).resolve() if args.base else None

    def _resolve(p: str) -> Path | None:
        s = (p or "").strip()
        if not s:
            return None
        cand = Path(s)
        if not cand.is_absolute() and base:
            cand = base / cand
        if not cand.is_absolute():
            # Also try repo root
            repo_root = Path(__file__).resolve().parents[2]
            cand2 = (repo_root / s)
            if cand2.exists():
                cand = cand2
        return cand

    element_path = _resolve(args.element)
    outline_path = _resolve(args.outline)
    body_path = _resolve(args.body)

    element_text = _read_optional(element_path)
    outline_text = _read_optional(outline_path)
    body_text = _read_optional(body_path)

    if not any([element_text, outline_text, body_text]):
        raise SystemExit("No content resolved. Provide --element/--outline/--body or set env PS_SYSTEM_*_FILE")

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH))
    try:
        con.execute(DDL)
        saved = 0
        if element_text:
            set_prompt(con, "ps_system_element", element_text)
            saved += 1
        if outline_text:
            set_prompt(con, "ps_system_outline", outline_text)
            saved += 1
        if body_text:
            set_prompt(con, "ps_system_body", body_text)
            saved += 1
        con.commit()
        print(f"ok: saved={saved}")
    finally:
        con.close()


if __name__ == "__main__":
    main()

