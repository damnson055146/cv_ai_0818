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
        <div class="relative p-4 space-y-4">
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

          <div v-if="curDoc === 'ps'" class="mt-4 space-y-3">
            <div class="rounded-lg border border-c bg-dark-c p-4 space-y-3">
              <div class="flex items-center justify-between text-sm font-medium text-light-c">
                <span>PS 预置信息</span>
                <span class="text-xs text-light-c opacity-70">可选</span>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1">
                  <label class="block text-xs text-light-c opacity-70">项目背景</label>
                  <input
                    v-model.trim="projectInfo"
                    class="w-full px-3 py-2 rounded border border-c bg-transparent outline-none focus:border-brand transition"
                    placeholder="Project info (optional)"
                  />
                </div>
                <div class="space-y-1">
                  <label class="block text-xs text-light-c opacity-70">学生亮点</label>
                  <input
                    v-model.trim="studentInfo"
                    class="w-full px-3 py-2 rounded border border-c bg-transparent outline-none focus:border-brand transition"
                    placeholder="Student info (optional)"
                  />
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-c bg-dark-c p-4 space-y-3">
              <div class="flex items-center justify-between text-sm font-medium text-light-c">
                <span>上传素材（可选）</span>
                <span class="text-xs text-light-c opacity-70">支持 PDF / MD / TXT / DOC / DOCX</span>
              </div>
              <input ref="uploadInputRef" type="file" class="hidden" :accept="acceptedTypes" @change="onUploadSelect" />
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded border border-dashed border-c px-3 py-2 text-sm text-light-c hover:border-brand hover:text-brand transition"
                  @click="openUploadPicker"
                >
                  <span i-mdi:tray-arrow-up />
                  <span>选择文件</span>
                </button>
                <button
                  v-if="uploadFile"
                  type="button"
                  class="text-xs text-light-c opacity-80 hover:text-red-400 transition"
                  @click="clearUpload"
                >移除</button>
              </div>
              <div v-if="uploadFile" class="flex items-center gap-2 rounded bg-darker-c px-3 py-2 text-xs text-light-c">
                <span i-mdi:file-document-outline />
                <span class="truncate">{{ uploadFile.name }}</span>
                <span v-if="uploadFileSummary" class="opacity-70">· {{ uploadFileSummary }}</span>
              </div>
              <div v-if="uploadParsing" class="text-xs text-brand animate-pulse">正在解析文件...</div>
            </div>

            <div class="rounded-lg border border-c bg-dark-c p-4 space-y-2">
              <div class="text-sm font-medium text-light-c">或输入初始信息</div>
              <textarea
                v-model="initialText"
                class="w-full min-h-[120px] resize-y rounded border border-c bg-transparent px-3 py-2 text-sm text-light-c focus:border-brand focus:outline-none transition"
                placeholder="粘贴初始素材、写作要求或其他背景信息（可选）"
              />
              <div class="text-xs text-light-c opacity-70">文字会与上传文件共同用于生成首稿，可单独使用。</div>
            </div>

            <div class="flex justify-end gap-2 border-t border-c pt-3">
              <button
                class="px-3 py-1.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition dark:bg-gray-600 dark:text-white/90"
                @click="resetDialog"
              >取消</button>
              <button
                class="px-3 py-1.5 rounded bg-blue-600 text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-2 transition"
                :disabled="!canConfirm || psSubmitting"
                @click="confirmCreate"
              >
                <span v-if="psSubmitting" class="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>确定</span>
              </button>
            </div>
          </div>
          <div v-if="curDoc === 'rec'" id="rec-create" class="mt-4 space-y-2">
            <div text-sm text-light-c>推荐信素材上传</div>
            <div class="space-y-1">
              <label class="text-xs text-light-c">上传文件（必需）</label>
              <input type="file" :accept="acceptedRecTypes" @change="onRecSelect" />
              <label class="text-xs text-light-c rec-optional-label">上传文件（可选）</label>
              <div v-if="recName" class="text-xs text-light-c">已选择：{{ recName }}</div>
            </div>
            <div class="space-y-1 rec-upload-block">
              <label class="text-xs text-light-c">输入信息（可选）</label>
              <textarea
                v-model.trim="recInitialText"
                rows="4"
                class="w-full px-3 py-2 rounded border border-c bg-transparent outline-none focus:border-brand transition"
                placeholder="例如：推荐人与学生关系、课程/项目背景、学生亮点、具体事例等"
              />
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-c">
              <button class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600" @click="resetDialog">取消</button>
              <button class="px-3 py-1 rounded bg-blue-600 text-white hover:opacity-90" :disabled="!canConfirm || recSubmitting" @click="confirmCreateRec">确定</button>
            </div>
          </div>
          
          <!-- 全局加载遮罩：新建文档时调用 Agent 显示动画 -->
          <div
            v-if="psSubmitting || recSubmitting"
            class="absolute inset-0 z-50 flex items-center justify-center rounded-md bg-black/30 backdrop-blur-sm"
            aria-live="polite"
          >
            <div class="flex flex-col items-center gap-3 px-4 py-3 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 shadow-md">
              <span class="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <div class="text-sm font-medium">
                {{ agentStep || ($t('common.loading_ai') || '正在调用智能写作，请稍候…') }}
              </div>
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
const recCfg = computed(() => (runtimeConfig.public as any)?.rec || { requireUpload: false, allowedUploadTypes: ["application/pdf"] })
const psAllowedTypes = computed(() => {
  const list = Array.isArray(psCfg.value.allowedUploadTypes) && psCfg.value.allowedUploadTypes.length > 0
    ? psCfg.value.allowedUploadTypes
    : ['application/pdf']
  const normalized = list.map(t => String(t).toLowerCase())
  if (!normalized.includes('application/pdf')) normalized.push('application/pdf')
  if (!normalized.includes('.pdf')) normalized.push('.pdf')
  return Array.from(new Set(normalized))
})
const acceptedTypes = computed(() => psAllowedTypes.value.join(','))
const uploadFileSummary = computed(() => {
  if (!uploadFile.value) return ''
  const parts: string[] = []
  const ext = uploadFile.value.ext ? uploadFile.value.ext.toUpperCase() : ''
  if (ext) parts.push(ext)
  if (uploadFile.value.size) parts.push(formatBytes(uploadFile.value.size))
  return parts.join(' · ')
})
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
type UploadPayload = {
  name: string
  mime: string
  ext: string
  size: number
  base64?: string
  text?: string
}

const step = ref<'doc' | 'lang'>('doc');
const curDoc = ref<Doc>('cv');
const lang = ref<Lang | null>(null)

const projectInfo = ref("")
const studentInfo = ref("")
const initialText = ref("")
const recInitialText = ref("")
const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadFile = ref<UploadPayload | null>(null)
const uploadParsing = ref(false)
const psSubmitting = ref(false)
const agentStep = ref<string>("")
const setAgentStep = (msg: string) => { agentStep.value = msg }
const recBase64 = ref<string | null>(null)
const recName = ref<string>("")
const recSubmitting = ref<boolean>(false)

const setLang = (l: Lang) => { lang.value = l }
const canConfirm = computed(() => {
  if (curDoc.value === 'ps') {
    if (!lang.value) return false
    if (uploadParsing.value) return false
    if (psCfg.value.requireUpload) {
      const hasFile = !!uploadFile.value
      const hasText = Boolean(initialText.value.trim())
      if (!hasFile && !hasText) return false
    }
    return true
  }
  if (curDoc.value === 'rec') {
    if (!lang.value) return false
    const hasFile = !!recBase64.value
    const hasText = Boolean(recInitialText.value?.trim?.() || '')
    if (recCfg.value.requireUpload) return hasFile
    return hasFile || hasText
  }
  return true
})

const resetDialog = () => {
  step.value = 'doc'
  curDoc.value = 'cv'
  lang.value = null
  projectInfo.value = ''
  studentInfo.value = ''
  initialText.value = ''
  uploadFile.value = null
  uploadParsing.value = false
  psSubmitting.value = false
  if (uploadInputRef.value) uploadInputRef.value.value = ''
  recBase64.value = null
  recName.value = ''
  recInitialText.value = ''
}

const openUploadPicker = () => {
  if (psSubmitting.value || uploadParsing.value) return
  uploadInputRef.value?.click()
}

const clearUpload = () => {
  uploadFile.value = null
  if (uploadInputRef.value) uploadInputRef.value.value = ''
}

const isPsFileAllowed = (file: File): boolean => {
  const allowed = psAllowedTypes.value
  if (!allowed.length) return true
  const mime = (file.type || '').toLowerCase()
  const ext = `.${(file.name?.split('.')?.pop() || '').toLowerCase()}`
  if (mime && allowed.includes(mime)) return true
  if (ext && allowed.includes(ext)) return true
  if (ext === '.pdf' || mime === 'application/pdf') return true
  if (ext === '.md' && allowed.includes('text/markdown')) return true
  if (ext === '.txt' && allowed.includes('text/plain')) return true
  if (ext === '.docx' && allowed.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return true
  if (ext === '.doc' && allowed.includes('application/msword')) return true
  return false
}

const onUploadSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  uploadParsing.value = true
  try {
    if (!isPsFileAllowed(file)) {
      uploadFile.value = null
      ;(toast as any).import(false)
      return
    }
    const name = file.name || 'attachment'
    const lowerMime = (file.type || '').toLowerCase()
    const lowerExt = (name.split('.').pop() || '').toLowerCase()
    const baseInfo: UploadPayload = { name, mime: lowerMime || '', ext: lowerExt, size: file.size }

    if (lowerExt === 'pdf' || lowerMime === 'application/pdf') {
      const dataUrl = await readFileAsDataUrl(file)
      uploadFile.value = { ...baseInfo, mime: 'application/pdf', ext: 'pdf', base64: extractBase64(dataUrl) }
    } else if (['md', 'markdown'].includes(lowerExt) || lowerMime === 'text/markdown') {
      const text = await readFileAsText(file)
      uploadFile.value = { ...baseInfo, ext: 'md', text }
    } else if (lowerExt === 'txt' || lowerMime === 'text/plain') {
      const text = await readFileAsText(file)
      uploadFile.value = { ...baseInfo, ext: 'txt', text }
    } else if (lowerExt === 'docx' || lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const buffer = await readFileAsArrayBuffer(file)
      const text = await convertDocxBufferToText(buffer)
      uploadFile.value = { ...baseInfo, ext: 'docx', text, base64: arrayBufferToBase64(buffer) }
    } else if (lowerExt === 'doc' || lowerMime === 'application/msword') {
      const dataUrl = await readFileAsDataUrl(file)
      uploadFile.value = { ...baseInfo, ext: 'doc', base64: extractBase64(dataUrl) }
    } else {
      const dataUrl = await readFileAsDataUrl(file)
      uploadFile.value = { ...baseInfo, base64: extractBase64(dataUrl) }
    }
    ;(toast as any).import(true)
  } catch (error) {
    console.error('[PS Upload] failed to process file', error)
    uploadFile.value = null
    ;(toast as any).import(false)
  } finally {
    uploadParsing.value = false
    if (input) input.value = ''
  }
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
  if (psSubmitting.value) return
  psSubmitting.value = true
  setAgentStep('准备创建文书...')
  let outlineId: string | null = null

  try {
    const chatId = `chat_${Date.now().toString(36)}`
    outlineId = await newResume(buildPsTemplateKey(lang.value, 'outline'))
    const bodyId = await newResume(buildPsTemplateKey(lang.value, 'body'))

    const { setPsMetaForPair } = await import('~/utils/ps')
    setPsMetaForPair({ outlineId, bodyId, chatId })

    if (fileId) try {
      setAgentStep('准备上下文...')
      const { convStore } = await import('~/data/contextStore')
      const prelim: string[] = []
      if (projectInfo.value) prelim.push(`Project: ${projectInfo.value}`)
      if (studentInfo.value) prelim.push(`Student: ${studentInfo.value}`)
      if (prelim.length) convStore.appendMessage(chatId, 'user', prelim.join('\n'))
      if (initialText.value.trim()) convStore.appendMessage(chatId, 'user', initialText.value.trim())
    } catch (err) {
      console.warn('[PS Seed] failed to preload chat context', err)
    }

    let extracted = ''
    if (uploadFile.value) {
      try {
        setAgentStep('解析上传的素材...')
        extracted = await extractTextFromFile()
      } catch (err) {
        console.error('[PS Upload] failed to extract content', err)
        extracted = ''
      }
    }

    const manual = initialText.value.trim()
    const uploadText = [extracted, manual].filter(Boolean).join('\n\n').trim()

    if (uploadText) {
      try {
        setAgentStep('生成初始写作建议...')
        const seed: any = await $fetch('/api/ps/seed-from-upload', {
          method: 'POST',
          body: {
            chatId,
            language: lang.value,
            uploadText,
            projectInfo: projectInfo.value,
            studentInfo: studentInfo.value
          }
        })
        if (seed && seed.status === 'ok') {
          try { localStorage.setItem(`ps_seed_${chatId}`, JSON.stringify(seed.data)) } catch {}
          try { (toast as any).import(true) } catch {}
        } else {
          try { (toast as any).import(false) } catch {}
        }
      } catch (err) {
        console.error('[PS Seed] request failed', err)
        try { (toast as any).import(false) } catch {}
      }
    }
  } catch (error) {
    console.error('[PS Create] failed to initialize document', error)
    try { (toast as any).import(false) } catch {}
  } finally {
    psSubmitting.value = false
    setAgentStep('')
  }

  if (outlineId) router.push(localePath(`/edit/${outlineId}`))
}

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
  reader.onerror = () => reject(reader.error)
  reader.readAsText(file)
})

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    if (reader.result instanceof ArrayBuffer) resolve(reader.result)
    else reject(new Error('Unexpected reader result'))
  }
  reader.onerror = () => reject(reader.error)
  reader.readAsArrayBuffer(file)
})

const extractBase64 = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`
}

const getBuffer = (): any => (typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined)

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const BufferImpl = getBuffer()
  if (typeof window === 'undefined' && BufferImpl) {
    return BufferImpl.from(buffer).toString('base64')
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  if (typeof btoa === 'function') return btoa(binary)
  return BufferImpl ? BufferImpl.from(binary, 'binary').toString('base64') : ''
}

const base64ToUint8Array = (b64: string): Uint8Array => {
  const BufferImpl = getBuffer()
  if (typeof window === 'undefined' && BufferImpl) {
    return Uint8Array.from(BufferImpl.from(b64, 'base64'))
  }
  const binary = typeof atob === 'function' ? atob(b64) : BufferImpl ? BufferImpl.from(b64, 'base64').toString('binary') : ''
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const base64ToArrayBuffer = (b64: string): ArrayBuffer => base64ToUint8Array(b64).buffer

const decodeBase64ToUtf8 = (b64: string): string => {
  try {
    const BufferImpl = getBuffer()
    if (typeof window === 'undefined' && BufferImpl) {
      return BufferImpl.from(b64, 'base64').toString('utf-8')
    }
    const bytes = base64ToUint8Array(b64)
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

const normalizeText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const htmlToPlainText = (html: string): string => {
  if (!html) return ''
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return normalizeText((doc.body?.textContent || '').trim())
  }
  return normalizeText(html.replace(/<[^>]+>/g, ' '))
}

const convertDocxBufferToText = async (buffer: ArrayBuffer): Promise<string> => {
  try {
    const mammothMod: any = await import(/* @vite-ignore */ 'mammoth/mammoth.browser')
    const mammothLib: any = (mammothMod && (mammothMod as any).default)
      || (typeof window !== 'undefined' ? (window as any).mammoth : null)
      || mammothMod
    const result = await mammothLib.convertToHtml({ arrayBuffer: buffer })
    const html = result?.value || ''
    return htmlToPlainText(html)
  } catch (error) {
    console.warn('[PS Upload] DOCX parse failed via mammoth', error)
    return ''
  }
}

const extractTextFromPdfBase64 = async (b64: string): Promise<string> => {
  const data = base64ToUint8Array(b64)
  const pdfjsLib: any = await import('pdfjs-dist')
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default as string
    if ((pdfjsLib as any)?.GlobalWorkerOptions && typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      const worker = new Worker(workerUrl, { type: 'module' })
      ;(pdfjsLib as any).GlobalWorkerOptions.workerPort = worker
    }
  } catch (err) {
    console.warn('[PS Upload] unable to initialize dedicated PDF worker', err)
  }
  const task = (pdfjsLib as any).getDocument({ data })
  const pdf = await task.promise
  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const items = (tc.items || []) as any[]
    const lineBuckets = new Map<number, Array<{ x: number; str: string }>>()
    const yTolerance = 2
    for (const it of items) {
      const tr = it.transform || [0, 0, 0, 0, 0, 0]
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
      let buf = ''
      for (let i = 0; i < line.length; i++) {
        const cur = line[i]
        const prev = line[i - 1]
        const gap = prev ? cur.x - prev.x : 0
        buf += (prev && gap > 6 ? ' ' : '') + cur.str
      }
      lines.push(buf.trim())
    }
    const pageText = lines.join('\n')
    fullText += (p > 1 ? '\n\n' : '') + pageText
  }
  return normalizeText(fullText)
}

const extractViaBackend = async (payload: UploadPayload): Promise<string> => {
  const url = backendBase.value ? `${backendBase.value}/api/files/extract-text` : '/api/files/extract-text'
  const res: any = await $fetch(url, {
    method: 'POST',
    body: {
      name: payload.name,
      contentBase64: payload.base64,
      language: lang.value,
      contentType: payload.mime
    }
  })
  if (res?.ok && typeof res.text === 'string') return normalizeText(res.text)
  throw new Error('extract_text_failed')
}

const extractTextFromFile = async (): Promise<string> => {
  const info = uploadFile.value
  if (!info) return ''

  if (info.text && info.text.trim()) return normalizeText(info.text)

  if (info.base64) {
    if (info.ext === 'pdf') {
      return await extractTextFromPdfBase64(info.base64)
    }
    if (info.ext === 'doc') {
      return await extractViaBackend(info)
    }
    if (info.ext === 'docx') {
      const buffer = base64ToArrayBuffer(info.base64)
      const text = await convertDocxBufferToText(buffer)
      if (text) return normalizeText(text)
      return await extractViaBackend(info)
    }
    if (['md', 'markdown', 'txt'].includes(info.ext)) {
      return normalizeText(decodeBase64ToUtf8(info.base64))
    }
    return normalizeText(decodeBase64ToUtf8(info.base64))
  }

  return ''
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
const parseMaybeJson = (raw: any): any => {
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (!trimmed) return raw
  if (!/^[\[{]/.test(trimmed)) return raw
  try { return JSON.parse(trimmed) } catch { return raw }
}
const formatMaterial = (material: any): string => {
  if (!material) return ''
  const source = parseMaybeJson(material)
  if (typeof source === 'string') return source.trim()
  try {
    const stories = Array.isArray(source?.stories) ? source.stories : []
    if (!stories.length) return safeString(source)
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
    return safeString(source)
  }
}
const formatOutline = (outline: any): string => {
  if (!outline) return ''
  const source = parseMaybeJson(outline)
  if (typeof source === 'string') return source.trim()
  try {
    const lines: string[] = []
    const opening = source?.opening || source?.intro || ''
    if (opening) { lines.push('Opening:'); lines.push(String(opening)) }
    const bps = Array.isArray(source?.body_paragraphs || source?.body)
      ? (source.body_paragraphs || source.body)
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
    const closing = source?.closing || source?.conclusion || source?.outro || ''
    if (closing) { lines.push('Closing:'); lines.push(String(closing)) }
    return lines.join('\n')
  } catch {
    return safeString(source)
  }
}
const formatChecks = (checks: any): string => {
  if (!checks) return ''
  const source = parseMaybeJson(checks)
  if (typeof source === 'string') return source.trim()
  if (isPlainObject(source)) {
    const lines: string[] = []
    const entries = Object.entries(source as Record<string, any>)
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
  if (Array.isArray(source)) return source.map((x: any) => `- ${safeString(x)}`).join('\n')
  return safeString(source)
}

const confirmCreateRec = async () => {
  if (curDoc.value !== 'rec' || !lang.value) return
  if (!recBase64.value && !recInitialText.value.trim()) return
  recSubmitting.value = true
  setAgentStep('准备生成推荐信...')
  try {
    let fileId: string | null = null
    if (recBase64.value) {
      setAgentStep('上传附件...')
      const up: any = await $fetch(`${backendBase.value}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { name: recName.value || 'upload.bin', contentBase64: recBase64.value, purpose: 'user_data' }
      })
      if (!up || up.status !== 'ok' || !up.file || !up.file.id) throw new Error('upload_failed')
      fileId = up.file.id as string
    }
    // 记录附件消息，供 Chatbot 展示与预览
    try {
      const name = recName.value || 'upload.bin'
      const lower = name.toLowerCase()
      const mime = /\.pdf$/.test(lower) ? 'application/pdf'
        : /\.docx$/.test(lower) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : /\.doc$/.test(lower) ? 'application/msword'
        : /\.md$/.test(lower) ? 'text/markdown'
        : /\.txt$/.test(lower) ? 'text/plain'
        : ''
      const payload = { images: [], files: [{ id: fileId, name, mime }] }
      const marker = '[[ATTACHMENTS]]' + JSON.stringify(payload)
      ;(window as any).__pendingChatMessages = ((window as any).__pendingChatMessages || [])
      ;(window as any).__pendingChatMessages.unshift(marker)
    } catch {}
    const reqBody: any = { max_output_tokens: 8192, reasoning_effort: 'medium' }
    if (fileId) reqBody.file_ids = [fileId]
    if (recInitialText.value.trim()) reqBody.prompt = recInitialText.value.trim()
    setAgentStep('调用模型生成内容...')
    const res: any = await $fetch(`${backendBase.value}/api/rec/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody })
    // 仅提取 Structured Outputs 的 result，并将 "\n" 转义为真正的换行
    const unescapeNewlines = (t: string) => (t || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
    const pickResultString = (obj: any): string => {
      const r = obj?.result
      if (typeof r === 'string') return r
      if (r && typeof r === 'object') {
        const en = String(
          r.letter_en || r.recommendation_en || r.english_letter || r.english_text || r.english || r.en || ''
        )
        const zh = String(
          r.letter_zh || r.recommendation_zh || r.chinese_translation || r.chinese_letter || r.chinese || r.zh || r.zh_cn || r.cn || ''
        )
        if (en && zh) return en + '\n\n' + zh
        if (en || zh) return en || zh
        // 未识别的对象结构，返回空以便后续使用后端提供的 output_text 回退
        return ''
      }
      return ''
    }
    setAgentStep('解析与整理结果...')
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
    setAgentStep('创建文档...')
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
    setAgentStep('跳转编辑器...')
    router.push(localePath(`/edit/${id}`))
  } catch (e) {
    ;(toast as any).import(false)
  } finally {
    recSubmitting.value = false
    setAgentStep('')
  }
}
</script>

<style scoped>
#rec-create .rec-upload-block > label:first-child {
  display: none;
}
#rec-create .rec-upload-block .rec-optional-label {
  display: inline-block;
}
</style>
