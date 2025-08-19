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
  </div>
</template>

<script lang="ts" setup>
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
const prompt = ref('Rewrite the selected text to be concise and professional. Keep all markdown and custom tags unchanged.');
const runtime = useRuntimeConfig();
const apiKeyFromEnv = (runtime.public as any)?.OPENAI_API_KEY || (runtime as any)?.openaiApiKey || '';
const apiKey = ref(apiKeyFromEnv || localStorage.getItem('OPENAI_API_KEY') || '');

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

const run = async () => {
  const input = props.getSelection();
  if (!input) return;

  try {
    if (!apiKey.value) {
      alert('Please set OPENAI_API_KEY in site/configs/.env or localStorage.');
      return;
    }
    localStorage.setItem('OPENAI_API_KEY', apiKey.value);

    // Preserve formatting via instruction & examples
    const examples = `Examples of formatting to preserve:\n- Bold: **text**\n- Italic: *text*\n- Code: \`code\`\n- Links: [text](url)\n- Images: ![alt](url)\n- Crossref: [~P1] and [~P1]: Definition\n- Headings: #, ##, ### prefixes\n- Lists: -, 1., >, : prefixes\nIf the selection contains formatting markers, keep the structure and only rewrite natural language text.`;

    const combined = `${prompt.value}\n\n${examples}\n\n<selection>\n${input}\n</selection>`;

    const body = {
      model: 'openai/o3-2025-04-16',
      input: [ { role: 'user', content: combined } ],
      reasoning: { effort: 'high' },
      max_completion_tokens: 512,
      tool_calling: 'auto',
      parallel_tool_calls: true
    } as any;

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // no direct key on client
      },
      body: JSON.stringify({ endpoint: 'responses', body })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    // Extract text
    const output = (data.output_text || data.output?.[0]?.content || data.output?.[0]?.content?.[0]?.text || '');
    if (output) props.applyText(output);
    visible.value = false;
  } catch (e: any) {
    console.error(e);
    alert(`OpenAI error: ${e.message || e}`);
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


