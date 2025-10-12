<template>
  <div class="hstack items-center gap-2 ml-2">
    <label class="text-xs text-light-c">PS</label>
    <select
      class="text-sm px-2 py-1 bg-white dark:bg-slate-700 border border-c rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      v-model="current"
      @change="onChange"
      :disabled="!isPs || !meta"
      :title="isPs ? 'Switch between Outline and Body' : '仅对 PS 文档提供'"
    >
      <option value="outline">文书素材</option>
      <option value="body">正文</option>
    </select>
  </div>
</template>

<script lang="ts" setup>
import type { PsDocMeta, PsDocSubtype } from '~/utils/ps'
import { ensurePsMetaForDoc, getPsMeta } from '~/utils/ps'

const route = useRoute()
const localePath = useLocalePath()

const isPs = ref(false)
const current = ref<'outline' | 'body'>('outline')
const meta = ref<PsDocMeta | null>(null)

const handleMetaUpdate = (event: Event) => {
  try {
    const detail = (event as CustomEvent<{ id: string; meta: PsDocMeta }>).detail
    if (!detail?.meta || !detail.id) return
    const currentId = route.params.id as string
    if (!currentId) return
    if (detail.id === currentId || detail.meta.siblingId === currentId) {
      void loadMeta(currentId)
    }
  } catch {}
}

const loadMeta = async (docId: string) => {
  isPs.value = false
  meta.value = null
  current.value = 'outline'
  if (!docId) return

  try {
    const resolved = getPsMeta(docId)
    if (resolved) {
      meta.value = resolved
      isPs.value = resolved.docType === 'ps'
      current.value = resolved.sub
      return
    }
  } catch {}

  try {
    const ensured = await ensurePsMetaForDoc(docId)
    if (ensured) {
      meta.value = ensured
      isPs.value = ensured.docType === 'ps'
      current.value = ensured.sub
      return
    }
  } catch {}

  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem('ps_doc_meta_' + docId)
    if (raw) {
      const parsed = JSON.parse(raw) as PsDocMeta
      meta.value = parsed
      isPs.value = parsed.docType === 'ps'
      current.value = parsed.sub
      return
    }
  } catch {}

  try {
    const docRaw = localStorage.getItem('doc_meta_' + docId)
    if (docRaw) {
      const docMeta = JSON.parse(docRaw) as { docType?: string; siblingId?: string; chatId?: string; sub?: PsDocSubtype }
      if (docMeta?.docType === 'ps') {
        const fallback: PsDocMeta = {
          docType: 'ps',
          sub: docMeta.sub ?? 'outline',
          chatId: docMeta.chatId || docId,
          siblingId: docMeta.siblingId || ''
        }
        meta.value = fallback
        isPs.value = true
        current.value = fallback.sub
      }
    }
  } catch {}
}

onMounted(() => {
  const id = route.params.id as string
  void loadMeta(id)
  if (typeof window !== 'undefined') window.addEventListener('ps-meta-updated', handleMetaUpdate)
})

watch(() => route.params.id as string, (id) => {
  void loadMeta(id)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('ps-meta-updated', handleMetaUpdate)
})

const onChange = () => {
  const m = meta.value
  if (!m) return
  const id = route.params.id as string
  const targetId = current.value === m.sub ? id : m.siblingId
  if (targetId) navigateTo(localePath(`/edit/${targetId}`))
}
</script>
