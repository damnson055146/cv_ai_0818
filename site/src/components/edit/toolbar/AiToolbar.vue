<template>
  <div ref="root" v-show="visible" class="ai-toolbar fixed z-50 bg-c/90 border border-c/60 rounded-xl shadow-xl backdrop-blur-md p-2 text-xs"
       :style="{ left: `${pos.x}px`, top: `${pos.y}px` }">
    <div class="flex items-center space-x-1">
      <button class="round-btn" title="Collapse/Expand" @click="collapsed = !collapsed">{{ collapsed ? '⮟' : '⮝' }}</button>
      <button class="round-btn" @click="run">Rewrite (o3)</button>
      <button class="round-btn" @click="copy">Copy</button>
      <button class="round-btn" @click="paste">Paste</button>
    </div>

    <div v-show="!collapsed" class="mt-2 space-y-1 max-w-120">
      <div class="flex items-center space-x-1">
        <select v-model="selectedPreset" class="border border-c/60 rounded px-1 py-0.5 bg-transparent w-44">
          <option value="">Select preset…</option>
          <option v-for="p in presets" :key="p.name" :value="p.name">{{ p.name }}</option>
        </select>
        <input v-model="newPresetName" class="border border-c/60 rounded px-1 py-0.5 bg-transparent w-36" placeholder="Preset name" />
        <button class="round-btn" @click="savePreset">Save</button>
        <button class="round-btn" :disabled="!selectedPreset" @click="deletePreset">Delete</button>
      </div>
      <textarea v-model="prompt" class="border border-c/60 rounded px-2 py-1 bg-transparent w-80 h-22 leading-5" placeholder="Custom prompt"></textarea>
    </div>

    <!-- Preview bubble -->
    <div v-if="showPreview" class="preview-bubble absolute left-2 top-full mt-2 bg-c border border-c/60 rounded-lg shadow-lg p-2 w-96 max-w-[80vw]">
      <div class="font-medium mb-1">Preview</div>
      <div class="border border-c/60 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{{ previewText }}</div>
      <div class="mt-2 hstack space-x-2">
        <button class="round-btn" @click="applyPreview">Apply</button>
        <button class="round-btn" @click="cancelPreview">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useWorkspaceStore } from "~/composables/stores/workspace";
import { useWorkspaceOperator, OperationType } from "~/composables/workspaceOperator";

const props = defineProps<{ getSelection: () => string; getSelectionRect: () => { x: number; y: number; visible: boolean }; applyText: (text: string) => void }>();
const root = ref<HTMLElement | null>(null);

const visible = ref(false);
const pos = reactive({ x: 0, y: 0 });
const collapsed = ref(true);
const STORAGE_KEY = 'MR_AI_PROMPTS';
type Preset = { name: string; prompt: string };
const presets = ref<Preset[]>([]);
const selectedPreset = ref('');
const newPresetName = ref('');
const prompt = ref('Rewrite the selected text to be concise and professional. Keep all markdown and custom tags unchanged. Return only the rewritten text. Do not include addional tags or any explanations.');
const showPreview = ref(false);
const previewText = ref('');

let hideTimer: number | null = null;

const updateFromSelection = () => {
  const rect = props.getSelectionRect();
  visible.value = rect.visible;
  if (!rect.visible) return;
  pos.x = rect.x;
  pos.y = rect.y - 40;
};

let mouseDownHandler: ((e: MouseEvent) => void) | null = null;
let mouseUpHandler: ((e: MouseEvent) => void) | null = null;

onMounted(() => {
  mouseDownHandler = (e: MouseEvent) => {
    if (root.value && root.value.contains(e.target as Node)) return; // clicks inside toolbar should not hide
    visible.value = false;
  };
  mouseUpHandler = (e: MouseEvent) => {
    if (root.value && root.value.contains(e.target as Node)) return; // ignore toolbar interactions
    window.setTimeout(updateFromSelection, 0);
  };
  document.addEventListener('mousedown', mouseDownHandler, true);
  document.addEventListener('mouseup', mouseUpHandler, true);
  // load presets
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) presets.value = JSON.parse(raw);
  } catch {}
});
onBeforeUnmount(() => {
  if (mouseDownHandler) document.removeEventListener('mousedown', mouseDownHandler, true);
  if (mouseUpHandler) document.removeEventListener('mouseup', mouseUpHandler, true);
});

// TODO: [工作区AI操作集成] 集成工作区操作管理器
// 当前: 直接调用API进行AI重写
// 增强: 通过工作区操作管理器进行AI操作，支持键鼠锁定和状态管理
const run = async () => {
  const input = props.getSelection();
  if (!input) return;

  try {
    // 尝试通过工作区操作管理器执行AI操作
    const workspaceStore = useWorkspaceStore?.()
    
    if (workspaceStore) {
      console.log('[AiToolbar] 通过工作区操作管理器执行AI重写')
      
      // 构建AI操作需求
      const requirement = {
        action: 'edit',
        target: 'selection',
        parameters: {
          prompt: prompt.value,
          preserveFormatting: true,
          selectedText: input
        },
        prompt: `${prompt.value}\n\n选中文本: ${input}`
      }
      
      // 通过工作区管理器添加操作
      const operator = useWorkspaceOperator()
      const operationId = await operator.addOperation({
        type: OperationType.AI_LLM,
        description: `AI工具栏重写: ${input.substring(0, 50)}...`,
        priority: 1,
        payload: requirement,
        onComplete: (result: any) => {
          console.log('[AiToolbar] AI重写操作完成:', result)
          if (result.text) {
            previewText.value = result.text
            showPreview.value = true
          }
        },
        onError: (error: Error) => {
          console.error('[AiToolbar] AI重写操作失败:', error)
          alert(`AI操作失败: ${error.message}`)
        }
      })
      
      console.log(`[AiToolbar] AI重写操作已添加到队列，ID: ${operationId}`)
      return
    }
    
    // 如果工作区管理器不可用，回退到原有实现
    console.log('[AiToolbar] 工作区管理器不可用，使用原有AI调用方式')
    await runLegacyAiOperation(input)
    
  } catch (e: any) {
    console.error('[AiToolbar] AI操作失败:', e);
    alert(`AI操作失败: ${e.message || e}`);
  }
};

/**
 * 原有的AI操作实现（作为后备）
 */
const runLegacyAiOperation = async (input: string) => {
  // Preserve formatting via instruction & examples
  const examples = `Examples of formatting to preserve:\n- Bold: **text**\n- Italic: *text*\n- Code: \`code\`\n- Links: [text](url)\n- Images: ![alt](url)\n- Crossref: [~P1] and [~P1]: Definition\n- Headings: #, ##, ### prefixes\n- Lists: -, 1., >, : prefixes\nIf the selection contains formatting markers, keep the structure and only rewrite natural language text.`;

  const combined = `${prompt.value}\n\n${examples}\n\n<selection>\n${input}\n</selection>`;

  const body = {
    model: 'o3',
    input: combined,
    reasoning: { effort: 'high' },
    max_output_tokens: 512
  };

  const base = (window as any).__NUXT__?.config?.app?.baseURL || '/';
  const apiURL = (base.endsWith('/') ? base : base + '/') + 'api/ai';
  let res = await fetch(apiURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // no direct key on client
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = await res.json();
  // Extract text robustly for Responses API
  const pickOutputText = (d: any): string => {
    if (typeof d?.output_text === 'string') return d.output_text;
    if (typeof d?.text === 'string') return d.text;
    const arr = Array.isArray(d?.output) ? d.output : [];
    for (const item of arr) {
      if (item?.type === 'message' && Array.isArray(item?.content)) {
        const outTxt = item.content.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string');
        if (outTxt) return outTxt.text as string;
        const anyTxt = item.content.find((c: any) => typeof c?.text === 'string');
        if (anyTxt) return anyTxt.text as string;
      }
    }
    return '';
  };
  const output = pickOutputText(data);
  if (output) {
    previewText.value = output;
    showPreview.value = true;
  }
};
watch(selectedPreset, (name) => {
  const found = presets.value.find((p) => p.name === name);
  if (found) prompt.value = found.prompt;
});

const savePreset = () => {
  const name = (newPresetName.value || selectedPreset.value || '').trim();
  if (!name) return alert('Preset name is required');
  const idx = presets.value.findIndex((p) => p.name === name);
  const item = { name, prompt: prompt.value } as Preset;
  if (idx >= 0) presets.value[idx] = item; else presets.value.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.value));
  selectedPreset.value = name;
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
  try { await navigator.clipboard.writeText(input); } catch {}
};

const paste = async () => {
  // Try Async Clipboard API
  try {
    const text = await navigator.clipboard.readText();
    if (text) return props.applyText(text);
  } catch {}
  // Fallback: prompt-based paste if permission is blocked
  const text = window.prompt('Paste text here');
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
</script>

<style scoped>
.ai-toolbar {
  transform: translateY(-8px) scale(0.98);
  opacity: 0.98;
  border-radius: 12px;
}
.ai-toolbar::after {
  content: "";
  position: absolute;
  left: 16px;
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-left: 1px solid var(--un-c-border, #cbd5e1);
  border-bottom: 1px solid var(--un-c-border, #cbd5e1);
  transform: rotate(45deg);
}
.round-btn {
  padding: 2px 8px;
  border: 1px solid var(--un-c-border, #cbd5e1);
  border-radius: 8px;
}
select, input, textarea {
  outline: none;
}
</style>


