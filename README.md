<h1 align="center">Markdown Resume</h1>

<p align="center">Write an ATS-friendly Resume in Markdown. Available for anyone, Optimized for Dev.</p>

<p align="center"><a href="/"><strong>Start Writing Now</strong></a>!</p>

<img align="center" src="https://raw.githubusercontent.com/junian/markdown-resume/assets/img/markdown-resume-screenshot-00.jpg"/>

## About
A work from Junian, with LLM integrated.

Changes I made from the original work:
- Default template is now as close as possible with [CareerCup's](https://www.careercup.com/resume) resume template.
- Default color is all Black.
- Added Web-safe fonts for easier ATS parsing.
- And many more ...

## Notice

Highly recommend using Chromium-based browsers, e.g., [Chrome](https://www.google.com/chrome/) and [Microsoft Edge](https://www.microsoft.com/en-us/edge).

## Features

- Write your resume in Markdown and preview it in real-time, it's smooth!
- It works offline ([PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps))
- Export to A4 and US Letter size PDFs
- Customize page margins, theme colors, line heights, fonts, etc.
- Pick any fonts from [Google Fonts](https://fonts.google.com/)
- Add icons easily via [Iconify](https://github.com/iconify/iconify) (search for icons on [Icônes](https://icones.js.org/))
- Tex support ([KaTeX](https://github.com/KaTeX/KaTeX))
- Cross-reference (would be useful for an academic CV)
- Case correction (e.g. `Github` -> `GitHub`)
- Add line breaks (`\\[10px]`) or start a new page (`\newpage`) just like in LaTeX
- Break pages automatically
- Customize CSS
- Manage multiple resumes
- Your data in your hands:
  - Data are saved locally within your browser, see [here](https://localforage.github.io/localForage/) for details
  - Open-source static website hosted on [Github Pages](https://pages.github.com/), which doesn't (have the ability to) collect your data
  - No user tracking, no ads
- Dark mode

## Development

It's built on [Nuxt 3](https://nuxt.com), with the power of [Vue 3](https://github.com/vuejs/vue-next), [Vite](https://github.com/vitejs/vite), [Zag](https://zagjs.com/), and [UnoCSS](https://github.com/antfu/unocss).

Clone the repo and install dependencies:

```bash
pnpm install
```

Build some [packages](packages):

```bash
pnpm build:pkg
```

To enable picking fonts from [Google Fonts](https://fonts.google.com/), you will need to generate a [Google Fonts Developer API Key](https://developers.google.com/fonts/docs/developer_api#APIKey). Then, create a `.env` file in [`site`](site/) folder and put:

```
NUXT_PUBLIC_GOOGLE_FONTS_KEY="YOUR_API_KEY"
```

Start developing / building the site:

```bash
pnpm dev
pnpm build
```

## Credits

- The original work: [Renovamen/oh-my-cv](https://github.com/Renovamen/oh-my-cv)
- [billryan/resume](https://github.com/billryan/resume)

## License

This project is licensed under [MIT](LICENSE) license.

---

Made with ☕ by Junian.
Appreciate the effort from Junian --Pan

# CV AI Project

## FastAPI + OpenAI Agents SDK Migration

This project has migrated AI endpoints from Node (Nuxt server routes) to a FastAPI backend using OpenAI Agents SDK Sessions.

### Setup

1) Backend (FastAPI)
- Install deps:
  - `pip install -r backend_fastapi/requirements.txt`
- Set env:
  - `OPENAI_API_KEY=...`
  - optional: `AGENTS_FALLBACK_TO_PROXY=true`
  - optional: `CV_AGENT_ID` / `PS_AGENT_ID` / `REC_AGENT_ID` if you want `/api/create` to use prebuilt OpenAI Agents
  - optional: `REC_PROMPT_ID` / `REC_PROMPT_VERSION` to keep the recommendation flow mounted to a specific Prompt resource
- Run:
  - `uvicorn backend_fastapi.app.main:app --host 0.0.0.0 --port 8000`

2) Frontend (Nuxt)
- Set `.env`:
  - `FASTAPI_BASE_URL=http://127.0.0.1:8000`
  - `USE_AGENTS=true`
- Start:
  - `pnpm dev` in `site/`

### Endpoints
- FastAPI now serves: `/api/ai`, `/api/files/upload`, `/api/content-generate`, `/api/convert-to-md`, `/api/agent/act`.
- Frontend calls are unified to point at `FASTAPI_BASE_URL` when provided.

Agent endpoint notes:
- `POST /api/agent/act`: plans edits for the current document/selection.
  - Body: `{ clientId, docId, instruction, file_ids?, inline_text_snippets?, session_id? }`
  - Reads current editor state from Nuxt: `GET ${NUXT_BASE_URL}/api/editor-state?clientId=...` (sends `x-mcp-token` if `MCP_QUEUE_TOKEN` is set).
  - Uses OpenAI Responses API (`gpt-5`, reasoning medium) and returns JSON with `steps`, `targets`, `result`, `reasoning_summary`.

### Chatbot Settings UI
- Manage prompts at `site` route: `/admin/chatbot-settings`.
  - Per-type system prompts: keys `agent_act_system_prompt:{cv|ps|rec}`.
  - Per-type append prompts: keys `agent_act_global_append:{cv|ps|rec}`.
  - Global fallbacks: `agent_act_system_prompt`, `agent_act_global_append`.
  - Concatenation order per type: `agent_act_concat_order:{cv|ps|rec}` with JSON array of `"system"|"append"|"session"`.
  - Session prompt by id: `agent_act_session_prompt:{session_id}`.
- If backend sets `PROMPTS_ADMIN_TOKEN`, fill the Admin Token field so POST updates include `x-admin-token`.

### Removed Node endpoints
The following Nuxt server routes have been removed in favor of FastAPI:
- `site/src/server/api/ai.post.ts`
- `site/src/server/api/content-generate.post.ts`
- `site/src/server/api/convert-to-md.post.ts`

### Sessions
Requests include `use_agents: true` and a `session_id` (document scoped) to enable Agents SDK Sessions memory, per the official docs.

## Chatbot Integration

- Component: `site/src/components/shared/Chatbot.vue`
- API: Uses FastAPI `POST /api/agent/act` (agent endpoint; backend defaults to `gpt-5`).
- Editor state awareness: Chatbot includes `clientId` in the request body. The backend agent augments the model input by fetching the current editor selection/document from Nuxt `GET /api/editor-state?clientId=...`.
  - The editor periodically syncs selection/doc to Nuxt via `POST /api/editor-state` (see `site/src/components/edit/Editor.vue`).
  - If `MCP_QUEUE_TOKEN` is set, Nuxt APIs require header `x-mcp-token` for these editor-state endpoints (handled in the editor code).
- Conversation continuity: Chatbot passes a `session_id` (per-session) and, when available, a `previous_response_id` to `/api/agent/act` to improve follow-ups. Conversation is scoped by `docId` (the current resume id from `useDataStore().data.curResumeId`).
- File attachments: Chatbot uploads files to `POST /api/files/upload` and passes returned `file_ids` to `/api/agent/act`. Previews stream from `GET /api/files/content/{file_id}`.
- Visibility: The floating bubble is hidden on the homepage by default. Control via `runtimeConfig.public.chatbot.bubbleHiddenRoutes` in `site/nuxt.config.ts`.
- Base URL behavior: If `FASTAPI_BASE_URL` is set in `site/.env`, Chatbot hits that backend; otherwise it uses same-origin relative `/api/*` (suitable behind a reverse proxy).

## Prompt Management (Unified)

All system/user prompts are managed via a single SQLite table `prompts` (file: `backend_fastapi/conversations.db`). You can edit them from the UI or via REST.

- Backend CRUD APIs
  - List: `GET /api/prompts?prefix=<prefix>&exclude=<prefix_csv>`
  - Read: `GET /api/prompts/{key}`
  - Write: `POST /api/prompts/{key}` body: `{ value: string }` (protect with `PROMPTS_ADMIN_TOKEN` + `x-admin-token` if needed)

- Chatbot (ACT) keys and stitching
  - Final system prompt = join non-empty with blank lines:
    1) Base (by doc type): `agent_act_system_prompt:{cv|ps|rec}` → fallback `agent_act_system_prompt` → ENV file → repo root `{cv|ps|rec}_sys.md` → built-in
    2) Global append (optional): `agent_act_global_append:{cv|ps|rec}` → fallback `agent_act_global_append` → ENV file → empty
    3) Session-level (optional): `agent_act_session_prompt:{session_id}`
  - Doc type selection:
    - Frontend sends `doc_type` (from store/local metadata when available), else backend auto-detects from instruction/document.
  - UI entries:
    - Chatbot header: Gear = “Manage Chatbot Prompts” (edits `agent_*` keys)
    - Chatbot header: Notebook = “Session Prompt” (edits `agent_act_session_prompt:{session_id}`)

- PS (Personal Statement) prompts
  - System prompts for the 3 stages (DB-first, then fallback to built-ins):
    - `ps_system_element`, `ps_system_outline`, `ps_system_body`
  - Defaults content (non-system text templates) are still served by `GET /api/prompts/ps-defaults` but now prefer DB keys for:
    - `ps_requirement`, `guidance_outline`, `guidance_element`
  - Save via `POST /api/prompts/ps-defaults` (will write to DB when backend is configured, else fallback to filesystem)

- Toolbar prompts
  - System: `toolbar_system_prompt`
  - Default user prompt: `toolbar_default_prompt`
  - Both are DB-first with built-in fallbacks.

- Seeding / initialization
  - Script: `python backend_fastapi/scripts/seed_prompts.py`
    - Seeds:
      - `agent_act_system_prompt`, `agent_act_global_append`
      - `agent_act_system_prompt:{cv|ps|rec}` from root `cv_sys.md|ps_sys.md|rec_sys.md` if present
      - `ps_system_element|ps_system_outline|ps_system_body` (English defaults)
      - `toolbar_default_prompt|toolbar_system_prompt`

- Database (PS tables)
  - Created on backend start:
    - `ps_documents` (per-document, initially empty): `doc_id`, `info_program`, `info_ps_requirement`, `info_student_profile`, timestamps
    - `ps_settings` (global, initially empty): `key`, `value`, `updated_at` (can store `guidance_element`, `guidance_outline` if you prefer separate from `prompts`)

- PS system from files (one-off)
  - To overwrite PS three-stage system prompts from your own copy files in one go:
    - Option A (script):
      - `python backend_fastapi/scripts/seed_ps_system_from_files.py --element <path/to/element.md> --outline <path/to/outline.md> --body <path/to/body.md>`
      - Or set env `PS_SYSTEM_ELEMENT_FILE`, `PS_SYSTEM_OUTLINE_FILE`, `PS_SYSTEM_BODY_FILE` and run the script without args.
    - Option B (API):
      - `POST {FASTAPI}/api/prompts/seed-ps-system` with JSON body, any of:
        - `{ "element_file": "C:/.../element.md", "outline_file": ".../outline.md", "body_file": ".../body.md" }`
        - or raw text: `{ "element_text": "...", "outline_text": "...", "body_text": "..." }`
      - Protected by `PROMPTS_ADMIN_TOKEN` when set; include header `x-admin-token` to authorize.

- ENV overrides for file-based fallbacks (optional)
  - ACT base: `AGENT_ACT_PROMPT_FILE_{CV|PS|REC}` → `AGENT_ACT_PROMPT_FILE`
  - ACT append: `AGENT_ACT_APPEND_FILE_{CV|PS|REC}` → `AGENT_ACT_APPEND_FILE`

Tip: Prefer editing from the UI “管理提示词” dialogs. For Chatbot-specific keys, use the Chatbot’s gear button; for all other keys (PS/Toolbar/REC), use the “管理提示词” buttons on the home and document pages (left of Save/Save As).
