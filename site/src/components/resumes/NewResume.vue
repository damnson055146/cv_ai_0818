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
                @click="(curDoc === 'ps' || curDoc === 'rec' || curDoc === 'cv') ? setLang('en') : createBy(curDoc, 'en')"
              >English</button>
              <button
                :class="['px-3 py-2 rounded border hover:border-darker-c hover:bg-dark-c', lang === 'zh' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-c']"
                @click="(curDoc === 'ps' || curDoc === 'rec' || curDoc === 'cv') ? setLang('zh') : createBy(curDoc, 'zh')"
              >中文</button>
            </div>
          </div>

          <div v-if="curDoc === 'cv'" id="cv-create" class="mt-4 space-y-3">
            <div class="rounded-lg border border-c bg-dark-c p-4 space-y-3">
              <div class="flex items-center justify-between text-sm font-medium text-light-c">
                <span>上传素材（{{ cvCfg.requireUpload ? '必需' : '可选' }}）</span>
                <span class="text-xs text-light-c opacity-70">支持 PDF / MD / TXT / DOC / DOCX</span>
              </div>
              <input type="file" :accept="acceptedCvTypes" @change="onCvSelect" />
              <div v-if="cvName" class="text-xs text-light-c">已选择：{{ cvName }}</div>
            </div>
            <div class="space-y-1 cv-upload-block">
              <label class="text-xs text-light-c">输入信息（可选）</label>
              <textarea
                v-model.trim="cvInitialText"
                rows="4"
                class="w-full px-3 py-2 rounded border border-c bg-transparent outline-none focus:border-brand transition"
                placeholder="例如：个人背景、教育经历亮点、关键项目、技能要点等"
              />
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-c">
              <button
                type="button"
                class="text-xs text-light-c opacity-80 hover:text-brand transition"
                :disabled="cvSubmitting"
                @click="createTemplateCv"
              >直接使用默认模板</button>
              <div class="ml-auto flex gap-2">
                <button class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600" :disabled="cvSubmitting" @click="resetDialog">取消</button>
                <button class="px-3 py-1 rounded bg-blue-600 text-white hover:opacity-90" :disabled="!canConfirm || cvSubmitting" @click="confirmCreateCv">确定</button>
              </div>
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
              <label class="text-xs text-light-c">上传文件（{{ recCfg.requireUpload ? '必需' : '可选' }}）</label>
              <input type="file" :accept="acceptedRecTypes" @change="onRecSelect" />
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
            v-if="psSubmitting || recSubmitting || cvSubmitting"
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
import { resolveBackendBase } from "~/utils/backendBase";

const runtimeConfig = useRuntimeConfig()
const backendBase = computed(() => resolveBackendBase((runtimeConfig.public as any)?.backendBase))
const defaultAllowedUploadTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf',
  '.txt',
  '.md',
  '.doc',
  '.docx'
]
const psCfg = computed(() => (runtimeConfig.public as any)?.ps || { requireUpload: false, allowedUploadTypes: defaultAllowedUploadTypes })
const cvCfg = computed(() => (runtimeConfig.public as any)?.cv || { requireUpload: false, allowedUploadTypes: defaultAllowedUploadTypes })
const recCfg = computed(() => (runtimeConfig.public as any)?.rec || { requireUpload: false, allowedUploadTypes: defaultAllowedUploadTypes })
const psAllowedTypes = computed(() => {
  const list = Array.isArray(psCfg.value.allowedUploadTypes) && psCfg.value.allowedUploadTypes.length > 0
    ? psCfg.value.allowedUploadTypes
    : defaultAllowedUploadTypes
  const normalized = list.map(t => String(t).toLowerCase())
  if (!normalized.includes('application/pdf')) normalized.push('application/pdf')
  if (!normalized.includes('.pdf')) normalized.push('.pdf')
  return Array.from(new Set(normalized))
})
const acceptedTypes = computed(() => psAllowedTypes.value.join(','))
const acceptedCvTypes = computed(() => {
  const types = Array.isArray(cvCfg.value.allowedUploadTypes) && cvCfg.value.allowedUploadTypes.length > 0
    ? cvCfg.value.allowedUploadTypes.join(',')
    : defaultAllowedUploadTypes.join(',')
  return types.includes('.pdf') ? types : `${types},.pdf`
})
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
    : defaultAllowedUploadTypes.join(',')
  // Always allow .pdf extension as fallback for browsers that set generic mime types
  return types.includes('.pdf') ? types : `${types},.pdf`
})
const router = useRouter();
const localePath = useLocalePath();
import { useToast } from "~/composables/toast";
import { deleteResume, getStorage, newResume, newResumeFromImport, saveResume } from "~/utils/database";
import { buildTemplateKey, buildPsTemplateKey } from "~/utils";
import { createChatId, setDocMeta } from "~/utils/docContext";
import { uploadSupportFile } from "~/utils/fileUpload";
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
const cvInitialText = ref("")
const recInitialText = ref("")
const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadFile = ref<UploadPayload | null>(null)
const uploadParsing = ref(false)
const psSubmitting = ref(false)
const agentStep = ref<string>("")
const setAgentStep = (msg: string) => { agentStep.value = msg }
const cvBase64 = ref<string | null>(null)
const cvName = ref<string>("")
const recBase64 = ref<string | null>(null)
const recName = ref<string>("")
const recSubmitting = ref<boolean>(false)
const cvSubmitting = ref<boolean>(false)

const guessFileMime = (filename: string): string => {
  const lower = (filename || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return ''
}

const ensurePrimaryHeading = (markdown: string): { markdown: string; heading: string } => {
  if (!markdown) return { markdown, heading: '' }
  const single = markdown.match(/^#\s+(.+)$/m)
  if (single) return { markdown, heading: single[1].trim() }
  const double = markdown.match(/^##\s+(.+)$/m)
  if (double) {
    return { markdown: markdown.replace(/^##\s+(.+)$/m, '# $1'), heading: double[1].trim() }
  }
  return { markdown, heading: '' }
}

const outlineTitleKeys = ['title', 'heading', 'section', 'name', 'label', 'topic', 'headline']
const outlineNumberKeys = ['order', 'index', 'number', 'step', 'position']
const outlineChildKeys = ['points', 'bullets', 'details', 'items', 'subsections', 'children', 'summary', 'content', 'paragraphs', 'highlights', 'support', 'examples', 'subpoints', 'subitems', 'sections', 'elements', 'notes', 'outline', 'steps', 'body']

const renderOutlineStructure = (value: any): string => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()

  const seen = new WeakSet<object>()
  const lines: string[] = []

  const addLine = (text: string, depth: number) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (depth === 0) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      lines.push(trimmed.startsWith('#') ? trimmed : `## ${trimmed}`)
      return
    }
    const indent = '  '.repeat(Math.max(0, depth - 1))
    const sanitized = trimmed.replace(/^[-*•]\s+/, '').trim()
    lines.push(`${indent}- ${sanitized || trimmed}`)
  }

  const visit = (node: any, depth: number) => {
    if (!node) return
    if (typeof node === 'string') {
      addLine(node, depth)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth)
      return
    }
    if (typeof node === 'object') {
      if (seen.has(node)) return
      seen.add(node)
      const obj = node as Record<string, any>
      const title = outlineTitleKeys.map((key) => (typeof obj[key] === 'string' ? obj[key].trim() : '')).find(Boolean)
      let numbering = ''
      for (const key of outlineNumberKeys) {
        if (typeof obj[key] === 'number') {
          numbering = `${obj[key]}. `
          break
        }
        if (typeof obj[key] === 'string' && obj[key].trim()) {
          numbering = `${obj[key].trim()} `
          break
        }
      }
      if (title) addLine(`${numbering}${title}`.trim(), depth)
      let childHandled = false
      for (const key of outlineChildKeys) {
        if (obj[key] === undefined) continue
        visit(obj[key], title ? depth + 1 : depth)
        childHandled = true
      }
      if (!childHandled) {
        for (const key of Object.keys(obj)) {
          if (outlineTitleKeys.includes(key) || outlineChildKeys.includes(key) || outlineNumberKeys.includes(key)) continue
          visit(obj[key], title ? depth + 1 : depth)
        }
      }
    }
  }

  visit(value, 0)
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text
}

const setLang = (l: Lang) => { lang.value = l }
const canConfirm = computed(() => {
  if (curDoc.value === 'ps') {
    if (!lang.value) return false
    if (uploadParsing.value) return false
    const hasFile = !!uploadFile.value
    const hasText = Boolean(initialText.value.trim())
    if (!hasFile && !hasText) return false
    if (psCfg.value.requireUpload && !hasFile) return false
    return true
  }
  if (curDoc.value === 'rec') {
    if (!lang.value) return false
    const hasFile = !!recBase64.value
    const hasText = Boolean(recInitialText.value.trim())
    if (recCfg.value.requireUpload && !hasFile) return false
    if (!hasFile && !hasText) return false
    return true
  }
  if (curDoc.value === 'cv') {
    if (!lang.value) return false
    const hasFile = !!cvBase64.value
    const hasText = Boolean(cvInitialText.value.trim())
    if (cvCfg.value.requireUpload && !hasFile) return false
    if (!hasFile && !hasText) return false
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
  initialText.value = ''
  cvInitialText.value = ''
  uploadFile.value = null
  uploadParsing.value = false
  psSubmitting.value = false
  if (uploadInputRef.value) uploadInputRef.value.value = ''
  cvBase64.value = null
  cvName.value = ''
  cvSubmitting.value = false
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
    setDocMeta(id, { docType: docType === 'rec' ? 'rec' : 'cv', lang });
    router.push(localePath(`/edit/${id}`));
    return
  }

  // Create two docs: outline and body, share chatId
  const chatId = createChatId();
  const outlineId = await newResume(buildPsTemplateKey(lang, 'outline'))
  const bodyId = await newResume(buildPsTemplateKey(lang, 'body'))

  // Mark meta for PS outline/body pair
  const { setPsMetaForPair } = await import('~/utils/ps')
  setPsMetaForPair({ outlineId, bodyId, chatId })
  setDocMeta(outlineId, { docType: 'ps', lang })
  setDocMeta(bodyId, { docType: 'ps', lang })

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

  const manual = initialText.value.trim()
  const hasFile = !!uploadFile.value
  if (!hasFile && !manual) {
    ;(toast as any).import(false)
    return
  }
  if (psCfg.value.requireUpload && !hasFile) {
    ;(toast as any).import(false)
    return
  }

  psSubmitting.value = true
  setAgentStep('准备创建文书...')

  let outlineId: string | null = null
  let bodyId: string | null = null
  let chatId: string | null = null

  const decodeNewlines = (text: string) => (text || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
  const looksLikeJson = (text: string) => {
    const trimmed = text.trim()
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  }
  const looksLikeOutlineText = (text: string) => {
    if (!text) return false
    const headingMatches = text.match(/^#{1,3}\s+/gm)?.length || 0
    const numberedMatches = text.match(/^\s*(?:\d+[.)]|[IVX]+\.)\s+/gim)?.length || 0
    const bulletMatches = text.match(/^\s*[-*•]\s+/gm)?.length || 0
    const sectionSignals = headingMatches + numberedMatches
    if (sectionSignals >= 2) return true
    if (sectionSignals >= 1 && bulletMatches >= 2) return true
    if (bulletMatches >= 4) return true
    return /大纲|outline/i.test(text)
  }
  const extractByKeys = (value: any, keys: string[], options?: { transform?: (input: any) => string }): string => {
    const visited = new WeakSet<object>()
    const transform = options?.transform

    const collectAll = (input: any): string => {
      if (!input) return ''
      if (typeof input === 'string') return input.trim()
      if (transform) {
        try {
          const transformed = transform(input)
          if (transformed) return transformed.trim()
        } catch {}
      }
      const seen = new WeakSet<object>()
      const gather = (node: any): string[] => {
        if (!node) return []
        if (typeof node === 'string') return [node.trim()]
        if (Array.isArray(node)) return node.flatMap((item) => gather(item))
        if (typeof node === 'object') {
          if (seen.has(node)) return []
          seen.add(node)
          const obj = node as Record<string, any>
          return Object.keys(obj).flatMap((key) => gather(obj[key]))
        }
        return []
      }
      return gather(input).filter(Boolean).join('\n\n').trim()
    }

    const walk = (node: any): string => {
      if (!node) return ''
      if (typeof node === 'string') return node.trim()
      if (Array.isArray(node)) {
        for (const item of node) {
          const found = walk(item)
          if (found) return found
        }
        return ''
      }
      if (typeof node === 'object') {
        if (visited.has(node)) return ''
        visited.add(node)
        const obj = node as Record<string, any>
        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const result = collectAll(obj[key])
            if (result) return result
          }
        }
        for (const key of Object.keys(obj)) {
          if (keys.includes(key)) continue
          const result = walk(obj[key])
          if (result) return result
        }
      }
      return ''
    }

    return walk(value).trim()
  }

  try {
    chatId = createChatId()
    outlineId = await newResume(buildPsTemplateKey(lang.value, 'outline'))
    bodyId = await newResume(buildPsTemplateKey(lang.value, 'body'))
    if (!outlineId || !bodyId) throw new Error('ps_doc_init_failed')

    const psUtils = await import('~/utils/ps')
    psUtils.setPsMetaForPair({ outlineId, bodyId, chatId })
    setDocMeta(outlineId, { docType: 'ps', lang: lang.value })
    setDocMeta(bodyId, { docType: 'ps', lang: lang.value })

    try {
      const { convStore } = await import('~/data/contextStore')
      const prelim: string[] = []
      if (projectInfo.value) prelim.push(`Project: ${projectInfo.value}`)
      if (studentInfo.value) prelim.push(`Student: ${studentInfo.value}`)
      if (prelim.length) convStore.appendMessage(chatId, 'user', prelim.join('\n'))
      if (manual) convStore.appendMessage(chatId, 'user', manual)
    } catch (err) {
      console.warn('[PS Context] failed to append prelim messages', err)
    }

    let fileId: string | null = null
    let attachmentName = ''
    let attachmentMime = ''
    if (uploadFile.value) {
      const info = uploadFile.value
      attachmentName = info.name || 'attachment.bin'
      attachmentMime = guessFileMime(attachmentName) || info.mime || ''
      let base64Payload = info.base64 || ''
      if (!base64Payload && info.text) {
        base64Payload = textToBase64(info.text)
      }
      if (base64Payload) {
        setAgentStep('上传附件...')
        fileId = await uploadSupportFile({
          backendBase: backendBase.value,
          name: attachmentName,
          contentBase64: base64Payload,
          purpose: 'user_data',
          contentType: attachmentMime || undefined
        })
        try {
          const payload = { images: [], files: [{ id: fileId, name: attachmentName, mime: attachmentMime }] }
          const marker = '[[ATTACHMENTS]]' + JSON.stringify(payload)
          ;(window as any).__pendingChatMessages = ((window as any).__pendingChatMessages || [])
          ;(window as any).__pendingChatMessages.unshift(marker)
        } catch {}
      }
    }

    setAgentStep('整理上下文...')
    let extracted = ''
    if (uploadFile.value) {
      try {
        extracted = await extractTextFromFile()
      } catch (err) {
        console.error('[PS Upload] failed to extract content', err)
        extracted = ''
      }
    }

    const promptSections: string[] = []
    if (projectInfo.value) promptSections.push(`Project Information:\n${projectInfo.value}`)
    if (studentInfo.value) promptSections.push(`Student Profile:\n${studentInfo.value}`)
    if (manual) promptSections.push(`User Notes:\n${manual}`)
    if (extracted) promptSections.push(`Extracted Materials:\n${extracted}`)
    const promptText = promptSections.join('\n\n').trim()

    if (!fileId && !promptText) throw new Error('missing_input')

    const reqBody: any = {
      doc_type: 'ps',
      max_output_tokens: 32768,
      reasoning_effort: 'medium'
    }
    if (lang.value) reqBody.language = lang.value
    if (fileId) reqBody.file_ids = [fileId]
    if (promptText) reqBody.prompt = promptText

    setAgentStep('调用模型生成文书...')
    const createUrl = backendBase.value ? `${backendBase.value}/api/create` : '/api/create'
    const res: any = await $fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: reqBody
    })

    setAgentStep('解析与整理结果...')

    const others = (res?.others && typeof res.others === 'object') ? res.others : {}
    const structuredCandidates: any[] = []
    const outlineStrings: string[] = []
    const bodyStrings: string[] = []

    const normalizedOutlineFromOthers = renderOutlineStructure((others as any)?.outline)
    if (normalizedOutlineFromOthers) outlineStrings.push(normalizedOutlineFromOthers)
    if (typeof res?.result === 'string') bodyStrings.push(res.result)
    if (typeof res?.output_text === 'string') {
      const text = res.output_text.trim()
      if (text) {
        if (looksLikeJson(text)) {
          try {
            structuredCandidates.push(JSON.parse(text))
          } catch {}
        } else {
          if (looksLikeOutlineText(text)) outlineStrings.push(text)
          else bodyStrings.push(text)
        }
      }
    }

    const rawOutput = res?.raw
    if (rawOutput && Array.isArray(rawOutput.output)) {
      for (const item of rawOutput.output) {
        const contents = item?.content || []
        for (const chunk of contents) {
          if (chunk && typeof chunk.json === 'object') structuredCandidates.push(chunk.json)
          if (typeof chunk.text === 'string') {
            const txt = chunk.text.trim()
            if (txt) {
              if (looksLikeOutlineText(txt)) outlineStrings.push(txt)
              else bodyStrings.push(txt)
            }
          }
        }
      }
    }

    if (res?.result && typeof res.result === 'object') structuredCandidates.push(res.result)
    if (others) structuredCandidates.push(others)

    let outlineCandidate = ''
    let bodyCandidate = ''
    let reasoningCandidate = typeof others.reasoning_summary === 'string' ? others.reasoning_summary : ''

    for (const candidate of structuredCandidates) {
      if (!outlineCandidate) {
        const outline = extractByKeys(candidate, ['outline', 'ps_outline', 'outline_text', 'outline_markdown'], { transform: renderOutlineStructure })
        if (outline) outlineCandidate = outline
      }
      if (!bodyCandidate) {
        const body = extractByKeys(candidate, ['body', 'ps_body', 'english_letter', 'english_text', 'text', 'result', 'statement'])
        if (body) bodyCandidate = body
      }
      if (!reasoningCandidate) {
        const summary = extractByKeys(candidate, ['reasoning_summary', 'summary', 'analysis'])
        if (summary) reasoningCandidate = summary
      }
      if (outlineCandidate && bodyCandidate && reasoningCandidate) break
    }

    if (!outlineCandidate && outlineStrings.length) {
      const uniqueOutlinePieces = Array.from(new Set(outlineStrings.map((item) => item.trim()).filter(Boolean)))
      const mergedOutline = uniqueOutlinePieces.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
      if (mergedOutline) outlineCandidate = mergedOutline
    }
    if (!bodyCandidate && bodyStrings.length) bodyCandidate = bodyStrings[0]

    const finalOutline = decodeNewlines(outlineCandidate || '').trim()
    const bodySource = bodyCandidate || bodyStrings[0] || manual || extracted
    const normalizedBody = ensurePrimaryHeading(decodeNewlines(bodySource || '').trim())
    const finalBody = normalizedBody.markdown
    const bodyHeading = normalizedBody.heading

    if (!finalOutline && !finalBody) throw new Error('no_content')

    setAgentStep('写入文档...')
    const storage = (await getStorage()) || {}
    const timestamp = Date.now().toString()

    if (outlineId && finalOutline && storage[outlineId]) {
      await saveResume(outlineId, {
        ...storage[outlineId],
        markdown: finalOutline,
        update: timestamp
      })
    }
    if (bodyId && storage[bodyId]) {
      await saveResume(bodyId, {
        ...storage[bodyId],
        markdown: finalBody || storage[bodyId].markdown,
        name: bodyHeading || storage[bodyId].name,
        update: timestamp
      })
    }

    if (outlineId && bodyId) {
      const outlineHash = finalOutline ? psUtils.simpleHash(finalOutline) : undefined
      psUtils.setPsMetaForPair({ outlineId, bodyId, chatId, initialOutlineHash: outlineHash })
    }

    const detailMessages: string[] = []
    const materialMsg = formatMaterial((others as any)?.material)
    if (materialMsg) detailMessages.push(`【material】\n${materialMsg}`)
    if (finalOutline) detailMessages.push(`【outline】\n${finalOutline}`)
    const checksMsg = formatChecks((others as any)?.checks)
    if (checksMsg) detailMessages.push(`【checks】\n${checksMsg}`)
    const reasoningMsg = (reasoningCandidate || '').trim()
    if (reasoningMsg) detailMessages.push(`【推理摘要】\n${reasoningMsg}`)
    const steps = Array.isArray((others as any)?.steps) ? (others as any).steps : []
    if (steps.length) detailMessages.push(`【步骤】\n- ${steps.join('\n- ')}`)

    try {
      const pending = Array.isArray((window as any).__pendingChatMessages)
        ? (window as any).__pendingChatMessages
        : ((window as any).__pendingChatMessages = [])
      pending.push(...detailMessages)
      const { convStore } = await import('~/data/contextStore')
      for (const msg of detailMessages) convStore.appendMessage(chatId, 'assistant', msg)
    } catch {}

    try { localStorage.setItem(`ps_seed_${chatId}`, JSON.stringify({ outline: finalOutline, body: finalBody })) } catch {}

    ;(toast as any).import(true)
    uploadFile.value = null
    if (uploadInputRef.value) uploadInputRef.value.value = ''
    initialText.value = ''
    projectInfo.value = ''
    studentInfo.value = ''

    setAgentStep('跳转编辑器...')
    router.push(localePath(`/edit/${outlineId}`))
  } catch (error) {
    console.error('[PS Create] failed', error)
    ;(toast as any).import(false)
    if (chatId) try { localStorage.removeItem(`ps_seed_${chatId}`) } catch {}
    try {
      if (outlineId) await deleteResume(outlineId)
      if (bodyId) await deleteResume(bodyId)
    } catch {}
  } finally {
    psSubmitting.value = false
    setAgentStep('')
  }
}

const createTemplateCv = async () => {
  if (curDoc.value !== 'cv') return
  const targetLang = lang.value
  if (!targetLang) return
  await createBy('cv', targetLang)
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

const textToBase64 = (text: string): string => {
  if (!text) return ''
  const BufferImpl = getBuffer()
  if (typeof window === 'undefined' && BufferImpl) {
    return BufferImpl.from(text, 'utf-8').toString('base64')
  }
  try {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(text)))
    }
  } catch {}
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
  if (encoder) {
    return arrayBufferToBase64(encoder.encode(text).buffer)
  }
  return ''
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

const isCvFileAllowed = (file: File): boolean => {
  const raw = (cvCfg.value.allowedUploadTypes as string[]) || []
  const allowed = raw.map((t) => String(t).toLowerCase())
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

const onCvSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  try {
    if (!isCvFileAllowed(file)) {
      cvBase64.value = null
      cvName.value = ''
      ;(toast as any).import(false)
      return
    }
  } catch {}
  cvName.value = file.name || 'attachment.bin'
  const reader = new FileReader()
  reader.onload = () => {
    const res = typeof reader.result === 'string' ? reader.result : ''
    const comma = res.indexOf(',')
    cvBase64.value = comma >= 0 ? res.slice(comma + 1) : res
  }
  reader.readAsDataURL(file)
}

const isRecFileAllowed = (file: File): boolean => {
  const raw = (recCfg.value.allowedUploadTypes as string[]) || []
  const allowed = raw.map((t) => String(t).toLowerCase())
  if (!allowed.length) return true
  const mime = (file.type || '').toLowerCase()
  const ext = `.${(file.name?.split('.')?.pop() || '').toLowerCase()}`
  if (mime && allowed.includes(mime)) return true
  if (ext && allowed.includes(ext)) return true
  // Always allow PDF by extension or mime
  if (ext === '.pdf' || mime === 'application/pdf') return true
  // Common fallbacks when browsers set generic or empty types
  if (ext === '.md' && allowed.includes('text/markdown')) return true
  if (ext === '.txt' && allowed.includes('text/plain')) return true
  if (ext === '.docx' && allowed.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return true
  if (ext === '.doc' && allowed.includes('application/msword')) return true
  return false
}

const onRecSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return
  try {
    if (!isRecFileAllowed(file)) {
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

const confirmCreateCv = async () => {
  if (curDoc.value !== 'cv' || !lang.value) return
  const promptText = cvInitialText.value.trim()
  const hasFile = !!cvBase64.value
  if (!hasFile && !promptText) {
    ;(toast as any).import(false)
    return
  }
  cvSubmitting.value = true
  setAgentStep('准备生成简历...')
  try {
    let fileId: string | null = null
    const originalName = cvName.value || 'upload.bin'
    const originalMime = guessFileMime(originalName)
    if (cvBase64.value) {
      setAgentStep('上传附件...')
      fileId = await uploadSupportFile({
        backendBase: backendBase.value,
        name: originalName,
        contentBase64: cvBase64.value,
        purpose: 'user_data',
        contentType: originalMime || undefined
      })
    }

    // 附件占位，便于 Chatbot 侧展示
    try {
      if (fileId) {
        const mime = originalMime
        const payload = { images: [], files: [{ id: fileId, name: originalName, mime }] }
        const marker = '[[ATTACHMENTS]]' + JSON.stringify(payload)
        const pending = Array.isArray((window as any).__pendingChatMessages)
          ? (window as any).__pendingChatMessages
          : ((window as any).__pendingChatMessages = [])
        pending.unshift(marker)
      }
    } catch {}

    const reqBody: any = {
      doc_type: 'cv',
      max_output_tokens: 32768,
      reasoning_effort: 'medium',
      template_key: buildTemplateKey('cv', lang.value)
    }
    if (lang.value) reqBody.language = lang.value
    if (fileId) reqBody.file_ids = [fileId]
    if (promptText) reqBody.prompt = promptText

    setAgentStep('调用模型生成简历...')
    const createUrl = backendBase.value ? `${backendBase.value}/api/cv/create` : '/api/cv/create'
    const res: any = await $fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: reqBody
    })

    setAgentStep('解析与整理结果...')
    const unescapeNewlines = (t: string) => (t || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
    const digResult = (source: any): { markdown: string; name?: string } => {
      let markdown = ''
      let name = ''
      const pickMarkdown = (text: any): string => {
        if (typeof text !== 'string') return ''
        const trimmed = text.trim()
        if (!trimmed) return ''
        // Heuristic: prefer multi-line or heading-style strings to avoid grabbing plain labels
        const looksStructured = /\n/.test(trimmed) || /^#{1,3}\s/.test(trimmed)
        return looksStructured ? trimmed : ''
      }
      const tryAssign = (val: any) => {
        if (!val) return
        if (typeof val === 'string' && val.trim()) {
          if (!markdown) {
            const picked = pickMarkdown(val)
            if (picked) markdown = picked
          }
          return
        }
        if (typeof val === 'object') {
          const directCandidates = [
            (val as any).english_letter,
            (val as any).letter_en,
            (val as any).english_text,
            (val as any).english,
            (val as any).en,
            (val as any).result?.english_letter,
            (val as any).result?.letter_en,
            (val as any).result?.english_text,
            (val as any).result?.english,
            (val as any).result?.en
          ]
          for (const candidate of directCandidates) {
            if (markdown) break
            const picked = pickMarkdown(candidate)
            if (picked) markdown = picked
          }
          if (markdown) return
          const mdKeys = [
            'markdown',
            'resume_markdown',
            'cv_markdown',
            'resume',
            'cv',
            'content',
            'text',
            'body',
            'english_letter',
            'letter_en',
            'english_text',
            'english',
            'en'
          ]
          for (const key of mdKeys) {
            const candidate = (val as any)[key]
            if (typeof candidate === 'string' && candidate.trim()) {
              if (!markdown) {
                const picked = pickMarkdown(candidate)
                if (picked) markdown = picked
              }
            }
          }
          const nameKeys = ['name', 'title', 'filename', 'document_name']
          for (const key of nameKeys) {
            const n = (val as any)[key]
            if (typeof n === 'string' && n.trim()) {
              if (!name) name = n.trim()
            }
          }
          if ((val as any).result) tryAssign((val as any).result)
          if (Array.isArray(val)) {
            for (const item of val) {
              if (markdown) break
              tryAssign(item)
            }
          } else {
            for (const key of Object.keys(val)) {
              if (markdown) break
              if (key === 'result') continue
              tryAssign((val as any)[key])
            }
          }
        }
      }
      tryAssign(source)
      return { markdown, name }
    }

    let markdown = ''
    let resumeName = ''
    let reasoningForChat = ''
    let others: any = {}

    const directResult = typeof res?.result === 'string' ? res.result.trim() : ''
    if (directResult) {
      markdown = directResult
    } else {
      others = res?.others || {}
    }

    if (!markdown) {
      try {
        const fromOthers = digResult(others?.result)
        if (fromOthers.markdown) markdown = fromOthers.markdown
        if (fromOthers.name) resumeName = fromOthers.name
        if (typeof others.reasoning_summary === 'string') reasoningForChat = others.reasoning_summary

        if (!markdown && typeof res?.output_text === 'string' && res.output_text.trim()) {
          const rawText = res.output_text.trim()
          if (/^[\[{]/.test(rawText)) {
            try {
              const parsed = JSON.parse(rawText)
              const extracted = digResult(parsed?.result ?? parsed)
              if (extracted.markdown) markdown = extracted.markdown
              if (!resumeName && extracted.name) resumeName = extracted.name
              if (!reasoningForChat && typeof parsed?.reasoning_summary === 'string') reasoningForChat = parsed.reasoning_summary
              if (!others.steps && Array.isArray(parsed?.steps)) {
                (res as any).others = Object.assign({}, others || {}, { steps: parsed.steps })
                others = (res as any).others
              }
            } catch {
              markdown = rawText
            }
          } else {
            markdown = rawText
          }
        }

        if (!markdown) {
          const rawOut = String(res?.raw?.output_text || '').trim()
          if (rawOut) {
            if (/^[\[{]/.test(rawOut)) {
              try {
                const parsed = JSON.parse(rawOut)
                const extracted = digResult(parsed?.result ?? parsed)
                if (extracted.markdown) markdown = extracted.markdown
                if (!resumeName && extracted.name) resumeName = extracted.name
                if (!reasoningForChat && typeof parsed?.reasoning_summary === 'string') reasoningForChat = parsed.reasoning_summary
              } catch {
                markdown = rawOut
              }
            } else {
              markdown = rawOut
            }
          }
        }

        if (!markdown) {
          const raw = res?.raw
          if (raw && Array.isArray(raw.output)) {
            outer: for (const item of raw.output) {
              const parts = item?.content || []
              for (const p of parts) {
                if (p && typeof p.json === 'object' && p.json) {
                  const extracted = digResult(p.json)
                  if (extracted.markdown) {
                    markdown = extracted.markdown
                    if (!resumeName && extracted.name) resumeName = extracted.name
                    break outer
                  }
                }
                if (p && typeof p.text === 'string' && p.text.trim()) {
                  markdown = p.text.trim()
                  break outer
                }
              }
            }
          }
        }
      } catch {}
    }

    const normalizedPrimary = ensurePrimaryHeading(unescapeNewlines(markdown || '').trim())
    markdown = normalizedPrimary.markdown
    if (!resumeName && normalizedPrimary.heading) resumeName = normalizedPrimary.heading
    if (!markdown) throw new Error('no_content')

    const detailMessages: string[] = []
    const materialMsg = formatMaterial(others.material)
    if (materialMsg) detailMessages.push(`【material】\n${materialMsg}`)
    const outlineMsg = formatOutline(others.outline)
    if (outlineMsg) detailMessages.push(`【outline】\n${outlineMsg}`)
    const checksMsg = formatChecks(others.checks)
    if (checksMsg) detailMessages.push(`【checks】\n${checksMsg}`)
    try {
      const missing = (others as any)?.material?.missing_information
      if (Array.isArray(missing) && missing.length) {
        detailMessages.push(`【missing_information】\n- ${missing.map((x: any) => String(x)).join('\n- ')}`)
      }
    } catch {}
    if (reasoningForChat) detailMessages.push(`【推理摘要】\n${reasoningForChat}`)
    if (Array.isArray(others.steps) && others.steps.length) {
      detailMessages.push(`【步骤】\n- ${others.steps.join('\n- ')}`)
    }

    try {
      if (typeof res?.output_text === 'string' && res.output_text.trim()) {
        try {
          const parsed = JSON.parse(res.output_text)
          if (!reasoningForChat && typeof parsed?.reasoning_summary === 'string') {
            reasoningForChat = parsed.reasoning_summary
            if (reasoningForChat && !detailMessages.some(m => m.startsWith('【推理摘要】'))) {
              detailMessages.push(`【推理摘要】\n${reasoningForChat}`)
            }
          }
          if (parsed?.checks && !detailMessages.some(m => m.startsWith('【checks】'))) {
            const msg = formatChecks(parsed.checks)
            if (msg) detailMessages.push(`【checks】\n${msg}`)
          }
          if (Array.isArray(parsed?.steps) && parsed.steps.length && !detailMessages.some(m => m.startsWith('【步骤】'))) {
            detailMessages.push(`【步骤】\n- ${parsed.steps.join('\n- ')}`)
          }
        } catch {}
      }
    } catch {}

    try {
      if (detailMessages.length) {
        try { window.dispatchEvent(new CustomEvent('chatbot-append', { detail: { messages: detailMessages } })) } catch {}
        const pending = Array.isArray((window as any).__pendingChatMessages)
          ? (window as any).__pendingChatMessages
          : ((window as any).__pendingChatMessages = [])
        pending.push(...detailMessages)
      }
    } catch {}

    setAgentStep('创建文档...')
    const cleanName = resumeName || (cvName.value ? cvName.value.replace(/\.[^.]+$/, '') : '') || 'Resume'
    const id = await newResumeFromImport(markdown, cleanName)
    try {
      const msgs: string[] = Array.isArray((window as any).__pendingChatMessages) ? (window as any).__pendingChatMessages : []
      if (msgs.length) {
        const { convStore } = await import('~/data/contextStore')
        for (const m of msgs) convStore.appendMessage(id, 'assistant', m)
        ;(window as any).__pendingChatMessages = []
      }
    } catch {}

    setDocMeta(id, { docType: 'cv', lang: lang.value })
    setAgentStep('跳转编辑器...')
    router.push(localePath(`/edit/${id}`))
  } catch (error) {
    console.error('[CV Create] failed', error)
    ;(toast as any).import(false)
  } finally {
    cvSubmitting.value = false
    setAgentStep('')
  }
}

const confirmCreateRec = async () => {
  if (curDoc.value !== 'rec' || !lang.value) return
  if (recCfg.value.requireUpload && !recBase64.value) return
  if (!recBase64.value && !recInitialText.value.trim()) {
    ;(toast as any).import(false)
    return
  }
  recSubmitting.value = true
  setAgentStep('准备生成推荐信...')
  try {
    let fileId: string | null = null
    const originalName = recName.value || 'upload.bin'
    const originalMime = guessFileMime(originalName)
    if (recBase64.value) {
      setAgentStep('上传附件...')
      fileId = await uploadSupportFile({
        backendBase: backendBase.value,
        name: originalName,
        contentBase64: recBase64.value,
        purpose: 'user_data',
        contentType: originalMime || undefined
      })
    }
    // 记录附件消息，供 Chatbot 展示与预览
    try {
      const payload = { images: [], files: [{ id: fileId, name: originalName, mime: originalMime }] }
      const marker = '[[ATTACHMENTS]]' + JSON.stringify(payload)
      ;(window as any).__pendingChatMessages = ((window as any).__pendingChatMessages || [])
      ;(window as any).__pendingChatMessages.unshift(marker)
    } catch {}
    const reqBody: any = { max_output_tokens: 32768, reasoning_effort: 'medium' }
    // New unified create endpoint requires doc_type; also pass language
    reqBody.doc_type = 'rec'
    if (lang.value) reqBody.language = lang.value
    if (fileId) reqBody.file_ids = [fileId]
    if (recInitialText.value.trim()) reqBody.prompt = recInitialText.value.trim()
    setAgentStep('调用模型生成内容...')
    const res: any = await $fetch(`${backendBase.value}/api/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody })
    // 仅提取 Structured Outputs 的 result，并将 "\n" 转义为真正的换行
    const unescapeNewlines = (t: string) => (t || '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
    const pickRecResultParts = (obj: any): { en: string; zh: string } => {
      let en = ''
      let zh = ''
      try {
        const r = obj?.result
        if (typeof r === 'string') {
          en = String(r || '')
        } else if (r && typeof r === 'object') {
          const inner = (r as any).result && typeof (r as any).result === 'object' ? (r as any).result : null
          if (inner) {
            en = String(inner.english_letter || inner.letter_en || inner.english || inner.english_text || '')
            zh = String(inner.chinese_translation || inner.letter_zh || inner.chinese || inner.zh || inner.zh_cn || inner.cn || '')
          }
          if (!en && !zh) {
            en = String((r as any).english_letter || (r as any).letter_en || (r as any).english_text || (r as any).english || (r as any).en || '')
            zh = String((r as any).chinese_translation || (r as any).letter_zh || (r as any).chinese_letter || (r as any).chinese || (r as any).zh || (r as any).zh_cn || (r as any).cn || '')
          }
        }
      } catch {}
      return { en, zh }
    }
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
    let enCandidate = ''
    let zhCandidate = ''
    let reasoningForChat = ''
    try {
      const raw = res?.raw
      if (raw && Array.isArray(raw.output)) {
        outer: for (const item of raw.output) {
          const parts = item?.content || []
          for (const p of parts) {
            if (p && typeof p.json === 'object' && p.json) {
              const parts = pickRecResultParts(p.json)
              const rs = (p.json || {}).reasoning_summary
              if (typeof rs === 'string') reasoningForChat = rs
              if (parts.en || parts.zh) {
                enCandidate = parts.en
                zhCandidate = parts.zh
                content = unescapeNewlines([parts.en, parts.zh].filter(Boolean).join('\n\n'))
                break outer
              }
            }
          }
        }
      }
      // Fallback: parse backend output_text (JSON string) to extract english/chinese only
      if (!content && typeof res?.output_text === 'string' && res.output_text.trim()) {
        try {
          const parsed = JSON.parse(res.output_text)
          const parts = pickRecResultParts({ result: parsed?.result })
          if (parts.en || parts.zh) {
            enCandidate = parts.en
            zhCandidate = parts.zh
            content = unescapeNewlines([parts.en, parts.zh].filter(Boolean).join('\n\n'))
          }
          if (!reasoningForChat && typeof parsed?.reasoning_summary === 'string') reasoningForChat = parsed.reasoning_summary
          if (!Array.isArray(res?.others?.steps) && Array.isArray(parsed?.steps)) {
            (res as any).others = Object.assign({}, res?.others || {}, { steps: parsed.steps })
          }
        } catch {}
      }
    } catch {}
    // If we only have English letter, try to translate to Chinese via backend
    try {
      if (enCandidate && !zhCandidate) {
        const tr: any = await $fetch(`${backendBase.value}/api/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { text: enCandidate, target: 'zh' } })
        const zh = String(tr?.text || '').trim()
        if (zh) {
          zhCandidate = zh
          content = unescapeNewlines([enCandidate, zhCandidate].join('\n\n'))
        }
      }
    } catch {}
    // 将其他结构化部分与 reasoning_summary 写入 Chatbot 历史（使用 convStore 以确保页面装载后可见）
    try {
      const { convStore } = await import('~/data/contextStore')
      const msgs: string[] = []
      const others = res?.others || {}
      // Show evaluation blocks in chatbot messages
      const pc = formatChecks(others.perspective_consistency)
      if (pc) msgs.push(`【perspective_consistency】\n${pc}`)
      const lq = formatChecks(others.language_quality)
      if (lq) msgs.push(`【language_quality】\n${lq}`)
      const cc = formatChecks(others.content_completeness)
      if (cc) msgs.push(`【content_completeness】\n${cc}`)
      const sl = formatChecks(others.structure_logic)
      if (sl) msgs.push(`【structure_logic】\n${sl}`)
      // missing_information from material
      try {
        const mi = (others as any)?.material?.missing_information
        if (Array.isArray(mi) && mi.length) {
          msgs.push(`【missing_information】\n- ${mi.map((x: any) => String(x)).join('\n- ')}`)
        }
      } catch {}
      const rs = reasoningForChat || (others.reasoning_summary || '')
      if (rs) msgs.push(`【推理摘要】\n${rs}`)
      // 统一由 Chatbot 的 CollapsibleList 自动折叠长列表
      if (Array.isArray(others.steps) && others.steps.length) {
        msgs.push(`【步骤】\n- ${others.steps.join('\n- ')}`)
      }
      // Fallback: if backend 'others' missing reasoning/steps, parse output_text JSON
      try {
        if (typeof res?.output_text === 'string' && res.output_text.trim()) {
          const parsed = JSON.parse(res.output_text)
          // If checks object present, append four categories when not already present
          try {
            const checks = parsed?.checks || null
            if (checks && typeof checks === 'object') {
              if (!msgs.some(m => m.startsWith('【perspective_consistency】')) && (checks.perspective_consistency || checks.perspectiveConsistency)) {
                msgs.push(`【perspective_consistency】\n${formatChecks(checks.perspective_consistency || checks.perspectiveConsistency)}`)
              }
              if (!msgs.some(m => m.startsWith('【language_quality】')) && (checks.language_quality || checks.languageQuality)) {
                msgs.push(`【language_quality】\n${formatChecks(checks.language_quality || checks.languageQuality)}`)
              }
              if (!msgs.some(m => m.startsWith('【content_completeness】')) && (checks.content_completeness || checks.contentCompleteness)) {
                msgs.push(`【content_completeness】\n${formatChecks(checks.content_completeness || checks.contentCompleteness)}`)
              }
              if (!msgs.some(m => m.startsWith('【structure_logic】')) && (checks.structure_logic || checks.structureLogic)) {
                msgs.push(`【structure_logic】\n${formatChecks(checks.structure_logic || checks.structureLogic)}`)
              }
            }
          } catch {}
          // Append missing_information when available
          try {
            const mi = parsed?.material?.missing_information
            if (Array.isArray(mi) && mi.length && !msgs.some(m => m.startsWith('【missing_information】'))) {
              msgs.push(`【missing_information】\n- ${mi.map((x: any) => String(x)).join('\n- ')}`)
            }
          } catch {}
          const rs2 = (typeof parsed?.reasoning_summary === 'string') ? parsed.reasoning_summary : ''
          if (rs2 && !msgs.some(m => m.startsWith('【推理摘要】'))) {
            msgs.push(`【推理摘要】\n${rs2}`)
          }
          if (Array.isArray(parsed?.steps) && parsed.steps.length && !msgs.some(m => m.startsWith('【步骤】'))) {
            msgs.push(`【步骤】\n- ${parsed.steps.join('\n- ')}`)
          }
        }
      } catch {}
      // Also send messages to Chatbot bubble (external append)
      try { window.dispatchEvent(new CustomEvent('chatbot-append', { detail: { messages: msgs } })) } catch {}
      if (msgs.length) {
        // 先建文档，再将消息追加到该文档的 chatId（等于文档 id）
        // 注意：下面会在拿到 id 后 append
        ;(window as any).__pendingChatMessages = msgs
      }
    } catch {}
    // No additional fallback: ensure editor only saves english_letter + chinese_translation
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
    setDocMeta(id, { docType: 'rec', lang: lang.value })
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
