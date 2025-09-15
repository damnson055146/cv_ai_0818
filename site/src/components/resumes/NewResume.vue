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
              class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
              @click="step = 'lang'; curDoc = 'cv'"
            >CV</button>
            <button
              class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
              @click="step = 'lang'; curDoc = 'ps'"
            >{{ $t('resumes.ps') || 'Personal Statement' }}</button>
            <button
              class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
              @click="step = 'lang'; curDoc = 'rec'"
            >{{ $t('resumes.rec') || 'Recommendation' }}</button>
          </div>

          <div v-if="step === 'lang'" class="space-y-2">
            <div text-sm text-light-c>{{ $t('resumes.choose_lang') || 'Choose language' }}</div>
            <div class="grid grid-cols-2 gap-3">
              <button
                class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
                @click="curDoc === 'ps' ? setLang('en') : createBy(curDoc, 'en')"
              >English</button>
              <button
                class="px-3 py-2 rounded border border-c hover:border-darker-c hover:bg-dark-c"
                @click="curDoc === 'ps' ? setLang('zh') : createBy(curDoc, 'zh')"
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
        </div>
      </template>
    </Dialog>
  </div>
  
</template>

<script lang="ts" setup>
const runtimeConfig = useRuntimeConfig()
const psCfg = computed(() => (runtimeConfig.public as any)?.ps || { requireUpload: false, allowedUploadTypes: ["application/pdf"] })
const acceptedTypes = computed(() => Array.isArray(psCfg.value.allowedUploadTypes) && psCfg.value.allowedUploadTypes.length > 0
  ? psCfg.value.allowedUploadTypes.join(',')
  : 'application/pdf')
const router = useRouter();
const localePath = useLocalePath();
import { useToast } from "~/composables/toast";
import { newResume } from "~/utils/database";
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

const setLang = (l: Lang) => { lang.value = l }
const canConfirm = computed(() => {
  if (curDoc.value !== 'ps') return true
  if (!lang.value) return false
  if (psCfg.value.requireUpload && !pdfBase64.value) return false
  return true
})

const resetDialog = () => {
  step.value = 'doc'
  curDoc.value = 'cv'
  lang.value = null
  projectInfo.value = ''
  studentInfo.value = ''
  pdfBase64.value = null
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
</script>
