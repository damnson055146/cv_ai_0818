<template>
  <div class="edit-page flex flex-col">
    <Header>
      <template #middle>
        <div class="hstack items-center">
          <RenameResume />
        </div>
      </template>

      <template #tail>
        <PsSwitcher />
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
import type { PsDocMeta, PsDocSubtype } from "~/utils/ps";
import { ensurePsMetaForDoc, getPsMeta, markOutlineComplete, simpleHash, updateBaselineForBody } from "~/utils/ps";


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
const shownSeedDiffFor = new Set<string>();

const loadResume = async (
  id: string,
  options: { createIfMissing?: boolean; triggerSeedDiff?: boolean } = {}
) => {
  if (!id) return;
  const { createIfMissing = false, triggerSeedDiff = true } = options;

  let ok = await switchResume(id);
  if (!ok && createIfMissing) {
    const { DEFAULT_STYLES, DEFAULT_NAME, DEFAULT_MD_CONTENT, DEFAULT_CSS_CONTENT } = await import("~/utils");
    const { saveResume } = await import("~/utils/database");
    await saveResume(id, {
      name: DEFAULT_NAME,
      markdown: DEFAULT_MD_CONTENT,
      css: DEFAULT_CSS_CONTENT,
      styles: DEFAULT_STYLES,
      update: id
    } as any);
    ok = await switchResume(id);
  }
  if (!ok) return;

  if (!triggerSeedDiff || shownSeedDiffFor.has(id)) return;

  try {
    const meta = getPsMeta(id);
    if (meta && meta.chatId) {
      const seedRaw = localStorage.getItem('ps_seed_' + meta.chatId);
      if (seedRaw) {
        const seed = JSON.parse(seedRaw);
        const suggested = meta.sub === 'outline' ? (seed?.outline || '') : (seed?.body || '');
        if (suggested && typeof suggested === 'string') {
          const ev = new CustomEvent('show-initial-ps-seed-diff', {
            detail: {
              suggestedText: suggested
            }
          });
          window.dispatchEvent(ev);
          shownSeedDiffFor.add(id);
        }
      }
    }
  } catch {}
};

onMounted(async () => {
  const id = route.params.id as string;
  await loadResume(id, { createIfMissing: true, triggerSeedDiff: true });
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
const psMeta = ref<PsDocMeta | null>(null)
const showOutlineChangedWarning = ref(false)

const hydratePsMeta = async (docId: string) => {
  psMeta.value = null
  showOutlineChangedWarning.value = false
  if (!docId) return

  try {
    const metaValue = getPsMeta(docId)
    if (metaValue) {
      psMeta.value = metaValue
      showOutlineChangedWarning.value = Boolean(metaValue.sub === 'body' && metaValue.baselineOutlineHash)
      return
    }
  } catch {}

  try {
    const ensured = await ensurePsMetaForDoc(docId)
    if (ensured) {
      psMeta.value = ensured
      showOutlineChangedWarning.value = Boolean(ensured.sub === 'body' && ensured.baselineOutlineHash)
      return
    }
  } catch {}

  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem('ps_doc_meta_' + docId)
    if (raw) {
      const parsed = JSON.parse(raw) as PsDocMeta
      psMeta.value = parsed
      showOutlineChangedWarning.value = Boolean(parsed.sub === 'body' && parsed.baselineOutlineHash)
      return
    }
  } catch {}

  try {
    const docRaw = localStorage.getItem('doc_meta_' + docId)
    if (docRaw) {
      const docMeta = JSON.parse(docRaw) as { docType?: string; siblingId?: string; chatId?: string; sub?: PsDocSubtype }
      if (docMeta?.docType === 'ps') {
        psMeta.value = {
          docType: 'ps',
          sub: docMeta.sub ?? 'outline',
          chatId: docMeta.chatId || docId,
          siblingId: docMeta.siblingId || ''
        }
      }
    }
  } catch {}
}

const handlePsMetaUpdate = (event: Event) => {
  try {
    const detail = (event as CustomEvent<{ id: string; meta: PsDocMeta }>).detail
    if (!detail?.meta || !detail.id) return
    const currentId = route.params.id as string
    if (!currentId) return
    if (detail.id === currentId || detail.meta.siblingId === currentId) {
      void hydratePsMeta(currentId)
    }
  } catch {}
}

onMounted(() => {
  const id = route.params.id as string
  void hydratePsMeta(id)
  if (typeof window !== 'undefined') window.addEventListener('ps-meta-updated', handlePsMetaUpdate)
})

watch(
  () => route.params.id as string,
  (id, prev) => {
    if (!id || id === prev) return
    void loadResume(id, { triggerSeedDiff: true })
    void hydratePsMeta(id)
  }
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('ps-meta-updated', handlePsMetaUpdate)
})

function completeOutline() {
  try {
    if (!psMeta.value) return
    const chatId = psMeta.value.chatId
    // 标记完成
    markOutlineComplete(chatId, true)
    // 计算大纲hash并写入到正文baseline
    const askContent = () => new Promise<string>((resolve) => {
      const ev = new CustomEvent('get-document-content', { detail: { callback: resolve } })
      document.dispatchEvent(ev)
      setTimeout(() => resolve(''), 800)
    })
    askContent().then((outlineContent) => {
      const hash = simpleHash(outlineContent)
      try {
        const bodyId = psMeta.value?.siblingId
        if (bodyId) updateBaselineForBody(bodyId, hash)
        if (psMeta.value) psMeta.value.baselineOutlineHash = hash
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
