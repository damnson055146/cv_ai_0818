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
          <!-- 模式切换按钮 -->
          <div class="hstack space-x-1 mr-2">
            <button 
              @click="setMode('ask')"
              class="mode-btn"
              :class="currentMode === 'ask' ? 'mode-btn-active' : 'mode-btn-inactive'"
              title="问答模式"
            >
              <span class="i-ph:chat-duotone text-sm" />
            </button>
            <button 
              @click="setMode('edit')"
              class="mode-btn"
              :class="currentMode === 'edit' ? 'mode-btn-active' : 'mode-btn-inactive'"
              title="编辑模式"
            >
              <span class="i-ph:pencil-duotone text-sm" />
            </button>
          </div>
          
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
            :placeholder="currentMode === 'ask' ? '询问任何问题...' : '输入编辑指令...'"
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
import { useWorkspaceStore } from "~/composables/stores/workspace";
import { useAiRequirementParser } from "~/composables/aiRequirementParser";
import type { AiRequirement } from "~/composables/workspaceOperator";
import { useWorkspaceOperator } from "~/composables/workspaceOperator";
import { useDocumentStructureParser } from "~/composables/documentStructureParser";

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

// 模式管理
const currentMode = useLocalStorage<'ask' | 'edit'>('chatbot.mode', 'edit');

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
const gpt5Spec = computed(() => (modelOptions.find((m) => m.id === "gpt-5")?.specific ?? { verbosity: { options: ["low", "medium", "high"], default: "medium" }, reasoning_effort: { options: ["low", "medium", "high"], default: "medium" } }));

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
const reasoningEffort = useLocalStorage<string>("chatbot.gpt5.reasoning_effort", gpt5Spec.value.reasoning_effort.default ?? "medium");

// 清理无效的缓存值
if (!["low", "medium", "high"].includes(reasoningEffort.value)) {
  reasoningEffort.value = "medium";
}

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

/**
 * 设置AI助手模式
 */
function setMode(mode: 'ask' | 'edit') {
  currentMode.value = mode;
  console.log(`[Chatbot] 切换到${mode === 'ask' ? '问答' : '编辑'}模式`);
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

// TODO: [工作区AI操作] 扩展AI助手支持工作区操作命令解析和执行
// 当前功能: 基础的AI对话助手，支持OpenAI API调用
// 扩展计划: 
// 1. 添加需求解析器，识别工作区操作指令 ✓
// 2. 集成工作区操作管理器 ✓
// 3. 支持异步操作队列和进度反馈 ✓
async function simulateAssistant(userText: string) {
  console.log(`[Chatbot] 处理用户输入 - 模式: ${currentMode.value}`)
  
  // 根据模式选择处理方式
  if (currentMode.value === 'ask') {
    // 问答模式：直接调用原有聊天机器人逻辑
    console.log('[Chatbot] 问答模式，直接调用AI')
    await processChatMode(userText)
    return
  }
  
  // 编辑模式：处理工作区操作
  if (currentMode.value === 'edit') {
    const workspaceStore = useWorkspaceStore?.()
    
    if (workspaceStore) {
      try {
        console.log('[Chatbot] 编辑模式，分析操作意图')
        
        // 检查是否有选中文本
        const hasSelection = workspaceStore.state.currentSelection.hasSelection
        
        if (hasSelection) {
          // 有选中文本：直接进行编辑操作
          console.log('[Chatbot] 检测到选中文本，直接编辑')
          await processSelectionEdit(userText)
        } else {
          // 无选中文本：使用小LLM识别操作范围
          console.log('[Chatbot] 无选中文本，使用小LLM识别操作范围')
          await processSmartEdit(userText)
        }
        return
      } catch (error) {
        console.error('[Chatbot] 编辑模式处理失败:', error)
        pushMessage({ 
          role: "assistant", 
          content: `编辑操作失败: ${error instanceof Error ? error.message : String(error)}`
        })
        return
      }
    }
  }
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

/**
 * 统一处理工作区AI操作
 */
async function processWorkspaceAiOperation(requirement: AiRequirement, originalInput: string) {
  const workspaceStore = useWorkspaceStore()
  
  try {
    console.log('[Chatbot] 统一处理工作区AI操作:', requirement)
    
    // 1. 锁定键鼠操作
    const operator = useWorkspaceOperator()
    operator.lockKeyboardMouse('chatbot-ai-operation', `正在执行${requirement.action}操作`)
    
    // 2. 获取选中文本
    const selectedText = workspaceStore.state.currentSelection.hasSelection 
      ? workspaceStore.state.currentSelection.text 
      : ''
    
    // 3. 构建AI提示（将选中文本明确包含在prompt中，便于后端检查）
    const aiPrompt = buildWorkspaceAiPrompt(requirement, selectedText, originalInput)
      + (selectedText ? `\n\n[选中文本]\n${selectedText}\n[/选中文本]` : '')
    
    // 4. 调用AI API (复用现有的聊天机器人AI调用逻辑)
    const aiResponse = await callAiForWorkspace(aiPrompt)
    
    // 5. 应用AI结果到编辑器
    const applyResult = await applyAiResultToEditor(requirement, aiResponse, selectedText)
    
    // 6. 解锁键鼠操作
    operator.unlockKeyboardMouse()
    
    return {
      success: true,
      description: applyResult.description,
      result: aiResponse
    }
    
  } catch (error) {
    console.error('[Chatbot] 工作区AI操作失败:', error)
    
    // 确保解锁
    const operator = useWorkspaceOperator()
    operator.unlockKeyboardMouse()
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 构建工作区AI提示
 */
function buildWorkspaceAiPrompt(requirement: AiRequirement, selectedText: string, originalInput: string): string {
  const { action, target, parameters } = requirement
  
  let prompt = originalInput
  
  // 根据操作类型构建专用提示
  if (action === 'edit' && selectedText) {
    prompt += `\n\n选中的文本:\n${selectedText}\n\n请按要求修改上述选中文本，保持原有格式，只返回修改后的文本，不要添加任何解释。`
  } else if (action === 'format' && selectedText) {
    const style = parameters?.style || 'unknown'
    prompt += `\n\n选中的文本:\n${selectedText}\n\n请将上述文本格式化为${style}格式，只返回格式化后的文本。`
  } else if (action === 'generate') {
    prompt += `\n\n请根据要求生成内容，只返回生成的内容，不要添加任何解释。`
  } else if (action === 'analyze' && selectedText) {
    prompt += `\n\n要分析的文本:\n${selectedText}\n\n请分析上述文本并提供详细反馈。`
  } else if (action === 'translate' && selectedText) {
    const targetLang = parameters?.targetLanguage || 'english'
    prompt += `\n\n要翻译的文本:\n${selectedText}\n\n请翻译为${targetLang}，只返回翻译结果。`
  }
  
  return prompt
}

/**
 * 调用AI API处理工作区操作
 */
async function callAiForWorkspace(prompt: string): Promise<string> {
  // 复用现有的AI调用逻辑
  const endpoint = effectiveApiBaseNormalized.value
  
  if (!endpoint) {
    throw new Error('AI API端点未配置')
  }
  
  const useResponsesApi = selectedModel.value.startsWith('o3')
  
  if (useResponsesApi) {
    const payload = {
      model: apiModel.value,
      input: prompt,
      temperature: temperature.value,
      max_output_tokens: maxTokens.value
    }
    
    const res = await $fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: { ...payload, model: selectedModel.value }
    })
    
    return sanitizeForDisplay(ensureText(normalizeResponsesOutput(res)))
  } else {
    const payload = {
      model: apiModel.value,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: temperature.value,
      ...(selectedModel.value === 'gpt-5'
        ? { max_completion_tokens: maxTokens.value }
        : { max_tokens: maxTokens.value })
    }
    
    const res: any = await requestChatCompletions(endpoint, payload)
    return sanitizeForDisplay(ensureText(
      res?.choices?.[0]?.message?.content ??
      res?.reply ??
      (typeof res === "string" ? res : JSON.stringify(res))
    ))
  }
}

/**
 * 将AI结果应用到编辑器
 */
async function applyAiResultToEditor(requirement: AiRequirement, aiResult: string, selectedText: string) {
  const { action, target } = requirement
  
  // 通过事件通知编辑器更新内容
  const event = new CustomEvent('workspace-ai-result', {
    detail: {
      action,
      target,
      result: aiResult,
      originalText: selectedText,
      hasSelection: selectedText.length > 0
    }
  })
  
  document.dispatchEvent(event)
  
  let description = ''
  
  switch (action) {
    case 'edit':
      description = selectedText ? '已修改选中文本' : '已完成编辑'
      break
    case 'format':
      description = '已格式化文本'
      break
    case 'generate':
      description = '已生成新内容'
      break
    case 'analyze':
      description = '已完成分析'
      break
    case 'translate':
      description = '已翻译文本'
      break
    default:
      description = '操作已完成'
  }
  
  return { description }
}

/**
 * 处理问答模式
 */
async function processChatMode(userText: string) {
  console.log('[Chatbot] 执行问答模式')
  
  isThinking.value = true
  try {
    // 调用原有的聊天机器人逻辑
    await executeOriginalChatLogic(userText)
  } finally {
    isThinking.value = false
  }
}

/**
 * 处理选中文本编辑
 */
async function processSelectionEdit(userText: string) {
  console.log('[Chatbot] 执行选中文本编辑')
  
  isThinking.value = true
  pushMessage({ 
    role: "assistant", 
    content: "正在编辑选中文本..."
  })
  
  try {
    // 解析编辑意图
    const parser = useAiRequirementParser()
    const parsedCommand = parser.parse(userText)
    
    if (parsedCommand.type === 'workspace' && parsedCommand.confidence > 0.3) {
      const aiResult = await processWorkspaceAiOperation(parsedCommand.requirement!, userText)
      
      if (aiResult.success) {
        pushMessage({ 
          role: "assistant", 
          content: `✅ 选中文本编辑完成！${aiResult.description || ''}`
        })
      } else {
        pushMessage({ 
          role: "assistant", 
          content: `❌ 编辑失败: ${aiResult.error}`
        })
      }
    } else {
      // 兜底：直接把原话当作编辑指令作用于选区
      try {
        const fallbackReq = { action: 'edit', target: 'selection', parameters: {}, prompt: userText }
        const aiResult = await processWorkspaceAiOperation(fallbackReq as any, userText)
        if (aiResult.success) {
          pushMessage({ 
            role: "assistant", 
            content: "未精确识别，但已按你的原话完成选区编辑。"
          })
        } else {
          pushMessage({ 
            role: "assistant", 
            content: `❌ 编辑失败: ${aiResult.error}`
          })
        }
      } catch (e) {
        pushMessage({ 
          role: "assistant", 
          content: `❌ 编辑失败: ${(e as Error).message}`
        })
      }
    }
  } finally {
    isThinking.value = false
  }
}

/**
 * 处理智能编辑（无选中文本时）
 */
async function processSmartEdit(userText: string) {
  console.log('[Chatbot] 执行智能编辑')
  
  isThinking.value = true
  pushMessage({ 
    role: "assistant", 
    content: "正在分析编辑范围..."
  })
  
  try {
    // 1. 获取当前文档内容和结构
    const workspaceStore = useWorkspaceStore()
    const currentDocumentContent = await getCurrentDocumentContent()
    const documentStructure = await getCurrentDocumentStructure()
    
    console.log('[Chatbot] 文档结构:', documentStructure)
    
    // 2. 优先检查是否是常见的全文操作（避免小LLM解析延迟）
    const quickAnalysis = quickPatternMatch(userText)
    let scopeAnalysis
    
    if (quickAnalysis.success && (quickAnalysis.confidence || 0) > 0.8) {
      console.log('[Chatbot] 快速模式匹配成功，跳过小LLM:', quickAnalysis)
      scopeAnalysis = quickAnalysis
    } else {
      // 使用小LLM识别操作范围和意图
      scopeAnalysis = await analyzeScopeWithSmallLLM(userText, currentDocumentContent)
    }
    
    console.log('[Chatbot] 小LLM分析结果:', scopeAnalysis)
    
    // 3. 根据分析结果执行操作
    if (scopeAnalysis.success) {
      pushMessage({ 
        role: "assistant", 
        content: `识别到操作范围: ${scopeAnalysis.scope}，正在执行...`
      })
      
      const editResult = await executeStructuredSmartEdit(scopeAnalysis, userText, currentDocumentContent, documentStructure)
      
      if (editResult.success) {
        pushMessage({ 
          role: "assistant", 
          content: `✅ ${scopeAnalysis.scope}编辑完成！${editResult.description || ''}`
        })
      } else {
        pushMessage({ 
          role: "assistant", 
          content: `❌ 编辑失败: ${editResult.error}`
        })
      }
    } else {
      // 兜底：无法识别范围时，直接将原话按全文编辑执行
      try {
        const fallbackReq = { action: 'edit', target: 'document', parameters: {}, prompt: userInput }
        const aiResult = await processWorkspaceAiOperation(fallbackReq as any, userInput)
        if (aiResult.success) {
          pushMessage({ 
            role: "assistant", 
            content: "未能确定范围，已按你的原话对全文执行编辑。"
          })
        } else {
          pushMessage({ 
            role: "assistant", 
            content: `❌ 编辑失败: ${aiResult.error}`
          })
        }
      } catch (e) {
        pushMessage({ 
          role: "assistant", 
          content: `❌ 编辑失败: ${(e as Error).message}`
        })
      }
    }
  } finally {
    isThinking.value = false
  }
}

/**
 * 获取当前文档内容
 */
async function getCurrentDocumentContent(): Promise<string> {
  try {
    // 通过事件获取当前编辑器内容
    return new Promise((resolve) => {
      const event = new CustomEvent('get-document-content', {
        detail: { callback: resolve }
      })
      document.dispatchEvent(event)
      
      // 超时处理
      setTimeout(() => resolve(''), 1000)
    })
  } catch (error) {
    console.warn('[Chatbot] 获取文档内容失败:', error)
    return ''
  }
}

/**
 * 获取当前文档结构
 */
async function getCurrentDocumentStructure(): Promise<any> {
  try {
    return new Promise((resolve) => {
      const event = new CustomEvent('get-document-structure', {
        detail: { callback: resolve }
      })
      document.dispatchEvent(event)
      
      // 超时处理
      setTimeout(() => resolve({ sections: [], totalLines: 0 }), 1000)
    })
  } catch (error) {
    console.warn('[Chatbot] 获取文档结构失败:', error)
    return { sections: [], totalLines: 0 }
  }
}

/**
 * 使用小LLM分析操作范围
 */
async function analyzeScopeWithSmallLLM(userInput: string, documentContent: string) {
  try {
    const prompt = `你是一个文本编辑助手。用户想要编辑一个文档，但没有选中特定文本。请分析用户的意图和操作范围。

用户指令: "${userInput}"

文档内容预览 (前500字符):
${documentContent.substring(0, 500)}${documentContent.length > 500 ? '...' : ''}

请以JSON格式返回分析结果:
{
  "scope": "全文|段落|标题|列表项|具体位置描述",
  "action": "编辑|格式化|翻译|分析|生成|删除|插入",
  "confidence": 0.8,
  "target_content": "如果能识别具体内容则提供，否则为空",
  "reason": "分析理由"
}

只返回JSON，不要任何其他文字。`

    const response = await fetch('/api/siliconflow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: prompt,
        temperature: 0.1,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error(`小LLM API调用失败: ${response.status}`)
    }

    // 如果不是 JSON，直接 fallback
    const ct = response.headers.get('content-type') || ''
    if (!/application\/json/i.test(ct)) {
      const text = await response.text()
      console.warn('[Chatbot] 小LLM返回非JSON，启用fallback。content-type=', ct, 'snippet=', (text || '').slice(0, 120))
      return useFallbackAnalysis(userInput, documentContent)
    }
    const data = await response.json()
    
    // 检查是否是API错误响应
    if (data.error || data.isApiError) {
      console.warn('[Chatbot] 硅基流动API错误:', data.error)
      return useFallbackAnalysis(userInput, documentContent)
    }
    
    const aiResponse = data.choices?.[0]?.message?.content || ''
    
    console.log('[Chatbot] 小LLM原始响应:', aiResponse)
    
    // 解析JSON响应 - 更健壮的处理
    try {
      // 清理响应内容，移除HTML标记和其他干扰内容
      let cleanResponse = aiResponse.trim()
      
      // 移除HTML内容（如<!DOCTYPE等）
      if (cleanResponse.includes('<!DOCTYPE') || cleanResponse.includes('<html')) {
        console.warn('[Chatbot] 检测到HTML响应，可能是API错误，直接使用fallback')
        return useFallbackAnalysis(userInput, documentContent)
      }
      
      // 移除markdown代码块标记
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '')
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '')
      }
      
      // 移除可能的前后缀文字，只提取JSON部分
      const jsonMatch = cleanResponse.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const jsonStr = jsonMatch[0]
        console.log('[Chatbot] 提取到的JSON字符串:', jsonStr)
        
        const analysis = JSON.parse(jsonStr)
        
        // 验证JSON格式是否正确
        if (analysis && typeof analysis === 'object') {
          return {
            success: true,
            scope: analysis.scope || '全文',
            action: analysis.action || '编辑',
            confidence: analysis.confidence || 0.8,
            targetContent: analysis.target_content || '',
            reason: analysis.reason || '小LLM识别'
          }
        } else {
          throw new Error('解析的JSON格式不正确')
        }
      } else {
        // 如果没有找到JSON，使用fallback分析
        console.warn('[Chatbot] 未找到JSON格式，使用fallback分析')
        return useFallbackAnalysis(userInput, documentContent)
      }
    } catch (parseError) {
      console.warn('[Chatbot] JSON解析失败，使用fallback分析:', parseError)
      return useFallbackAnalysis(userInput, documentContent)
    }
  } catch (error) {
    console.error('[Chatbot] 小LLM分析失败，回退到规则引擎:', error)
    return useFallbackAnalysis(userInput, documentContent)
  }
}

/**
 * 快速模式匹配 - 优先处理常见指令
 */
function quickPatternMatch(userInput: string) {
  const input = userInput.toLowerCase()
  
  // 高优先级的全文翻译模式
  const highPriorityPatterns = [
    { 
      patterns: ['翻译全文', '翻译整个文档', '全文翻译', '全部翻译'], 
      scope: '全文', 
      action: '翻译', 
      confidence: 0.95 
    },
    { 
      patterns: ['翻译成中文', '翻译为中文', '中文翻译'], 
      scope: '全文', 
      action: '翻译', 
      confidence: 0.9 
    },
    { 
      patterns: ['翻译成英文', '翻译为英文', '英文翻译'], 
      scope: '全文', 
      action: '翻译', 
      confidence: 0.9 
    }
  ]
  
  // 查找高优先级匹配
  for (const pattern of highPriorityPatterns) {
    for (const p of pattern.patterns) {
      if (input.includes(p)) {
        console.log(`[Chatbot] 快速匹配成功: ${p} -> ${pattern.scope}`)
        return {
          success: true,
          scope: pattern.scope,
          action: pattern.action,
          confidence: pattern.confidence,
          targetContent: '',
          reason: `快速匹配: ${p}`
        }
      }
    }
  }
  
  return { success: false }
}

/**
 * Fallback分析器 - 当小LLM失败时使用规则引擎
 */
function useFallbackAnalysis(userInput: string, documentContent: string) {
  const input = userInput.toLowerCase()
  
  // 预定义的编辑模式
  const editPatterns = [
    { 
      patterns: ['翻译全文', '翻译整个文档', '翻译成中文', '翻译为中文', 'translate to chinese', '中文翻译', '全文翻译', '全部翻译'], 
      scope: '全文', 
      action: '翻译', 
      confidence: 0.95 
    },
    { 
      patterns: ['翻译成英文', '翻译为英文', 'translate to english', '英文翻译', 'translate all', 'translate entire'], 
      scope: '全文', 
      action: '翻译', 
      confidence: 0.95 
    },
    { 
      patterns: ['整篇', '全文', '整个文档', 'whole document', 'entire document', '全部内容', '所有内容'], 
      scope: '全文', 
      action: '编辑', 
      confidence: 0.9 
    },
    { 
      patterns: ['标题', 'heading', 'title', 'h1', 'h2', 'h3', '所有标题', '全部标题'], 
      scope: '标题', 
      action: '编辑', 
      confidence: 0.8 
    },
    { 
      patterns: ['段落', 'paragraph', '这段', '这一段'], 
      scope: '段落', 
      action: '编辑', 
      confidence: 0.7 
    },
    { 
      patterns: ['列表', 'list', '清单', '所有列表'], 
      scope: '列表项', 
      action: '编辑', 
      confidence: 0.7 
    },
    { 
      patterns: ['实习', 'internship', '实习经验', '实习经历', '所有实习'], 
      scope: '实习', 
      action: '编辑', 
      confidence: 0.8 
    },
    { 
      patterns: ['项目', 'project', '项目经验', '项目经历', '所有项目'], 
      scope: '项目', 
      action: '编辑', 
      confidence: 0.8 
    },
    { 
      patterns: ['格式化', 'format', '排版'], 
      scope: '全文', 
      action: '格式化', 
      confidence: 0.8 
    },
    { 
      patterns: ['润色', '优化', 'polish', 'improve', '改进'], 
      scope: '全文', 
      action: '编辑', 
      confidence: 0.7 
    }
  ]
  
  // 查找匹配的模式
  for (const pattern of editPatterns) {
    for (const p of pattern.patterns) {
      if (input.includes(p)) {
        console.log(`[Chatbot] Fallback匹配模式: ${p} -> ${pattern.scope}`)
        return {
          success: true,
          scope: pattern.scope,
          action: pattern.action,
          confidence: pattern.confidence,
          targetContent: '',
          reason: `关键词匹配: ${p}`
        }
      }
    }
  }
  
  // 默认全文编辑
  return {
    success: true,
    scope: '全文',
    action: '编辑',
    confidence: 0.5,
    targetContent: '',
    reason: '默认全文编辑'
  }
}

/**
 * 执行结构化智能编辑（使用文档结构）
 */
async function executeStructuredSmartEdit(scopeAnalysis: any, userInput: string, documentContent: string, documentStructure: any) {
  try {
    console.log('[Chatbot] 开始结构化智能编辑:', scopeAnalysis.scope)
    
    // 特殊处理：全文翻译等全文操作
    if (scopeAnalysis.scope === '全文' || scopeAnalysis.action === '翻译') {
      return await executeFullDocumentEdit(scopeAnalysis, userInput, documentContent)
    }
    
    // 根据文档结构查找目标sections
    const { findSectionsByScope } = useDocumentStructureParser()
    const targetSections = findSectionsByScope(documentStructure, scopeAnalysis.scope)
    
    console.log('[Chatbot] 找到目标sections:', targetSections.length)
    
    if (targetSections.length === 0) {
      return {
        success: false,
        error: `未找到匹配的${scopeAnalysis.scope}内容`
      }
    }
    
    // 分段处理编辑
    const editPromises = targetSections.map(async (section: any, index: number) => {
      console.log(`[Chatbot] 处理section ${index + 1}/${targetSections.length}: ${section.title}`)
      
      let sectionPrompt = `${userInput}\n\n目标内容类型: ${section.type}\n内容:\n${section.content}`
      
      if (section.type === 'internship') {
        sectionPrompt += '\n\n注意：这是实习经验条目，请保持原有的markdown格式（以"- "开头）'
      } else if (section.type === 'heading') {
        sectionPrompt += `\n\n注意：这是${section.level}级标题，请保持markdown标题格式`
      }
      
      const result = await callAiForWorkspace(sectionPrompt)
      return {
        section,
        result,
        index
      }
    })
    
    const editResults = await Promise.all(editPromises)
    
    // 应用所有编辑结果
    for (const { section, result } of editResults) {
      const event = new CustomEvent('workspace-ai-result', {
        detail: {
          action: scopeAnalysis.action,
          target: 'section',
          result: result,
          originalText: section.content,
          hasSelection: false,
          isStructuredEdit: true,
          section: section,
          scope: scopeAnalysis.scope
        }
      })
      
      document.dispatchEvent(event)
      
      // 短暂延迟以确保编辑顺序
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return {
      success: true,
      description: `已处理${editResults.length}个${scopeAnalysis.scope}区域`
    }
    
  } catch (error) {
    console.error('[Chatbot] 结构化智能编辑失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 执行全文编辑
 */
async function executeFullDocumentEdit(scopeAnalysis: any, userInput: string, documentContent: string) {
  try {
    console.log('[Chatbot] 执行全文编辑')
    
    let editPrompt = userInput
    if (scopeAnalysis.action === '翻译') {
      editPrompt += `\n\n请翻译以下全部内容，保持原有的markdown格式：\n\n${documentContent}`
    } else {
      editPrompt += `\n\n文档内容:\n${documentContent}`
    }
    
    const aiResponse = await callAiForWorkspace(editPrompt)
    
    // 应用全文编辑结果
    const event = new CustomEvent('workspace-ai-result', {
      detail: {
        action: scopeAnalysis.action,
        target: 'document',
        result: aiResponse,
        originalText: documentContent,
        hasSelection: false,
        isStructuredEdit: true,
        scope: '全文'
      }
    })
    
    document.dispatchEvent(event)
    
    return {
      success: true,
      description: '全文编辑完成'
    }
    
  } catch (error) {
    console.error('[Chatbot] 全文编辑失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 执行智能编辑（原始版本，保留作为fallback）
 */
async function executeSmartEdit(scopeAnalysis: any, userInput: string, documentContent: string) {
  try {
    // 构建针对性的编辑提示
    let editPrompt = userInput
    
    if (scopeAnalysis.targetContent) {
      editPrompt += `\n\n目标内容: ${scopeAnalysis.targetContent}`
    } else {
      editPrompt += `\n\n操作范围: ${scopeAnalysis.scope}`
      editPrompt += `\n\n文档内容:\n${documentContent}`
    }
    
    // 使用大LLM进行实际编辑
    const aiResponse = await callAiForWorkspace(editPrompt)
    
    // 应用编辑结果
    const event = new CustomEvent('workspace-ai-result', {
      detail: {
        action: scopeAnalysis.action,
        target: scopeAnalysis.scope === '全文' ? 'document' : 'selection',
        result: aiResponse,
        originalText: scopeAnalysis.targetContent || '',
        hasSelection: false,
        isSmartEdit: true,
        scope: scopeAnalysis.scope
      }
    })
    
    document.dispatchEvent(event)
    
    return {
      success: true,
      description: `已对${scopeAnalysis.scope}进行${scopeAnalysis.action}操作`
    }
    
  } catch (error) {
    console.error('[Chatbot] 智能编辑执行失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 执行原有聊天逻辑
 */
async function executeOriginalChatLogic(userText: string) {
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
  }
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

/* 模式切换按钮样式 */
.mode-btn {
  @apply px-2 py-1 rounded text-xs transition-all duration-200;
}

.mode-btn-active {
  @apply bg-blue-500 text-white;
}

.mode-btn-inactive {
  @apply bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500;
}
</style>


