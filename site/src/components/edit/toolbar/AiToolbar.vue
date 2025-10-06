<template>

  <div

    ref="root"

    v-show="visible"

    class="ai-toolbar fixed z-50"

    :class="{ 'is-dragging': isDragging }"

    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"

  >

    <div class="toolbar-shell">

      <div class="toolbar-header" @pointerdown.prevent="onDragStart">

        <div class="header-info">

          <span class="i-ph:sparkle-duotone text-lg text-brand" />

          <div>

            <p class="title">AI 润色助手</p>

            <p class="subtitle">快速降低 AI 痕迹</p>

          </div>

        </div>

        <button class="toolbar-icon-btn" title="展开/收起" @pointerdown.stop @click="collapsed = !collapsed">

          <span :class="collapsed ? 'i-ph:caret-down' : 'i-ph:caret-up'" />

        </button>

      </div>



      <div class="toolbar-actions">

        <button class="toolbar-primary" :class="{ 'loading': isLoading }" :disabled="isLoading" @click="run">
          <span v-if="isLoading" class="flex items-center gap-2">
            <span class="i-ph:spinner-gap-duotone animate-spin text-base" />
            <span>处理中...</span>
          </span>
          <span v-else>重写</span>
        </button>
        <button class="toolbar-icon-btn" :disabled="isLoading" @click="runLowerAiRate">
          <span class="i-ph:magic-wand" />
          <span>降低AI率</span>
        </button>

        <button class="toolbar-icon-btn" :disabled="isLoading" @click="copy">
          <span class="i-ph:copy-simple" />
          <span>复制</span>
        </button>

        <button class="toolbar-icon-btn" :disabled="isLoading" @click="paste">
          <span class="i-ph:clipboard-text" />
          <span>粘贴</span>
        </button>

      </div>



      <transition name="fade">

        <div v-show="!collapsed" class="toolbar-panel">

          <div class="preset-row">

            <label class="preset-label">提示预设</label>

            <select v-model="selectedPreset" class="preset-select">

              <option value="">自定义</option>

              <option v-for="p in presets" :key="p.name" :value="p.name">{{ p.name }}</option>

            </select>

            <input v-model="newPresetName" class="preset-input" placeholder="保存为…" />

            <button class="toolbar-icon-btn" @click="savePreset">

              <span class="i-ph:floppy-disk" />

              <span>保存</span>

            </button>

            <button class="toolbar-icon-btn" :disabled="!selectedPreset" @click="deletePreset">

              <span class="i-ph:trash" />

              <span>删除</span>

            </button>

          </div>

          <textarea

            v-model="prompt"

            class="prompt-area"

            placeholder="输入润色指令，或选择上方预设"

          ></textarea>

          <div class="options-row mt-2 flex items-center gap-3">
            <label class="option-label text-dark-c/70 dark:text-light-c/70 whitespace-nowrap">Max tokens</label>
            <input
              v-model.number="maxTokens"
              type="number"
              min="128"
              max="4096"
              step="64"
              class="option-input w-28 px-2 py-1 rounded border border-c/50 dark:border-dark-c/60 bg-c dark:bg-dark-c/40 text-dark-c dark:text-light-c/90"
            />
            <span class="text-xs text-dark-c/50 dark:text-light-c/50">128–4096</span>

            <label class="option-label text-dark-c/70 dark:text-light-c/70 whitespace-nowrap ml-4">Effort</label>
            <select
              v-model="effort"
              class="option-input px-2 py-1 rounded border border-c/50 dark:border-dark-c/60 bg-c dark:bg-dark-c/40 text-dark-c dark:text-light-c/90"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>

        </div>

      </transition>

    </div>



    <div v-if="showPreview" class="preview-bubble">

      <div class="preview-header">

        <span class="i-ph:magic-wand-duotone text-brand" />

        <span>预览</span>

      </div>

      <div class="preview-columns grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="preview-box">
          <div class="preview-box-title text-dark-c/70 dark:text-light-c/70 text-xs mb-1">原文</div>
          <div class="preview-content" v-html="originalHtml"></div>
        </div>
        <div class="preview-box">
          <div class="preview-box-title text-dark-c/70 dark:text-light-c/70 text-xs mb-1">改写</div>
          <div class="preview-content" v-html="rewrittenHtml"></div>
        </div>
      </div>



      <div class="preview-legend" v-if="false">

        <span class="legend-chip legend-insert">新增</span>

        <span class="legend-chip legend-delete">删除</span>

      </div>

      <div class="preview-actions">

        <button class="toolbar-primary" @click="applyPreview">替换选区</button>

        <button class="toolbar-icon-btn" @click="cancelPreview">取消</button>

      </div>

    </div>

  </div>

</template>



<script lang="ts" setup>

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { useWorkspaceStore } from "~/composables/stores/workspace";

import { useWorkspaceOperator, OperationType } from "~/composables/workspaceOperator";
import { resolveBackendBase } from "~/utils/backendBase";



type SelectionRect = { x: number; y: number; visible: boolean; height?: number };

const props = defineProps<{ getSelection: () => string; getSelectionRect: () => SelectionRect; applyText: (text: string) => void }>();

const root = ref<HTMLElement | null>(null);



const visible = ref(false);

const pos = reactive({ x: 0, y: 0 });

const collapsed = ref(true);

const runtimeConfig = useRuntimeConfig();
const backendBase = computed(() => resolveBackendBase((runtimeConfig.public as any)?.backendBase));

const STORAGE_KEY = 'MR_AI_PROMPTS';

const DEFAULT_PROMPT = 'Rewrite the selected content so it feels human, personal, and natural. Preserve markdown, placeholders, and factual meaning while reducing AI-detection signals.';



type Preset = { name: string; prompt: string };

const presets = ref<Preset[]>([]);

const selectedPreset = ref('');

const newPresetName = ref('');

const prompt = ref(DEFAULT_PROMPT);

const showPreview = ref(false);

const previewText = ref('');
const maxTokens = ref<number>(1024);
// 固定用于“降低AI率”的提示词
const LOWER_AI_RATE_PROMPT = `你来自non-English-speaking国家，你并非英语母语者，你的英文写作无法像英文母语者一样完美，但你会尽可能写出真情实感。请在完全保留正式文风、原文信息、论证顺序和段落边界的前提下，遵循以下写作原则：
# 困惑度
提高整体困惑度，避免重复模板化表达；
适度引入同义词、近义词与多样化搭配，让语言显得天然且不规整。
# 句式结构
交替使用长短句，偶尔加入并列、倒装或省略，打破机器“一句一意”的呆板感；
在关键转折或补充处使用自然衔接词（however, moreover, particularly等）。禁止使用破折号、引号。
# 轻微混乱度
在不影响逻辑清晰的前提下，偶尔添加较为口语化的表达；
避免机械重复同一词或同一开头，体现“人写稿”常见的微杂糅感。
# 保持语义边界
任何事实、数据、结论都不得改动；
段落顺序、论点论据映射保持一致；
仅在修辞和用词层面做调整，不新增、删减核心信息。

请用这种策略重写文本，输出不包含任何解释，只给最终润色后的内容。`;
const effort = ref<'low' | 'medium' | 'high'>('medium');
const originalSelection = ref('');
const originalHtml = computed(() => escapeHtml(originalSelection.value || ''));
const rewrittenHtml = computed(() => escapeHtml(previewText.value || ''));
const isLoading = ref(false);

const isDragging = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });
let skipSelectionUpdate = false;

const setPosition = (x: number, y: number) => {
  if (typeof window === 'undefined') {
    pos.x = x;
    pos.y = y;
    return;
  }
  const margin = 12;
  const width = root.value?.offsetWidth ?? 0;
  const height = root.value?.offsetHeight ?? 0;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  pos.x = Math.min(Math.max(x, margin), maxX);
  pos.y = Math.min(Math.max(y, margin), maxY);
};

// “降低AI率”按钮：使用固定提示词
const runLowerAiRate = async () => {
  const input = props.getSelection();
  if (!input || isLoading.value) return;
  originalSelection.value = input;
  try {
    isLoading.value = true;
    await runRequest(input, LOWER_AI_RATE_PROMPT);
  } catch (e: any) {
    console.error('[AiToolbar] 降低AI率失败:', e);
    alert(`降低AI率失败: ${e.message || e}`);
  } finally {
    isLoading.value = false;
  }
};

const updateFromSelection = async () => {
  if (skipSelectionUpdate) {
    skipSelectionUpdate = false;
    return;
  }
  const rect = props.getSelectionRect();
  visible.value = rect.visible;
  if (!rect.visible) return;
  await nextTick();
  const margin = 16;
  const toolbarHeight = root.value?.offsetHeight ?? 0;
  const rectHeight = rect.height && rect.height > 0 ? rect.height : 24;
  let targetY = rect.y - (toolbarHeight || 0) - margin;
  if (!toolbarHeight) targetY = rect.y - 64;
  if (toolbarHeight && targetY < margin) {
    targetY = rect.y + rectHeight + margin;
  }
  if (!toolbarHeight && targetY < margin) {
    targetY = rect.y + rectHeight + margin;
  }
  setPosition(rect.x, targetY);
};



let mouseDownHandler: ((e: MouseEvent) => void) | null = null;

let mouseUpHandler: ((e: MouseEvent) => void) | null = null;



const buildApiUrl = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const backend = backendBase.value;
  if (backend) return `${backend}${normalized}`;
  const base = (typeof window !== 'undefined' && (window as any).__NUXT__?.config?.app?.baseURL) || '/';
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${normalized}`;
};

function onDragMove(event: PointerEvent) {
  if (!isDragging.value) return;
  setPosition(event.clientX - dragOffset.x, event.clientY - dragOffset.y);
}

function detachDragListeners() {
  if (typeof window === 'undefined') return;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
}

function onDragEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      skipSelectionUpdate = false;
    }, 120);
  } else {
    skipSelectionUpdate = false;
  }
  detachDragListeners();
}

function onDragStart(event: PointerEvent) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  skipSelectionUpdate = true;
  detachDragListeners();
  dragOffset.x = event.clientX - pos.x;
  dragOffset.y = event.clientY - pos.y;
  isDragging.value = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }
}



const fetchToolbarPresets = async () => {

  if (typeof window === 'undefined') return;

  try {

    const res = await fetch(buildApiUrl('/api/toolbar/presets'));

    if (!res.ok) return;

    const data = await res.json();

    const incoming: Preset[] = Array.isArray(data?.presets) ? data.presets.filter((p: any) => p && typeof p.name === 'string' && typeof p.prompt === 'string') : [];

    if (!incoming.length) return;

    const existingNames = new Set(presets.value.map((p) => p.name));

    const merged: Preset[] = [];

    for (const item of incoming) {

      if (!existingNames.has(item.name)) merged.push(item);

    }

    if (merged.length) {

      presets.value = [...merged, ...presets.value];

      if (!selectedPreset.value && !localStorage.getItem(STORAGE_KEY)) {

        selectedPreset.value = merged[0].name;

        prompt.value = merged[0].prompt;

      }

    }

  } catch (error) {

    console.warn('[AiToolbar] 无法获取预设提示词', error);

  }

};



onMounted(() => {

  mouseDownHandler = (e: MouseEvent) => {

    if (root.value && root.value.contains(e.target as Node)) return;

    visible.value = false;

  };

  mouseUpHandler = (e: MouseEvent) => {

    if (root.value && root.value.contains(e.target as Node)) return;

    window.setTimeout(updateFromSelection, 0);

  };

  document.addEventListener('mousedown', mouseDownHandler, true);

  document.addEventListener('mouseup', mouseUpHandler, true);



  try {

    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {

      const stored = JSON.parse(raw) as Preset[];

      if (Array.isArray(stored)) {

        presets.value = stored;
      }

    }

  } catch {}



  fetchToolbarPresets();

});



onBeforeUnmount(() => {

  if (mouseDownHandler) document.removeEventListener('mousedown', mouseDownHandler, true);

  if (mouseUpHandler) document.removeEventListener('mouseup', mouseUpHandler, true);

  detachDragListeners();

  isDragging.value = false;

});



const run = async () => {
  const input = props.getSelection();
  if (!input || isLoading.value) return;
  originalSelection.value = input;

  const workspaceStore = useWorkspaceStore?.();
  const canUseWorkspaceOperator = false; // 工具栏改走独立后端，暂不接入工作区调度

  let handledByOperator = false;

  try {
    isLoading.value = true;

    if (workspaceStore && canUseWorkspaceOperator) {
      handledByOperator = true;
      const requirement = {
        action: 'edit',
        target: 'selection',
        parameters: {
          prompt: prompt.value,
          preserveFormatting: true,
          selectedText: input,
          maxTokens: maxTokens.value,
          effort: effort.value,
        },
        prompt: `${prompt.value}

选中的文本:
${input}`,
      };

      const operator = useWorkspaceOperator();
      const operationId = await operator.addOperation({
        type: OperationType.AI_LLM,
        description: `AI操作已调度: ${input.substring(0, 32)}...`,
        priority: 1,
        payload: requirement,
        onComplete: (result: any) => {
          isLoading.value = false;
          if (result?.text) {
            previewText.value = result.text;
            showPreview.value = true;
          }
        },
        onError: (error: Error) => {
          isLoading.value = false;
          console.error('[AiToolbar] AI操作失败:', error);
          alert(`AI操作失败: ${error.message}`);
        },
      });

      console.log(`[AiToolbar] AI操作已调度: ${operationId}`);
      return;
    }

    await runRequest(input, prompt.value);
  } catch (e: any) {
    console.error('[AiToolbar] AI操作失败:', e);
    alert(`AI操作失败: ${e.message || e}`);
  } finally {
    if (!handledByOperator) isLoading.value = false;
  }
};

const runRequest = async (input: string, promptText: string) => {

  const body = {

    prompt: String(promptText || ''),

    selection: input,

    reasoning_effort: effort.value,

    max_tokens: Math.max(128, Math.min(Number(maxTokens.value) || 1024, 4096)),

  };



  const res = await fetch(buildApiUrl('/api/toolbar/rewrite'), {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify(body),

  });

  if (!res.ok) {

    throw new Error(await res.text());

  }

  const data = await res.json();

  const output = pickOutputText(data);

  if (output) {

    previewText.value = output;

    showPreview.value = true;

  }

};



const pickOutputText = (d: any): string => {

  if (!d) return '';

  if (typeof d.text === 'string') return d.text;

  if (typeof d.output_text === 'string') return d.output_text;

  const arr = Array.isArray(d.output) ? d.output : [];

  for (const item of arr) {

    if (item?.type === 'message' && Array.isArray(item?.content)) {

      const outTxt = item.content.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string');

      if (outTxt) return outTxt.text as string;

      const anyTxt = item.content.find((c: any) => typeof c?.text === 'string');

      if (anyTxt) return anyTxt.text as string;

    }

  }

  if (typeof d.reply === 'string') return d.reply;

  return '';

};



watch(selectedPreset, (name) => {

  const found = presets.value.find((p) => p.name === name);

  if (found) {

    prompt.value = found.prompt;

  }

});



const savePreset = () => {

  const name = (newPresetName.value || selectedPreset.value || '').trim();

  if (!name) {

    alert('请输入预设名称');

    return;

  }

  const idx = presets.value.findIndex((p) => p.name === name);

  const item = { name, prompt: prompt.value } as Preset;

  if (idx >= 0) presets.value[idx] = item; else presets.value.unshift(item);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.value));

  selectedPreset.value = name;

  newPresetName.value = '';

};



const deletePreset = () => {

  const name = selectedPreset.value;

  if (!name) return;

  presets.value = presets.value.filter((p) => p.name !== name);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.value));

  selectedPreset.value = '';

};



const copy = async () => {

  const input = props.getSelection();

  if (!input) return;

  try {

    await navigator.clipboard.writeText(input);

  } catch {}

};



const paste = async () => {

  try {

    const text = await navigator.clipboard.readText();

    if (text) return props.applyText(text);

  } catch {}

  const text = window.prompt('粘贴内容');

  if (text != null) props.applyText(text);

};



const applyPreview = () => {

  if (!previewText.value) return;

  props.applyText(previewText.value);

  showPreview.value = false;

  previewText.value = '';

  visible.value = false;

};



const cancelPreview = () => {

  showPreview.value = false;

  previewText.value = '';

};





function renderDiff(prev: string, next: string): string {

  if (!next && !prev) return '';

  if (prev === next) return escapeHtml(next);

  if (!prev) return '<span class="diff-insert">' + escapeHtml(next) + '</span>';

  if (!next) return '<span class="diff-delete">' + escapeHtml(prev) + '</span>';

  const segments = buildDiff(tokenize(prev), tokenize(next));

  return segments.map((seg) => {

    const html = escapeHtml(seg.text);

    if (!html) return '';

    if (seg.type === 'insert') return '<span class="diff-insert">' + html + '</span>';

    if (seg.type === 'delete') return '<span class="diff-delete">' + html + '</span>';

    return html;

  }).join('');

}



type DiffSegment = { type: 'equal' | 'delete' | 'insert'; text: string };



function buildDiff(aTokens: string[], bTokens: string[]): DiffSegment[] {

  const m = aTokens.length;

  const n = bTokens.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {

    for (let j = n - 1; j >= 0; j--) {

      if (aTokens[i] === bTokens[j]) dp[i][j] = dp[i + 1][j + 1] + 1;

      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);

    }

  }

  const segments: DiffSegment[] = [];

  let i = 0;

  let j = 0;

  while (i < m && j < n) {

    if (aTokens[i] === bTokens[j]) {

      segments.push({ type: 'equal', text: aTokens[i] });

      i++;

      j++;

    } else if (dp[i + 1][j] >= dp[i][j + 1]) {

      segments.push({ type: 'delete', text: aTokens[i] });

      i++;

    } else {

      segments.push({ type: 'insert', text: bTokens[j] });

      j++;

    }

  }

  while (i < m) segments.push({ type: 'delete', text: aTokens[i++] });

  while (j < n) segments.push({ type: 'insert', text: bTokens[j++] });

  return segments;

}



function tokenize(text: string): string[] {

  if (!text) return [];

  const match = text.match(/(\s+|\S+)/g);

  return match ? match : [];

}



function escapeHtml(text: string): string {

  return text

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/\r/g, '')

    .replace(/\n/g, '<br>')

    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')

    .replace(/'/g, '&#39;')



    .replace(/ /g, '&nbsp;');

}



</script>



<style scoped>

.ai-toolbar {
  transform: translateY(-10px);
  opacity: 0.98;
  min-width: 16rem;
}

.ai-toolbar.is-dragging {
  cursor: grabbing;
}

.ai-toolbar.is-dragging .toolbar-header {
  cursor: grabbing;
}

.toolbar-shell {
  @apply bg-c dark:bg-dark-c border border-c/50 dark:border-dark-c/60 rounded-2xl shadow-2xl px-4 py-3 text-xs text-dark-c space-y-3 dark:text-light-c;
}

.toolbar-header {
  @apply flex items-start justify-between gap-3 cursor-move select-none;
  touch-action: none;
}



.header-info {

  @apply flex items-start gap-2;

}



.title {
  @apply text-sm font-semibold text-dark-c dark:text-light-c;
}

.subtitle {
  @apply text-xs text-dark-c/70 dark:text-light-c/70;
}



.toolbar-actions {

  @apply flex items-center gap-2 flex-wrap;

}



.toolbar-icon-btn {
  @apply flex items-center gap-1 px-3 py-1.5 rounded-lg border border-c/50 bg-c text-dark-c hover:bg-brand/10 hover:text-brand transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:bg-dark-c dark:border-dark-c/60 dark:text-light-c/80;
}

.toolbar-primary {
  @apply px-3.5 py-1.5 rounded-lg bg-brand text-white font-medium text-xs shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5;
}

.toolbar-primary.loading {
  @apply pointer-events-none opacity-80;
}

.toolbar-primary.loading span {
  @apply flex items-center gap-1;
}


.toolbar-panel {

  @apply space-y-2;

}



.preset-row {

  @apply flex items-center gap-2 flex-wrap;

}



.preset-label {
  @apply text-[11px] uppercase tracking-wide text-dark-c/60 dark:text-light-c/60;
}



.preset-select,
.preset-input {
  @apply border border-c/50 rounded-lg bg-c px-3 py-1.5 text-xs text-dark-c outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/40 transition-colors dark:bg-dark-c dark:border-dark-c/60 dark:text-light-c/90;
}

.prompt-area {
  @apply w-full h-24 rounded-xl border border-c/50 bg-c px-3 py-2 text-xs leading-5 text-dark-c outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/40 transition dark:bg-dark-c dark:border-dark-c/60 dark:text-light-c/90;
}

.preview-bubble {
  /* Wider bubble to fit two columns comfortably */
  @apply absolute left-4 top-full mt-3 w-[52rem] max-w-[92vw] bg-c border border-c/50 rounded-2xl shadow-2xl p-4 space-y-3 text-xs text-dark-c dark:bg-dark-c dark:border-dark-c/60 dark:text-light-c/90;
}

.preview-header {
  @apply flex items-center gap-2 text-dark-c dark:text-light-c;
}

.preview-content {
  /* Taller scroll area to review more text */
  @apply border border-c/30 rounded-xl bg-c p-4 max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-6 text-dark-c dark:bg-dark-c/40 dark:text-light-c/90;
}

.diff-insert {
  @apply text-green-600 dark:text-green-400 bg-green-100/60 dark:bg-green-900/30 px-1.5 py-0.5 rounded-sm font-medium;
}

.diff-delete {
  @apply text-red-600 dark:text-red-400 bg-red-100/70 dark:bg-red-900/30 px-1.5 py-0.5 rounded-sm line-through font-medium;
}

.preview-legend {
  @apply mt-2 flex items-center gap-2 text-xs text-dark-c/60 dark:text-light-c/60;
}

.legend-chip {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px];
}

.legend-insert {
  @apply border-green-300 text-green-700 bg-green-100/50 dark:border-green-500/40 dark:text-green-300 dark:bg-green-900/30;
}

.legend-delete {
  @apply border-red-300 text-red-700 bg-red-100/60 dark:border-red-500/40 dark:text-red-300 dark:bg-red-900/30;
}

.preview-actions {

  @apply flex items-center gap-2;

}



.fade-enter-active,

.fade-leave-active {

  transition: opacity 0.18s ease;

}



.fade-enter-from,

.fade-leave-to {

  opacity: 0;

}

</style>












