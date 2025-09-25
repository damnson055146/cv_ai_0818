# PS 文档生成的提示词位置与说明

本项目中，PS（Personal Statement）相关的“提示词/规则”由两部分组成：一部分是可配置的基础指引文本（从外部 Markdown 文件读取），另一部分是在生成流程中内置的 system 提示模板。

## 基础指引文本（可配置文件）
- 配置入口：`site/nuxt.config.ts:105` 下的 `runtimeConfig.public.psPrompts`
  - `baseDir`：指向提示词文件所在目录（默认）
    - C:\Users\PSJ\Desktop\bridge_to_future\cursor_ps_test\ps_test(1)\ps_test
  - `files`：三类文件的文件名映射
    - `ps_requirement` → 申请要求/写作范围提示（如 info_ps_requirement.md）
    - `guidance_outline` → 大纲写作指导（如 guidance_outline.md）
    - `guidance_element` → 素材要素提炼指导（如 guidance_element.md）

- 读取位置：`site/src/server/api/prompts/ps-defaults.get.ts:1`
  - 服务端通过上面的 `baseDir + files.*` 按需读取三段提示词，返回给前端。

- 更新位置：`site/src/server/api/prompts/ps-defaults.post.ts:1`
  - 支持通过 POST 写回上述三个文件（可部分更新）。

- 前端使用：`site/src/composables/psPrompts.ts:12`
  - 通过 `GET /api/prompts/ps-defaults` 拉取三段文本，并附带两个前缀：
    - `outline_prefix`: "[PS-OUTLINE]\nYou are drafting a PS outline only. Output structure and bullet points."
    - `body_prefix`: "[PS-BODY]\nYou are drafting the PS body text. Strictly follow the given outline."

以上三个可配置 Markdown 文件（当前默认路径）
- C:\Users\PSJ\Desktop\bridge_to_future\cursor_ps_test\ps_test(1)\ps_test\info_ps_requirement.md
- C:\Users\PSJ\Desktop\bridge_to_future\cursor_ps_test\ps_test(1)\ps_test\guidance_outline.md
- C:\Users\PSJ\Desktop\bridge_to_future\cursor_ps_test\ps_test(1)\ps_test\guidance_element.md

## 生成流程内置的 system 提示（代码内）
位置：`site/src/server/api/ps/seed-from-upload.post.ts`
- `elementSystem`（第 41 行）：用于“素材要素整理”阶段的 system 提示
  - 要求按章节提炼：Motivation; Pre‑Knowledge; Experience; Why Master’s; Why This Program; Career Plan
  - 产出纯文本、带清晰小标题与要点；不得臆造信息；语言根据 `language` 参数在中/英切换
- `outlineSystem`（第 59 行）：用于“大纲生成”的 system 提示
  - 仅输出编号结构与小标题要点，不写正文
  - 章节需覆盖与上面一致的六大块，语言中/英切换
- `bodySystem`（第 72 行）：用于“正文撰写”的 system 提示
  - 严格遵循给定大纲，段落精炼，不得臆造信息（缺失处允许占位或跳过），语言中/英切换

上述三段 system 提示与外部三段可配置文本（requirement/outline/element）一起，构成 PS 文档生成链路：元素提炼 → 大纲 → 正文。

