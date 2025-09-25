from __future__ import annotations

import os
import sqlite3
from typing import Optional, List, Dict, Any


def _db_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(__file__))
    # Reuse conversations.db if present; otherwise create it
    return os.path.join(base_dir, "conversations.db")


def _connect() -> sqlite3.Connection:
    # Create a fresh connection per call; SQLite is fast and avoids cross-thread issues
    conn = sqlite3.connect(_db_path(), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA encoding='UTF-8';")
    return conn


def ensure_prompts_table() -> None:
    with _connect() as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS prompts (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        con.commit()


def ensure_ps_tables() -> None:
    """Create PS-related tables if not exist.

    - ps_documents: per-document PS info captured during creation/upload
      doc_id (TEXT, PRIMARY KEY) — links to frontend document id
      info_program (TEXT) — program information
      info_ps_requirement (TEXT) — application requirements / scope
      info_student_profile (TEXT) — student profile summary
      created_at/updated_at (TIMESTAMP) — audit timestamps

    - ps_settings: PS global adjustable texts (e.g., guidance_element, guidance_outline)
      key (TEXT, PRIMARY KEY), value (TEXT), updated_at (TIMESTAMP)
      (Note: current code also supports these keys via the generic 'prompts' table; this
       dedicated table is introduced for future separation. Keeping both is harmless.)
    """
    with _connect() as con:
        # Per-document PS info
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ps_documents (
                doc_id TEXT PRIMARY KEY,
                info_program TEXT,
                info_ps_requirement TEXT,
                info_student_profile TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        # Global PS settings (optional; can mirror prompts keys)
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS ps_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        con.commit()


def get_prompt(key: str) -> Optional[str]:
    ensure_prompts_table()
    with _connect() as con:
        cur = con.execute("SELECT value FROM prompts WHERE key = ?", (key,))
        row = cur.fetchone()
        return row[0] if row else None


def set_prompt(key: str, value: str) -> None:
    ensure_prompts_table()
    with _connect() as con:
        con.execute(
            "INSERT INTO prompts (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)\n"
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
            (key, value),
        )
        con.commit()


def list_prompts(prefix: Optional[str] = None) -> List[Dict[str, Any]]:
    ensure_prompts_table()
    q = "SELECT key, updated_at FROM prompts"
    args: tuple = ()
    if prefix:
        q += " WHERE key LIKE ?"
        args = (f"{prefix}%",)
    q += " ORDER BY key ASC"
    with _connect() as con:
        cur = con.execute(q, args)
        rows = cur.fetchall()
        return [{"key": r[0], "updated_at": r[1]} for r in rows]
