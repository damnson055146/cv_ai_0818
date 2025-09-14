<template>
  <ToolItem :text="$t('toolbar.file.text')" icon="i-carbon:import-export">
    <Dialog
      id="import-md"
      :title="$t('import.title')"
      icon="i-mdi:upload"
      box-class="w-full md:w-96"
    >
      <template #button>
        <li class="dropdown-li space-x-1.5 rounded" role="button">
          <span i-mdi:upload text-base />
          <span>{{ $t("toolbar.file.import") }}</span>
        </li>
      </template>

      <template #content>
        <ImportDialogContent />
      </template>
    </Dialog>

    <hr border-dashed border-c my-1 />

    <li class="dropdown-li space-x-1.5 rounded" role="button" @click="exportPDF">
      <span i-mdi:file-pdf text-base />
      <span>{{ $t("toolbar.file.export_pdf") }}</span>
    </li>

    <li class="dropdown-li space-x-1.5 rounded" role="button" @click="exportMd">
      <span i-ri:markdown-fill text-base />
      <span>{{ $t("toolbar.file.export_md") }}</span>
    </li>

    <li class="dropdown-li space-x-1.5 rounded" role="button" @click="exportTxt">
      <span i-mdi:file-document-outline text-base />
      <span>Export .txt</span>
    </li>

    <li class="dropdown-li space-x-1.5 rounded" role="button" @click="exportDocx">
      <span i-mdi:file-word text-base />
      <span>Export .docx</span>
    </li>
  </ToolItem>
</template>

<script lang="ts" setup>
import { downloadFile } from "@renovamen/utils";

const { data } = useDataStore();
const saveName = computed(() => data.curResumeName.trim().replace(/\s+/g, "_"));

const exportPDF = () => {
  const title = document.title;

  document.title = saveName.value;
  window.print();
  document.title = title;
};

const exportMd = () => {
  downloadFile(`${saveName.value}.md`, data.mdContent);
};

const exportTxt = () => {
  const plain = (data.mdContent || '').replace(/```[\s\S]*?```/g, (m) => m.replace(/`/g, ''))
  downloadFile(`${saveName.value}.txt`, plain)
}

const exportDocx = async () => {
  try {
    const { renderMarkdown } = await import('~/utils/markdown')
    const html = renderMarkdown(data.mdContent || '')
    const payloadHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
    const res: any = await $fetch('/api/html-to-docx', {
      method: 'POST',
      body: {
        html: payloadHtml,
        options: { table: { row: { cantSplit: true } }, footer: true, pageNumber: true }
      }
    })
    if (!res?.ok) throw new Error(res?.error || 'server convert failed')
    const base64: string = res.base64
    const byteChars = atob(base64)
    const byteNumbers = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${saveName.value}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[Export] 导出DOCX失败', e)
  }
}
</script>
