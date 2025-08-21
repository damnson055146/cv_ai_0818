<template>
  <div class="edit-page flex flex-col">
    <Header>
      <template #middle>
        <RenameResume />
      </template>

      <template #tail>
        <SaveResume />
        
        <!-- 工具栏方案切换器 -->
        <div class="toolbar-scheme-selector mr-4 flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
          <span class="text-xs font-medium text-blue-700 dark:text-blue-300">工具栏:</span>
          <select
            v-model="toolbarScheme"
            class="text-sm px-3 py-1 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
            title="选择工具栏方案"
          >
            <option value="original">🔧 原版工具栏</option>
            <option value="scheme1">📋 垂直标签卡</option>
            <option value="scheme2">📁 可折叠分组</option>
            <option value="scheme3">🎛️ 浮动面板</option>
          </select>
          <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="工具栏切换器"></div>
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
          <Editor />
        </div>

        <div v-bind="api.getResizeTriggerProps({ id: 'editor:preview' })" />

        <div class="preview-pane" v-bind="api.getPanelProps({ id: 'preview' })">
          <Preview />
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
import ToolbarScheme1 from "~/components/edit/ToolbarScheme1.vue";
import ToolbarScheme2 from "~/components/edit/ToolbarScheme2.vue";
import ToolbarScheme3 from "~/components/edit/ToolbarScheme3.vue";

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
});

// Toggle toolbar
const { width } = useWindowSize();
const isToolbarOpen = ref(width.value > 1024);

// Toolbar scheme selection
const toolbarScheme = ref('original');

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
</script>

<style scoped>
[data-scope="splitter"][data-part="resize-trigger"] {
  @apply relative w-3 outline-none;
}

[data-scope="splitter"][data-part="resize-trigger"]::after {
  @apply content-[""] absolute bg-gray-400/40 w-1 h-10 rounded-full inset-0 m-auto;
}
</style>
