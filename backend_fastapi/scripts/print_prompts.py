from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "conversations.db"


def main() -> None:
    con = sqlite3.connect(str(DB_PATH))
    try:
        cur = con.execute(
            "SELECT key, substr(value,1,120) FROM prompts WHERE key LIKE 'agent_act_%' ORDER BY key"
        )
        rows = cur.fetchall()
        for k, v in rows:
            v = (v or "").replace("\n", "\\n")
            print(f"{k}: {v}")
    finally:
        con.close()


if __name__ == "__main__":
    main()

