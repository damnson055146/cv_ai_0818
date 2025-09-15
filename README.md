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
- Run:
  - `uvicorn backend_fastapi.app.main:app --host 0.0.0.0 --port 8000`

2) Frontend (Nuxt)
- Set `.env`:
  - `FASTAPI_BASE_URL=http://127.0.0.1:8000`
  - `USE_AGENTS=true`
- Start:
  - `pnpm dev` in `site/`

### Endpoints
- FastAPI now serves: `/api/ai`, `/api/files/upload`, `/api/content-generate`, `/api/convert-to-md`.
- Frontend calls are unified to point at `FASTAPI_BASE_URL` when provided.

### Removed Node endpoints
The following Nuxt server routes have been removed in favor of FastAPI:
- `site/src/server/api/ai.post.ts`
- `site/src/server/api/content-generate.post.ts`
- `site/src/server/api/convert-to-md.post.ts`

### Sessions
Requests include `use_agents: true` and a `session_id` (document scoped) to enable Agents SDK Sessions memory, per the official docs.

