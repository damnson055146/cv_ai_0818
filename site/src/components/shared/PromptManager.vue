<template>
  <div class="prompt-mgr flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <input v-model="query" class="input px-2 py-1 rounded border border-light-c flex-1" :placeholder="scope==='chatbot' ? '筛选（agent_*）' : '筛选（排除 chatbot）'" />
      <button class="rect-btn px-2 py-1 border border-light-c" @click="reload">刷新</button>
      <button class="rect-btn px-2 py-1 border border-light-c" @click="startCreate">新增</button>
    </div>

    <div class="flex gap-3 min-h-[260px]">
      <div class="w-48 shrink-0 border border-light-c rounded overflow-auto">
        <ul>
          <li v-for="k in filteredKeys" :key="k" :class="['px-2 py-1 cursor-pointer text-sm', selKey===k ? 'bg-gray-100 dark:bg-slate-700' : 'hover:bg-gray-50 dark:hover:bg-slate-800']" @click="selectKey(k)">{{ k }}</li>
          <li v-if="!filteredKeys.length" class="px-2 py-2 text-xs opacity-60">无条目</li>
        </ul>
      </div>
      <div class="flex-1 border border-light-c rounded p-2">
        <div v-if="mode==='view' && selKey" class="flex flex-col gap-2">
          <div class="text-xs opacity-60">键：{{ selKey }}</div>
          <textarea v-model="value" class="w-full h-56 rounded border border-light-c p-2 font-mono text-xs" placeholder="请输入提示词内容（支持中文）"></textarea>
          <div class="flex gap-2 justify-end">
            <button class="rect-btn px-3 py-1 border border-light-c" @click="save" :disabled="saving">保存</button>
          </div>
        </div>
        <div v-else-if="mode==='create'" class="flex flex-col gap-2">
          <div class="text-xs opacity-60">新建键名（{{ scope==='chatbot' ? '建议前缀：agent_' : '避免前缀：agent_/chatbot_' }}）</div>
          <input v-model="newKey" class="input px-2 py-1 rounded border border-light-c" placeholder="例如：rec_prompt_main" />
          <textarea v-model="value" class="w-full h-48 rounded border border-light-c p-2 font-mono text-xs" placeholder="请输入提示词内容"></textarea>
          <div class="flex gap-2 justify-end">
            <button class="rect-btn px-2 py-1 border border-light-c" @click="cancelCreate">取消</button>
            <button class="rect-btn px-3 py-1 border border-light-c" @click="create" :disabled="!newKey.trim() || saving">创建并保存</button>
          </div>
        </div>
        <div v-else class="text-xs opacity-60">选择左侧键或点击“新增”。</div>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRuntimeConfig } from '#imports'

const props = defineProps<{ scope?: 'general' | 'chatbot' }>()
const scope = props.scope || 'general'

const cfg = useRuntimeConfig()
const backendBase: string = (cfg.public as any)?.backendBase || ''
const apiBase = backendBase ? backendBase.replace(/\/$/, '') : ''

const keys = ref<string[]>([])
const query = ref('')
const selKey = ref('')
const value = ref('')
const mode = ref<'idle'|'view'|'create'>('idle')
const saving = ref(false)
const newKey = ref('')

const filteredKeys = computed(() => {
  const q = query.value.trim().toLowerCase()
  let arr = keys.value.slice()
  if (scope === 'general') {
    arr = arr.filter(k => !(k.startsWith('agent_') || k.startsWith('chatbot_')))
  } else {
    arr = arr.filter(k => (k.startsWith('agent_') || k.startsWith('chatbot_')))
  }
  if (q) arr = arr.filter(k => k.toLowerCase().includes(q))
  return arr
})

function selectKey(k: string) {
  selKey.value = k
  mode.value = 'view'
  loadValue(k)
}

async function loadKeys() {
  const url = `${apiBase}/api/prompts`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (data && data.ok && Array.isArray(data.items)) {
    keys.value = data.items.map((x: any) => x.key)
  }
}

async function loadValue(k: string) {
  const url = `${apiBase}/api/prompts/${encodeURIComponent(k)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  value.value = (data && data.value) || ''
}

function reload() { loadKeys() }

function startCreate() {
  newKey.value = scope === 'chatbot' ? 'agent_' : ''
  value.value = ''
  mode.value = 'create'
}
function cancelCreate() {
  mode.value = selKey.value ? 'view' : 'idle'
}

async function create() {
  const k = newKey.value.trim()
  if (!k) return
  saving.value = true
  try {
    const url = `${apiBase}/api/prompts/${encodeURIComponent(k)}`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: value.value || '' }) })
    if (res.ok) {
      await loadKeys()
      selectKey(k)
    }
  } finally {
    saving.value = false
  }
}

async function save() {
  if (!selKey.value) return
  saving.value = true
  try {
    const url = `${apiBase}/api/prompts/${encodeURIComponent(selKey.value)}`
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: value.value || '' }) })
  } finally { saving.value = false }
}

onMounted(() => { loadKeys() })

</script>

<style scoped>
.rect-btn { border-radius: 8px; }
.input { min-width: 120px; }
</style>

