<template>
  <div v-if="isPs" class="hstack items-center gap-2 ml-2">
    <label class="text-xs text-light-c">PS</label>
    <select
      class="text-sm px-2 py-1 bg-white dark:bg-slate-700 border border-c rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
      v-model="current"
      @change="onChange"
      :title="'Switch between Outline and Body'"
    >
      <option value="outline">文书素材</option>
      <option value="body">正文</option>
    </select>
  </div>
</template>

<script lang="ts" setup>
import type { PsDocMeta } from '~/utils/ps'

const route = useRoute()
const localePath = useLocalePath()

const isPs = ref(false)
const current = ref<'outline' | 'body'>('outline')
const meta = ref<PsDocMeta | null>(null)

onMounted(() => {
  try {
    const id = route.params.id as string
    const raw = localStorage.getItem('ps_doc_meta_' + id)
    const m = raw ? (JSON.parse(raw) as PsDocMeta) : null
    meta.value = m
    isPs.value = !!m && m.docType === 'ps'
    if (m) current.value = m.sub
  } catch {}
})

watch(() => route.params.id as string, (id) => {
  try {
    const raw = localStorage.getItem('ps_doc_meta_' + id)
    const m = raw ? (JSON.parse(raw) as PsDocMeta) : null
    meta.value = m
    isPs.value = !!m && m.docType === 'ps'
    if (m) current.value = m.sub
  } catch {}
})

const onChange = () => {
  try {
    const m = meta.value
    if (!m) return
    const id = route.params.id as string
    const targetId = current.value === m.sub ? id : m.siblingId
    if (targetId) navigateTo(localePath(`/edit/${targetId}`))
  } catch {}
}
</script>


