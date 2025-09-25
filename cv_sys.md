# CV 文档生成/编辑的提示词位置与说明

本项目的“CV/简历”没有单独的 cv 默认提示词文件；简历的 AI 生成/编辑依赖通用的 Chatbot 规划代理（planning agent）的 system 提示词，以及用户在工具栏/对话中输入的具体指令。初始文档内容来自内置模板（非提示词）。

## Chatbot 规划代理的 system 提示词
- 代码位置：`backend_fastapi/app/agent.py:119`
  - 默认 system 提示词（节选原文）：
    - You are an edit-planning agent for a Markdown/code editor. Work step-by-step with short, audit-friendly reasoning (no chain-of-thought). Operate conservatively: preserve structure, formatting, placeholders, and author voice. Interpret the user's instruction and decide WHAT to reference and WHERE to modify: (1) If a selection is provided, use it as the primary focus; (2) Otherwise, locate the most relevant sections (e.g., heading, first paragraph, experience bullets, matching keywords); (3) When needed, reference the broader document for consistency. Always provide a non-empty revised candidate for 'result' (even a minimal, safe polishing). Return a JSON object with: steps (string[]), targets (object[]), result (string), reasoning_summary (string), and optionally step_details (array). Each step_details item may include: title, analysis, decision, evidence (array of brief strings referencing the selection/document snippets). Do not include any text outside of the JSON object.

- 组合方式（按优先级拼接）：
  - 数据库键值（SQLite）：
    - 基础：`agent_act_system_prompt`（`PROMPT_KEY_AGENT_ACT`，见 `backend_fastapi/app/agent.py:16`）
    - 全局追加：`agent_act_global_append`（见 `backend_fastapi/app/agent.py:17`）
    - 会话追加：`agent_act_session_prompt:{session_id}`
  - 文件覆盖（环境变量）：
    - `AGENT_ACT_PROMPT_FILE`、`AGENT_ACT_APPEND_FILE`（见 `backend_fastapi/app/agent.py:144`）
  - 取值顺序：DB → 文件 → 内置默认文案

- 管理接口（供前端使用）：
  - 列表：`GET /api/prompts`
  - 读取：`GET /api/prompts/{key}`
  - 写入：`POST /api/prompts/{key}`
  - 前端管理界面：`site/src/components/shared/PromptManager.vue:1`

以上即为“CV 文档生成/编辑”时 Chatbot 使用的核心提示词来源（全局通用，适用于简历、PS、推荐信等文档的编辑/生成规划）。

## 简历模板（非提示词）
- 初始英文模板内容：`site/src/utils/constants/default.ts` 中的 `DEFAULT_MD_CONTENT`
- 简历模板入口与键：`site/src/utils/constants/templates.ts:23`（`DEFAULT_TEMPLATE_KEY = "cv-en"`），其中也包含中文简历示例 `MD_CV_ZH`
- 说明：这些是文档初始内容模板，并非 AI 提示词。后续的 AI 编辑/生成依赖上文的 Chatbot system 提示词与用户指令。

## 备注：工具栏预设
- 编辑器 AI 工具栏支持“提示词预设”（用户自定义）。前端尝试从 `GET /api/toolbar/presets` 拉取预设（见 `site/src/components/edit/toolbar/AiToolbar.vue:336`）。该接口可按需在服务端实现，用于给简历编辑提供常用提示词片段，但它不是固定的“cv 默认提示词”。
