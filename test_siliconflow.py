import os
import sys
import json
import textwrap
from typing import Any, Dict

try:
    import requests
except Exception:
    print("Please install requests: pip install requests", file=sys.stderr)
    sys.exit(1)


def mask(s: str, keep: int = 4) -> str:
    if not s:
        return ""
    if len(s) <= keep:
        return "*" * len(s)
    return s[:keep] + "…" + "*" * (len(s) - keep)


def main() -> int:
    api_key = os.environ.get("SILICON_FLOW_API_KEY") or os.environ.get("SILICON_FLOW_APIKEY")
    base_url = os.environ.get("SILICON_FLOW_BASE_URL", "https://api.siliconflow.cn/v1")
    model = os.environ.get("SILICON_FLOW_MODEL", "Qwen/Qwen2.5-7B-Instruct")

    print("[config] base_url=", base_url)
    print("[config] model=   ", model)
    print("[config] key=     ", mask(api_key or "<missing>"))

    if not api_key:
        print("ERROR: SILICON_FLOW_API_KEY is not set in environment", file=sys.stderr)
        return 2

    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload: Dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "temperature": 0.1,
        "max_tokens": 64,
        "stream": False,
    }

    try:
        resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
    except Exception as e:
        print("REQUEST FAILED:", e, file=sys.stderr)
        return 3

    print("[http] status=", resp.status_code)
    print("[http] content-type=", resp.headers.get("content-type"))

    text = resp.text or ""
    snippet = textwrap.shorten(text.replace("\n", " "), width=300, placeholder="…")
    print("[body] snippet=", snippet)

    if resp.headers.get("content-type", "").startswith("application/json"):
        try:
            data = resp.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if content:
                print("[ok] assistant:", textwrap.shorten(content.replace("\n", " "), width=200, placeholder="…"))
                return 0
        except Exception as e:
            print("[warn] json parse error:", e, file=sys.stderr)

    return 0 if resp.ok else 1


if __name__ == "__main__":
    sys.exit(main())


