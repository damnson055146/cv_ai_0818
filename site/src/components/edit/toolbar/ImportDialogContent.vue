<template>
  <div flex-1 px-4 py-6 space-y-6 bg-dark-c text-sm>
    <div v-bind="api.rootProps" class="w-full space-y-2">
      <div
        v-bind="api.dropzoneProps"
        class="py-12 hover:bg-darker-c cursor-pointer"
        border="~ c dashed rounded"
      >
        <input v-bind="api.hiddenInputProps" />
        <div text-center>{{ $t("import.from_local") }}</div>
      </div>

      <div v-if="localFile" class="bg-darker-c rounded py-1 px-2">
        {{ localFile }}
      </div>
    </div>

    <div hstack>
      <div flex-1 border="t c" />
      <div px-5>OR</div>
      <div flex-1 border="t c" />
    </div>

    <div class="hstack w-full space-x-1.5">
      <input
        class="flex-1 h-7 px-2 rounded-sm outline-none bg-c"
        :value="pastedURL"
        :placeholder="$t('import.from_url')"
        @change="pastedURL = ($event.target as HTMLTextAreaElement).value"
        @keyup.enter="uploadFileFromURL"
      />
      <button
        class="flex-center w-8 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-sm"
        @click="uploadFileFromURL"
      >
        <span i-line-md:confirm />
      </button>
    </div>
  </div>

  <!-- 解析加载动画 -->
  <div v-if="isParsing" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-darker-c border border-c rounded px-4 py-3 flex items-center space-x-3 shadow-lg">
      <div class="w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
      <div class="text-sm">{{ parseMsg }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const runtime = useRuntimeConfig()
const backendBase: string = (runtime.public as any)?.backendBase || ''
const convertToMdApi = backendBase ? backendBase.replace(/\/$/, '') + '/api/convert-to-md' : '/api/convert-to-md'
import * as fileUpload from "@zag-js/file-upload";
import { normalizeProps, useMachine } from "@zag-js/vue";
import { fetchFile } from "@renovamen/utils";

// File component component
const localFile = ref<string | null>(null);

const [state, send] = useMachine(
  fileUpload.machine({
    id: "import-dialog",
    accept: ".md,.txt,.docx,.pdf",
    onFileAccept: async ({ files }) => {
      const file = files[0]
      const name = file?.name || ''
      localFile.value = name
      pastedURL.value = ""

      try {
        if (/\.(md|markdown)$/i.test(name)) {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const text = (reader.result as string) || ''
            // 首页导入场景：若存在 newOnImport 回调则创建新文档
            if (typeof (window as any).__newOnImport === 'function') {
              try {
                const id = await (window as any).__newOnImport(text, name)
                // 导航由回调处理
                return
              } catch {}
            }
            setResumeMd(text)
          }
          reader.readAsText(file)
          return
        }
        if (/\.txt$/i.test(name)) {
          const reader = new FileReader()
          reader.onloadend = async () => {
            startParsing('AI 正在规整为 Markdown ...')
            const txt = (reader.result as string) || ''
            try {
              const resp: any = await $fetch(convertToMdApi, {
                method: 'POST',
                body: { text: txt, hint: 'auto', model: 'gpt-4o-mini' }
              })
              const md = resp?.markdown || txt
              if (typeof (window as any).__newOnImport === 'function') {
                try { await (window as any).__newOnImport(md, name); return } catch {}
              }
              setResumeMd(md)
            } catch {
              setResumeMd(txt)
            } finally {
              endParsing()
            }
          }
          reader.readAsText(file)
          return
        }
        if (/\.docx$/i.test(name)) {
          // Try mammoth (browser build) to extract text from docx
          const reader = new FileReader()
          reader.onloadend = async () => {
            const buffer = reader.result as ArrayBuffer
            try {
              startParsing('正在读取 DOCX ...')
              // Dynamic import mammoth browser build
              // @ts-ignore
              const mammothMod: any = await import(/* @vite-ignore */ 'mammoth/mammoth.browser')
              const mammothLib: any = (mammothMod && (mammothMod as any).default) || (window as any).mammoth || mammothMod
              const result = await mammothLib.convertToHtml({ arrayBuffer: buffer })
              let html = result?.value || ''
              // 去除图片/内联数据和零宽字符，避免“乱码”与巨大 base64
              html = html
                .replace(/<img[^>]*>/gi, '')
                .replace(/<svg[\s\S]*?<\/svg>/gi, '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g, '')
              // Convert HTML -> Markdown using Turndown to保留标题/列表/加粗
              const tdMod: any = await import('turndown')
              const TurndownService: any = (tdMod as any).default || (tdMod as any)
              const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
              // 处理粗体/斜体/链接/列表/标题已由默认规则覆盖，增加表格与换行优化
              td.addRule('tableToPipes', {
                filter: (node: HTMLElement) => node.nodeName === 'TABLE',
                replacement: (content: string, node: HTMLElement) => {
                  const rows = Array.from(node.querySelectorAll('tr'))
                  const cells = (r: HTMLTableRowElement) => Array.from(r.children).map((c: any) => (c.textContent || '').trim())
                  const lines: string[] = []
                  rows.forEach((r, idx) => {
                    const cols = cells(r as any)
                    lines.push(`| ${cols.join(' | ')} |`)
                    if (idx === 0) lines.push(`| ${cols.map(() => '---').join(' | ')} |`)
                  })
                  return `\n${lines.join('\n')}\n`
                }
              })
              td.addRule('softBreak', {
                filter: ['br'],
                replacement: () => '  \n'
              })
              // preserve <u>/<span> to plain text
              td.addRule('inlineRemove', {
                filter: ['u','span','font'],
                replacement: (content: string) => content
              })
              let md = td.turndown(html)
              // AI 规整为更干净的 Markdown（可选，失败则回退）
              try {
                parseMsg.value = 'AI 正在规整为 Markdown ...'
                const resp: any = await $fetch(convertToMdApi, {
                  method: 'POST',
                  body: { text: md, hint: 'auto', model: 'gpt-4o-mini' }
                })
                if (resp?.ok && resp?.markdown) md = resp.markdown
              } catch {}
              if (typeof (window as any).__newOnImport === 'function') {
                try { await (window as any).__newOnImport(md, name); return } catch {}
              }
              setResumeMd(md)
            } catch (err) {
              console.warn('[Import] DOCX parse failed, using fallback plain text notice', err)
              setResumeMd('无法直接解析 .docx，请转换为 .md 或 .txt 后再导入。')
            } finally {
              endParsing()
            }
          }
          reader.readAsArrayBuffer(file)
          return
        }
        if (/\.pdf$/i.test(name)) {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const buffer = reader.result as ArrayBuffer
            try {
              startParsing('正在解析 PDF 文本 ...')
              const pdfjsLib: any = await import('pdfjs-dist/build/pdf')
              // Attempt to set worker if needed
              try {
                const worker = await import('pdfjs-dist/build/pdf.worker.min')
                if (pdfjsLib?.GlobalWorkerOptions) {
                  pdfjsLib.GlobalWorkerOptions.workerPort = worker?.default || undefined
                }
              } catch {}
              const task = pdfjsLib.getDocument({ data: buffer })
              const pdf = await task.promise
              let fullText = ''
              for (let p = 1; p <= pdf.numPages; p++) {
                const page = await pdf.getPage(p)
                const tc = await page.getTextContent()
                // 根据 y 坐标聚合为“行”，并按 x 排序，尽量还原段落
                const items = (tc.items || []) as any[]
                const lineBuckets = new Map<number, Array<{ x: number; str: string }>>()
                const yTolerance = 2 // 行合并容差
                for (const it of items) {
                  const tr = it.transform || [0,0,0,0,0,0]
                  const x = tr[4] || 0
                  const y = tr[5] || 0
                  // 归一化 y
                  const yKey = Math.round(y / yTolerance) * yTolerance
                  if (!lineBuckets.has(yKey)) lineBuckets.set(yKey, [])
                  lineBuckets.get(yKey)!.push({ x, str: String(it.str || '') })
                }
                // 将行按 y 从小到大排序（PDF 坐标原点左下，较大在上/下因实现而异，统一排序后反转）
                const yKeys = Array.from(lineBuckets.keys()).sort((a, b) => b - a)
                const lines: string[] = []
                for (const y of yKeys) {
                  const line = lineBuckets.get(y)!
                  line.sort((a, b) => a.x - b.x)
                  // 根据字符间距添加空格
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
              // 粗粒度清洗：合并多余空行
              let md = fullText
                .replace(/[ \t]+/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
              // AI 规整
              try {
                parseMsg.value = 'AI 正在规整为 Markdown ...'
                const resp: any = await $fetch(convertToMdApi, {
                  method: 'POST',
                  body: { text: md, hint: 'auto', model: 'gpt-4o-mini' }
                })
                if (resp?.ok && resp?.markdown) md = resp.markdown
              } catch {}
              if (typeof (window as any).__newOnImport === 'function') {
                try { await (window as any).__newOnImport(md, name); return } catch {}
              }
              setResumeMd(md)
            } catch (err) {
              console.warn('[Import] PDF parse failed', err)
              setResumeMd('无法直接解析 PDF，请转换为 .md 或 .txt 后再导入。')
            } finally {
              endParsing()
            }
          }
          reader.readAsArrayBuffer(file)
          return
        }
        // Fallback
        const reader = new FileReader()
        reader.onloadend = () => setResumeMd((reader.result as string) || '')
        reader.readAsText(file)
      } catch (e) {
        console.error('[Import] 文件导入失败', e)
      }
    }
  })
);
const api = computed(() => fileUpload.connect(state.value, send, normalizeProps));

// Fetched file from pasted URL
const pastedURL = ref("");

const uploadFileFromURL = () => {
  if (pastedURL.value.trim() === "") return;
  fetchFile(pastedURL.value).then((content: string) => {
    setResumeMd(content);
    localFile.value = null;
  });
};

// 解析加载状态
const isParsing = ref(false)
const parseMsg = ref('正在解析...')
const startParsing = (msg?: string) => { isParsing.value = true; if (msg) parseMsg.value = msg }
const endParsing = () => { isParsing.value = false }
</script>
