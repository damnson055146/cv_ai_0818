<template>
  <Teleport to="body">
    <!-- Floating bubble -->
    <button
      v-if="!isOpen && mounted && !isHiddenByRoute"
      class="fixed z-50 circle size-14 bg-gray-800 text-white shadow-c border border-darker-c select-none"
      title="Chatbot"
      :style="{ right: '16px', bottom: '16px' }"
      @click="toggleOpen"
    >
      <span class="i-ph:chat-circle-text-duotone text-2xl" />
    </button>

    <!-- Panel -->
    <div
      v-if="isOpen && mounted && !isHiddenByRoute"
      class="fixed z-50 bg-c text-c shadow-c border border-c rounded-xl overflow-hidden flex flex-col"
      :style="{ right: '16px', bottom: '16px', width: '500px', height: '70vh' }"
    >
      <!-- Header -->
      <div class="hstack justify-between px-3 py-2 border-b border-light-c bg-dark-c">
        <div class="hstack space-x-2">
          <span class="i-ph:chat-circle-text-duotone text-xl text-gray-500" />
          <div class="leading-tight">
            <div class="text-dark-c text-sm font-700">Chatbot</div>
            <div class="text-xs opacity-60">{{ modelLabel }}</div>
          </div>
        </div>
        <div class="hstack space-x-1">
          <!-- Prompt settings: manage cv/ps/rec prompts + concat order -->
          <!-- Only Chatbot disables outside click + enables drag; others keep defaults -->
          <Dialog id="manage-prompts-chatbot" title="Prompt Settings" icon="i-ph:gear" box-class="w-full md:w-140" :closeOnBackdrop="false" :draggable="true">
            <template #button>
              <button class="round-btn" title="Prompt Settings">
                <span class="i-ph:gear-six" />
              </button>
            </template>
            <template #content>
              <div class="p-3 border border-light-c rounded-md overflow-y-auto" style="max-height: 65vh;">
                <PromptSettings />
              </div>
            </template>
          </Dialog>
          <!-- Session-level prompt editor -->
          <Dialog id="manage-session-prompt" title="Session Prompt" icon="i-ph:note" box-class="w-full md:w-120" :closeOnBackdrop="false" :draggable="true">
            <template #button>
              <button class="round-btn" title="Session Prompt" @click="loadSessionPrompt">
                <span class="i-ph:note-pencil" />
              </button>
            </template>
            <template #content>
              <div class="space-y-2 p-3 border border-light-c rounded-md overflow-y-auto" style="max-height: 65vh;">
                <div class="text-xs opacity-70">Session key: {{ sessionPromptKey }}</div>
                <textarea v-model="sessionPrompt" class="w-full h-36 rounded border border-light-c p-2 text-xs font-mono" placeholder="Session-level system prompt. Appends after global."></textarea>
                <div class="flex justify-end gap-2">
                  <button class="rect-btn px-3 py-1 border border-light-c" :disabled="sessionSaving" @click="saveSessionPrompt">Save</button>
                </div>
              </div>
            </template>
          </Dialog>
          <label class="round-btn" title="Attach files">
            <input ref="fileInput" type="file" class="hidden" multiple @change="onPickFiles" />
            <span class="i-ph:paperclip-duotone" />
          </label>
          <button class="round-btn" title="Minimize" @click="toggleOpen">
            <span class="i-ph:minus-circle-duotone" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="scrollRef" class="flex-1 px-4 py-4 space-y-3 overflow-y-auto bg-c">
        <div v-if="attachments.length" class="text-xs opacity-70">
          <div class="mb-1 font-600">Attachments</div>
          <ul class="space-y-1">
            <li v-for="a in attachments" :key="a.localId" class="flex items-center gap-2">
              <span class="i-ph:file-duotone" />
              <span class="truncate">{{ a.name }}</span>
              <span v-if="a.status==='uploading'" class="opacity-60">(uploading {{ a.progress }}%)</span>
              <a v-if="a.fileId" :href="filePreviewUrl(a.fileId)" target="_blank" class="text-blue-600 hover:underline">open</a>
            </li>
          </ul>
        </div>

        <div v-for="m in messages" :key="m.id" class="w-full">
          <div v-if="m.role === 'assistant'" class="w-full">
            <template v-if="hasCursorView(m)">
              <div class="max-w-4/5 md:max-w-3/4 bg-gray-100 dark:bg-slate-600 border border-light-c rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap">
                {{ m.preview?.result || m.content }}
              </div>
              <details v-if="m.reasoningSummary" class="accordion mt-1">
                <summary class="accordion-summary">
                  <span class="caret i-ph:caret-right mr-1" /> 推理摘要 · Summary
                </summary>
                <div class="accordion-body text-xs leading-relaxed whitespace-pre-wrap">
                  {{ m.reasoningSummary }}
                </div>
              </details>
              <details v-if="m.selectionText" class="accordion mt-1">
                <summary class="accordion-summary">
                  <span class="caret i-ph:caret-right mr-1" /> 已读取区域 · Selected Region
                </summary>
                <div class="accordion-body text-xs leading-relaxed whitespace-pre-wrap">
                  {{ m.selectionText }}
                </div>
              </details>
              <details v-if="(m.steps && m.steps.length) || (m.preview?.targets && m.preview.targets.length)" class="accordion mt-1">
                <summary class="accordion-summary">
                  <span class="caret i-ph:list-checks mr-1" /> 思考过程 · Reasoning
                </summary>
                <div class="accordion-body text-xs leading-relaxed">
                  <div v-if="m.steps && m.steps.length">
                    <div class="font-600 mb-1">步骤 · Steps</div>
                    <ol class="list-decimal pl-4 space-y-0.5">
                      <li v-for="(s, i) in m.steps" :key="i" class="whitespace-pre-wrap">{{ s }}</li>
                    </ol>
                  </div>
                  <div v-if="m.preview?.targets && m.preview.targets.length" class="mt-2">
                    <div class="font-600 mb-1">Targets</div>
                    <ul class="space-y-0.5">
                      <li v-for="(t, i) in m.preview.targets" :key="i" class="opacity-80">
                        <code class="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded border border-light-c">{{ t.strategy }}</code>
                        <span v-if="t.text"> - {{ truncate(t.text, 120) }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </details>
            </template>
            <template v-else>
              <div class="max-w-4/5 md:max-w-3/4 bg-gray-100 dark:bg-slate-600 border border-light-c rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap">
                {{ m.content }}
              </div>
            </template>
          </div>
          <div v-else class="w-full flex justify-end">
            <div class="max-w-4/5 md:max-w-3/4 bg-white text-black border border-light-c rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap">
              {{ m.content }}
            </div>
          </div>
        </div>
        <div v-if="isThinking" class="text-light-c text-xs px-1">...</div>
      </div>

      <form class="px-4 pb-4 pt-2 bg-c border-t border-light-c" @submit.prevent="handleSend">
        <div class="w-full rounded-full border border-light-c bg-white dark:bg-slate-700 text-black dark:text-white shadow-c flex items-center gap-3 px-3 py-1.5">
          <textarea
            id="chatbot-input"
            ref="inputRef"
            v-model="draft"
            class="flex-1 resize-none bg-transparent border-0 outline-none px-1 py-1 text-sm"
            rows="1"
            placeholder="输入问题或指令... / Ask a question or instruction..."
            @keydown.enter.exact.prevent="handleSend"
            @input="autoGrow"
          />
          <div class="hstack gap-1.5">
            <button type="submit" class="circle size-9 bg-black text-white hover:opacity-90" :disabled="!canSend" title="Send">
              <span class="i-ic:round-arrow-upward text-base" />
            </button>
          </div>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRuntimeConfig } from '#app'
import { useDataStore } from '~/composables/stores/data'
import { useRoute } from '#imports'
import Dialog from '~/components/shared/base/Dialog.vue'
import PromptSettings from '~/components/shared/PromptSettings.vue'
import { resolveBackendBase } from '~/utils/backendBase'

type Role = 'user' | 'assistant'
interface CursorPreview { result?: string; targets?: any[] }
interface WorkspaceSelection { hasSelection: boolean; text: string; startLine: number; endLine: number; startColumn: number; endColumn: number }
interface Message { id: number; role: Role; content: string; preview?: CursorPreview; steps?: string[]; reasoningSummary?: string; stepDetails?: any[]; selectionText?: string }
interface Attachment { localId: string; name: string; size: number; type: string; file?: File | null; fileId?: string | null; status?: 'pending'|'uploading'|'done'|'error'; progress?: number }

const mounted = ref(false)
const isOpen = ref(false)
const draft = ref('')
const messages = ref<Message[]>([{ id: Date.now(), role: 'assistant', content: "Hello, I'm Chatbot." }])
const isThinking = ref(false)

const inputRef = ref<HTMLTextAreaElement | null>(null)
const scrollRef = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const attachments = ref<Attachment[]>([])
const lastSelection = ref<WorkspaceSelection | null>(null)

const cfg = useRuntimeConfig()
const route = useRoute()
const backendBase = resolveBackendBase((cfg.public as any)?.backendBase)
const chatbotCfg: any = (cfg.public as any)?.chatbot || {}
const agentBase = backendBase ? backendBase.replace(/\/$/, '') : ''
const agentUrl: string = agentBase ? `${agentBase}/api/agent/act` : '/api/agent/act'
const filesBase: string = agentBase
const model = String(chatbotCfg.model || 'gpt-5')
const modelLabel = computed(() => `agent · model: ${model}`)

const hiddenRoutes: string[] = Array.isArray(chatbotCfg.bubbleHiddenRoutes) ? (chatbotCfg.bubbleHiddenRoutes as string[]) : []
const isHiddenByRoute = computed(() => hiddenRoutes.includes(route.path))

const canSend = computed(() => draft.value.trim().length > 0 && !isThinking.value)

function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) nextTick(() => inputRef.value?.focus())
}

function pushMessage(msg: Omit<Message, 'id'>) {
  messages.value.push({ id: Date.now() + Math.random(), ...msg })
  nextTick(() => { const el = scrollRef.value; if (el) el.scrollTop = el.scrollHeight })
}

function hasCursorView(m: Message): boolean { return !!(m.preview || (m.steps && m.steps.length) || m.reasoningSummary) }
function truncate(s: string, n = 120): string { if (!s) return ''; return s.length > n ? s.slice(0, n - 3) + '...' : s }

function parseMaybeStructured(v: any): any | null {
  if (!v) return null
  if (typeof v === 'object' && v) return v
  if (typeof v === 'string') {
    const s = v.trim(); if (!s) return null
    try { const obj = JSON.parse(s); if (obj && typeof obj === 'object') return obj } catch {}
    try { const stripped = s.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim(); const obj = JSON.parse(stripped); if (obj && typeof obj === 'object') return obj } catch {}
  }
  return null
}

function handleWorkspaceSelectionChanged(e: any) { try { const d = (e && e.detail) || {}; if (d && typeof d.text === 'string') lastSelection.value = d as WorkspaceSelection } catch {} }

// Request the freshest selection from Editor by firing a pull event,
// then waiting briefly for a 'workspace-selection-changed' response.
async function requestLatestSelection(timeoutMs = 150): Promise<WorkspaceSelection | null> {
  return new Promise((resolve) => {
    let settled = false as boolean
    let timer: any = null
    const handler = (e: any) => {
      if (settled) return
      settled = true
      try {
        const d = (e && e.detail) || {}
        if (d && typeof d.text === 'string') resolve(d as WorkspaceSelection)
        else resolve(null)
      } finally {
        try { window.removeEventListener('workspace-selection-changed', handler as any) } catch {}
        if (timer) clearTimeout(timer)
      }
    }
    try { window.addEventListener('workspace-selection-changed', handler as any, { once: true } as any) } catch { window.addEventListener('workspace-selection-changed', handler as any) }
    try { window.dispatchEvent(new Event('get-current-selection')) } catch {}
    timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { window.removeEventListener('workspace-selection-changed', handler as any) } catch {}
      resolve(null)
    }, Math.max(50, Math.min(timeoutMs, 500)))
  })
}

function getClientId(): string { try { const key = 'mcp_client_id'; let id = sessionStorage.getItem(key) || ''; if (!id) { id = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem(key, id) } return id } catch { return `cli_${Date.now()}` } }
function getConversationId(docId: string): string { try { const key = `chat_conv_id_${docId || 'global'}`; let id = sessionStorage.getItem(key) || ''; if (!id) { id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem(key, id) } return id } catch { return `conv_${Date.now()}` } }
function getPreviousResponseId(docId: string): string | null { try { return sessionStorage.getItem(`chat_prev_resp_${docId || 'global'}`) } catch { return null } }
function setPreviousResponseId(docId: string, id: string) { try { sessionStorage.setItem(`chat_prev_resp_${docId || 'global'}`, id) } catch {} }
function getDocType(): string { try { const dataStore = useDataStore(); const direct: string = String((dataStore as any)?.data?.docType || '').toLowerCase(); if (direct && ['cv','ps','rec'].includes(direct)) return direct } catch {}; return '' }

// Session-level prompt management
const sessionPrompt = ref('')
const sessionPromptKey = ref('')
const sessionSaving = ref(false)
function getAdminToken(): string { try { return localStorage.getItem('prompts_admin_token') || '' } catch { return '' } }
function getCurrentDocId(): string { try { const dataStore = useDataStore(); return String((dataStore?.data?.curResumeId as any) || '') } catch { return '' } }
function buildSessionPromptKey(): string {
  const docId = getCurrentDocId(); const sessionId = getConversationId(docId)
  return `agent_act_session_prompt:${sessionId}`
}
async function loadSessionPrompt() {
  try {
    const key = buildSessionPromptKey(); sessionPromptKey.value = key
    const url = `${filesBase}/api/prompts/${encodeURIComponent(key)}`
    const r = await fetch(url)
    const data = await r.json().catch(() => ({} as any))
    sessionPrompt.value = (data && data.value) || ''
  } catch { sessionPrompt.value = '' }
}
async function saveSessionPrompt() {
  sessionSaving.value = true
  try {
    const key = sessionPromptKey.value || buildSessionPromptKey()
    const url = `${filesBase}/api/prompts/${encodeURIComponent(key)}`
    const headers: any = { 'Content-Type': 'application/json' }
    const token = getAdminToken(); if (token) headers['x-admin-token'] = token
    await fetch(url, { method: 'POST', headers, body: JSON.stringify({ value: sessionPrompt.value || '' }) })
  } finally { sessionSaving.value = false }
}

async function handleSend() {
  const text = draft.value.trim(); if (!text || isThinking.value) return
  pushMessage({ role: 'user', content: text }); draft.value = ''; isThinking.value = true
  try {
    const clientId = getClientId(); const dataStore = useDataStore(); const docId = String((dataStore?.data?.curResumeId as any) || ''); const sessionId = getConversationId(docId); const prevId = getPreviousResponseId(docId)
    const freshSelection = await requestLatestSelection(150)
    const selSnapshot = freshSelection || lastSelection.value
    const body: any = { clientId, docId, instruction: text, session_id: sessionId, doc_type: getDocType() }
    if (selSnapshot && typeof selSnapshot.text === 'string' && selSnapshot.text.trim()) {
      body.selection = selSnapshot
    }
    const fids = attachments.value.map((a) => a.fileId).filter(Boolean) as string[]; if (fids.length) body.file_ids = fids; if (prevId) body.previous_response_id = prevId
    const res = await fetch(agentUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const errText = await res.text().catch(() => 'http_error'); pushMessage({ role: 'assistant', content: `请求失败: ${res.status}\n${errText}` }); return }
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) { const txt = await res.text().catch(() => ''); pushMessage({ role: 'assistant', content: txt || '请求成功但响应格式不是 JSON' }) }
    else {
      const data = await res.json()
      if (data && data.ok) {
        let contentText = ''; let steps: string[] | undefined; let reasoningSummary: string | undefined; let mergedTargets: any[] = []
        const outerTargets = Array.isArray(data?.preview?.targets) ? data.preview.targets : []; if (outerTargets.length) mergedTargets = mergedTargets.concat(outerTargets)
        const candidate = (data?.preview && data.preview.result) || data?.raw_text || ''
        const structured = parseMaybeStructured(candidate)
        if (structured) { if (typeof structured.result === 'string') contentText = structured.result; if (Array.isArray(structured.steps)) steps = structured.steps; if (typeof structured.reasoning_summary === 'string') reasoningSummary = structured.reasoning_summary; if (Array.isArray(structured.targets) && structured.targets.length) mergedTargets = mergedTargets.concat(structured.targets) }
        else { contentText = String(candidate || '') }
        if (!steps && Array.isArray(data.steps)) steps = data.steps; if (!reasoningSummary && typeof data.reasoning_summary === 'string') reasoningSummary = data.reasoning_summary
        pushMessage({ role: 'assistant', content: contentText || '(无返回文本)' })
        try { const last = messages.value[messages.value.length - 1] as any; if (last && last.role === 'assistant') { last.preview = { result: contentText || undefined, targets: mergedTargets.length ? mergedTargets : (Array.isArray(data?.preview?.targets) ? data.preview.targets : undefined) }; last.steps = steps; last.reasoningSummary = reasoningSummary; last.stepDetails = Array.isArray(data.step_details) ? data.step_details : undefined; if (selSnapshot?.text) last.selectionText = selSnapshot.text } } catch {}
        try { const rid = data?.meta?.response_id; if (rid) setPreviousResponseId(docId, String(rid)) } catch {}
      } else { const msg = (data && (data.error?.message || JSON.stringify(data))) || '未知错误'; pushMessage({ role: 'assistant', content: `出错: ${msg}` }) }
    }
  } catch (e: any) { pushMessage({ role: 'assistant', content: `网络错误: ${e?.message || e}` }) } finally { isThinking.value = false }
}

function filePreviewUrl(fileId: string) { return `${filesBase}/api/files/content/${fileId}` }
function autoGrow() { const el = inputRef.value; if (!el) return; el.style.height = 'auto'; const line = 20, max = line * 6; const next = Math.min(el.scrollHeight, max); el.style.height = Math.max(line * 1.5, next) + 'px'; el.style.overflowY = next >= max ? 'auto' : 'hidden' }
function rid() { if ('randomUUID' in crypto) return (crypto as any).randomUUID(); return Math.random().toString(36).slice(2) }
function onPickFiles(e: Event) { const input = e.target as HTMLInputElement; const files = Array.from(input.files || []); if (!files.length) return; for (const f of files) { const a: Attachment = { localId: rid(), name: f.name, size: f.size, type: f.type, file: f, status: 'pending', progress: 0 }; attachments.value.push(a); startUploadAttachment(a).catch(() => {}) } (e.target as HTMLInputElement).value = '' }
function fileToBase64(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = (e) => reject(e); reader.readAsDataURL(file) }) }
async function startUploadAttachment(a: Attachment) { if (!a.file) return; a.status = 'uploading'; a.progress = 0; try { const b64 = await fileToBase64(a.file); const url = `${filesBase}/api/files/upload`; const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: a.name, contentBase64: b64, contentType: a.type, purpose: 'user_data' }) }); const data = await res.json().catch(() => ({})); if (res.ok && data?.file?.id) { a.fileId = String(data.file.id); a.status = 'done'; a.progress = 100 } else a.status = 'error' } catch { a.status = 'error' } }

onMounted(() => { mounted.value = true; try { window.addEventListener('workspace-selection-changed', handleWorkspaceSelectionChanged as any) } catch {} })
onUnmounted(() => { try { window.removeEventListener('workspace-selection-changed', handleWorkspaceSelectionChanged as any) } catch {}; try { if ((window as any).__chatbotExtHandler) window.removeEventListener('chatbot-append', (window as any).__chatbotExtHandler) } catch {} })

// Allow external features (like REC create flow) to append messages to the chatbot
try {
  const extHandler = (e: CustomEvent) => {
    try {
      const items = (e?.detail && (e.detail as any).messages) || []
      if (Array.isArray(items)) {
        for (const m of items) pushMessage({ role: 'assistant', content: String(m || '') })
      }
    } catch {}
  }
  // Store handler to remove later if needed
  ;(window as any).__chatbotExtHandler = extHandler
  window.addEventListener('chatbot-append', extHandler as any)
} catch {}
</script>

<style scoped>
.max-w-4\/5 { max-width: 80%; }
.hstack { display: inline-flex; align-items: center; }
.circle { border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; }
.size-9 { width: 2.25rem; height: 2.25rem; }
.size-14 { width: 3.5rem; height: 3.5rem; }
.shadow-c { box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
.bg-c { background-color: var(--color-bg, #fff); }
.text-c { color: var(--color-text, #111); }
.border-c { border-color: var(--color-border, #ddd); }
.border-light-c { border-color: rgba(0,0,0,0.1); }
.bg-dark-c { background-color: #f7f7f7; }
.text-dark-c { color: #333; }
.round-btn { padding: 0.35rem; border-radius: 9999px; }
.truncate { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.accordion { border: 1px solid rgba(0,0,0,0.06); border-radius: 8px; background: transparent; }
.accordion-summary { list-style: none; cursor: pointer; padding: 6px 8px; font-size: 12px; color: #555; display: flex; align-items: center; }
details.accordion > summary::-webkit-details-marker { display: none; }
.accordion-body { padding: 8px 10px; }
details[open] .caret { transform: rotate(90deg); }
</style>
