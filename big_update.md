# Document Creation Queue & Batch Creation Refactor

## 背景
当前 `NewResume.vue` 中的 CV/PS/Rec 创建流程直接在前端串行执行：
- 单次创建点击后立即调用后端接口，等待响应
- 完成后自动跳转到编辑页并刷新单个文档
- 没有并发控制或任务排队能力，也不支持多文档批量创建

新的需求需要：
1. 点击“确定”后进入一个可见的队列/任务列表（一次最多同时执行 5 个任务，后续可升级）。
2. 支持批量创建：多文件上传，每个文件生成一个任务，根据用户选的文档类型执行。
3. 创建完成后不自动跳转，而是保持当前页面，前端列表自动刷新并允许用户自行打开文档。
4. 使用默认用户 ID `1`（未来会接入用户系统）。

## 拟定工作拆解

### 1. 通用任务队列能力
- 新建 `site/src/composables/docCreationQueue.ts`：
  - 维护任务列表、状态、每用户并发限制（初始 5）。
  - 提供 `enqueue(userId, type, title, runner)`，返回任务 ID。
  - Runner 通过回调 `ctx.update(message)` 实时更新任务状态。
  - 任务完成后记下相关文档 ID，并在 15 秒后自动从列表移除。
- 广播任务完成事件（例如 `useEventBus('resumes:created')`）以便其它组件刷新。

### 2. 重构单文档创建流程
- 在 `NewResume.vue` 中：
  - 将 CV / PS / Rec 的创建逻辑拆分成独立的 runner 函数；
  - 原本直接 `$fetch`、`router.push` 的流程改为调用队列；
  - 取消加载遮罩，改为显示队列状态卡片（包括排队中/执行中/成功/失败信息）；
  - 任务完成后触发 `resumes:created` 事件，刷新列表。
- `ResumeItem` 列表页监听事件（或使用 store）以重新拉取 `getResumeList()`。

### 3. 批量创建入口
- UI：
  - 在创建弹窗中，添加可选择多文件的批量模式。
  - 描述批量模式较慢、最多并发 5 的提示。
- 逻辑：
  - 每个上传文件（支持 pdf/doc/docx/md/txt 等）创建独立任务。
  - 共享同一提示词（与单次一致）；根据类型走对应 runner。
  - 队列中每个任务仍受并发上限限制。

### 4. 列表刷新 & 交互优化
- 首页 `site/src/pages/[...lang]/index.vue`：
  - 监听 `resumes:created`，完成后重新执行 `getResumeList()`。
- 可能的话在任务列表中提供“查看详情 / 打开文档”按钮，便于用户快速进入。

### 5. 后续考虑
- 将用户 ID 从常量改为登录用户。
- 将队列任务持久化或放到后端统一管理（目前方案先在前端实现）。
- 结合后端批量 API（若后端可接受批量请求）。

## 预估改动区域
- `site/src/composables/docCreationQueue.ts`（新文件）
- `site/src/components/resumes/NewResume.vue`
- `site/src/pages/[...lang]/index.vue`
- 可能触及：
  - `site/src/components/resumes/ResumeItem.vue` / `ResumeOptions.vue`
  - `site/src/utils/database.ts`（如需补充批量保存逻辑）
  - `site/src/composables/toast.ts`（新增提示类型）

## 风险 & 回滚策略
- 现有创建逻辑复杂：拆分时要防止漏掉 Chatbot 消息、PS 双文档元数据、文件解析等细节。
- 建议分阶段提交，每个阶段确保现有功能不回归：
  1. 引入队列但保留原单任务流程（使用开关或备用路径）。
  2. 全量切换单任务到队列。
  3. 新增批量模式。
- 若出现阻塞，可暂时保留旧流程作为 fallback。

## 当前进展
- [x] 实现前端队列能力，PS/CV/Rec 创建均通过 `useDocCreationQueue` 排队并在完成后触发 `resumes:created` 自动刷新列表。
- [x] `NewResume.vue` 重构为队列任务：保留原生成逻辑为 runner，并提供队列状态面板。
- [x] 添加批量模式（PS/CV/Rec）：多文件上传自动拆分任务，复用相同提示信息，可与队列并发约束协同工作。
- [ ] 后端持久化与真实用户 ID 仍待接入。
