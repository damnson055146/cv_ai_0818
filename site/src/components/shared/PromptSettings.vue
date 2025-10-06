<template>
  <div class="prompt-settings flex flex-col gap-4">
    <!-- Doc-type prompts (cv/ps/rec) -->
    <section>
      <div class="section-title">Document Type Prompts</div>
      <div class="tabs">
        <button v-for="t in docTypes" :key="t"
                :class="['tab', selType===t && 'active']"
                @click="selType=t">{{ t.toUpperCase() }}</button>
      </div>
      <div class="mt-2 space-y-2">
        <div class="text-xs opacity-60">Key: {{ systemKey(selType) }}</div>
        <textarea v-model="systemValues[selType]" class="w-full h-36 rounded border border-light-c p-2 text-xs font-mono" placeholder="Enter the system prompt for this document type"></textarea>
        <div class="flex justify-end gap-2">
          <button class="rect-btn px-3 py-1 border border-light-c" :disabled="savingSys" @click="saveSystemPrompt(selType)">Save {{ selType.toUpperCase() }}</button>
        </div>
      </div>
    </section>

    <!-- Doc-type append prompts (cv/ps/rec) -->
    <section>
      <div class="section-title">Append Prompts (Per Type)</div>
      <div class="tabs">
        <button v-for="t in docTypes" :key="'append-' + t"
                :class="['tab', selAppendType===t && 'active']"
                @click="selAppendType=t">{{ t.toUpperCase() }}</button>
      </div>
      <div class="mt-2 space-y-2">
        <div class="text-xs opacity-60">Key: {{ appendKey(selAppendType) }}</div>
        <textarea v-model="appendValues[selAppendType]" class="w-full h-28 rounded border border-light-c p-2 text-xs font-mono" placeholder="Append content added after system prompt"></textarea>
        <div class="flex justify-end gap-2">
          <button class="rect-btn px-3 py-1 border border-light-c" :disabled="savingAppend" @click="saveAppendPrompt(selAppendType)">Save {{ selAppendType.toUpperCase() }}</button>
        </div>
      </div>
    </section>

    <!-- Concatenation order -->
    <section>
      <div class="section-title">Concatenation Order & Selection</div>
      <div class="tabs">
        <button v-for="t in docTypes" :key="t + '-order'"
                :class="['tab', selOrderType===t && 'active']"
                @click="selOrderType=t">{{ t.toUpperCase() }}</button>
      </div>
      <div class="mt-2">
        <div class="text-xs opacity-60 mb-2">Key: {{ orderKey(selOrderType) }} (JSON array, e.g. [\"system\",\"append\",\"session\"])</div>
        <ul class="order-list">
          <li v-for="(seg, idx) in orderValues[selOrderType]" :key="seg" class="order-item">
            <span class="seg">{{ labelOf(seg) }}</span>
            <div class="ops">
              <button class="tiny" :disabled="idx===0" @click="moveUp(idx)">Up</button>
              <button class="tiny" :disabled="idx===orderValues[selOrderType].length-1" @click="moveDown(idx)">Down</button>
              <button class="tiny" @click="toggleSeg(seg)">{{ hasSeg(seg) ? 'Remove' : 'Add' }}</button>
            </div>
          </li>
        </ul>
        <div class="mt-2 text-xs opacity-60">Available Segments:
          <span v-for="c in candidates" :key="c" class="candidate" :class="hasSeg(c) ? 'on' : ''" @click="toggleSeg(c)">{{ labelOf(c) }}</span>
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <button class="rect-btn px-3 py-1 border border-light-c" :disabled="savingOrder" @click="saveOrder(selOrderType)">Save Order</button>
        </div>
      </div>
    </section>
    
    <!-- Global defaults -->
    <section>
      <div class="section-title">Global Defaults</div>
      <div class="mt-2 space-y-3">
        <div>
          <div class="text-xs opacity-60">Key: {{ globalSystemKey }}</div>
          <textarea v-model="globalSystem" class="w-full h-24 rounded border border-light-c p-2 text-xs font-mono" placeholder="Global default system prompt (used when per-type is missing)"></textarea>
        </div>
        <div>
          <div class="text-xs opacity-60">Key: {{ globalAppendKey }}</div>
          <textarea v-model="globalAppend" class="w-full h-24 rounded border border-light-c p-2 text-xs font-mono" placeholder="Global default append prompt"></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button class="rect-btn px-3 py-1 border border-light-c" :disabled="savingGlobal" @click="saveGlobal">Save Global</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRuntimeConfig } from '#imports'
import { resolveBackendBase } from '~/utils/backendBase'

type DocType = 'cv'|'ps'|'rec'
type Segment = 'system'|'append'|'session'

const cfg = useRuntimeConfig()
const apiBase = resolveBackendBase((cfg.public as any)?.backendBase)

const docTypes: DocType[] = ['cv','ps','rec']
const candidates: Segment[] = ['system','append','session']

const selType = ref<DocType>('cv')
const selOrderType = ref<DocType>('cv')
const selAppendType = ref<DocType>('cv')

const savingSys = ref(false)
const savingOrder = ref(false)
const savingAppend = ref(false)
const savingGlobal = ref(false)

const systemValues = reactive<Record<DocType, string>>({ cv: '', ps: '', rec: '' })
const orderValues = reactive<Record<DocType, Segment[]>>({ cv: ['system','append','session'], ps: ['system','append','session'], rec: ['system','append','session'] })
const appendValues = reactive<Record<DocType, string>>({ cv: '', ps: '', rec: '' })
const globalSystem = ref('')
const globalAppend = ref('')

function systemKey(t: DocType) { return `agent_act_system_prompt:${t}` }
function orderKey(t: DocType) { return `agent_act_concat_order:${t}` }
function appendKey(t: DocType) { return `agent_act_global_append:${t}` }
const globalSystemKey = 'agent_act_system_prompt'
const globalAppendKey = 'agent_act_global_append'
function labelOf(seg: Segment): string { return seg === 'system' ? 'System' : seg === 'append' ? 'Append' : 'Session' }
function hasSeg(seg: Segment): boolean { return orderValues[selOrderType.value].includes(seg) }
function toggleSeg(seg: Segment) { const arr = orderValues[selOrderType.value]; const i = arr.indexOf(seg); if (i >= 0) arr.splice(i, 1); else arr.push(seg) }
function moveUp(idx: number) { const arr = orderValues[selOrderType.value]; if (idx <= 0) return; const [x] = arr.splice(idx, 1); arr.splice(idx - 1, 0, x) }
function moveDown(idx: number) { const arr = orderValues[selOrderType.value]; if (idx >= arr.length - 1) return; const [x] = arr.splice(idx, 1); arr.splice(idx + 1, 0, x) }
function getAdminToken(): string { try { return localStorage.getItem('prompts_admin_token') || '' } catch { return '' } }

async function loadSystemPrompt(t: DocType) { try { const url = `${apiBase}/api/prompts/${encodeURIComponent(systemKey(t))}`; const r = await fetch(url); const data = await r.json().catch(() => ({})); systemValues[t] = (data && data.value) || '' } catch { systemValues[t] = '' } }
async function saveSystemPrompt(t: DocType) { savingSys.value = true; try { const url = `${apiBase}/api/prompts/${encodeURIComponent(systemKey(t))}`; const headers: any = { 'Content-Type': 'application/json' }; const token = getAdminToken(); if (token) headers['x-admin-token'] = token; await fetch(url, { method: 'POST', headers, body: JSON.stringify({ value: systemValues[t] || '' }) }) } finally { savingSys.value = false } }
async function loadOrder(t: DocType) { try { const url = `${apiBase}/api/prompts/${encodeURIComponent(orderKey(t))}`; const r = await fetch(url); const data = await r.json().catch(() => ({})); const v = (data && data.value) || ''; if (v && typeof v === 'string') { try { const arr = JSON.parse(v); if (Array.isArray(arr)) { const filtered = arr.filter((x: any) => ['system','append','session'].includes(String(x))) as Segment[]; if (filtered.length) orderValues[t] = filtered } } catch {} } } catch {} }
async function saveOrder(t: DocType) { savingOrder.value = true; try { const url = `${apiBase}/api/prompts/${encodeURIComponent(orderKey(t))}`; const headers: any = { 'Content-Type': 'application/json' }; const token = getAdminToken(); if (token) headers['x-admin-token'] = token; await fetch(url, { method: 'POST', headers, body: JSON.stringify({ value: JSON.stringify(orderValues[t]) }) }) } finally { savingOrder.value = false } }
async function loadAppendPrompt(t: DocType) { try { const url = `${apiBase}/api/prompts/${encodeURIComponent(appendKey(t))}`; const r = await fetch(url); const data = await r.json().catch(() => ({})); appendValues[t] = (data && data.value) || '' } catch { appendValues[t] = '' } }
async function saveAppendPrompt(t: DocType) { savingAppend.value = true; try { const url = `${apiBase}/api/prompts/${encodeURIComponent(appendKey(t))}`; const headers: any = { 'Content-Type': 'application/json' }; const token = getAdminToken(); if (token) headers['x-admin-token'] = token; await fetch(url, { method: 'POST', headers, body: JSON.stringify({ value: appendValues[t] || '' }) }) } finally { savingAppend.value = false } }
async function loadGlobal() {
  try { const r1 = await fetch(`${apiBase}/api/prompts/${encodeURIComponent(globalSystemKey)}`); const d1 = await r1.json().catch(() => ({} as any)); globalSystem.value = (d1 && d1.value) || '' } catch { globalSystem.value = '' }
  try { const r2 = await fetch(`${apiBase}/api/prompts/${encodeURIComponent(globalAppendKey)}`); const d2 = await r2.json().catch(() => ({} as any)); globalAppend.value = (d2 && d2.value) || '' } catch { globalAppend.value = '' }
}
async function saveGlobal() {
  savingGlobal.value = true
  try {
    const headers: any = { 'Content-Type': 'application/json' }
    const token = getAdminToken(); if (token) headers['x-admin-token'] = token
    await fetch(`${apiBase}/api/prompts/${encodeURIComponent(globalSystemKey)}`, { method: 'POST', headers, body: JSON.stringify({ value: globalSystem.value || '' }) })
    await fetch(`${apiBase}/api/prompts/${encodeURIComponent(globalAppendKey)}`, { method: 'POST', headers, body: JSON.stringify({ value: globalAppend.value || '' }) })
  } finally { savingGlobal.value = false }
}

onMounted(async () => { for (const t of docTypes) { await loadSystemPrompt(t); await loadOrder(t); await loadAppendPrompt(t) } await loadGlobal() })
</script>

<style scoped>
.section-title { font-size: 12px; font-weight: 600; opacity: 0.7; }
.tabs { display: inline-flex; gap: 6px; margin-top: 6px; }
.tab { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border, #ddd); border-radius: 6px; background: transparent; }
.tab.active { background: rgba(0,0,0,0.06); }
.rect-btn { border-radius: 8px; }
.order-list { display: flex; flex-direction: column; gap: 6px; }
.order-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; }
.seg { font-size: 12px; opacity: 0.8; }
.ops { display: inline-flex; gap: 6px; }
.tiny { font-size: 12px; padding: 2px 6px; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px; }
.candidate { display: inline-block; margin-right: 8px; cursor: pointer; padding: 2px 6px; border: 1px dashed rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; }
.candidate.on { background: rgba(0,0,0,0.06); }
.border-light-c { border-color: rgba(0,0,0,0.1); }
</style>
