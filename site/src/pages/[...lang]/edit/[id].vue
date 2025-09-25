<template>
  <div class="edit-page flex flex-col">
    <Header>
      <template #middle>
        <div class="hstack items-center">
          <RenameResume />
          <PsSwitcher />
        </div>
      </template>

      <template #tail>
        <SaveResume />
        
        <!-- 工具栏方案切换器 -->
        <div class="toolbar-scheme-selectors mr-4 flex items-center space-x-3">
          <!-- 右侧工具栏方案 -->
          <div class="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
            <span class="text-xs font-medium text-blue-700 dark:text-blue-300">右侧:</span>
            <select
              v-model="toolbarScheme"
              class="text-sm px-2 py-1 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
              title="选择右侧工具栏方案"
            >
              <option value="original">🔧 原版</option>
              <option value="scheme1">📋 标签卡</option>
              <option value="scheme2">📁 分组</option>
              <option value="scheme3">🎛️ 浮动</option>
            </select>
          </div>
          
          <!-- 左侧工具栏方案 -->
          <div class="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-700 shadow-sm">
            <span class="text-xs font-medium text-green-700 dark:text-green-300">左侧:</span>
            <select
              v-model="leftSidebarScheme"
              class="text-sm px-2 py-1 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-600 rounded-md shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-medium"
              title="选择左侧工具栏方案"
            >
              <option value="original">🔧 原版</option>
              <option value="scheme1">📊 标签组</option>
              <option value="scheme2">🎛️ 浮动面板</option>
              <option value="scheme3">⚡ 极简</option>
            </select>
          </div>
        </div>
        
        <ToggleToolbar
          :is-toolbar-open="isToolbarOpen"
          @toggle-toolbar="isToolbarOpen = !isToolbarOpen"
        />
      </template>
    </Header>

    <div class="workspace size-full overflow-hidden" flex="~ 1" pb-2>
      <div v-bind="api.rootProps" px-3>
        <div class="editor-pane" v-bind="api.getPanelProps({ id: 'editor' })">
          <Editor :leftSidebarComponent="currentLeftSidebarComponent" />
        </div>

        <div v-bind="api.getResizeTriggerProps({ id: 'editor:preview' })" />

        <div class="preview-pane" v-bind="api.getPanelProps({ id: 'preview' })">
          <Preview />
          <!-- PS 大纲完成提示与正文提醒 -->
          <div v-if="psMeta && psMeta.sub === 'outline'" class="mt-2 px-3">
            <button class="px-3 py-1 rounded bg-green-600 text-white hover:opacity-90" @click="completeOutline">大纲完成</button>
          </div>
          <div v-if="psMeta && psMeta.sub === 'body' && showOutlineChangedWarning" class="mt-2 px-3 text-xs text-amber-600">
            检测到大纲有修改，建议重新生成正文。
          </div>
        </div>
      </div>

      <div v-if="isToolbarOpen" class="tools-pane">
        <component :is="currentToolbarComponent" />
      </div>
    </div>
    
  </div>
</template>

<script lang="ts" setup>
import * as splitter from "@zag-js/splitter";
import { normalizeProps, useMachine } from "@zag-js/vue";
import { useWindowSize } from "@vueuse/core";
import Toolbar from "~/components/edit/Toolbar.vue";
import PsSwitcher from "~/components/edit/header/PsSwitcher.vue";
import ToolbarScheme1 from "~/components/edit/ToolbarScheme1.vue";
import ToolbarScheme2 from "~/components/edit/ToolbarScheme2.vue";
import ToolbarScheme3 from "~/components/edit/ToolbarScheme3.vue";
import MdSidebarScheme1 from "~/components/edit/toolbar/MdSidebarScheme1.vue";
import MdSidebarScheme2 from "~/components/edit/toolbar/MdSidebarScheme2.vue";
import MdSidebarScheme3 from "~/components/edit/toolbar/MdSidebarScheme3.vue";


// Horizontal splitpane
const [state, send] = useMachine(
  splitter.machine({
    id: "h",
    size: [{ id: "editor" }, { id: "preview" }]
  })
);

const api = computed(() => splitter.connect(state.value, send, normalizeProps));

// Fetch resume data (client-only to avoid SSR errors)
const route = useRoute();
onMounted(async () => {
  const id = route.params.id as string;
  const ok = await switchResume(id);
  if (!ok) {
    const { DEFAULT_STYLES, DEFAULT_NAME, DEFAULT_MD_CONTENT, DEFAULT_CSS_CONTENT } = await import("~/utils");
    const { saveResume } = await import("~/utils/database");
    await saveResume(id, {
      name: DEFAULT_NAME,
      markdown: DEFAULT_MD_CONTENT,
      css: DEFAULT_CSS_CONTENT,
      styles: DEFAULT_STYLES,
      update: id
    } as any);
    await switchResume(id);
  }
  // 如果是新建的 PS 且存在种子建议，则触发 Diff 预览应用流程（通过全局事件让 Chatbot 弹窗）
  try {
    const rawMeta = localStorage.getItem('ps_doc_meta_' + id)
    const meta = rawMeta ? JSON.parse(rawMeta) : null
    if (meta && meta.docType === 'ps' && meta.chatId) {
      const seedRaw = localStorage.getItem('ps_seed_' + meta.chatId)
      if (seedRaw) {
        const seed = JSON.parse(seedRaw)
        // 构造建议文本：若当前子类型为 outline 用 seed.outline，否则用 seed.body
        const suggested = meta.sub === 'outline' ? (seed?.outline || '') : (seed?.body || '')
        if (suggested && typeof suggested === 'string') {
          const ev = new CustomEvent('show-initial-ps-seed-diff', {
            detail: {
              suggestedText: suggested
            }
          })
          window.dispatchEvent(ev)
        }
      }
    }
  } catch {}
});

// Toggle toolbar
const { width } = useWindowSize();
const isToolbarOpen = ref(width.value > 1024);

// Toolbar scheme selection
const toolbarScheme = ref('original');
const leftSidebarScheme = ref('original');

const currentToolbarComponent = computed(() => {
  switch (toolbarScheme.value) {
    case 'scheme1':
      return ToolbarScheme1;
    case 'scheme2':
      return ToolbarScheme2;
    case 'scheme3':
      return ToolbarScheme3;
    default:
      return Toolbar;
  }
});

const currentLeftSidebarComponent = computed(() => {
  switch (leftSidebarScheme.value) {
    case 'scheme1':
      return MdSidebarScheme1;
    case 'scheme2':
      return MdSidebarScheme2;
    case 'scheme3':
      return MdSidebarScheme3;
    default:
      return null; // 返回null，让Editor使用默认的MdSidebar
  }
});

// ===== PS 大纲/正文 gating =====
const psMeta = ref<any | null>(null)
const showOutlineChangedWarning = ref(false)

onMounted(() => {
  try {
    const id = route.params.id as string
    const raw = localStorage.getItem('ps_doc_meta_' + id)
    psMeta.value = raw ? JSON.parse(raw) : null
    if (psMeta.value?.sub === 'body') {
      // 对比baseline
      const outlineId = psMeta.value.siblingId
      const storageGetter = (window as any).localforage?.getItem || null
      // 轻量：通过事件从编辑器获取内容hash
      const askContent = () => new Promise<string>((resolve) => {
        const ev = new CustomEvent('get-document-content', { detail: { callback: resolve } })
        document.dispatchEvent(ev)
        setTimeout(() => resolve(''), 800)
      })
      askContent().then((bodyContent) => {
        // 读取大纲内容需要切换/或单独保存hash。这里仅基于baselineHash提示
        if (psMeta.value?.baselineOutlineHash) {
          showOutlineChangedWarning.value = true
        }
      })
    }
  } catch {}
})

function completeOutline() {
  try {
    if (!psMeta.value) return
    const chatId = psMeta.value.chatId
    // 标记完成
    localStorage.setItem('ps_outline_status_' + chatId, '1')
    // 计算大纲hash并写入到正文baseline
    const askContent = () => new Promise<string>((resolve) => {
      const ev = new CustomEvent('get-document-content', { detail: { callback: resolve } })
      document.dispatchEvent(ev)
      setTimeout(() => resolve(''), 800)
    })
    askContent().then((outlineContent) => {
      const hash = (() => {
        let h = 0
        for (let i = 0; i < outlineContent.length; i++) { h = (h << 5) - h + outlineContent.charCodeAt(i); h |= 0 }
        return String(h >>> 0)
      })()
      // 更新正文元数据baseline
      try {
        const bodyId = psMeta.value.siblingId
        const raw = localStorage.getItem('ps_doc_meta_' + bodyId)
        if (raw) {
          const meta = JSON.parse(raw)
          meta.baselineOutlineHash = hash
          localStorage.setItem('ps_doc_meta_' + bodyId, JSON.stringify(meta))
        }
      } catch {}
      // 跳转到正文
      const localePath = useLocalePath()
      navigateTo(localePath(`/edit/${psMeta.value.siblingId}`))
    })
  } catch {}
}
</script>

<style scoped>
[data-scope="splitter"][data-part="resize-trigger"] {
  @apply relative w-3 outline-none;
}

[data-scope="splitter"][data-part="resize-trigger"]::after {
  @apply content-[""] absolute bg-gray-400/40 w-1 h-10 rounded-full inset-0 m-auto;
}
</style>
