<template>
  <div class="p-4 space-y-6">
    <h1 class="text-xl font-700">Chatbot Settings</h1>

    <section class="space-y-2">
      <div class="text-sm opacity-70">Admin Token (x-admin-token)</div>
      <div class="flex gap-2 items-center">
        <input v-model="adminToken" class="border border-gray-300 rounded px-2 py-1 w-80" type="password" placeholder="Optional: set if backend requires it" />
        <button class="rect-btn border border-gray-300 px-3 py-1" @click="saveAdminToken">Save Token</button>
        <span v-if="saved" class="text-xs opacity-60">Saved</span>
      </div>
    </section>

    <section>
      <div class="p-3 border border-gray-300 rounded-md max-w-5xl overflow-y-auto" style="max-height: 70vh;">
        <PromptSettings />
      </div>
    </section>

    <section class="space-y-2">
      <div class="section-title">Session Prompt (by session_id)</div>
      <div class="flex gap-2 items-center">
        <input v-model="sessionId" class="border border-gray-300 rounded px-2 py-1 w-72" placeholder="Enter session_id" />
        <button class="rect-btn border border-gray-300 px-3 py-1" @click="loadBySessionId">Load</button>
      </div>
      <div v-if="sessionId" class="text-xs opacity-70">Key: {{ sessionKey }}</div>
      <textarea v-model="sessionText" class="w-full h-36 rounded border border-gray-300 p-2 text-xs font-mono" placeholder="Session-level system prompt"></textarea>
      <div class="flex justify-end">
        <button class="rect-btn border border-gray-300 px-3 py-1" :disabled="saving" @click="saveBySessionId">Save</button>
      </div>
    </section>
  </div>
  
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRuntimeConfig } from '#imports'
import PromptSettings from '~/components/shared/PromptSettings.vue'

const cfg = useRuntimeConfig()
const backendBase: string = (cfg.public as any)?.backendBase || ''
const apiBase = backendBase ? backendBase.replace(/\/$/, '') : ''

const adminToken = ref('')
const saved = ref(false)

function saveAdminToken() { try { localStorage.setItem('prompts_admin_token', adminToken.value || '') } catch {} saved.value = true; setTimeout(() => (saved.value = false), 1200) }

onMounted(() => { try { adminToken.value = localStorage.getItem('prompts_admin_token') || '' } catch {} })

const sessionId = ref('')
const sessionText = ref('')
const saving = ref(false)
const sessionKey = computed(() => (sessionId.value ? `agent_act_session_prompt:${sessionId.value}` : ''))

async function loadBySessionId() {
  if (!sessionId.value) return
  try {
    const url = `${apiBase}/api/prompts/${encodeURIComponent(sessionKey.value)}`
    const r = await fetch(url)
    const data = await r.json().catch(() => ({} as any))
    sessionText.value = (data && data.value) || ''
  } catch { sessionText.value = '' }
}

async function saveBySessionId() {
  if (!sessionId.value) return
  saving.value = true
  try {
    const url = `${apiBase}/api/prompts/${encodeURIComponent(sessionKey.value)}`
    const headers: any = { 'Content-Type': 'application/json' }
    const token = adminToken.value.trim(); if (token) headers['x-admin-token'] = token
    await fetch(url, { method: 'POST', headers, body: JSON.stringify({ value: sessionText.value || '' }) })
  } finally { saving.value = false }
}
</script>

<style scoped>
.section-title { font-size: 14px; font-weight: 600; opacity: 0.8; margin-bottom: 6px; }
.rect-btn { border-radius: 8px; }
</style>
