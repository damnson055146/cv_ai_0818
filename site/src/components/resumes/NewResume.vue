<template>
  <div w-56 h-80>
    <Dialog id="new-resume-template" :title="$t('resumes.new')" icon="i-ic:round-plus" box-class="w-full md:w-[28rem]">
      <template #button>
        <button
          class="resume-card group w-[210px] h-[299px] flex-center bg-darker-c hover:bg-c"
          :aria-label="$t('resumes.new')"
        >
          <span i-ic:round-plus text="5xl light-c group-hover:brand" />
        </button>
      </template>

      <template #content>
        <div class="p-4 space-y-4">
          <div text-sm text-light-c>{{ $t('resumes.choose_doc_type') || 'Choose document type' }}</div>
          <div class="grid grid-cols-3 gap-3">
            <button
              :class="['px-3 py-2 rounded border hover:border-darker-c hover:bg-dark-c', curDoc === 'cv' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c']"
              @click="step = 'lang'; curDoc = 'cv'"
            >CV</button>
            <button
              :class="['px-3 py-2 rounded border hover:border-darker-c hover:bg-dark-c', curDoc === 'ps' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c']"
              @click="step = 'lang'; curDoc = 'ps'"
            >{{ $t('resumes.ps') || 'Personal Statement' }}</button>
            <button
              :class="['px-3 py-2 rounded border hover:border-darker-c hover:bg-dark-c', curDoc === 'rec' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c']"
              @click="step = 'lang'; curDoc = 'rec'"
            >{{ $t('resumes.rec') || 'Recommendation' }}</button>
          </div>

          <div v-if="step === 'lang'" class="space-y-2">
            <div text-sm text-light-c>{{ $t('resumes.choose_lang') || 'Choose language' }}</div>
            <div class="grid grid-cols-2 gap-3">
              <button
                :class="['px-3 py-2 rounded border hover:border-darker-c hover:bg-dark-c', lang === 'en' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c']"
                @click="(curDoc === 'ps' || curDoc === 'rec') ? setLang('en') : createBy(curDoc, 'en')"
              >English</button>
              <button
                :class="['px-3 py-2 rounded border hover:border-darker-c hover:bg-dark-c', lang === 'zh' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c']"
                @click="(curDoc === 'ps' || curDoc === 'rec') ? setLang('zh') : createBy(curDoc, 'zh')"
              >中文</button>
            </div>
          </div>

          <div v-if="curDoc === 'ps'" class="mt-4 space-y-2">
            <div text-sm text-light-c>PS 预置信息</div>
            <div class="grid grid-cols-2 gap-3">
              <input v-model.trim="projectInfo" class="px-3 py-2 rounded border border-c bg-transparent" placeholder="Project info (optional)" />
              <input v-model.trim="studentInfo" class="px-3 py-2 rounded border border-c bg-transparent" placeholder="Student info (optional)" />
            </div>
            <div class="space-y-1">
              <label class="text-xs text-light-c">上传 PDF（{{ psCfg.requireUpload ? '必需' : '可选' }}）</label>
              <input type="file" :accept="acceptedTypes" @change="onPdfSelect" />
              <div v-if="pdfName" class="text-xs text-light-c">已选择：{{ pdfName }}</div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-c">
              <button class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600" @click="resetDialog">取消</button>
              <button class="px-3 py-1 rounded bg-blue-600 text-white hover:opacity-90" :disabled="!canConfirm" @click="confirmCreate">确定</button>
            </div>
          </div>
          <div v-if="curDoc === 'rec'" class="mt-4 space-y-2">
            <div text-sm text-light-c>推荐信素材上传</div>
            <div class="space-y-1">
              <label class="text-xs text-light-c">上传文件（必需）</label>
              <input type="file" :accept="acceptedRecTypes" @change="onRecSelect" />
              <div v-if="recName" class="text-xs text-light-c">已选择：{{ recName }}</div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-c">
              <button class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600" @click="resetDialog">取消</button>
              <button class="px-3 py-1 rounded bg-blue-600 text-white hover:opacity-90" :disabled="!canConfirm || recSubmitting" @click="confirmCreateRec">确定</button>
            </div>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
  
</template>

<script lang="ts" setup>
const runtimeConfig = useRuntimeConfig()
const backendBase = computed(() => String((runtimeConfig.public as any)?.backendBase || '').replace(/\/$/, ''))
const psCfg = computed(() => (runtimeConfig.public as any)?.ps || { requireUpload: false, allowedUploadTypes: ["application/pdf"] })
const recCfg = computed(() => (runtimeConfig.public as any)?.rec || { requireUpload: true, allowedUploadTypes: ["application/pdf"] })
const acceptedTypes = computed(() => Array.isArray(psCfg.value.allowedUploadTypes) && psCfg.value.allowedUploadTypes.length > 0
  ? psCfg.value.allowedUploadTypes.join(',')
  : 'application/pdf')
const acceptedRecTypes = computed(() => {
  const types = Array.isArray(recCfg.value.allowedUploadTypes) && recCfg.value.allowedUploadTypes.length > 0
    ? recCfg.value.allowedUploadTypes.join(',')
    : 'application/pdf'
  // Always allow .pdf extension as fallback for browsers that set generic mime types
  return types.includes('.pdf') ? types : `${types},.pdf`
})
const router = useRouter();
const localePath = useLocalePath();
import { useToast } from "~/composables/toast";
import { newResume, newResumeFromImport } from "~/utils/database";
import { buildTemplateKey, buildPsTemplateKey } from "~/utils";
const toast = useToast();

type Doc = 'cv' | 'ps' | 'rec';
type Lang = 'en' | 'zh';

const step = ref<'doc' | 'lang'>('doc');
const curDoc = ref<Doc>('cv');
const lang = ref<Lang | null>(null)

const projectInfo = ref("")
const studentInfo = ref("")
const pdfBase64 = ref<string | null>(null)
const pdfName = ref<string>("")
const recBase64 = ref<string | null>(null)
const recName = ref<string>("")
const recSubmitting = ref<boolean>(false)

const setLang = (l: Lang) => { lang.value = l }
const canConfirm = computed(() => {
  if (curDoc.value === 'ps') {
    if (!lang.value) return false
    if (psCfg.value.requireUpload && !pdfBase64.value) return false
    return true
  }
  if (curDoc.value === 'rec') {
    if (!lang.value) return false
    if (recCfg.value.requireUpload && !recBase64.value) return false
    return true
  }
  return true
})

const resetDialog = () => {
  step.value = 'doc'
  curDoc.value = 'cv'
  lang.value = null
  projectInfo.value = ''
  studentInfo.value = ''
  pdfBase64.value = null
  recBase64.value = null
}

const onPdfSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  // Validate type by config
  try {
    const okTypes = (psCfg.value.allowedUploadTypes as string[]) || []
    if (okTypes.length > 0 && !okTypes.includes(file.type)) {
      pdfBase64.value = null
      pdfName.value = ''
      ;(toast as any).import(false)
      return
    }
  } catch {}
  pdfName.value = file.name || 'attachment.pdf'
  // Use FileReader to avoid huge argument spreading causing stack overflow
  const reader = new FileReader()
  reader.onload = () => {
    const res = typeof reader.result === 'string' ? reader.result : ''
    const comma = res.indexOf(',')
    pdfBase64.value = comma >= 0 ? res.slice(comma + 1) : res
  }
  reader.readAsDataURL(file)
}

const createBy = async (docType: Doc, lang: Lang) => {
  if (docType !== 'ps') {
    const key = buildTemplateKey(docType, lang);
    const id = await newResume(key);
    try { localStorage.setItem('doc_meta_' + id, JSON.stringify({ docType: docType === 'rec' ? 'rec' : 'cv', lang })) } catch {}
    router.push(localePath(`/edit/${id}`));
    return
  }

  // Create two docs: outline and body, share chatId
  const chatId = `chat_${Date.now().toString(36)}`
  const outlineId = await newResume(buildPsTemplateKey(lang, 'outline'))
  const bodyId = await newResume(buildPsTemplateKey(lang, 'body'))

  // Mark meta for PS outline/body pair
  const { setPsMetaForPair } = await import('~/utils/ps')
  setPsMetaForPair({ outlineId, bodyId, chatId })

  // Seed chatbot with initial info as system/user messages
  try {
    const { convStore } = await import('~/data/contextStore')
    const seed = [
      projectInfo.value ? `Project: ${projectInfo.value}` : '',
      studentInfo.value ? `Student: ${studentInfo.value}` : ''
    ].filter(Boolean).join('\n')
    if (seed) convStore.appendMessage(chatId, 'user', seed)
  } catch {}

  router.push(localePath(`/edit/${outlineId}`));
}

const confirmCreate = async () => {
  if (curDoc.value !== 'ps' || !lang.value) return
  // Create two docs: outline and body, share chatId
  const chatId = `chat_${Date.now().toString(36)}`
  const outlineId = await newResume(buildPsTemplateKey(lang.value, 'outline'))
  const bodyId = await newResume(buildPsTemplateKey(lang.value, 'body'))

  const { setPsMetaForPair } = await import('~/utils/ps')
  setPsMetaForPair({ outlineId, bodyId, chatId })

  try {
    const { convStore } = await import('~/data/contextStore')
    const seed = [
      projectInfo.value ? `Project: ${projectInfo.value}` : '',
      studentInfo.value ? `Student: ${studentInfo.value}` : ''
    ].filter(Boolean).join('\n')
    if (seed) convStore.appendMessage(chatId, 'user', seed)
  } catch {}

  try {
    if (pdfBase64.value) {
      // Parse PDF to text locally (reuse Import pipeline) then call PS seed endpoint
      try {
        const buf = Uint8Array.from(atob(pdfBase64.value), c => c.charCodeAt(0))
        const pdfjsLib: any = await import('pdfjs-dist')
        try {
          const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default as string
          if ((pdfjsLib as any)?.GlobalWorkerOptions) {
            const worker = new Worker(workerUrl, { type: 'module' })
            ;(pdfjsLib as any).GlobalWorkerOptions.workerPort = worker
          }
        } catch {}
        const task = (pdfjsLib as any).getDocument({ data: buf })
        const pdf = await task.promise
        let fullText = ''
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p)
          const tc = await page.getTextContent()
          const items = (tc.items || []) as any[]
          const lineBuckets = new Map<number, Array<{ x: number; str: string }>>()
          const yTolerance = 2
          for (const it of items) {
            const tr = it.transform || [0,0,0,0,0,0]
            const x = tr[4] || 0
            const y = tr[5] || 0
            const yKey = Math.round(y / yTolerance) * yTolerance
            if (!lineBuckets.has(yKey)) lineBuckets.set(yKey, [])
            lineBuckets.get(yKey)!.push({ x, str: String(it.str || '') })
          }
          const yKeys = Array.from(lineBuckets.keys()).sort((a, b) => b - a)
          const lines: string[] = []
          for (const y of yKeys) {
            const line = lineBuckets.get(y)!
            line.sort((a, b) => a.x - b.x)
            let bufLine = ''
            for (let i = 0; i < line.length; i++) {
              const cur = line[i]
              const prev = line[i - 1]
              const gap = prev ? cur.x - prev.x : 0
              bufLine += (prev && gap > 6 ? ' ' : '') + cur.str
            }
            lines.push(bufLine.trim())
          }
          const pageText = lines.join('\n')
          fullText += (p > 1 ? '\n\n' : '') + pageText
        }
        // Call backend to prepare PS suggestions
        const seed: any = await $fetch('/api/ps/seed-from-upload', {
          method: 'POST',
          body: {
            chatId,
            language: lang.value,
            uploadText: fullText,
            projectInfo: projectInfo.value,
            studentInfo: studentInfo.value
          }
        })
        if (seed && seed.status === 'ok') {
          try {
            const key = `ps_seed_${chatId}`
            localStorage.setItem(key, JSON.stringify(seed.data))
          } catch {}
        }
        try { (toast as any).import(true) } catch {}
      } catch (e) {
        try { (toast as any).import(false) } catch {}
      }
    }
  } catch (e) {
    try { (toast as any).import(false) } catch {}
  }

  router.push(localePath(`/edit/${outlineId}`));
}

const onRecSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  try {
    const okTypes = (recCfg.value.allowedUploadTypes as string[]) || []
    const isPdfExt = /\.pdf$/i.test(file.name || '')
    if (okTypes.length > 0 && !okTypes.includes(file.type) && !isPdfExt) {
      recBase64.value = null
      recName.value = ''
      ;(toast as any).import(false)
      return
    }
  } catch {}
  recName.value = file.name || 'attachment.bin'
  const reader = new FileReader()
  reader.onload = () => {
    const res = typeof reader.result === 'string' ? reader.result : ''
    const comma = res.indexOf(',')
    recBase64.value = comma >= 0 ? res.slice(comma + 1) : res
  }
  reader.readAsDataURL(file)
}

// Helpers: format structured fields for chatbot display
const isPlainObject = (v: any): boolean => !!v && typeof v === 'object' && !Array.isArray(v)
const safeString = (v: any): string => {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
const formatMaterial = (material: any): string => {
  if (!material) return ''
  if (typeof material === 'string') return material.trim()
  try {
    const stories = Array.isArray(material?.stories) ? material.stories : []
    if (!stories.length) return safeString(material)
    const blocks: string[] = []
    stories.forEach((s: any, idx: number) => {
      const title = s?.title ? String(s.title) : `Story ${idx + 1}`
      const star = s?.STAR || s?.star || s || {}
      const sit = star?.Situation || star?.situation || ''
      const task = star?.Task || star?.task || ''
      const action = star?.Action || star?.action || ''
      const result = star?.Result || star?.result || ''
      const lines: string[] = []
      lines.push(`${idx + 1}) ${title}`)
      if (sit) lines.push(`- Situation: ${sit}`)
      if (task) lines.push(`- Task: ${task}`)
      if (action) lines.push(`- Action: ${action}`)
      if (result) lines.push(`- Result: ${result}`)
      blocks.push(lines.join('\n'))
    })
    return blocks.join('\n\n')
  } catch {
    return safeString(material)
  }
}
const formatOutline = (outline: any): string => {
  if (!outline) return ''
  if (typeof outline === 'string') return outline.trim()
  try {
    const lines: string[] = []
    const opening = outline?.opening || outline?.intro || ''
    if (opening) { lines.push('Opening:'); lines.push(String(opening)) }
    const bps = Array.isArray(outline?.body_paragraphs || outline?.body)
      ? (outline.body_paragraphs || outline.body)
      : []
    bps.forEach((bp: any, i: number) => {
      if (typeof bp === 'string') {
        lines.push(`Body ${i + 1}:`)
        lines.push(bp)
      } else {
        const focus = bp?.focus || bp?.title || `Body ${i + 1}`
        const content = bp?.content || ''
        lines.push(`Body ${i + 1} - ${focus}:`)
        if (content) lines.push(String(content))
      }
    })
    const closing = outline?.closing || outline?.conclusion || outline?.outro || ''
    if (closing) { lines.push('Closing:'); lines.push(String(closing)) }
    return lines.join('\n')
  } catch {
    return safeString(outline)
  }
}
const formatChecks = (checks: any): string => {
  if (!checks) return ''
  if (typeof checks === 'string') return checks.trim()
  if (isPlainObject(checks)) {
    const lines: string[] = []
    const entries = Object.entries(checks as Record<string, any>)
    const valuesAreArrays = entries.every(([, v]) => Array.isArray(v))
    if (valuesAreArrays) {
      for (const [k, arr] of entries) {
        const pretty = k.replace(/_/g, ' ')
        lines.push(`${pretty}:`)
        for (const item of arr as any[]) lines.push(`- ${safeString(item)}`)
        lines.push('')
      }
      return lines.join('\n').trim()
    } else {
      for (const [k, v] of entries) {
        const mark = v ? '✓' : '✗'
        const pretty = k.replace(/_/g, ' ')
        lines.push(`- ${pretty}: ${mark}`)
      }
      return lines.join('\n')
    }
  }
  if (Array.isArray(checks)) return checks.map((x: any) => `- ${safeString(x)}`).join('\n')
  return safeString(checks)
}

const confirmCreateRec = async () => {
  if (curDoc.value !== 'rec' || !lang.value) return
  if (!recBase64.value) return
  recSubmitting.value = true
  try {
    const up: any = await $fetch(`${backendBase.value}/api/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: recName.value || 'upload.bin', contentBase64: recBase64.value, purpose: 'user_data' }
    })
    if (!up || up.status !== 'ok' || !up.file || !up.file.id) throw new Error('upload_failed')
    const fileId = up.file.id as string
    const res: any = await $fetch(`${backendBase.value}/api/rec/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { file_ids: [fileId], max_output_tokens: 8192, reasoning_effort: 'medium' } })
    // 仅提取 Structured Outputs 的 result，并将 "\n" 转义为真正的换行
    const unescapeNewlines = (t: string) => (t || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
    const pickResultString = (obj: any): string => {
      const r = obj?.result
      if (typeof r === 'string') return r
      if (r && typeof r === 'object') {
        const en = String(
          r.letter_en || r.recommendation_en || r.english || r.en || ''
        )
        const zh = String(
          r.letter_zh || r.recommendation_zh || r.chinese || r.zh || r.zh_cn || r.cn || ''
        )
        if (en && zh) return en + '\n\n' + zh
        if (en || zh) return en || zh
        // 未识别的对象结构，返回空以便后续使用后端提供的 output_text 回退
        return ''
      }
      return ''
    }
    let content = ''
    let reasoningForChat = ''
    try {
      const raw = res?.raw
      if (raw && Array.isArray(raw.output)) {
        outer: for (const item of raw.output) {
          const parts = item?.content || []
          for (const p of parts) {
            if (p && typeof p.json === 'object' && p.json) {
              const resultText = pickResultString(p.json)
              const rs = (p.json || {}).reasoning_summary
              if (typeof rs === 'string') reasoningForChat = rs
              if (resultText) {
                content = unescapeNewlines(resultText)
                break outer
              }
            }
          }
        }
      }
      if (!content && typeof res?.output_text === 'string' && res.output_text.trim()) {
        content = unescapeNewlines(res.output_text.trim())
      }
    } catch {}
    // 将其他结构化部分与 reasoning_summary 写入 Chatbot 历史（使用 convStore 以确保页面装载后可见）
    try {
      const { convStore } = await import('~/data/contextStore')
      const msgs: string[] = []
      const others = res?.others || {}
      const mat = formatMaterial(others.material)
      if (mat) msgs.push(`【素材提炼】\n${mat}`)
      const out = formatOutline(others.outline)
      if (out) msgs.push(`【写作大纲】\n${out}`)
      const chk = formatChecks(others.checks)
      if (chk) msgs.push(`【质量检查确认】\n${chk}`)
      const rs = reasoningForChat || (others.reasoning_summary || '')
      if (rs) msgs.push(`【推理摘要】\n${rs}`)
      if (Array.isArray(others.steps) && others.steps.length) msgs.push(`【步骤】\n- ${others.steps.join('\n- ')}`)
      if (msgs.length) {
        // 先建文档，再将消息追加到该文档的 chatId（等于文档 id）
        // 注意：下面会在拿到 id 后 append
        ;(window as any).__pendingChatMessages = msgs
      }
    } catch {}
    try {
      const raw = res?.raw
      if (!content && raw && Array.isArray(raw.output)) {
        for (const item of raw.output) {
          const parts = item?.content || []
          for (const p of parts) {
            if (p && typeof p.text === 'string') content += p.text
            if (p && typeof p.json === 'object' && p.json && typeof p.json.result === 'string') content = p.json.result
          }
        }
      }
      if (!content && typeof raw?.reply === 'string') content = raw.reply
    } catch {}
    const id = await newResumeFromImport(content || '', recName.value.replace(/\.[^.]+$/, '') || 'Recommendation')
    try {
      const msgs: string[] = (window as any).__pendingChatMessages || []
      if (msgs.length) {
        const { convStore } = await import('~/data/contextStore')
        for (const m of msgs) convStore.appendMessage(id, 'assistant', m)
        ;(window as any).__pendingChatMessages = []
      }
    } catch {}
    try { localStorage.setItem('doc_meta_' + id, JSON.stringify({ docType: 'rec', lang: lang.value })) } catch {}
    router.push(localePath(`/edit/${id}`))
  } catch (e) {
    ;(toast as any).import(false)
  } finally {
    recSubmitting.value = false
  }
}
</script>
