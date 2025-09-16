<template>
  <!-- Floating bubble -->
  <Teleport to="body" v-if="mounted && !isHiddenByRoute">
    <button
      data-workspace-ignore="true"
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
  <Teleport to="body" v-if="mounted && !isHiddenByRoute">
    <div
      data-workspace-ignore="true"
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
          <div class="hstack space-x-2 mr-3">
            <button 
              @click="setMode('ask')"
              class="mode-text-btn"
              :class="currentMode === 'ask' ? 'mode-text-btn-active' : 'mode-text-btn-inactive'"
              title="问答模式"
            >
              对话模式
            </button>
            <span class="text-gray-400">|</span>
            <button 
              @click="setMode('edit')"
              class="mode-text-btn"
              :class="currentMode === 'edit' ? 'mode-text-btn-active' : 'mode-text-btn-inactive'"
              title="编辑模式"
            >
              编辑模式
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

        <!-- Tabs -->
        <div class="hstack gap-2 text-sm">
          <button class="px-3 py-1 rounded" :class="settingsTab === 'model' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent'" @click="settingsTab = 'model'">Model</button>
          <button class="px-3 py-1 rounded" :class="settingsTab === 'prompts' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent'" @click="openPromptsTab">Prompts</button>
          <button class="px-3 py-1 rounded" :class="settingsTab === 'uploads' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent'" @click="settingsTab = 'uploads'">Uploads</button>
        </div>

        <!-- Model & Params -->
        <div v-if="settingsTab === 'model'" class="space-y-2">
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
              <div class="space-y-1">
                <label class="text-xs text-light-c inline-flex items-center gap-2">
                  <input type="checkbox" v-model="gpt5ExtrasEnabled" class="align-middle" />
                  <span>Send GPT‑5 extras (verbosity, reasoning_effort)</span>
                </label>
              </div>
            </template>
            <template v-else-if="selectedModel === 'o3'">
              <div class="space-y-1">
                <span class="text-xs text-light-c">Reasoning Effort (o3)</span>
                <select v-model="reasoningEffort" class="rounded-md bg-dark-c border border-light-c px-2 py-2 text-sm">
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </template>
          </div>
          <div class="text-xs truncate">
            <span class="text-light-c">apiBase:</span>
            <span class="mx-1">{{ effectiveApiBase || '(not set)' }}</span>
          </div>
        </div>

        <!-- Prompts Tab -->
        <div v-else-if="settingsTab === 'prompts'" class="space-y-3">
          <div class="text-xs text-light-c">Edit prompts for current scope (shared by PS outline/body). Leave empty to use defaults.</div>
          <label class="text-xs inline-flex items-center gap-2">
            <input type="checkbox" v-model="injectPsBlocks" /> 启用大纲/正文专属系统提示
          </label>
          <div class="flex items-center gap-4">
            <label class="text-xs inline-flex items-center gap-2">
              <input type="checkbox" v-model="inlineTextAuto" /> 自动内联 MD/TXT 短文本
            </label>
            <label class="text-xs inline-flex items-center gap-1">
              阈值(KB)
              <input type="number" min="4" max="256" step="4" v-model.number="inlineTextThresholdKB" class="w-16 px-2 py-1 rounded border border-light-c bg-white dark:bg-slate-700 text-xs" />
            </label>
          </div>
          <div v-if="promptsLoading" class="text-xs text-light-c">Loading defaults…</div>
          <div class="space-y-2">
            <label class="text-xs font-medium">ps_requirement</label>
            <textarea v-model="promptsRequirement" class="w-full min-h-20 rounded border border-light-c bg-white dark:bg-slate-700 text-sm px-2 py-1"></textarea>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium">guidance_outline</label>
            <textarea v-model="promptsOutline" class="w-full min-h-20 rounded border border-light-c bg-white dark:bg-slate-700 text-sm px-2 py-1"></textarea>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium">guidance_element</label>
            <textarea v-model="promptsElement" class="w-full min-h-20 rounded border border-light-c bg-white dark:bg-slate-700 text-sm px-2 py-1"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="space-y-2">
              <label class="text-xs font-medium">outline_prefix</label>
              <textarea v-model="promptsOutlinePrefix" class="w-full min-h-16 rounded border border-light-c bg-white dark:bg-slate-700 text-sm px-2 py-1"></textarea>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium">body_prefix</label>
              <textarea v-model="promptsBodyPrefix" class="w-full min-h-16 rounded border border-light-c bg-white dark:bg-slate-700 text-sm px-2 py-1"></textarea>
            </div>
          </div>
          <div class="space-y-2 border-t border-light-c pt-2">
            <div class="text-xs text-light-c">已内联的文本片段（发送时将附加到上下文）：</div>
            <div v-if="inlineTextSnippets.length === 0" class="text-xs text-light-c">暂无</div>
            <div v-else class="flex flex-col gap-1 max-h-32 overflow-auto">
              <div v-for="(snip, i) in inlineTextSnippets" :key="snip.name + i" class="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-gray-50 dark:bg-gray-700/40 border border-light-c">
                <div class="truncate flex-1">{{ snip.name }} <span class="text-light-c">({{ snip.text.length }} chars)</span></div>
                <button type="button" class="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600" @click="removeSnippet(i)">移除</button>
              </div>
              <div class="flex justify-end">
                <button type="button" class="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600" @click="clearInlineSnippets">清空全部</button>
              </div>
            </div>
          </div>
          <div class="hstack gap-2">
            <button class="px-3 py-1 rounded bg-blue-600 text-white hover:opacity-90" @click="savePromptsOverrides">保存覆盖</button>
            <button class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600" @click="resetPromptsToDefault">恢复默认</button>
          </div>
        </div>
        <!-- Uploads Tab -->
        <div v-else-if="settingsTab === 'uploads'" class="space-y-3">
          <div class="text-xs text-light-c">Attach images and upload PDFs for Responses API.</div>
          <div class="space-y-2">
            <label class="text-xs font-medium">Images (PNG/JPEG)</label>
            <input type="file" accept="image/*" multiple @change="onPickImages" />
            <div class="grid grid-cols-3 gap-2 mt-2">
              <div v-for="(src, idx) in imageDataUrls" :key="src" class="relative">
                <img :src="src" class="w-full h-20 object-cover rounded border border-light-c" />
                <button type="button" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs" @click="removeImage(idx)">×</button>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium">PDF</label>
            <input type="file" accept="application/pdf" @change="onPickAnyFile" />
            <div class="text-xs text-light-c flex flex-wrap gap-2 items-center">
              <span v-if="uploadedFileIds.length === 0">None</span>
              <span v-for="(fid, i) in uploadedFileIds" :key="fid" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                {{ fid }}
                <button type="button" class="text-xs" @click="removeFileId(i)">×</button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div ref="scrollRef" class="flex-1 px-4 py-4 space-y-3 overflow-y-auto bg-c">
        <div v-for="m in messages" :key="m.id" class="w-full" @click="onMessageClick(m)">
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

      <!-- 选中文本卡片 -->
      <div v-if="showSelectionCard" class="px-4 pt-3 pb-2 bg-c border-t border-light-c">
        <div class="selection-card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 relative">
          <!-- 关闭按钮 -->
          <button
            @click="hideSelectionCard"
            class="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 flex items-center justify-center"
          >
            <span class="i-ph:x text-xs text-blue-600 dark:text-blue-300" />
          </button>
          
          <!-- 卡片标题 -->
          <div class="flex items-center gap-2 mb-2">
            <span class="i-ph:selection-plus text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-blue-700 dark:text-blue-300">选中的文本</span>
            <span class="text-xs text-blue-500 dark:text-blue-400">
              {{ currentSelectionInfo.length }} 字符 • 第{{ currentSelectionInfo.startLine }}-{{ currentSelectionInfo.endLine }}行
            </span>
          </div>
          
          <!-- 文本内容 -->
          <div class="bg-white dark:bg-slate-700 rounded border p-2 text-sm max-h-20 overflow-y-auto">
            <code class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ currentSelectionInfo.text }}</code>
          </div>
          
          <!-- 快捷操作 -->
          <div class="flex gap-2 mt-2">
            <button
              @click="insertQuickCommand('改成更专业的表达')"
              class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
            >
              专业化
            </button>
            <button
              @click="insertQuickCommand('翻译成英文')"
              class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
            >
              翻译
            </button>
            <button
              @click="insertQuickCommand('简化这段文字')"
              class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
            >
              简化
            </button>
            <button
              @click="openCustomPrompt"
              class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
            >
              自定义
            </button>
          </div>

          <!-- 自定义提示词输入 -->
          <div v-if="showCustomPrompt" class="mt-2 flex items-center gap-2">
            <input
              id="chatbot-custom-prompt"
              ref="customPromptInputRef"
              v-model="customPrompt"
              type="text"
              class="flex-1 px-2 py-1 text-xs rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100"
              placeholder="输入自定义提示词，如：替换为简洁表达"
            />
            <button @click="confirmCustomPrompt" class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:opacity-90">确定</button>
            <button @click="cancelCustomPrompt" class="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500">取消</button>
          </div>
        </div>
      </div>

      <!-- Input -->
      <form class="px-4 pb-4 pt-2 bg-c border-t border-light-c" @submit.prevent="handleSend">
        <!-- Attachments preview -->
        <div v-if="hasAnyAttachments" class="px-1 pb-2">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Image thumbs -->
            <div v-for="(src, idx) in imageDataUrls" :key="'img-'+idx" class="relative w-16 h-16">
              <img :src="src" class="w-16 h-16 object-cover rounded border border-light-c" />
              <button type="button" class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white text-xs" @click="removeImage(idx)">×</button>
            </div>
            <!-- Uploaded files chips -->
            <div v-for="(f, i) in uploadedFiles" :key="'f-'+f.id" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-light-c text-xs">
              <span class="i-ph:file-text text-gray-600 dark:text-gray-300" />
              <span class="max-w-48 truncate">{{ f.name || f.id }}</span>
              <button type="button" class="ml-1" @click="removeUploadedFile(i)">×</button>
            </div>
            <!-- Inline text snippets -->
            <div v-for="(snip, i) in inlineTextSnippets" :key="'snip-'+i" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-50 dark:bg-gray-700/40 border border-light-c text-xs">
              <span class="i-ph:file-text text-gray-600 dark:text-gray-300" />
              <span class="max-w-48 truncate">{{ snip.name }} ({{ snip.text.length }} chars)</span>
              <button type="button" class="ml-1" @click="removeSnippet(i)">×</button>
            </div>
          </div>
        </div>
        <div
          class="w-full rounded-full border border-light-c bg-white dark:bg-slate-700 text-black dark:text-white shadow-c flex items-center gap-3 px-3 py-1.5 relative"
          :class="dragActive ? 'ring-2 ring-blue-400 border-blue-400' : ''"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <button type="button" class="circle size-7 hover:bg-gray-100 dark:hover:bg-slate-600" title="Add" @click="toggleAddMenu" ref="plusBtnRef">
            <span class="i-ph:plus-bold text-gray-600 dark:text-gray-300" />
          </button>
          <!-- Hidden picker (single) -->
          <input ref="anyPickerRef" type="file" accept="image/*,application/pdf,.md,text/plain,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="hidden" @change="onPickAnyFile" multiple />
          <!-- Add menu: single entry -->
          <div v-if="showAddMenu" class="chatbot-add-menu absolute left-2 bottom-12 z-50 bg-c border border-light-c rounded-md shadow px-2 py-2 w-48">
            <button type="button" class="w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-600" @click="openAnyPicker">上传文件（图片/PDF/DOCX/DOC/MD/TXT）…</button>
            <div class="text-[11px] text-light-c px-2 pt-1">或将文件拖拽到此输入框</div>
          </div>

          <textarea
            id="chatbot-input"
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

          <!-- Drag overlay -->
          <div v-if="dragActive" class="absolute inset-0 rounded-full bg-blue-50/60 dark:bg-blue-900/20 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
            <div class="flex items-center gap-2 text-blue-700 dark:text-blue-200 text-sm">
              <span class="i-ph:upload-simple" /> 释放以上传
            </div>
          </div>
        </div>
      </form>
    </div>
  </Teleport>

  <!-- Fix-in-Chat Diff 预览 -->
  <DiffPreview
    :visible="diffPreviewVisible"
    :original-text="fixOriginalText"
    :suggested-text="fixSuggestedText"
    :context-info="fixContextInfo"
    @close="closeDiffPreview"
    @apply="applyFixSuggestion"
    @reject="rejectFixSuggestion"
    @edit="editFixSuggestion"
  />
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from "~/composables/stores/workspace";
import { useAiRequirementParser } from "~/composables/aiRequirementParser";
import type { AiRequirement } from "~/composables/workspaceOperator";
import { useWorkspaceOperator } from "~/composables/workspaceOperator";
import { useDocumentStructureParser } from "~/composables/documentStructureParser";
import DiffPreview from "~/components/shared/DiffPreview.vue";
import { contextExtractor } from "~/data/contextExtractor";
import type { SelectionContext } from "~/data/contextExtractor";
import { UpdateManager } from "~/data/updateManager";
import { buildContext } from "~/data/contextBuilder";
import { convStore } from "~/data/contextStore";

type Role = "user" | "assistant" | "system";
interface Message {
  id: number;
  role: Role;
  content: string;
}

// Preset system prompt
const SYSTEM_PROMPT =
  "你是一个资深留学顾问，擅长编辑留学申请用的简历、个人陈述/文书、推荐信。默认用简体中文回答，如果文本处理需求则按照用户要求来选择语言。你的回答风格专业、清晰、可执行，必要时先澄清关键信息。";

const isOpen = ref(false);
const draft = ref("");
const messages = ref<Message[]>([]);
const isThinking = ref(false);
const mounted = ref(false)

// 当前文档ID（来源于路由）
const route = useRoute()
// Resolve document type (cv | rec | ps) and ps sub (outline|body)
const docMeta = computed(() => {
  try {
    const id = route.params?.id as string
    if (!id) return { docType: 'cv', sub: null as any }
    // PS meta
    const psRaw = localStorage.getItem('ps_doc_meta_' + id)
    if (psRaw) {
      const m = JSON.parse(psRaw)
      if (m?.docType === 'ps') return { docType: 'ps', sub: m?.sub || null }
    }
    // CV/REC meta
    const raw = localStorage.getItem('doc_meta_' + id)
    if (raw) {
      const m = JSON.parse(raw)
      if (m?.docType === 'rec') return { docType: 'rec', sub: null }
      if (m?.docType === 'cv') return { docType: 'cv', sub: null }
    }
  } catch {}
  return { docType: 'cv', sub: null as any }
})

function buildAgentInstructions(): string {
  const meta = docMeta.value
  const commonFooter = [
    'You MUST return a single JSON object with keys: steps (array of strings), targets (array), result (string), reasoning_summary (string).',
    'targets[].strategy is one of: selection | match | section.',
    "For strategy 'match', include exact 'text' to locate.",
    "For strategy 'section', include a 'section' name if known.",
    'Do NOT include chain-of-thought; provide a concise reasoning_summary only.'
  ].join(' ')
  if (meta.docType === 'cv') {
    return [
      'You are an expert CV editor. Improve clarity, quantify achievements, preserve Markdown structure and sections.',
      'Focus on action verbs, metrics, impact; keep factual accuracy and language style consistent.',
      commonFooter
    ].join(' ')
  }
  if (meta.docType === 'rec') {
    return [
      'You are assisting with recommendation letter drafting in chat mode. Keep replies concise and avoid long templates; defer full drafting to dedicated creation flow.',
      commonFooter
    ].join(' ')
  }
  // ps: elements/outline vs body
  if (docMeta.value.docType === 'ps' && docMeta.value.sub === 'outline') {
    return [
      'You are preparing Personal Statement materials and outline. Extract key elements, organize into a clear outline.',
      'Check for missing required info; if missing, reflect in steps and produce result that marks placeholders.',
      commonFooter
    ].join(' ')
  }
  // ps body
  return [
    'You are writing Personal Statement body following the provided outline and materials. Keep paragraphs concise and coherent.',
    'Check for missing required info; if missing, politely request supplements in steps and still produce best-effort result.',
    commonFooter
  ].join(' ')
}

function tryParseStructuredJSON(text: string): any | null {
  try {
    const obj = JSON.parse(text)
    if (obj && typeof obj === 'object') {
      // Normalize legacy keys: steps, targets, result, reasoning/summary
      const out: any = {}
      out.steps = Array.isArray(obj.steps) ? obj.steps : (typeof obj.thoughts === 'string' ? obj.thoughts.split(/\n+/).filter(Boolean) : [])
      out.targets = Array.isArray(obj.targets) ? obj.targets : (Array.isArray(obj.spans) ? obj.spans : [])
      out.result = typeof obj.result === 'string' ? obj.result : (typeof obj.final === 'string' ? obj.final : '')
      out.reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : (typeof obj.reasoning_summary === 'string' ? obj.reasoning_summary : '')
      out.reply = typeof obj.reply === 'string' ? obj.reply : (typeof obj.answer === 'string' ? obj.answer : '')
      // Must have at least result or reasoning
      if (out.result || out.reasoning || out.reply || out.steps.length || out.targets.length) return out
    }
  } catch {}
  return null
}

// Normalize a structured object from Responses API JSON part
function normalizeStructuredFromObj(obj: any): any | null {
  if (!obj || typeof obj !== 'object') return null
  try {
    const out: any = {}
    out.steps = Array.isArray(obj.steps) ? obj.steps : []
    out.targets = Array.isArray(obj.targets) ? obj.targets : []
    out.result = typeof obj.result === 'string' ? obj.result : ''
    out.reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : (typeof obj.reasoning_summary === 'string' ? obj.reasoning_summary : '')
    out.reply = typeof obj.reply === 'string' ? obj.reply : ''
    if (out.result || out.reasoning || out.reply || out.steps.length || out.targets.length) return out
  } catch {}
  return null
}

// Extract structured outputs from Responses payload (handles json parts)
function extractStructuredFromResponsesPayload(res: any): any | null {
  try {
    const outputs = res?.output
    if (Array.isArray(outputs)) {
      for (const item of outputs) {
        const contentArr = item?.content
        if (Array.isArray(contentArr)) {
          for (const c of contentArr) {
            if (c && typeof c.json === 'object' && c.json) {
              const norm = normalizeStructuredFromObj(c.json)
              if (norm) return norm
            }
            if (typeof c?.text === 'string') {
              const parsed = tryParseStructuredJSON(c.text)
              if (parsed) return parsed
            }
          }
        }
      }
    }
  } catch {}
  return null
}

async function openStructuredApplyPreview(targets: any[] | undefined, resultText: string, autoOpen: boolean = true) {
  const content = await getCurrentDocumentContent()
  let original = ''
  let pos: any = null
  const sel: any = (currentSelectionInfo as any)?.text ? (currentSelectionInfo as any) : null
  const first = Array.isArray(targets) && targets.length ? targets[0] : null
  if (first && first.strategy === 'selection' && sel?.text) {
    original = String(sel.text)
    try {
      const idx = content.indexOf(original)
      if (idx >= 0) pos = { start: idx, end: idx + original.length }
    } catch {}
  } else if (first && first.strategy === 'match' && typeof first.text === 'string') {
    const needle = String(first.text)
    const idx = content.indexOf(needle)
    if (idx >= 0) {
      original = needle
      pos = { start: idx, end: idx + needle.length }
    }
  }
  if (!original) {
    // fallback: no target matched, preview whole replacement at top (non-destructive confirm)
    original = ''
    pos = { start: 0, end: 0 }
  }
  try {
    fixOriginalText.value = original
    fixSuggestedText.value = resultText
    fixPosition.value = pos
    if (autoOpen) diffPreviewVisible.value = true
  } catch {}
}

function openPreparedDiffPreview() {
  diffPreviewVisible.value = true
}

function onMessageClick(m: any) {
  try {
    const t = String(m?.content || '')
    if (/已生成改动预览/.test(t) || /查看完整对比/.test(t)) {
      openPreparedDiffPreview()
    }
  } catch {}
}
const runtimeConfig = useRuntimeConfig()
const isHiddenByRoute = computed(() => {
  try {
    const hidden: string[] = (runtimeConfig.public as any)?.chatbot?.bubbleHiddenRoutes || []
    const normalize = (p: string) => {
      if (!p) return '/'
      const noQuery = p.split('?')[0]
      const trimmed = noQuery.replace(/\/+$/, '')
      return trimmed === '' ? '/' : trimmed
    }
    const current = normalize(route.path || '/')
    return hidden.map(normalize).includes(current)
  } catch {
    return false
  }
})
const documentId = computed(() => {
  const id = route.params?.id
  if (Array.isArray(id)) return id[0]
  return (id as string) || ''
})

// PS大纲/正文共享chatId（若存在元数据则优先）
const chatScopedId = computed(() => {
  const id = documentId.value
  if (!id) return ''
  try {
    const raw = localStorage.getItem('ps_doc_meta_' + id)
    if (!raw) return id
    const meta = JSON.parse(raw) as any
    return (meta?.chatId as string) || id
  } catch {
    return id
  }
})

// 模式管理
const currentMode = useLocalStorage<'ask' | 'edit'>('chatbot.mode', 'edit');

const bubbleRef = ref<HTMLButtonElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);
const plusBtnRef = ref<HTMLButtonElement | null>(null)
const anyPickerRef = ref<HTMLInputElement | null>(null)
const showAddMenu = ref(false)

// Settings state
const showSettings = ref(false);
const settingsTab = ref<'model' | 'prompts' | 'uploads'>('model')
const injectPsBlocks = useLocalStorage<boolean>('chatbot.injectPsBlocks', true)
// API key is no longer required on client; keep a stub store for backward compatibility
const revealKey = ref(false);
const apiKey = ref<string>("");
const apiKeyLocal = ref<string>("");

const runtime = useRuntimeConfig();
const provider = (runtime.public as any)?.chatbot?.provider ?? "openai";
const defaultModel = (runtime.public as any)?.chatbot?.model ?? "gpt-5";
const globalApiBase = (runtime.public as any)?.chatbot?.apiBase ?? "";
// If backendBase is configured, prefer it
const backendBase: string = (runtime.public as any)?.backendBase || "";
const models = (runtime.public as any)?.chatbot?.models ?? [];
const responseFormatDefault = (runtime.public as any)?.chatbot?.responseFormat ?? { enabled: false, schema: null };
const gpt5ExtrasDefault = (runtime.public as any)?.chatbot?.gpt5Extras ?? false;

// Model and params state
const modelOptions = models as Array<{ id: string; label: string; general: any; specific?: any; apiBase?: string; apiModel?: string }>
const selectedModel = useLocalStorage<string>("chatbot.model", defaultModel);
// Sanitize legacy/invalid values persisted in localStorage (e.g., gpt-4o-mini)
watch([selectedModel, () => modelOptions], () => {
  const valid = modelOptions.some((m) => m.id === selectedModel.value)
  if (!valid) selectedModel.value = defaultModel
}, { immediate: true })

const currentModel = computed(() => modelOptions.find((m) => m.id === selectedModel.value));
const generalSpec = computed(() => currentModel.value?.general ?? { max_tokens: { min: 16, max: 32768, step: 16, default: 2048 } });
const apiModel = computed(() => currentModel.value?.apiModel || defaultModel);
const gpt5Spec = computed(() => {
  const spec = modelOptions.find((m) => m.id === "gpt-5")?.specific;
  return spec ?? {
    verbosity: { options: ["low", "medium", "high"], default: "medium" },
    reasoning_effort: { options: ["low", "medium", "high"], default: "medium" },
  };
});
const gpt5ExtrasEnabled = useLocalStorage<boolean>("chatbot.gpt5Extras", gpt5ExtrasDefault);
// Inline text settings
const inlineTextAuto = useLocalStorage<boolean>('chatbot.inlineTextAuto', true)
const inlineTextThresholdKB = useLocalStorage<number>('chatbot.inlineTextThresholdKB', 80)

// Prefer global apiBase (proxy) when configured; else fallback to model's endpoint
const effectiveApiBase = computed(() => {
  if (backendBase) return backendBase.replace(/\/$/, '') + '/api/ai';
  return globalApiBase || currentModel.value?.apiBase || "";
});
// Backward compatibility: auto-upgrade old endpoint '/api/chat' to '/api/ai'
const effectiveApiBaseNormalized = computed(() => {
  // Always call server proxy at absolute root '/api/ai'
  let url = effectiveApiBase.value || "/api/ai";
  if (url.includes("/api/chat")) url = url.replace("/api/chat", "/api/ai");
  // If absolute URL (http/https), keep as-is (FastAPI direct)
  if (/^https?:\/\//i.test(url)) return url;
  // Else ensure it is an absolute API path under current origin
  if (!url.startsWith("/api/")) url = "/api/ai";
  return url;
});

// Remove temperature for GPT-5; upstream only supports default = 1, so we omit the field.
const temperature = ref<number>(1);
const maxTokens = useLocalStorage<number>("chatbot.max_tokens", generalSpec.value.max_tokens.default);
watch(currentModel, (m) => {
  if (!m) return;
  // reset defaults when switching model
  temperature.value = m.general.temperature.default;
  maxTokens.value = m.general.max_tokens.default;
  if (m.id === "gpt-5") {
    verbosity.value = m.specific.verbosity.default;
    reasoningEffort.value = m.specific.reasoning_effort.default;
  } else if (m.id === "o3") {
    reasoningEffort.value = "medium";
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
const panelWidth = ref(500);
const panelHeight = ref(800);

// Fix-in-Chat 状态管理
const diffPreviewVisible = ref(false);
const fixOriginalText = ref('');
const fixSuggestedText = ref('');
const fixContextInfo = ref<SelectionContext | undefined>();
// 兼容两种定位：行列 或 绝对偏移
const fixPosition = ref<
  | { startLine: number; startColumn: number; endLine: number; endColumn: number }
  | { start: number; end: number }
  | null
>(null);
const fixMode = ref(false); // 是否在 Fix-in-Chat 模式

// UpdateManager 实例
const updateManager = new UpdateManager();

// 选中文本卡片状态
const showSelectionCard = ref(false);
const currentSelectionInfo = ref({
  text: '',
  length: 0,
  startLine: 0,
  endLine: 0
});

// 自定义提示词
const showCustomPrompt = ref(false);
const customPrompt = ref("");
const customPromptInputRef = ref<HTMLInputElement | null>(null);

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

function toggleAddMenu() {
  showAddMenu.value = !showAddMenu.value
}
function openAnyPicker() {
  showAddMenu.value = false
  anyPickerRef.value?.click()
}

// Close add menu when clicking outside or pressing Esc
function handleGlobalClick(e: MouseEvent) {
  const target = e.target as Node
  const menu = document.querySelector('.chatbot-add-menu')
  const btn = plusBtnRef.value
  if (!menu || !btn) return
  if (!menu.contains(target) && !btn.contains(target as any)) {
    showAddMenu.value = false
  }
}
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') showAddMenu.value = false
}

// Drag-and-drop into input area
const dragActive = ref(false)
function onDragOver() { dragActive.value = true }
function onDragLeave() { dragActive.value = false }
async function onDrop(e: DragEvent) {
  dragActive.value = false
  const dt = e.dataTransfer
  if (!dt) return
  const files = dt.files
  if (!files || !files.length) return
  await handlePickedFiles(Array.from(files))
}

// Convert File to base64 string using FileReader (avoid stack overflow)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => {
      const res = typeof fr.result === 'string' ? fr.result : ''
      const idx = res.indexOf(',')
      resolve(idx >= 0 ? res.slice(idx + 1) : res)
    }
    fr.onerror = () => resolve('')
    fr.readAsDataURL(file)
  })
}

/**
 * 设置AI助手模式
 */
function setMode(mode: 'ask' | 'edit') {
  currentMode.value = mode;
  console.log(`[Chatbot] 切换到${mode === 'ask' ? '问答' : '编辑'}模式`);
  // When switching to chat/ask mode, ensure no edit-related state remains active
  if (mode === 'ask') {
    try {
      if (diffPreviewVisible.value) diffPreviewVisible.value = false;
      if (fixMode.value) resetFixMode();
      showSelectionCard.value = false;
    } catch {}
  }
}

const canSend = computed(() => draft.value.trim().length > 0 && !isThinking.value);

async function handleSend() {
  if (!canSend.value) return;
  const text = draft.value.trim();
  draft.value = "";
  pushMessage({ role: "user", content: text });
  // Reset input height after sending long messages
  nextTick(() => resetInputHeight());
  
  // In chat mode, never trigger edit or Fix-in-Chat flows
  if (currentMode.value === 'ask') {
    simulateAssistant(text);
    return;
  }
  
  // 检查是否在 Fix-in-Chat 模式
  if (fixMode.value) {
    const handled = await processFixInChatMessage(text);
    if (handled) {
      return; // Fix-in-Chat 已处理，不走普通流程
    }
  }
  
  // 智能检测：如果有选中文本且用户输入的是修改指令，自动启动 Fix-in-Chat 模式
  const workspaceStore = useWorkspaceStore?.();
  if (workspaceStore && workspaceStore.state.currentSelection.hasSelection && !fixMode.value) {
    const modificationKeywords = ['改成', '修改为', '改为', '换成', '替换为', '变成', '翻译', '优化', '简化', '详细', '专业'];
    const hasModificationIntent = modificationKeywords.some(keyword => text.includes(keyword));
    
    if (hasModificationIntent) {
      console.log('[Chatbot] 检测到修改意图，自动启动 Fix-in-Chat 模式');
      
      // 自动启动 Fix-in-Chat 模式
      fixMode.value = true;
      fixOriginalText.value = workspaceStore.state.currentSelection.text;
      // 使用绝对偏移，交由 Editor 将其转换为行列范围，确保按预定位置替换
      fixPosition.value = {
        start: workspaceStore.state.currentSelection.start,
        end: workspaceStore.state.currentSelection.end
      };
      
      const handled = await processFixInChatMessage(text);
      if (handled) {
        return; // Fix-in-Chat 已处理，不走普通流程
      }
    }
  }
  
  simulateAssistant(text);
}

function pushMessage(partial: Omit<Message, "id">) {
  const id = Date.now() + Math.random();
  const content = ensureText(partial.content as any);
  messages.value.push({ id, role: partial.role, content });
  // 写入按文档分隔的对话记忆（仅本地）
  try {
    const key = chatScopedId.value
    if (key && (partial.role === 'user' || partial.role === 'assistant')) {
      convStore.appendMessage(key, partial.role as any, content)
    }
  } catch {}
  nextTick(() => scrollToBottom());
}

function clearMessages() {
  messages.value = [];
  try { if (chatScopedId.value) convStore.clear(chatScopedId.value) } catch {}
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
  
  // 检查其他命令（撤销/重做功能已删除）
  const lowerText = userText.toLowerCase().trim();
  if (lowerText === '选中文本' || lowerText === '当前选中' || lowerText === 'selection' || lowerText === '选区') {
    showCurrentSelection();
    return;
  }
  
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
      const useResponsesApi = true;
      const chatMessages = buildChatMessages();
      // Inject prompts context and ps subtype-specific blocks
      try {
        const scopeId = chatScopedId.value || documentId.value || ''
        if (scopeId) {
          const mod: any = await import('~/composables/psPrompts')
          const svc = mod.usePsPrompts()
          if (!svc.defaults.value?.ps_requirement) await svc.loadDefaultPrompts()
          const eff = svc.getEffectivePrompts(scopeId)
          let sub: 'outline' | 'body' | null = null
          let siblingId: string | null = null
          try {
            const raw = localStorage.getItem('ps_doc_meta_' + (documentId.value || ''))
            const meta = raw ? JSON.parse(raw) : null
            sub = meta?.sub || null
            siblingId = meta?.siblingId || null
          } catch {}

          if (!injectPsBlocks.value) {
            const block = [eff.ps_requirement, eff.guidance_outline, eff.guidance_element]
              .filter(Boolean).join('\n\n')
            if (block.trim()) chatMessages.unshift({ role: 'system', content: block })
          } else if (sub === 'outline') {
            // Outline: 强化结构引导，先注入大纲指导与元素指南，再附加需求
            const block = [
              (eff.outline_prefix || '[PS-OUTLINE]\n你正在编写「个人陈述大纲」。先列出清晰的结构与各段落要点，不要展开正文。'),
              eff.guidance_outline || '',
              eff.guidance_element || '',
              eff.ps_requirement || ''
            ].filter(Boolean).join('\n\n')
            chatMessages.unshift({ role: 'system', content: block })
          } else if (sub === 'body') {
            // Body: 遵循已完成的大纲撰写正文；尝试加载配对大纲文档内容作为上下文
            let outlinePreview = ''
            try {
              if (siblingId) {
                const db = await import('~/utils/database')
                const storage = (await db.getStorage()) || {}
                const sibling = storage?.[siblingId as any]
                const md = typeof sibling?.markdown === 'string' ? sibling.markdown : ''
                if (md) {
                  const limit = 6000
                  outlinePreview = md.length > limit ? (md.slice(0, limit) + '\n...') : md
                }
              }
            } catch {}
            const header = (eff.body_prefix || '[PS-BODY]\n你正在撰写「个人陈述正文」。必须严格遵循既定大纲的结构与顺序，不要修改大纲的标题与层级。')
            const block = [
              header,
              eff.ps_requirement || '',
              eff.guidance_element || '',
              outlinePreview ? `以下为大纲参考（只用作结构约束，不要复制原话）：\n${outlinePreview}` : ''
            ].filter(Boolean).join('\n\n')
            chatMessages.unshift({ role: 'system', content: block })
          } else {
            // 普通文档或无子类型：按默认顺序注入三段
            const block = [eff.ps_requirement, eff.guidance_outline, eff.guidance_element]
              .filter(Boolean).join('\n\n')
            if (block.trim()) chatMessages.unshift({ role: 'system', content: block })
          }
        }
      } catch {}
      if (useResponsesApi) {
        // Responses API expects `input` and `max_output_tokens`
        const baseInput = buildInputFromMessages(chatMessages)
        const uploads = buildResponsesInputWithUploads(baseInput)
        const payload: any = {
          model: apiModel.value,
          input: uploads.input,
          attachments: uploads.attachments,
          temperature: temperature.value,
          max_output_tokens: maxTokens.value,
          reasoning: { effort: reasoningEffort.value },
          instructions: buildAgentInstructions()
        };
        console.debug('[chatbot] request (responses)', {
          endpoint,
          selectedModel: selectedModel.value,
          apiModel: apiModel.value,
          inputLen: typeof payload.input === 'string' ? payload.input.length : 0,
          max_output_tokens: payload.max_output_tokens,
          reasoning_effort: payload.reasoning?.effort
        });
        const res: any = await $fetch(endpoint, {
          method: "POST",
          headers: {
            // using proxy; server injects Authorization
            "Content-Type": "application/json"
          },
          body: { ...payload, model: selectedModel.value, use_agents: true, session_id: chatScopedId.value || documentId.value || 'global', file_ids: uploadedFileIds.value, prompt: baseInput, instructions: buildAgentInstructions() }
        });
        try {
          console.debug('[chatbot] response (responses)', {
            model: res?.model,
            output_text_len: typeof res?.output_text === 'string' ? res.output_text.length : undefined
          });
        } catch {}
        const rawText = ensureText(normalizeResponsesOutput(res))
        // Prefer json part from Responses output; fallback to parsing text
        const parsed = extractStructuredFromResponsesPayload(res) || tryParseStructuredJSON(rawText)
        if (parsed) {
          // reasoning
          if (typeof parsed.reasoning === 'string' && parsed.reasoning.trim()) {
            // Show a small collapsible preview tile; click to expand full
            const preview = (parsed.reasoning.trim().slice(0, 120) + (parsed.reasoning.trim().length > 120 ? '…' : ''))
            pushMessage({ role: 'assistant', content: '推理摘要（点击查看完整对比）\n' + preview })
          }
          // steps (optional verbose thinking outline)
          if (Array.isArray(parsed.steps) && parsed.steps.length) {
            const previewSteps = parsed.steps.slice(0, 4)
            pushMessage({ role: 'assistant', content: '步骤预览\n- ' + previewSteps.join('\n- ') + (parsed.steps.length > 4 ? '\n…' : '') })
          }
          // reply (assistant-friendly summary for chat)
          if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
            pushMessage({ role: 'assistant', content: sanitizeForDisplay(parsed.reply.trim()) })
          }
          // result -> open diff apply preview (do not echo to chat)
          await openStructuredApplyPreview(parsed.targets, String(parsed.result || ''), false)
          // Insert a compact hint tile to open the prepared diff
          pushMessage({ role: 'assistant', content: '已生成改动预览，点击以查看并应用。' })
        } else {
          const text = sanitizeForDisplay(ensureText(rawText));
          pushMessage({ role: "assistant", content: text });
        }
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
  const includeGpt5Extras = selectedModel.value === "gpt-5" && gpt5ExtrasEnabled.value;
  const payloadWithExtras = includeGpt5Extras
    ? { ...basePayload, reasoning_effort: reasoningEffort.value, verbosity: verbosity.value }
    : basePayload;
  const hasResponseFormat = !!(basePayload && (basePayload as any).response_format);
  try {
    // Derive a plain prompt for Agents backend from last user message
    let derivedPrompt = ''
    try {
      const msgs = (payloadWithExtras as any).messages as Array<{ role: string; content: string }>
      if (Array.isArray(msgs)) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i]
          if (m && String(m.role).toLowerCase() === 'user') { derivedPrompt = String(m.content || '') ; break }
        }
      }
    } catch {}
    const res: any = await $fetch(endpoint, {
      method: "POST",
      headers: {
        // Proxy route will inject Authorization
        "Content-Type": "application/json"
      },
      body: {
        ...payloadWithExtras,
        model: apiModel.value,
        use_agents: true,
        session_id: chatScopedId.value || documentId.value || 'global',
        file_ids: uploadedFileIds.value,
        instructions: buildAgentInstructions(),
        prompt: derivedPrompt
      }
    });
    // If server switched to Responses API, normalize to chat-like shape
    if (res && (res.output || res.object === 'response')) {
      const text = normalizeResponsesOutput(res)
      return { model: res?.model, choices: [{ message: { content: text } }] }
    }
    return res
  } catch (e: any) {
    const status = e?.statusCode || e?.status || e?.response?.status;
    const msg: string = e?.data?.error?.message || e?.message || "";
    const isInvalidRequest = /invalid_request|Unrecognized request argument|schema|reasoning/i.test(msg);
    if (includeGpt5Extras && (status === 400 || isInvalidRequest)) {
      // retry without GPT‑5 extras
      try {
        const res2: any = await $fetch(endpoint, {
          method: "POST",
          headers: {
            // Proxy route will inject Authorization
            "Content-Type": "application/json"
          },
          body: { ...basePayload, model: apiModel.value }
        });
        if (res2 && (res2.output || res2.object === 'response')) {
          const text = normalizeResponsesOutput(res2)
          return { model: res2?.model, choices: [{ message: { content: text } }] }
        }
        return res2
      } catch (err) {
        // fallthrough to potential response_format retry below
        e = err as any;
      }
    }
    // If still failing and payload had response_format, retry once without it
    if (hasResponseFormat && (status === 400 || isInvalidRequest)) {
      try {
        const { response_format, ...rest } = basePayload || {} as any;
        return await $fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { ...rest, model: apiModel.value }
        });
      } catch (err2) {
        throw err2;
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
    
    // 3. 构建AI提示（仅内嵌原文，不再添加额外标签，避免模型回显）
    const aiPrompt = buildWorkspaceAiPrompt(requirement, selectedText, originalInput)
    
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
  
  const useResponsesApi = true
  
  if (useResponsesApi) {
    // Build Responses input with attachments so OpenAI receives files
    const uploads = buildResponsesInputWithUploads(prompt)
    const payload = {
      model: apiModel.value,
      input: uploads.input,
      attachments: uploads.attachments,
      // omit temperature for GPT-5
      max_output_tokens: maxTokens.value,
      reasoning: { effort: reasoningEffort.value }
    }
    try {
      const inLen = typeof payload.input === 'string' ? (payload.input as string).length : 0
      console.debug('[chatbot][workspace] request (responses)', {
        endpoint,
        selectedModel: selectedModel.value,
        apiModel: apiModel.value,
        inputLen: inLen,
        max_output_tokens: payload.max_output_tokens,
        reasoning_effort: payload.reasoning?.effort
      })
    } catch {}
    
    const res = await $fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: { ...payload, model: selectedModel.value, use_agents: true, session_id: chatScopedId.value || documentId.value || 'global', file_ids: uploadedFileIds.value, instructions: buildAgentInstructions(), prompt }
    })
    try {
      console.debug('[chatbot][workspace] response (responses)', {
        model: (res as any)?.model,
        output_text_len: typeof (res as any)?.output_text === 'string' ? (res as any).output_text.length : undefined
      })
    } catch {}
    return sanitizeForDisplay(ensureText(normalizeResponsesOutput(res)))
  } else {
    // Force Responses path for workspace too
    const uploads = buildResponsesInputWithUploads(prompt)
    const payload = {
      model: apiModel.value,
      input: uploads.input,
      attachments: uploads.attachments,
      max_output_tokens: maxTokens.value,
      reasoning: { effort: reasoningEffort.value }
    }
    console.debug('[chatbot][workspace] request (responses.fallback)', {
      endpoint,
      selectedModel: selectedModel.value,
      apiModel: apiModel.value
    })
    const res: any = await $fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { ...payload, model: selectedModel.value, use_agents: true, session_id: chatScopedId.value || documentId.value || 'global', file_ids: uploadedFileIds.value, instructions: buildAgentInstructions(), prompt }
    })
    return sanitizeForDisplay(ensureText(normalizeResponsesOutput(res)))
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
  
  // Push a detailed change summary to Chatbot (show before/after and model output)
  try {
    const limit = 1000
    const orig = (selectedText || '').slice(0, limit)
    const after = (aiResult || '').slice(0, limit)
    const moreO = selectedText && selectedText.length > limit ? `\n...(${selectedText.length - limit} more chars)` : ''
    const moreA = aiResult && aiResult.length > limit ? `\n...(${aiResult.length - limit} more chars)` : ''
    pushMessage({
      role: 'assistant',
      content: `已应用修改（${description}）。\n\n原文：\n\n\`\`\`\n${orig}${moreO}\n\`\`\`\n\n修改后：\n\n\`\`\`\n${after}${moreA}\n\`\`\``
    })
  } catch {}
  
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
            content: "已完成选区编辑。"
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
        const fallbackReq = { action: 'edit', target: 'document', parameters: {}, prompt: userText }
        const aiResult = await processWorkspaceAiOperation(fallbackReq as any, userText)
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

    const runtime = useRuntimeConfig()
    const backendBaseSf = (runtime.public as any)?.backendBase || ''
    const sfUrl = backendBaseSf ? backendBaseSf.replace(/\/$/, '') + '/api/siliconflow' : '/api/siliconflow'
    const response = await fetch(sfUrl, {
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
        sectionPrompt += '\n\n注意：这是实习经验条目，请保持原有的markdown或短代码格式（以"- "开头）'
      } else if (section.type === 'heading') {
        sectionPrompt += `\n\n注意：这是${section.level}级标题，请保持markdown或短代码标题格式`
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
      editPrompt += `\n\n请翻译以下全部内容，保持原有的markdown或短代码格式：\n\n${documentContent}`
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
      const useResponsesApi = true;
      // Build messages and prepend document context as a system message (chat mode only)
      const chatMessages = buildChatMessages();
      try {
        const docContent = await getCurrentDocumentContent();
        if (docContent && typeof docContent === 'string' && docContent.trim().length > 0) {
          const limit = 8000; // keep prompt size bounded
          const preview = docContent.length > limit ? (docContent.slice(0, limit) + '\n...') : docContent;
          chatMessages.unshift({
            role: 'system',
            content: `You are chatting with the user about the current document. Use the following document context when answering, but DO NOT modify the document in chat mode.\n\n[DOCUMENT_CONTEXT]\n${preview}`
          });
        }
      } catch {}
      if (useResponsesApi) {
        // Responses API expects `input` and `max_output_tokens`
        const baseInput = buildInputFromMessages(chatMessages)
        const uploads = buildResponsesInputWithUploads(baseInput)
        const payload: any = {
          model: apiModel.value,
          input: uploads.input,
          attachments: uploads.attachments,
          // omit temperature for GPT-5
          max_output_tokens: maxTokens.value,
          reasoning: { effort: reasoningEffort.value }
        };
        console.debug('[chatbot] request (responses)', {
          endpoint,
          selectedModel: selectedModel.value,
          apiModel: apiModel.value,
          inputLen: typeof payload.input === 'string' ? payload.input.length : 0,
          max_output_tokens: payload.max_output_tokens,
          reasoning_effort: payload.reasoning?.effort
        });
        const res: any = await $fetch(endpoint, {
          method: "POST",
          headers: {
            // using proxy; server injects Authorization
            "Content-Type": "application/json"
          },
          body: { ...payload, model: selectedModel.value, use_agents: true, session_id: chatScopedId.value || documentId.value || 'global', file_ids: uploadedFileIds.value }
        });
        try {
          console.debug('[chatbot] response (responses)', {
            model: res?.model,
            output_text_len: typeof res?.output_text === 'string' ? res.output_text.length : undefined
          });
        } catch {}
        const text = sanitizeForDisplay(ensureText(normalizeResponsesOutput(res)));
        pushMessage({ role: "assistant", content: text });
      } else {
        // Chat completions
        const basePayload: any = {
          model: apiModel.value,
          messages: chatMessages,
          // omit temperature for GPT-5
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
        console.debug('[chatbot] request (chat.completions)', {
          endpoint,
          selectedModel: selectedModel.value,
          apiModel: apiModel.value,
          messages: payload.messages?.length,
          max_tokens: payload.max_tokens,
          max_completion_tokens: payload.max_completion_tokens
        });
        const res: any = await requestChatCompletions(endpoint, payload);
        try {
          console.debug('[chatbot] response (chat.completions)', {
            model: res?.model || res?.choices?.[0]?.model,
            content_len: typeof res?.choices?.[0]?.message?.content === 'string' ? res.choices[0].message.content.length : undefined
          });
        } catch {}
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
  // 优先使用按文档存储的会话与规则；无文档ID时退化为本组件的本地消息
  const base: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT }
  ];
  if (chatScopedId.value) {
    const ctx = buildContext({ documentId: chatScopedId.value, docType: 'cv', language: 'zh-cn', tailMessages: 30 })
    if (ctx.rules && ctx.rules.trim()) {
      base.push({ role: 'system', content: `以下是跨文档可复用的写作/格式规则，请遵守：\n${ctx.rules.trim()}` })
    }
    const recent = ctx.recentConversation.map((m) => ({ role: m.role, content: sanitizeForDisplay(ensureText(m.content)) }))
    return base.concat(recent)
  }
  const history = messages.value
    .map((m) => ({ role: m.role, content: sanitizeForDisplay(ensureText(m.content)) }))
    .filter((m) => !isHtmlLike(m.content))
    .slice(-40)
  return base.concat(history)
}

function buildInputFromMessages(msgs: Array<{ role: string; content: string }>) {
  // For responses API, simple concatenation with role tags
  return msgs
    .filter((m) => !isHtmlLike(m.content))
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

// Build Responses API input parts for images/PDF per OpenAI docs
function buildResponsesInputWithUploads(baseText: string): { input: any; attachments?: any } {
  // Build 'system' role with current agent instructions
  const systemContent: any[] = []
  const sysText = buildAgentInstructions()
  if (sysText && sysText.trim()) systemContent.push({ type: 'input_text', text: sysText })

  // Build 'user' role content: text + inline snippets + images + input_file ids
  const userContent: any[] = []
  const baseTextNorm = (typeof baseText === 'string' ? baseText : '').trim()
  const ensuredText = baseTextNorm || '请基于上述指令与所附文件完成任务，并输出严格结构化结果。'
  userContent.push({ type: 'input_text', text: ensuredText })
  try {
    if (Array.isArray(inlineTextSnippets?.value)) {
      for (const snip of inlineTextSnippets.value) {
        if (snip?.text && snip.text.trim()) {
          const header = snip.name ? `[[${snip.name}]]\n` : ''
          userContent.push({ type: 'input_text', text: `${header}${snip.text}` })
        }
      }
    }
  } catch {}
  try {
    if (Array.isArray(imageDataUrls?.value)) {
      for (const url of imageDataUrls.value) {
        if (typeof url === 'string' && url.startsWith('data:')) {
          const m = url.match(/^data:([^;]+);base64,(.*)$/)
          if (m) userContent.push({ type: 'input_image', image_data: { data: m[2], mime_type: m[1] } })
        }
      }
    }
  } catch {}
  // Add input_file for each uploaded file id (per Responses API doc)
  try {
    if (Array.isArray(uploadedFileIds?.value) && uploadedFileIds.value.length) {
      for (const fid of uploadedFileIds.value) {
        if (fid && typeof fid === 'string') userContent.push({ type: 'input_file', file_id: fid })
      }
    }
  } catch {}

  const inputParts: any[] = []
  if (systemContent.length) inputParts.push({ role: 'system', content: systemContent })
  inputParts.push({ role: 'user', content: userContent })

  // Do not mix file_search attachments when using direct input_file mode
  const attachments = undefined
  return { input: inputParts as any, attachments }
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

// Fix-in-Chat 相关函数
/**
 * 处理 Fix-in-Chat 事件
 */
function handleFixInChatEvent(event: any) {
  const { selectedText, position, context } = event.detail;
  
  console.log('[Fix-in-Chat] 收到修复请求', {
    selectedText: selectedText.substring(0, 50) + '...',
    position,
    context
  });
  
  // 启动 Fix-in-Chat 模式
  fixMode.value = true;
  fixOriginalText.value = selectedText;
  fixPosition.value = position;
  
  // 打开聊天面板
  if (!isOpen.value) {
    toggleOpen();
  }
  
  // 设置为编辑模式
  setMode('edit');
  
  // 添加提示消息
  pushMessage({
    role: 'assistant',
    content: `🔧 Fix-in-Chat 模式已激活！\n\n已选中 ${selectedText.length} 个字符的文本。请告诉我如何修改这段内容。\n\n例如：\n- "让这段文字更专业"\n- "翻译成英文"\n- "增加技术细节"\n- "改为简洁表达"`
  });
  
  // 自动聚焦输入框
  setTimeout(() => {
    const input = document.querySelector('#chatbot-input') as HTMLTextAreaElement;
    if (input) {
      input.focus();
    }
  }, 100);
}

/**
 * 处理 Fix-in-Chat 用户输入
 */
async function processFixInChatMessage(userText: string) {
  if (!fixMode.value || !fixOriginalText.value || !fixPosition.value) {
    console.warn('[Fix-in-Chat] 模式未激活或缺少原文');
    return false;
  }
  
  try {
    // 提取上下文
    const fullDocument = await getCurrentDocumentContent();
    const context = await contextExtractor.extractContext({
      selectedText: fixOriginalText.value,
      position: fixPosition.value,
      beforeContext: '',
      afterContext: '',
      fullDocument: fullDocument || ''
    });
    
    fixContextInfo.value = context;
    
    // 构建 Fix-in-Chat 专用提示
    const prompt = buildFixInChatPrompt(userText, fixOriginalText.value, context);
    
    // 调用 OpenAI 生成修改建议
    console.log('[Fix-in-Chat] 准备调用 API:', {
      promptLength: prompt.length,
      selectedTextLength: fixOriginalText.value.length
    });
    
    const runtime = useRuntimeConfig()
    const backendBaseCg = (runtime.public as any)?.backendBase || ''
    const cgUrl = backendBaseCg ? backendBaseCg.replace(/\/$/, '') + '/api/content-generate' : '/api/content-generate'
    const response = await $fetch(cgUrl, {
      method: 'POST',
      headers: { 'x-chatbot-mode': currentMode.value },
      body: {
        prompt,
        context: {
          selectedText: fixOriginalText.value,
          sectionType: context.sectionType,
          contentType: context.contentType
        }
      }
    }) as any;
    
    console.log('[Fix-in-Chat] API 响应:', response);
    
    if (response && response.success && response.content) {
      // 显示 Diff 预览
      fixSuggestedText.value = response.content;
      diffPreviewVisible.value = true;
      
      pushMessage({
        role: 'assistant',
        content: `✅ 已生成修改建议！${response.method ? `(使用 ${response.method})` : ''} 请在预览窗口中确认是否应用。`
      });
    } else {
      console.error('[Fix-in-Chat] API 响应格式错误:', response);
      throw new Error(response?.error || `API响应无效: ${JSON.stringify(response)}`);
    }
    
    return true;
  } catch (error: any) {
    console.error('[Fix-in-Chat] 处理失败:', error);
    pushMessage({
      role: 'assistant',
      content: `❌ Fix-in-Chat 处理失败: ${error?.message || String(error)}`
    });
    return false;
  }
}

/**
 * 构建 Fix-in-Chat 专用提示
 */
function buildFixInChatPrompt(userInstruction: string, originalText: string, context: SelectionContext): string {
  let prompt = `请根据用户指令修改以下文本。只返回修改后的文本，不要任何解释或者前后缀。\n\n`;
  
  // 添加上下文信息
  if (context.sectionType && context.sectionType !== 'other') {
    prompt += `文本所在章节: ${context.sectionType}\n`;
  }
  
  if (context.contentType) {
    prompt += `内容类型: ${context.contentType}\n`;
  }
  
  if (context.semanticTags?.length) {
    prompt += `语义标签: ${context.semanticTags.join(', ')}\n`;
  }
  
  prompt += `\n用户指令: ${userInstruction}\n\n`;
  prompt += `原文:\n${originalText}\n\n`;
  prompt += `请严格按照指令修改上述文本，保持原有的 Markdown 格式和结构，只返回修改后的文本内容：`;
  
  return prompt;
}

/**
 * 关闭 Diff 预览
 */
function closeDiffPreview() {
  diffPreviewVisible.value = false;
}

/**
 * 应用修复建议
 */
async function applyFixSuggestion() {
  if (!fixPosition.value || !fixSuggestedText.value) {
    console.warn('[Fix-in-Chat] 缺少位置或建议文本');
    return;
  }
  
  try {
    // 应用修改（撤销功能已删除）
    
    // 发送应用事件给编辑器
    const applyEvent = new CustomEvent('apply-fix-suggestion', {
      detail: {
        position: fixPosition.value,
        newText: fixSuggestedText.value,
        originalText: fixOriginalText.value
      }
    });
    
    window.dispatchEvent(applyEvent);
    
    // 关闭预览和重置状态
    diffPreviewVisible.value = false;
    resetFixMode();
    
    // 显示成功消息
    pushMessage({
      role: 'assistant',
      content: `✅ 修改已应用到文档中！`
    });
    
  } catch (error: any) {
    console.error('[Fix-in-Chat] 应用修复建议失败:', error);
    pushMessage({
      role: 'assistant',
      content: `❌ 应用修改失败: ${error?.message || String(error)}`
    });
  }
}

/**
 * 拒绝修复建议
 */
function rejectFixSuggestion() {
  diffPreviewVisible.value = false;
  pushMessage({
    role: 'assistant',
    content: '❌ 已拒绝修改建议。您可以重新描述修改要求。'
  });
}

/**
 * 编辑修复建议
 */
function editFixSuggestion() {
  diffPreviewVisible.value = false;
  // 将建议文本放入输入框供用户编辑
  draft.value = `请修改为：\n${fixSuggestedText.value}`;
}

/**
 * 重置 Fix-in-Chat 模式
 */
function resetFixMode() {
  fixMode.value = false;
  fixOriginalText.value = '';
  fixSuggestedText.value = '';
  fixContextInfo.value = undefined;
  fixPosition.value = null;
}

// ====== 撤销/重做功能已删除 ======

/**
 * 显示当前选中的文本
 */
async function showCurrentSelection() {
  try {
    const workspaceStore = useWorkspaceStore?.();
    
    if (!workspaceStore) {
      pushMessage({
        role: 'assistant',
        content: '❌ 无法访问工作区状态'
      });
      return;
    }
    
    const selection = workspaceStore.state.currentSelection;
    
    let message = `🎯 当前选区状态:\n\n`;
    message += `• 是否有选中文本: ${selection.hasSelection ? '是' : '否'}\n`;
    
    if (selection.hasSelection && selection.text) {
      message += `• 选中文本长度: ${selection.text.length} 字符\n`;
      message += `• 选中位置: ${selection.start} 到 ${selection.end}\n\n`;
      message += `📝 选中的内容:\n`;
      message += `\`\`\`\n${selection.text}\`\`\`\n\n`;
      
      if (fixMode.value) {
        message += `🔧 当前正在 Fix-in-Chat 模式中\n`;
        message += `• 原始文本: "${fixOriginalText.value}"\n`;
      }
      
      message += `💡 提示: 你可以直接输入修改指令，如:\n`;
      message += `• "改成更专业的表达"\n`;
      message += `• "翻译成英文"\n`;
      message += `• "简化这段文字"\n`;
    } else {
      message += `\n❌ 当前没有选中任何文本\n\n`;
      message += `💡 请先在编辑器中选中一段文本，然后:\n`;
      message += `• 点击 "🔧 Fix in Chat" 按钮\n`;
      message += `• 或直接在这里输入修改指令`;
    }
    
    pushMessage({
      role: 'assistant',
      content: message
    });
    
  } catch (error: any) {
    console.error('[Chatbot] 显示选中文本失败:', error);
    pushMessage({
      role: 'assistant',
      content: `❌ 获取选中文本失败: ${error?.message || String(error)}`
    });
  }
}

// ====== 选中文本卡片相关函数 ======

/**
 * 处理选区变化事件
 */
function handleSelectionChanged(event: any) {
  const { hasSelection, text, startLine, endLine, startColumn, endColumn } = event.detail;
  
  console.log('[Chatbot] 选区变化:', { hasSelection, textLength: text?.length });
  
  if (hasSelection && text && text.trim()) {
    // 更新选中文本信息
    currentSelectionInfo.value = {
      text: text,
      length: text.length,
      startLine: startLine,
      endLine: endLine
    };
    
    // 只在聊天框打开时显示卡片
    if (isOpen.value) {
      showSelectionCard.value = true;
    }
  } else {
    // 没有选中文本时隐藏卡片
    showSelectionCard.value = false;
  }
}

/**
 * 隐藏选中文本卡片
 */
function hideSelectionCard() {
  showSelectionCard.value = false;
}

/**
 * 插入快捷命令到输入框
 */
function insertQuickCommand(command: string) {
  draft.value = command;
  
  // 自动聚焦到输入框
  setTimeout(() => {
    const input = document.querySelector('#chatbot-input') as HTMLTextAreaElement;
    if (input) {
      input.focus();
      // 将光标移到文本末尾
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 50);
}

function openCustomPrompt() {
  showSelectionCard.value = true;
  showCustomPrompt.value = true;
  customPrompt.value = '';
  setTimeout(() => customPromptInputRef.value?.focus(), 50);
}

function confirmCustomPrompt() {
  const text = (customPrompt.value || '').trim();
  if (!text) {
    showCustomPrompt.value = false;
    return;
  }
  draft.value = text;
  showCustomPrompt.value = false;
  // 聚焦主输入框
  setTimeout(() => {
    const input = document.querySelector('#chatbot-input') as HTMLTextAreaElement;
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 50);
}

function cancelCustomPrompt() {
  showCustomPrompt.value = false;
}

// Manage inline text snippets
function removeSnippet(idx: number) {
  if (idx >= 0 && idx < inlineTextSnippets.value.length) inlineTextSnippets.value.splice(idx, 1)
}
function clearInlineSnippets() {
  inlineTextSnippets.value = []
}

function onBubbleClick() {
  if (dragging) return; // ignore click if user just dragged
  toggleOpen();
}

onMounted(() => {
  computeInitialPosition();
  window.addEventListener("resize", computeInitialPosition);
  // Load conversation history scoped by chatScopedId (PS outline/body share same chatId)
  const loadScopedHistory = () => {
    try {
      const key = chatScopedId.value
      const hist = key ? convStore.loadMessages(key, 40) : []
      const mapped: Message[] = (hist || []).map((r) => ({
        id: (r as any).timestamp || Date.now() + Math.random(),
        role: r.role as Role,
        content: r.content
      }))
      messages.value = mapped.length ? mapped : [{ id: Date.now(), role: 'assistant', content: "Hi! I'm your Chatbot. How can I help you today?" }]
      nextTick(() => scrollToBottom())
    } catch {
      if (messages.value.length === 0) messages.value = [{ id: Date.now(), role: 'assistant', content: "Hi! I'm your Chatbot. How can I help you today?" }]
    }
  }
  watch(chatScopedId, () => loadScopedHistory(), { immediate: true })
  
  // 监听 Fix-in-Chat 事件
  window.addEventListener("start-fix-in-chat", handleFixInChatEvent);
  // 允许外部在创建后把部分结构化内容注入到聊天记录
  window.addEventListener('chatbot-append-message', (e: any) => {
    try {
      const d = (e && e.detail) || {}
      const role = d.role || 'assistant'
      const content = sanitizeForDisplay(ensureText(d.content || ''))
      if (content) pushMessage({ role, content })
    } catch {}
  })
  
  // 监听工作区选区变化事件
  window.addEventListener("workspace-selection-changed", handleSelectionChanged);
  // 首页新建PS后，编辑页触发的初始化种子建议对比
  window.addEventListener('show-initial-ps-seed-diff', (e: any) => {
    try {
      const suggested = String(e?.detail?.suggestedText || '')
      if (!suggested) return
      // 获取当前文档全文作为 original
      getCurrentDocumentContent().then((orig) => {
        fixOriginalText.value = orig || ''
        fixSuggestedText.value = suggested
        fixContextInfo.value = undefined
        diffPreviewVisible.value = true
      })
    } catch {}
  })
  // Global listeners for Add menu
  document.addEventListener('mousedown', handleGlobalClick, true)
  document.addEventListener('keydown', handleEsc, true)
});

onUnmounted(() => {
  window.removeEventListener("resize", computeInitialPosition);
  window.removeEventListener("start-fix-in-chat", handleFixInChatEvent);
  window.removeEventListener("workspace-selection-changed", handleSelectionChanged);
  window.removeEventListener('show-initial-ps-seed-diff', () => {})
  document.removeEventListener('mousedown', handleGlobalClick, true)
  document.removeEventListener('keydown', handleEsc, true)
});

// Prompts editing state
const promptsLoading = ref(false)
const promptsRequirement = ref('')
const promptsOutline = ref('')
const promptsElement = ref('')
const promptsOutlinePrefix = ref('')
const promptsBodyPrefix = ref('')

async function openPromptsTab() {
  settingsTab.value = 'prompts'
  try {
    const { usePsPrompts } = await import('~/composables/psPrompts')
    const svc = usePsPrompts()
    if (!svc.defaults.value?.ps_requirement) {
      promptsLoading.value = true
      await svc.loadDefaultPrompts()
      promptsLoading.value = false
    }
    const scopeId = chatScopedId.value || documentId.value || 'global'
    const eff = svc.getEffectivePrompts(scopeId)
    promptsRequirement.value = eff.ps_requirement
    promptsOutline.value = eff.guidance_outline
    promptsElement.value = eff.guidance_element
    promptsOutlinePrefix.value = eff.outline_prefix || ''
    promptsBodyPrefix.value = eff.body_prefix || ''
  } catch {}
}

async function savePromptsOverrides() {
  try {
    const { usePsPrompts } = await import('~/composables/psPrompts')
    const svc = usePsPrompts()
    const scopeId = chatScopedId.value || documentId.value || 'global'
    svc.setOverrides(scopeId, {
      ps_requirement: promptsRequirement.value,
      guidance_outline: promptsOutline.value,
      guidance_element: promptsElement.value,
      outline_prefix: promptsOutlinePrefix.value,
      body_prefix: promptsBodyPrefix.value
    })
    pushMessage({ role: 'assistant', content: '已保存当前作用域的提示词覆盖。' })
  } catch (e: any) {
    pushMessage({ role: 'assistant', content: '保存提示词失败。' })
  }
}

async function resetPromptsToDefault() {
  try {
    const { usePsPrompts } = await import('~/composables/psPrompts')
    const svc = usePsPrompts()
    const scopeId = chatScopedId.value || documentId.value || 'global'
    svc.clearOverrides(scopeId)
    const eff = svc.getEffectivePrompts(scopeId)
    promptsRequirement.value = eff.ps_requirement
    promptsOutline.value = eff.guidance_outline
    promptsElement.value = eff.guidance_element
    promptsOutlinePrefix.value = eff.outline_prefix || ''
    promptsBodyPrefix.value = eff.body_prefix || ''
    pushMessage({ role: 'assistant', content: '已恢复到默认提示词。' })
  } catch {
    pushMessage({ role: 'assistant', content: '恢复默认失败。' })
  }
}

// Uploads state (images dataURL, pdf file id)
const imageDataUrls = ref<string[]>([])
const uploadedFileIds = ref<string[]>([])
const uploadedFiles = ref<Array<{ id: string; name?: string }>>([])
const inlineTextSnippets = ref<Array<{ name: string; text: string }>>([])

function onPickImages(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input?.files
  if (!files) return
  const maxImages = 6
  const maxSize = 4 * 1024 * 1024 // 4MB
  const readers: Promise<void>[] = []
  const canAdd = Math.max(0, maxImages - imageDataUrls.value.length)
  for (let i = 0; i < Math.min(files.length, canAdd); i++) {
    const f = files[i]
    if (f.size > maxSize) continue
    const p = new Promise<void>((resolve) => {
      const fr = new FileReader()
      fr.onload = () => { if (typeof fr.result === 'string') imageDataUrls.value.push(fr.result); resolve() }
      fr.onerror = () => resolve()
      fr.readAsDataURL(f)
    })
    readers.push(p)
  }
  Promise.all(readers).then(() => {
    try {
      if (files && files.length) {
        const n = Math.min(files.length, canAdd)
        if (n > 0) pushMessage({ role: 'assistant', content: `已添加图片 ${n} 张（发送时附加）。` })
      }
    } catch {}
  })
  // reset input to allow re-selecting same files
  try { if (input) (input as any).value = '' } catch {}
}

async function onPickAnyFile(e: Event) {
  const input = e.target as HTMLInputElement
  const list = input?.files ? Array.from(input.files) : []
  if (!list.length) return
  await handlePickedFiles(list)
  try { if (input) (input as any).value = '' } catch {}
}

async function handlePickedFiles(files: File[]) {
  const images: File[] = []
  const pdfs: File[] = []
  const docs: File[] = [] // md/txt/doc/docx
  for (const f of files) {
    if (f.type.startsWith('image/')) images.push(f)
    else if (f.type === 'application/pdf') pdfs.push(f)
    else if (
      f.type === 'text/markdown' || f.name.endsWith('.md') ||
      f.type === 'text/plain' || f.name.endsWith('.txt') ||
      f.type === 'application/msword' || f.name.endsWith('.doc') ||
      f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.endsWith('.docx')
    ) {
      docs.push(f)
    }
  }

  // images -> preview as dataURL (no upload)
  if (images.length) {
    const maxImages = 6
    const maxSize = 4 * 1024 * 1024
    for (const f of images) {
      if (imageDataUrls.value.length >= maxImages) break
      if (f.size > maxSize) continue
      await new Promise<void>((resolve) => {
        const fr = new FileReader()
        fr.onload = () => { if (typeof fr.result === 'string') imageDataUrls.value.push(fr.result); resolve() }
        fr.onerror = () => resolve()
        fr.readAsDataURL(f)
      })
    }
  }

  // PDFs -> upload first one
  if (pdfs.length) {
    const f = pdfs[0]
    if (f.size <= 20 * 1024 * 1024) {
      const b64 = await fileToBase64(f)
      try {
        const runtime = useRuntimeConfig()
        const backendBase = (runtime.public as any)?.backendBase || ''
        const filesUrl = backendBase ? backendBase.replace(/\/$/, '') + '/api/files/upload' : '/api/files/upload'
        const res: any = await $fetch(filesUrl, { method: 'POST', body: { name: f.name || 'upload.pdf', contentBase64: b64, purpose: 'user_data' }})
        if (res?.status === 'ok' && res?.file?.id) {
          uploadedFileIds.value.push(res.file.id)
          uploadedFiles.value.push({ id: res.file.id, name: f.name })
        }
      } catch {}
    }
  }

  // docs -> always upload (no inline injection; Agents will read files)
  if (docs.length) {
    const f = docs[0]
    const b64 = await fileToBase64(f)
    try {
      const runtime = useRuntimeConfig()
      const backendBase = (runtime.public as any)?.backendBase || ''
      const filesUrl = backendBase ? backendBase.replace(/\/$/, '') + '/api/files/upload' : '/api/files/upload'
      const res: any = await $fetch(filesUrl, { method: 'POST', body: { name: f.name, contentBase64: b64, purpose: 'user_data' }})
      if (res?.status === 'ok' && res?.file?.id) {
        uploadedFileIds.value.push(res.file.id)
        uploadedFiles.value.push({ id: res.file.id, name: f.name })
      }
    } catch {}
  }
}

// Remove image / file
function removeImage(idx: number) {
  if (idx >= 0 && idx < imageDataUrls.value.length) imageDataUrls.value.splice(idx, 1)
}
function removeFileId(idx: number) {
  if (idx >= 0 && idx < uploadedFileIds.value.length) uploadedFileIds.value.splice(idx, 1)
}

function removeUploadedFile(idx: number) {
  if (idx >= 0 && idx < uploadedFiles.value.length) uploadedFiles.value.splice(idx, 1)
  if (idx >= 0 && idx < uploadedFileIds.value.length) uploadedFileIds.value.splice(idx, 1)
}

const hasAnyAttachments = computed(() => {
  return (imageDataUrls.value.length + uploadedFiles.value.length + inlineTextSnippets.value.length) > 0
})

// Paste image support
onMounted(() => {
  mounted.value = true
  const handler = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const it of items as any) {
      if (it.type?.startsWith('image/')) {
        const file = it.getAsFile?.()
        if (file) {
          if (imageDataUrls.value.length >= 6 || file.size > 4 * 1024 * 1024) continue
          const fr = new FileReader()
          fr.onload = () => { if (typeof fr.result === 'string') imageDataUrls.value.push(fr.result) }
          fr.readAsDataURL(file)
        }
      }
    }
  }
  window.addEventListener('paste', handler)
  ;(window as any)._chatbot_paste_handler = handler
})
onUnmounted(() => {
  const h = (window as any)._chatbot_paste_handler
  if (h) window.removeEventListener('paste', h)
})
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

.mode-text-btn {
  @apply px-3 py-1 rounded text-sm font-medium transition-all duration-200 cursor-pointer;
}

.mode-text-btn-active {
  @apply bg-blue-500 text-white shadow-sm;
}

.mode-text-btn-inactive {
  @apply bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600;
}
</style>



