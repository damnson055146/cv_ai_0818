# CV AI

## 项目概览
- Nuxt 3 (Vite + UnoCSS + Pinia) 构建的在线 Markdown 简历编辑器，内置聊天、AI 工具与多语言支持。
- FastAPI 服务封装 OpenAI Agents/Responses API，用于文档生成、翻译、文件上传等能力。
- packages/ 目录提供共享 TypeScript 工具库（tsup 构建），减少前端与脚本的重复实现。
- SQLite 数据库 `backend_fastapi/conversations.db` 存放提示词、PS 配置和聊天缓存，应用启动时自动建表。

## 主要目录
- `site/` Nuxt 前端源码（组件、Pinia store、server/api 中间层、i18n 配置）。
- `backend_fastapi/` FastAPI 服务，入口 `app/main.py`，业务路由在 `agent.py` 与 `toolbar_ai.py`。
- `packages/` Markdown、字体、格式化等工具包，运行 `pnpm build:pkg` 编译。
- `logs/` 默认存放 `rec_create.log` 等后端生成的调试日志。

## 快速开始
- `pnpm install && pnpm build:pkg` 安装依赖并构建共享包。
- `pnpm dev --filter site` 启动 Nuxt 开发服务器（默认端口 3000）。
- `pip install -r backend_fastapi/requirements.txt` 安装 FastAPI 所需依赖。
- `uvicorn backend_fastapi.app.main:app --host 0.0.0.0 --port 8000` 启动后端接口。
- 在 `site/.env` 中设置 `FASTAPI_BASE_URL=http://127.0.0.1:8000`，前端会将 `/api/*` 调用转发至后端。

## 环境变量速览
- 后端：`OPENAI_API_KEY`（必填）、`FASTAPI_CORS_ALLOW_ORIGINS`（逗号分隔来源，默认允许本地 3000）、`DEFAULT_FASTAPI_MODEL`、`CV_AGENT_ID` / `PS_AGENT_ID` / `REC_AGENT_ID`（可选 Agents 模式）。
- 后端可选：`REC_PROMPT_ID` / `REC_PROMPT_VERSION`、`CV_PROMPT_ID` / `CV_PROMPT_VERSION`、`CREATE_TIMEOUT` 控制调用 OpenAI Responses 的模型与超时。
- 前端：`FASTAPI_BASE_URL`（指向 FastAPI 服务）、`USE_AGENTS`、`MCP_QUEUE_TOKEN`（保护 `/api/editor-state` 与 `/api/editor-commands`），`NUXT_APP_BASE_URL` 用于部署场景。
- 前端可选：`NUXT_PUBLIC_GOOGLE_FONTS_KEY`、`SILICON_FLOW_API_KEY` / `SILICON_FLOW_BASE_URL` / `SILICON_FLOW_MODEL`、`PS_PROMPTS_BASE_DIR` 及文件名覆盖本地 PS 模板。

## 后端 API（FastAPI）
| Method | Path | 功能 | 请求 | 响应 | 实现 |
| --- | --- | --- | --- | --- | --- |
| POST | /api/agent/act | 编辑代理生成步骤、目标与候选结果 | `{"clientId":string,"instruction":string,"docId"?:string,"selection"?:object,"file_ids"?:string[],"inline_text_snippets"?:string[],"session_id"?:string,"previous_response_id"?:string,"doc_type"?:string}` | 成功 `{"ok":true,"preview":{"result":string,"targets"?:any[]},"steps"?:string[],"reasoning_summary"?:string,"step_details"?:any[],"raw_text"?:string,"meta":{"response_id"?:string,"session_id"?:string}}`；失败 `{"ok":false,"error":...}` | `backend_fastapi/app/agent.py:81` |
| POST | /api/create | 通用文档生成（doc_type=rec/ps） | `{"doc_type":"rec"|"ps","prompt"?:string,"language"?:string,"file_ids"?:string[],"max_output_tokens"?:number,"reasoning_effort"?:string}` | `{"status":"ok","raw":any,"output_text":string,"others":{"material"?:string,"outline"?:string,"checks"?:object,"result"?:object,"reasoning_summary"?:string,"steps"?:list}}` | `backend_fastapi/app/main.py:1158` |
| POST | /api/rec/create | 推荐信生成旧路径（委托 /api/create） | 同上但 `doc_type` 固定 `rec` | 同上 | `backend_fastapi/app/main.py:1145` |
| POST | /api/cv/create | 简历 Markdown 生成 | `{"prompt":string,"language"?:string,"file_ids"?:string[],"max_output_tokens"?:number,"reasoning_effort"?:string}` | 成功 `{"result":string}`（Markdown），失败返回 HTTP 错误 | `backend_fastapi/app/main.py:1152` |
| POST | /api/translate | 中文/英文互译 | `{"text":string,"target"?:("zh"|"en")}` | `{"ok":true,"text":string}`（失败返回 HTTP 4xx） | `backend_fastapi/app/main.py:1170` |
| POST | /api/files/upload | 将 Base64 文件上传到 OpenAI Files | `{"name":string,"contentBase64":string,"contentType"?:string,"purpose"?:string}` | `{"status":"ok","file":{...OpenAI file...}}` | `backend_fastapi/app/main.py:205` |
| GET | /api/files/meta/{file_id} | 查询 OpenAI 文件元信息 | 路径参数 `file_id` | 透传 OpenAI JSON；错误抛 HTTPException | `backend_fastapi/app/main.py:218` |
| GET | /api/files/content/{file_id} | 下载 OpenAI 文件内容 | 路径参数 `file_id` | 以流形式返回二进制内容 | `backend_fastapi/app/main.py:235` |
| GET | /api/prompts | 列出已保存的提示词 key | 查询参数 `prefix`、`exclude`（可选） | `{"ok":true,"items":[{"key":string,"updated_at":string},...]}` | `backend_fastapi/app/agent.py:546` |
| GET | /api/prompts/{key} | 读取指定提示词 | 路径参数 `key` | `{"ok":true,"key":string,"value":string|null}` | `backend_fastapi/app/agent.py:527` |
| POST | /api/prompts/{key} | 写入提示词内容 | `{"value":string}`，需 `x-admin-token`（若配置 `PROMPTS_ADMIN_TOKEN`） | `{"ok":true}` | `backend_fastapi/app/agent.py:534` |
| POST | /api/prompts/seed-ps-system | 批量导入 PS 系统提示词 | `{"element_file"?:string,"outline_file"?:string,"body_file"?:string,"element_text"?:string,"outline_text"?:string,"body_text"?:string}` | `{"ok":true,"saved":number}`（至少保存 1 项，否则 400） | `backend_fastapi/app/agent.py:555` |
| GET | /api/toolbar/presets | 获取 AI 工具栏默认提示词 | 无请求体 | `{"presets":[{"name":string,"prompt":string}]}` | `backend_fastapi/app/toolbar_ai.py:118` |
| POST | /api/toolbar/rewrite | AI 工具栏改写选区 | `{"selection":string,"prompt"?:string,"max_tokens"?:number,"reasoning_effort"?:string}` | `{"status":"ok","text":string,"raw":any,"provider":string,"prompt":string}` | `backend_fastapi/app/toolbar_ai.py:127` |

说明：表中 `selection` 结构与 Nuxt `/api/editor-state` 返回一致，包括 `hasSelection`、`text`、`start`、`end` 等字段。所有 FastAPI 接口在错误时会抛出 `HTTPException`，前端收到的 JSON 位于 `{"detail":...}` 中。

## Nuxt Server API（前端中间层）
| Method | Path | 功能 | 请求 | 响应 | 实现 |
| --- | --- | --- | --- | --- | --- |
| GET | /api/editor-state | 返回编辑器缓存的选区和文档内容 | 查询参数 `clientId`，可选 Header `x-mcp-token` | `{"ok":true,"selection":{...},"doc":string,"updatedAt":number}` | `site/src/server/api/editor-state.get.ts:23` |
| POST | /api/editor-state | 更新缓存的选区与文档 | `{"clientId":string,"selection":{...},"doc"?:string}`，可选 Header `x-mcp-token` | `{"ok":true}` | `site/src/server/api/editor-state.post.ts:25` |
| GET | /api/editor-commands | 拉取待执行的编辑命令 | 查询 `clientId`，可选 Header `x-mcp-token` | `{"ok":true,"commands":array}`，读取后自动清空队列 | `site/src/server/api/editor-commands.get.ts:23` |
| POST | /api/editor-commands | 入队编辑命令 | `{"clientId":string,"command":{ type:"replace"|"smart_edit"|"select", ... }}` | `{"ok":true,"queued":number}` | `site/src/server/api/editor-commands.post.ts:32` |
| POST | /api/mcp | JSON-RPC 适配 MCP 工具（封装 editor-state/commands） | JSON-RPC 2.0 请求，支持 `tools/list`、`tools/call` | JSON-RPC 响应或错误对象，尊重 `x-mcp-token` | `site/src/server/api/mcp.post.ts:19` |
| POST | /api/ps/seed-from-upload | 依据上传文本生成 PS 素材/大纲/正文草案 | `{"chatId"?:string,"language"?:string,"uploadText"?:string,"projectInfo"?:string,"studentInfo"?:string}` | `{"status":"ok","data":{"elements":string,"outline":string,"body":string}}` 或错误 | `site/src/server/api/ps/seed-from-upload.post.ts:8` |
| GET | /api/prompts/ps-defaults | 读取 PS 默认模板（优先后端，再落地文件） | 无请求体 | `{"status":"ok","data":{"ps_requirement":string,"guidance_outline":string,"guidance_element":string}}` | `site/src/server/api/prompts/ps-defaults.get.ts:5` |
| POST | /api/prompts/ps-defaults | 保存 PS 模板（优先写后端，再写文件） | `{"ps_requirement"?:string,"guidance_outline"?:string,"guidance_element"?:string}` | `{"status":"ok"}` 或报错 | `site/src/server/api/prompts/ps-defaults.post.ts:5` |
| POST | /api/siliconflow | 代理调用硅基流动 Chat Completions | 与 OpenAI 兼容的 `{"model":string,"messages":[...],"temperature"?:number,...}` | 透传硅基流动响应或 `{"error":...}` | `site/src/server/api/siliconflow.post.ts:11` |
| POST | /api/html-to-docx | 将 HTML 转换为 DOCX Base64 | `{"html":string,"options"?:object}` | `{"ok":true,"base64":string}` | `site/src/server/api/html-to-docx.post.ts:1` |
| POST | /api/intent-parse | 本地意图解析占位实现 | `{"template"?:string,"context"?:any}` | `{"status":"ok","intent":{...}}` 或 `{"status":"error","error":string}` | `site/src/server/api/intent-parse.post.ts:1` |
| GET | /api/health | 健康检查 | 无请求体 | `{"ok":true,"time":number}` | `site/src/server/api/health.get.ts:1` |
| GET | /api/ping | 简单连通性检测 | 无请求体 | `{"ok":true,"msg":"pong from src/server/api"}` | `site/src/server/api/ping.get.ts:1` |

这些 Nuxt API 会根据 `FASTAPI_BASE_URL` 决定是否转发到后端；当 `MCP_QUEUE_TOKEN` 存在时需携带 `x-mcp-token` Header。

## 前后端协同要点
- `site/src/components/shared/Chatbot.vue` 通过 `/api/agent/act` 与 FastAPI 交互，使用 `/api/files/*` 上传/预览附件，并将编辑器选区缓存到 `/api/editor-state`。
- `site/src/components/edit/toolbar/AiToolbar.vue` 调用 `/api/toolbar/presets` 与 `/api/toolbar/rewrite` 提供选区改写，同时在本地存储自定义预设。
- FastAPI 在生成文档时会根据 `doc_type` 读取数据库或根目录下的 `cv_sys.md`、`ps_sys.md`、`rec_gen.md`，并将请求/响应记录到 `logs/rec_create.log`。
- Nuxt server API 提供 `editor-commands` 队列，便于后端或 MCP 工具回写编辑器；命令消费后即被清空。

## 数据与日志
- 提示词、PS 设置、聊天记忆均保存在 `backend_fastapi/conversations.db`，通过 `app/db.py` 自动迁移。
- 文件上传直接落在 OpenAI Files，响应中返回的 `file.id` 用于后续 `/api/files/meta|content` 调用。
- 后端日志默认写入 `logs/rec_create.log`，可通过 `REC_CREATE_LOG_PATH` 自定义位置。

## 开发调试建议
- `pnpm lint`（根目录）确保前端代码通过 ESLint/Prettier。
- `pnpm typecheck --filter site` 可在提交前跑一次 Nuxt TypeScript 检查。
- 使用 `curl` 或 `httpie` 对 FastAPI 端点（如 `/api/create`、`/api/agent/act`）做手动回归，以确认 OpenAI Key、Prompt ID 等配置正确。
- 若新增命令或接口，更新 `README.md` 与相关脚本（如 `backend_fastapi/scripts/seed_prompts.py`）保持文档一致。
