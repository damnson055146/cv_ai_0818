# Repository Guidelines

## Project Structure & Modules
- `site/` — Nuxt 3 frontend (Vue, Vite, UnoCSS).
- `backend_fastapi/` — FastAPI service (`app/main.py`, `requirements.txt`).
- `packages/` — TypeScript utility libraries (built with `tsup`).
- `docs/`, `github/` — documentation and CI, if present.
- Root workspace uses `pnpm` with `pnpm-workspace.yaml`.

## Build, Run, Develop
- Install deps (root workspace): `pnpm install`
- Build shared packages: `pnpm build:pkg`
- Frontend dev server (Nuxt): `pnpm dev` (serves `site/` on port 3000)
- Frontend build/preview: `pnpm build` then `pnpm serve`
- Backend setup: `pip install -r backend_fastapi/requirements.txt`
- Backend run: `uvicorn backend_fastapi.app.main:app --host 0.0.0.0 --port 8000`

## Coding Style & Naming
- TypeScript/JS: follow ESLint + Prettier configs (`eslint.config.js`, `@renovamen/prettier-config`). Use 2‑space indent, `camelCase` for vars/functions, `PascalCase` for Vue/Nuxt components, `kebab-case` for file names.
- Python (FastAPI): follow PEP8 (4‑space indent). Keep endpoints in routers; avoid large functions.
- Import from workspace packages rather than duplicating utilities.

## Testing Guidelines
- No formal test suite is included yet. Validate changes by:
  - Linting: `pnpm lint`
  - Type checks where relevant (packages/site): keep types strict and fix TS warnings before PR.
  - Manual API checks: hit FastAPI endpoints (e.g., `/api/ai`) via the frontend or `curl`.

## Commit & Pull Requests
- Prefer Conventional Commits where possible: `feat:`, `fix:`, `chore:`, `docs:`.
- Write actionable messages in present tense (e.g., `fix: handle CORS for dev`).
- PRs should include: purpose, scope, screenshots (UI), and reproduction steps. Reference related issues.

## Security & Configuration
- Do not commit secrets. Use `.env` files (see `env.example`).
- Frontend: set `FASTAPI_BASE_URL` and `USE_AGENTS` in `site/.env`.
- Google Fonts: `NUXT_PUBLIC_GOOGLE_FONTS_KEY` in `site/.env`.
- Backend: set `OPENAI_API_KEY` and optional `FASTAPI_CORS_ALLOW_ORIGINS` in `backend_fastapi/.env`.

## Agent Notes
- Keep changes scoped; align with existing structure and naming.
- Update README or docs when adding commands, envs, or endpoints.
