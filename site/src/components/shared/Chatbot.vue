<template>
  <!-- Floating bubble -->
  <Teleport to="body">
    <button
      v-if="!isOpen"
      ref="bubbleRef"
      :style="bubbleStyle"
      class="fixed z-50 circle size-14 bg-gray-800 text-white shadow-c border border-darker-c select-none"
      title="Chatbot"
      @mousedown="onDragStart"
      @touchstart.passive="onTouchStart"
      @click="onBubbleClick"
    >
      <span class="i-ph:chat-circle-text-duotone text-2xl" />
    </button>
  </Teleport>

  <!-- Expandable panel -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed z-50 bg-c text-c shadow-c border border-c rounded-xl overflow-hidden flex flex-col"
      :style="panelStyle"
    >
      <!-- Header -->
      <div class="hstack justify-between px-3 py-2 border-b border-light-c bg-dark-c">
        <div class="hstack space-x-2">
          <span class="i-ph:chat-circle-text-duotone text-xl text-gray-500" />
          <div class="leading-tight">
            <div class="text-dark-c text-sm font-700">Chatbot</div>
          </div>
        </div>
        <div class="hstack space-x-1">
          <button class="round-btn" title="Settings" @click="toggleSettings">
            <span class="i-ph:gear-six-duotone" />
          </button>
          <button class="round-btn" title="Clear" @click="clearMessages">
            <span class="i-ph:trash-duotone" />
          </button>
          <button class="round-btn" title="Minimize" @click="toggleOpen">
            <span class="i-ph:minus-circle-duotone" />
          </button>
        </div>
      </div>

      <!-- Settings -->
      <div v-if="showSettings" class="px-3 py-3 space-y-3 bg-c border-b border-light-c">
        <div class="text-sm text-light-c">Configure model and parameters. API key is not required because requests go through server proxy.</div>

        <!-- Model & Params -->
        <div class="space-y-2">
          <label class="text-xs text-light-c">Model & Parameters</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="space-y-1">
              <span class="text-xs text-light-c">Model</span>
              <select v-model="selectedModel" class="rounded-md bg-dark-c border border-light-c px-2 py-2 text-sm">
                <option v-for="m in modelOptions" :key="m.id" :value="m.id">{{ m.label }}</option>
              </select>
            </div>
            <div class="space-y-1">
              <span class="text-xs text-light-c">Temperature</span>
              <input type="range" :min="generalSpec.temperature.min" :max="generalSpec.temperature.max" :step="generalSpec.temperature.step" v-model.number="temperature" />
              <div class="text-xs">{{ temperature.toFixed(2) }}</div>
            </div>
            <div class="space-y-1">
              <span class="text-xs text-light-c">Max tokens</span>
              <input type="number" class="rounded-md bg-dark-c border border-light-c px-2 py-2 text-sm w-full" :min="generalSpec.max_tokens.min" :max="generalSpec.max_tokens.max" :step="generalSpec.max_tokens.step" v-model.number="maxTokens" />
            </div>
            <template v-if="selectedModel === 'gpt-5'">
              <div class="space-y-1">
                <span class="text-xs text-light-c">Verbosity</span>
                <select v-model="verbosity" class="rounded-md bg-dark-c border border-light-c px-2 py-2 text-sm">
                  <option v-for="opt in gpt5Spec.verbosity.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div class="space-y-1">
                <span class="text-xs text-light-c">Reasoning Effort</span>
                <select v-model="reasoningEffort" class="rounded-md bg-dark-c border border-light-c px-2 py-2 text-sm">
                  <option v-for="opt in gpt5Spec.reasoning_effort.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
            </template>
          </div>
          <div class="text-xs truncate">
            <span class="text-light-c">apiBase:</span>
            <span class="mx-1">{{ effectiveApiBase || '(not set)' }}</span>
          </div>
        </div>

        
      </div>

      <!-- Messages -->
      <div ref="scrollRef" class="flex-1 px-4 py-4 space-y-3 overflow-y-auto bg-c">
        <div v-for="m in messages" :key="m.id" class="w-full">
          <div
            v-if="m.role === 'assistant'"
            class="w-full">
            <div class="max-w-4/5 md:max-w-3/4 bg-gray-100 dark:bg-slate-600 border border-light-c rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap">
              {{ m.content }}
            </div>
          </div>
          <div v-else class="w-full flex justify-end">
            <div class="max-w-4/5 md:max-w-3/4 bg-white text-black border border-light-c rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap">
              {{ m.content }}
            </div>
          </div>
        </div>
        <div v-if="isThinking" class="text-light-c text-xs px-1">Assistant is typing…</div>
      </div>

      <!-- Input -->
      <form class="px-4 pb-4 pt-2 bg-c border-t border-light-c" @submit.prevent="handleSend">
        <div class="w-full rounded-full border border-light-c bg-white dark:bg-slate-700 text-black dark:text-white shadow-c flex items-center gap-3 px-3 py-1.5">
          <button type="button" class="circle size-7 hover:bg-gray-100 dark:hover:bg-slate-600" title="Add">
            <span class="i-ph:plus-bold text-gray-600 dark:text-gray-300" />
          </button>

          <textarea
            ref="inputRef"
            v-model="draft"
            class="flex-1 resize-none bg-transparent border-0 outline-none px-1 py-1 text-sm"
            rows="1"
            placeholder="询问任何问题"
            @keydown.enter.exact.prevent="handleSend"
            @input="autoGrow"
          />

          <div class="hstack gap-1.5">
            <button type="submit" class="circle size-9 bg-black text-white hover:opacity-90" :disabled="!canSend" title="Send">
              <span class="i-ic:round-arrow-upward text-base" />
            </button>
          </div>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
type Role = "user" | "assistant" | "system";
interface Message {
  id: number;
  role: Role;
  content: string;
}

// Preset system prompt
const SYSTEM_PROMPT =
  "你是一个资深留学顾问，擅长编辑留学申请用的简历、个人陈述/文书、推荐信，并能专业解答留学相关问题。默认用简体中文回答，如果文本处理需求则按照用户要求来选择语言。你的回答风格专业、清晰、可执行，必要时先澄清关键信息。";

const isOpen = ref(false);
const draft = ref("");
const messages = useLocalStorage<Message[]>(
  "chatbot.messages",
  [{ id: 1, role: "assistant", content: "Hi! I'm your Chatbot. How can I help you today?" }]
);
const isThinking = ref(false);

const bubbleRef = ref<HTMLButtonElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);

// Settings state
const showSettings = ref(false);
// API key is no longer required on client; keep a stub store for backward compatibility
const revealKey = ref(false);
const apiKey = ref<string>("");
const apiKeyLocal = ref<string>("");

const runtime = useRuntimeConfig();
const provider = (runtime.public as any)?.chatbot?.provider ?? "openai";
const defaultModel = (runtime.public as any)?.chatbot?.model ?? "o3";
const globalApiBase = (runtime.public as any)?.chatbot?.apiBase ?? "";
const models = (runtime.public as any)?.chatbot?.models ?? [];
const responseFormatDefault = (runtime.public as any)?.chatbot?.responseFormat ?? { enabled: false, schema: null };
const gpt5ExtrasDefault = (runtime.public as any)?.chatbot?.gpt5Extras ?? false;

// Model and params state
const modelOptions = models as Array<{ id: string; label: string; general: any; specific?: any; apiBase?: string; apiModel?: string }>
const selectedModel = useLocalStorage<string>("chatbot.model", defaultModel);
if (selectedModel.value === 'gpt-4.1') selectedModel.value = defaultModel;

const currentModel = computed(() => modelOptions.find((m) => m.id === selectedModel.value));
const generalSpec = computed(() => currentModel.value?.general ?? { temperature: { min: 0, max: 2, step: 0.1, default: 1 }, max_tokens: { min: 16, max: 32768, step: 16, default: 2048 } });
const apiModel = computed(() => currentModel.value?.apiModel || selectedModel.value);
const gpt5Spec = computed(() => (modelOptions.find((m) => m.id === "gpt-5")?.specific ?? { verbosity: { options: ["low", "medium", "high"] }, reasoning_effort: { options: ["minimal", "default", "deep"] } }));

// Prefer global apiBase (proxy) when configured; else fallback to model's endpoint
const effectiveApiBase = computed(() => globalApiBase || currentModel.value?.apiBase || "");
// Backward compatibility: auto-upgrade old endpoint '/api/chat' to '/api/ai'
const effectiveApiBaseNormalized = computed(() => {
  // Always call server proxy at absolute root '/api/ai'
  let url = effectiveApiBase.value || "/api/ai";
  if (url.includes("/api/chat")) url = url.replace("/api/chat", "/api/ai");
  if (!url.startsWith("/api/")) url = "/api/ai";
  return url;
});

const temperature = useLocalStorage<number>("chatbot.temperature", generalSpec.value.temperature.default);
const maxTokens = useLocalStorage<number>("chatbot.max_tokens", generalSpec.value.max_tokens.default);
watch(currentModel, (m) => {
  if (!m) return;
  // reset defaults when switching model
  temperature.value = m.general.temperature.default;
  maxTokens.value = m.general.max_tokens.default;
  if (m.id === "gpt-5") {
    verbosity.value = m.specific.verbosity.default;
    reasoningEffort.value = m.specific.reasoning_effort.default;
  }
});
// Expose minimal debug helpers to the browser console
if (typeof window !== "undefined") {
  (window as any).__chatbot = {
    endpoint: effectiveApiBase,
    selectedModel,
    dump() {
      // English for code explanation
      console.debug("[chatbot]", {
        endpoint: effectiveApiBase.value,
        model: selectedModel.value
      });
    }
  };
}

const verbosity = useLocalStorage<string>("chatbot.gpt5.verbosity", gpt5Spec.value.verbosity.default ?? "medium");
const reasoningEffort = useLocalStorage<string>("chatbot.gpt5.reasoning_effort", gpt5Spec.value.reasoning_effort.default ?? "default");

// Bubble position state
const bubbleX = ref(0);
const bubbleY = ref(0);
const bubbleSize = 56; // px
const bubbleMargin = 16; // px

// Panel size and position (fixed to bottom-right but respects bubble offset when minimized)
const panelWidth = ref(420);
const panelHeight = ref(560);

const bubbleStyle = computed(() => ({
  left: bubbleX.value + "px",
  top: bubbleY.value + "px"
}));

const panelStyle = computed(() => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const margin = 12;

  // Prefer above the bubble; if not enough space, place below
  let top = bubbleY.value - panelHeight.value - margin;
  const placeBelow = top < margin;
  if (placeBelow) {
    top = bubbleY.value + bubbleSize + margin;
  }

  // Align panel's right edge to bubble's right edge by default
  let left = bubbleX.value + bubbleSize - panelWidth.value;
  // Clamp within viewport
  left = Math.max(margin, Math.min(left, vw - panelWidth.value - margin));
  top = Math.max(margin, Math.min(top, vh - panelHeight.value - margin));

  return {
    width: panelWidth.value + 'px',
    height: panelHeight.value + 'px',
    left: left + 'px',
    top: top + 'px'
  } as Record<string, string>;
});

function toggleOpen() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) nextTick(() => inputRef.value?.focus());
}

function toggleSettings() {
  showSettings.value = !showSettings.value;
}

const canSend = computed(() => draft.value.trim().length > 0 && !isThinking.value);

function handleSend() {
  if (!canSend.value) return;
  const text = draft.value.trim();
  draft.value = "";
  pushMessage({ role: "user", content: text });
  // Reset input height after sending long messages
  nextTick(() => resetInputHeight());
  simulateAssistant(text);
}

function pushMessage(partial: Omit<Message, "id">) {
  const id = Date.now() + Math.random();
  const content = ensureText(partial.content as any);
  messages.value.push({ id, role: partial.role, content });
  nextTick(() => scrollToBottom());
}

function clearMessages() {
  messages.value = [];
}

function saveApiKey() {}
function clearApiKey() {
  apiKey.value = "";
  apiKeyLocal.value = "";
  try { localStorage.removeItem('chatbot.apiKey'); } catch {}
}

function scrollToBottom() {
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function autoGrow() {
  const el = inputRef.value;
  if (!el) return;
  // Base line: 1 row height approximated by scrollHeight at start
  const lineHeight = 20; // px approximation for text-sm
  const minH = lineHeight * 1.5; // initial ~1.5 lines
  const maxAuto = lineHeight * 3; // up to ~2x height (3 lines)
  const hardMax = lineHeight * 6; // 4x height (6 lines)

  el.style.height = "auto";
  const next = Math.min(el.scrollHeight, hardMax);
  el.style.height = Math.max(minH, Math.min(next, maxAuto)) + "px";
  el.style.overflowY = next > maxAuto ? "auto" : "hidden";
}

function resetInputHeight() {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = ""; // revert to default
  el.style.overflowY = "hidden";
}

// Demo assistant (replace with real API if needed)
async function simulateAssistant(userText: string) {
  isThinking.value = true;
  try {
    // Ensure no legacy HTML blobs remain in history before building payload
    purgeHtmlFromHistory();
    const endpoint = effectiveApiBaseNormalized.value;
    console.debug('[chatbot] endpoint=', endpoint, 'model=', selectedModel.value);
    if (endpoint) {
      const useResponsesApi = selectedModel.value.startsWith('o3');
      const chatMessages = buildChatMessages();
      if (useResponsesApi) {
        // Responses API expects `input` and `max_output_tokens`
        const payload: any = {
          model: apiModel.value,
          input: buildInputFromMessages(chatMessages),
          temperature: temperature.value,
          max_output_tokens: maxTokens.value
        };
        const res: any = await $fetch(endpoint, {
          method: "POST",
          headers: {
            // using proxy; server injects Authorization
            "Content-Type": "application/json"
          },
          body: { ...payload, model: selectedModel.value }
        });
        const text = sanitizeForDisplay(ensureText(normalizeResponsesOutput(res)));
        pushMessage({ role: "assistant", content: text });
      } else {
        // Chat completions
        const basePayload: any = {
          model: apiModel.value,
          messages: chatMessages,
          temperature: temperature.value,
          // For GPT-5, backend will normalize if needed, but we prefer sending correct field
          ...(selectedModel.value === 'gpt-5'
            ? { max_completion_tokens: maxTokens.value }
            : { max_tokens: maxTokens.value })
        };
        // If GPT-5 and response_format enabled in config, attach JSON Schema
        let payload = basePayload;
        if (
          selectedModel.value === "gpt-5" &&
          responseFormatDefault?.enabled &&
          responseFormatDefault?.schema
        ) {
          payload = {
            ...payload,
            response_format: {
              type: "json_schema",
              json_schema: { strict: true, schema: responseFormatDefault.schema }
            }
          };
        }
        const res: any = await requestChatCompletions(endpoint, payload);
        const text = sanitizeForDisplay(ensureText(
          res?.choices?.[0]?.message?.content ??
          res?.reply ??
          (typeof res === "string" ? res : JSON.stringify(res))
        ));
        pushMessage({ role: "assistant", content: text });
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
      const reply = `You said: "${userText}"\n\n(This is a demo reply. Configure apiBase and API Key to enable real responses.)`;
      pushMessage({ role: "assistant", content: reply });
    }
  } catch (e: any) {
    const errDetail =
      e?.data?.error?.detail ||
      e?.data?.error ||
      e?.data ||
      e?.message ||
      "Request failed.";
    console.error("[chatbot] request error", errDetail);
    pushMessage({ role: "assistant", content: ensureText(errDetail) });
  } finally {
    isThinking.value = false;
  }
}

// Streaming for GPT‑4.1 (SSE-like)
async function streamChat(endpoint: string, payload: any) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        // Proxy route will inject Authorization with server runtimeConfig
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({ ...payload, model: apiModel.value, stream: true })
    });
    // If backend responded with JSON (error or non-stream), surface it
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('text/event-stream')) {
      const clone = res.clone();
      try {
        const data = await clone.json();
        const msg = data?.error?.detail || data?.error || data;
        pushMessage({ role: 'assistant', content: sanitizeForDisplay(ensureText(msg)) });
      } catch (_) {
        const text = await clone.text();
        pushMessage({ role: 'assistant', content: sanitizeForDisplay(ensureText(text)) });
      }
      return;
    }
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    const id = Date.now() + Math.random();
    messages.value.push({ id, role: "assistant", content: "" });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.replace(/^data:\s*/, "");
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || json?.text || "";
          if (delta) {
            const idx = messages.value.findIndex((m) => m.id === id);
            if (idx >= 0) messages.value[idx].content += ensureText(delta);
          }
        } catch {}
      }
      nextTick(() => scrollToBottom());
    }
  } catch (err: any) {
    const msg = err?.message || "Stream failed";
    pushMessage({ role: "assistant", content: `Error: ${msg}` });
  }
}

// Send chat completions; for GPT-5 try extras first, then fallback if 400
async function requestChatCompletions(endpoint: string, basePayload: any) {
  const includeGpt5Extras = selectedModel.value === "gpt-5" && gpt5ExtrasDefault;
  const payloadWithExtras = includeGpt5Extras
    ? { ...basePayload, reasoning_effort: reasoningEffort.value, verbosity: verbosity.value }
    : basePayload;
  try {
    return await $fetch(endpoint, {
      method: "POST",
      headers: {
        // Proxy route will inject Authorization
        "Content-Type": "application/json"
      },
      body: { ...payloadWithExtras, model: apiModel.value }
    });
  } catch (e: any) {
    const status = e?.statusCode || e?.status || e?.response?.status;
    const msg: string = e?.data?.error?.message || e?.message || "";
    const isInvalidRequest = /invalid_request|Unrecognized request argument|schema|reasoning/i.test(msg);
    if (includeGpt5Extras && (status === 400 || isInvalidRequest)) {
      // retry without GPT‑5 extras
      try {
        return await $fetch(endpoint, {
          method: "POST",
          headers: {
            // Proxy route will inject Authorization
            "Content-Type": "application/json"
          },
          body: { ...basePayload, model: apiModel.value }
        });
      } catch (err) {
        throw err;
      }
    }
    throw e;
  }
}

// Normalize Responses API output to plain text
function normalizeResponsesOutput(res: any): string {
  // Prefer high-level helpers if present
  if (typeof res?.output_text === "string" && res.output_text) return res.output_text;
  // Some responses may use an array of content parts
  const outputs = res?.output;
  if (Array.isArray(outputs)) {
    const texts: string[] = [];
    for (const item of outputs) {
      if (typeof item?.output_text === "string") texts.push(item.output_text);
      if (typeof item?.text === "string") texts.push(item.text);
      const contentArr = item?.content;
      if (Array.isArray(contentArr)) {
        for (const c of contentArr) {
          if (typeof c?.text === "string") texts.push(c.text);
          else if (typeof c === "string") texts.push(c);
        }
      }
    }
    if (texts.length) return texts.join("");
  }
  const content = res?.content || res?.message?.content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const c of content) {
      if (typeof c?.text === "string") texts.push(c.text);
      else if (typeof c === "string") texts.push(c);
    }
    if (texts.length) return texts.join("");
  }
  // Fallbacks
  return (
    res?.choices?.[0]?.message?.content ||
    res?.reply ||
    (typeof res === "string" ? res : JSON.stringify(res))
  );
}

function ensureText(value: any): string {
  if (typeof value === "string") return value;
  try {
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  } catch {
    return "";
  }
}

// Detect and sanitize unexpected HTML payloads
function isHtmlLike(text: string): boolean {
  return /<\s*(?:!doctype|html|head|body)\b/i.test(text);
}

function sanitizeForDisplay(text: string): string {
  if (isHtmlLike(text)) return "[Error] Unexpected HTML response discarded.";
  return text;
}

function purgeHtmlFromHistory() {
  const before = messages.value.length;
  messages.value = messages.value.filter((m) => !isHtmlLike(ensureText(m.content)));
}

// Utilities to build context
function buildChatMessages() {
  const base: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT }
  ];
  const history = messages.value
    .map((m) => ({ role: m.role, content: sanitizeForDisplay(ensureText(m.content)) }))
    .filter((m) => !isHtmlLike(m.content))
    .slice(-40); // keep last N turns to limit token usage
  return base.concat(history);
}

function buildInputFromMessages(msgs: Array<{ role: string; content: string }>) {
  // For responses API, simple concatenation with role tags
  return msgs
    .filter((m) => !isHtmlLike(m.content))
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

// Drag logic for bubble
let startX = 0;
let startY = 0;
let originX = 0;
let originY = 0;
let dragging = false;
const clickThreshold = 4; // px

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function computeInitialPosition() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  bubbleX.value = w - bubbleSize - bubbleMargin;
  bubbleY.value = h - bubbleSize - bubbleMargin;
}

function onDragStart(e: MouseEvent) {
  e.preventDefault();
  startX = e.clientX;
  startY = e.clientY;
  originX = bubbleX.value;
  originY = bubbleY.value;
  dragging = false;
  window.addEventListener("mousemove", onDragging);
  window.addEventListener("mouseup", onDragEnd);
}

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  startX = t.clientX;
  startY = t.clientY;
  originX = bubbleX.value;
  originY = bubbleY.value;
  dragging = false;
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
}

function onDragging(e: MouseEvent) {
  e.preventDefault();
  updatePosition(e.clientX, e.clientY);
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault();
  const t = e.touches[0];
  updatePosition(t.clientX, t.clientY);
}

function onDragEnd() {
  window.removeEventListener("mousemove", onDragging);
  window.removeEventListener("mouseup", onDragEnd);
}

function onTouchEnd() {
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("touchend", onTouchEnd);
}

function updatePosition(clientX: number, clientY: number) {
  const dx = clientX - startX;
  const dy = clientY - startY;
  if (Math.abs(dx) > clickThreshold || Math.abs(dy) > clickThreshold) dragging = true;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxX = w - bubbleSize;
  const maxY = h - bubbleSize;
  bubbleX.value = clamp(originX + dx, 0, maxX);
  bubbleY.value = clamp(originY + dy, 0, maxY);
}

function onBubbleClick() {
  if (dragging) return; // ignore click if user just dragged
  toggleOpen();
}

onMounted(() => {
  computeInitialPosition();
  window.addEventListener("resize", computeInitialPosition);
});

onUnmounted(() => {
  window.removeEventListener("resize", computeInitialPosition);
});
</script>

<style scoped>
.max-w-4\/5 { max-width: 80%; }
</style>


