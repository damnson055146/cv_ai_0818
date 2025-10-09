from __future__ import annotations

import json
import os
import sqlite3
import uuid
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
        # Chatbot memory persistence (generic across doc types)
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_memory (
                memory_key TEXT PRIMARY KEY,
                doc_id TEXT,
                doc_type TEXT,
                language TEXT,
                messages TEXT NOT NULL,
                consumed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_memory_doc ON chat_memory(doc_id);"
        )
        con.commit()


def save_ps_document(
    doc_id: str,
    info_program: str | None = None,
    info_ps_requirement: str | None = None,
    info_student_profile: str | None = None,
) -> None:
    """Upsert per-document PS metadata captured during create/upload."""

    doc = (doc_id or "").strip()
    if not doc:
        return

    ensure_ps_tables()
    with _connect() as con:
        con.execute(
            """
            INSERT INTO ps_documents (doc_id, info_program, info_ps_requirement, info_student_profile)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(doc_id) DO UPDATE SET
                info_program = excluded.info_program,
                info_ps_requirement = excluded.info_ps_requirement,
                info_student_profile = excluded.info_student_profile,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                doc,
                (info_program or "").strip() or None,
                (info_ps_requirement or "").strip() or None,
                (info_student_profile or "").strip() or None,
            ),
        )
        con.commit()


def _normalize_chat_messages(messages: List[Any]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    for item in messages or []:
        if item is None:
            continue
        if isinstance(item, dict):
            content = str(item.get("content") or "").strip()
            if not content:
                continue
            role = str(item.get("role") or "assistant").strip() or "assistant"
            normalized.append({"role": role, "content": content})
            continue
        text = str(item).strip()
        if text:
            normalized.append({"role": "assistant", "content": text})
    return normalized


def store_chat_memory(
    messages: List[Any],
    *,
    doc_id: str | None = None,
    doc_type: str | None = None,
    language: str | None = None,
    memory_key: str | None = None,
) -> Optional[str]:
    """Persist chatbot memory payload and return the memory key."""

    normalized = _normalize_chat_messages(messages)
    if not normalized:
        return None

    ensure_ps_tables()

    key = (memory_key or "").strip() or uuid.uuid4().hex
    doc = (doc_id or "").strip() or None
    doc_type_val = (doc_type or "").strip() or None
    lang = (language or "").strip() or None
    payload = json.dumps(normalized, ensure_ascii=False)

    with _connect() as con:
        con.execute(
            """
            INSERT INTO chat_memory (memory_key, doc_id, doc_type, language, messages, consumed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(memory_key) DO UPDATE SET
                doc_id = CASE WHEN excluded.doc_id IS NOT NULL THEN excluded.doc_id ELSE chat_memory.doc_id END,
                doc_type = CASE WHEN excluded.doc_type IS NOT NULL THEN excluded.doc_type ELSE chat_memory.doc_type END,
                language = CASE WHEN excluded.language IS NOT NULL THEN excluded.language ELSE chat_memory.language END,
                messages = excluded.messages,
                consumed = 0,
                updated_at = CURRENT_TIMESTAMP
            """,
            (key, doc, doc_type_val, lang, payload),
        )
        con.commit()
    return key


def assign_chat_memory(memory_key: str, doc_id: str) -> bool:
    """Bind an existing memory entry to a document/chat id."""

    key = (memory_key or "").strip()
    doc = (doc_id or "").strip()
    if not key or not doc:
        return False

    ensure_ps_tables()
    with _connect() as con:
        cur = con.execute(
            """
            UPDATE chat_memory
            SET doc_id = ?, consumed = 0, updated_at = CURRENT_TIMESTAMP
            WHERE memory_key = ?
            """,
            (doc, key),
        )
        con.commit()
        return cur.rowcount > 0


def load_chat_memory(
    *,
    memory_key: str | None = None,
    doc_id: str | None = None,
    consume: bool = False,
) -> List[Dict[str, Any]]:
    """Fetch chat memory by key or doc id; optionally mark as consumed."""

    key = (memory_key or "").strip()
    doc = (doc_id or "").strip()
    if not key and not doc:
        return []

    ensure_ps_tables()

    sql: str
    args: tuple
    direct_lookup = False
    if key:
        sql = "SELECT memory_key, messages FROM chat_memory WHERE memory_key = ? LIMIT 1"
        args = (key,)
        direct_lookup = True
    else:
        sql = (
            "SELECT memory_key, messages FROM chat_memory "
            "WHERE doc_id = ? AND consumed = 0 ORDER BY updated_at DESC LIMIT 1"
        )
        args = (doc,)

    with _connect() as con:
        cur = con.execute(sql, args)
        row = cur.fetchone()
        if not row and not direct_lookup and doc:
            # Fallback: treat doc id as memory key when explicitly stored that way
            cur = con.execute(
                "SELECT memory_key, messages FROM chat_memory WHERE memory_key = ? LIMIT 1",
                (doc,),
            )
            row = cur.fetchone()
        if not row:
            return []

        found_key, payload = row
        try:
            data = json.loads(payload or "[]")
        except Exception:
            data = []

        if consume:
            con.execute(
                "UPDATE chat_memory SET consumed = 1, updated_at = CURRENT_TIMESTAMP WHERE memory_key = ?",
                (found_key,),
            )
            con.commit()

    return data if isinstance(data, list) else []


def consume_chat_memory(identifier: str) -> List[Dict[str, Any]]:
    """Convenience wrapper that attempts to consume memory by key or doc id."""

    ident = (identifier or "").strip()
    if not ident:
        return []

    data = load_chat_memory(memory_key=ident, consume=True)
    if data:
        return data
    return load_chat_memory(doc_id=ident, consume=True)


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
