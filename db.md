**数据库概览**
- 引擎：SQLite（单文件数据库）。
- 路径：`backend_fastapi/conversations.db`（后端启动时自动创建）。
- 初始化：`backend_fastapi/app/main.py` 在应用启动时调用 `ensure_prompts_table()` 与 `ensure_ps_tables()`。

**数据表：prompts**
- 作用：统一存放可配置提示词及相关键值（Chatbot/PS/Toolbar/REC 等）。
- 结构（SQLite）：
  - `key` TEXT PRIMARY KEY
  - `value` TEXT NOT NULL
  - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- 典型键：
  - Chatbot 系统与拼接：`agent_act_system_prompt`、`agent_act_system_prompt:{cv|ps|rec}`、`agent_act_global_append`、`agent_act_concat_order:{cv|ps|rec}`、`agent_act_session_prompt:{session_id}`
  - PS 三阶段系统提示：`ps_system_element`、`ps_system_outline`、`ps_system_body`
  - PS 默认文案（优先 DB）：`ps_requirement`、`guidance_outline`、`guidance_element`
  - 其他：`rec_prompt_main`、`toolbar_system_prompt`、`toolbar_default_prompt` 等

**数据表：ps_documents（按文档）**
- 作用：保存单个 PS 文档在“创建/上传”时关联的可变信息。
- 结构（SQLite）：
  - `doc_id` TEXT PRIMARY KEY（与前端文档 ID 对应）
  - `info_program` TEXT（项目信息）
  - `info_ps_requirement` TEXT（申请要求/写作范围）
  - `info_student_profile` TEXT（学生画像摘要）
  - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**数据表：ps_settings（全局 PS 设置）**
- 作用：集中存放全局可调的 PS 提示（例如 `guidance_element`、`guidance_outline`）。
- 结构（SQLite）：
  - `key` TEXT PRIMARY KEY
  - `value` TEXT NOT NULL
  - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- 说明：当前前后端已支持通过 `prompts` 表管理这些键；`ps_settings` 为未来分离做准备，二者并存不冲突。

**后端接口（FastAPI）**
- `POST /api/agent/act`
  - 入参（JSON）：`clientId`(string, 必填)、`docId`(string)、`instruction`(string, 必填)、`file_ids`(string[])、`inline_text_snippets`(string[])、`session_id`(string)、`previous_response_id`(string)、`doc_type`("cv"|"ps"|"rec")
  - 说明：系统提示拼接顺序可配置，使用 `agent_act_concat_order:{cv|ps|rec}` 或全局 `agent_act_concat_order`（JSON 数组，取值 `system|append|session`）。
  - 返回：`{ ok, preview:{ targets, result }, steps, reasoning_summary, step_details?, raw_text, meta:{ response_id, session_id } }`
- `GET /api/prompts`
  - 参数：`prefix`(string, 可选)、`exclude`(string, 逗号分隔，可选)
  - 返回：`{ ok, items: [{ key, updated_at }, ...] }`
- `GET /api/prompts/{key}`
  - 返回：`{ ok, key, value }`
- `POST /api/prompts/{key}`
  - 入参（JSON）：`{ value: string }`
  - 认证：当设置了环境变量 `PROMPTS_ADMIN_TOKEN` 时，需要请求头 `x-admin-token`。
  - 效果：写入/更新 `prompts(key,value)`。
- `POST /api/prompts/seed-ps-system`
  - 作用：一次性把 PS 三阶段系统提示词写入 DB（键：`ps_system_element|ps_system_outline|ps_system_body`）。
  - 入参（JSON，三选其一或混用）：
    - 文件路径：`element_file`、`outline_file`、`body_file`（可绝对或以仓库根为相对）
    - 直接文本：`element_text`、`outline_text`、`body_text`
    - 环境变量兜底：`PS_SYSTEM_ELEMENT_FILE`、`PS_SYSTEM_OUTLINE_FILE`、`PS_SYSTEM_BODY_FILE`
  - 认证：同 `x-admin-token` 规则。
  - 返回：`{ ok: true, saved: <1..3> }`
- 文件上传与访问（用于 Chatbot 附件）：
  - `POST /api/files/upload`（字段：`name`、`contentBase64`、`contentType`、`purpose`）
  - `GET /api/files/meta/{file_id}`、`GET /api/files/content/{file_id}`

**Nuxt 内部接口（前端服务端路由）**
- `GET /api/prompts/ps-defaults`
  - 优先从后端 `prompts` 读取 `ps_requirement`、`guidance_outline`、`guidance_element`；否则按 `nuxt.config.ts` 的 `runtimeConfig.public.psPrompts` 从文件读取。
  - 返回：`{ status: 'ok', data: { ps_requirement, guidance_outline, guidance_element } }`
- `POST /api/prompts/ps-defaults`
  - 有后端时优先写入后端 `prompts`；否则写回到配置的文件路径。
  - 入参（JSON，允许部分更新）：`{ ps_requirement?: string, guidance_outline?: string, guidance_element?: string }`

**环境变量与安全**
- `PROMPTS_ADMIN_TOKEN`：设置后，`POST /api/prompts/{key}` 与 `POST /api/prompts/seed-ps-system` 需要头 `x-admin-token`。
- `PS_SYSTEM_ELEMENT_FILE` / `PS_SYSTEM_OUTLINE_FILE` / `PS_SYSTEM_BODY_FILE`：PS 三阶段系统提示词的文件路径（用于种子导入）。
- `FASTAPI_CORS_ALLOW_ORIGINS`：后端 CORS 白名单。
- `OPENAI_API_KEY`：文件上传代理与 Chatbot 上游调用需要。

**字段类型说明**
- SQLite `TEXT`：UTF‑8 文本，不限长度（受 SQLite 单行/页大小限制）。
- `TIMESTAMP`：默认 `CURRENT_TIMESTAMP`（UTC），应用层更新时需自行写入更新。
- 主键唯一：`prompts.key`、`ps_documents.doc_id`、`ps_settings.key`。

