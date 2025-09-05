<template>
  <div v-if="visible" class="fixed inset-0 z-50 bg-black bg-opacity-50">
    <div 
      ref="panelRef"
      class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden transition-shadow duration-200"
      :class="{ 'cursor-move': !isDragging, 'cursor-grabbing shadow-2xl': isDragging }"
      :style="panelStyle"
      @mousedown="startDrag"
    >
      <!-- 头部 -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
        <div class="flex items-center space-x-2">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            🔧 Fix-in-Chat 预览
          </h3>
          <span class="text-xs text-gray-400 dark:text-gray-500">
            (可拖动)
          </span>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex h-96">
        <!-- 原文 -->
        <div class="flex-1 border-r border-gray-200 dark:border-gray-600">
          <div class="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">原文</h4>
          </div>
          <div class="p-4 overflow-auto h-full bg-red-50 dark:bg-red-900/20">
            <pre class="text-sm whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">{{ originalText }}</pre>
          </div>
        </div>

        <!-- 修改后 -->
        <div class="flex-1">
          <div class="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">AI 建议</h4>
          </div>
          <div class="p-4 overflow-auto h-full bg-green-50 dark:bg-green-900/20">
            <pre class="text-sm whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">{{ suggestedText }}</pre>
          </div>
        </div>
      </div>

      <!-- 上下文信息 -->
      <div v-if="contextInfo" class="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div><strong>位置:</strong> 第{{ contextInfo.position?.startLine }}行 - 第{{ contextInfo.position?.endLine }}行</div>
          <div v-if="contextInfo.sectionType"><strong>章节:</strong> {{ getSectionName(contextInfo.sectionType) }}</div>
          <div v-if="contextInfo.contentType"><strong>类型:</strong> {{ getContentTypeName(contextInfo.contentType) }}</div>
          <div v-if="contextInfo.semanticTags?.length"><strong>标签:</strong> {{ contextInfo.semanticTags.join(', ') }}</div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-600">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          请确认是否应用AI建议的修改
        </div>
        <div class="flex space-x-3">
          <button
            @click="$emit('reject')"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
          >
            拒绝
          </button>
          <button
            @click="$emit('edit')"
            class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 dark:bg-blue-600 dark:text-blue-100 dark:hover:bg-blue-500"
          >
            编辑建议
          </button>
          <button
            @click="$emit('apply')"
            class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            应用修改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { SelectionContext } from '~/data/contextExtractor'

interface Props {
  visible: boolean
  originalText: string
  suggestedText: string
  contextInfo?: SelectionContext
}

defineProps<Props>()

defineEmits<{
  close: []
  apply: []
  reject: []
  edit: []
}>()

// 拖动相关的状态
const panelRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const panelPosition = ref({ x: 100, y: 100 }) // 默认靠左位置

// 计算面板样式
const panelStyle = computed(() => ({
  position: 'absolute',
  left: `${panelPosition.value.x}px`,
  top: `${panelPosition.value.y}px`,
  transform: 'none'
}))

// 开始拖动
const startDrag = (event: MouseEvent) => {
  if (!panelRef.value) return
  
  isDragging.value = true
  
  const rect = panelRef.value.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  
  event.preventDefault()
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

// 拖动过程中
const onDrag = (event: MouseEvent) => {
  if (!isDragging.value || !panelRef.value) return
  
  const newX = event.clientX - dragOffset.value.x
  const newY = event.clientY - dragOffset.value.y
  
  // 限制在视窗范围内
  const rect = panelRef.value.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width
  const maxY = window.innerHeight - rect.height
  
  panelPosition.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY))
  }
}

// 停止拖动
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (isDragging.value) {
    stopDrag()
  }
})

/**
 * 获取章节名称
 */
const getSectionName = (sectionType: string): string => {
  const names: Record<string, string> = {
    basic_info: '基础信息',
    education: '教育经历',
    work: '工作经历',
    projects: '项目经历',
    skills: '技能',
    awards: '奖项',
    certs: '证书',
    summary: '个人总结',
    other: '其他'
  }
  return names[sectionType] || sectionType
}

/**
 * 获取内容类型名称
 */
const getContentTypeName = (contentType: string): string => {
  const names: Record<string, string> = {
    heading: '标题',
    paragraph: '段落',
    list_item: '列表项',
    table_row: '表格行',
    inline_text: '行内文本'
  }
  return names[contentType] || contentType
}
</script>

<style scoped>
/* 自定义滚动条 */
.overflow-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.4);
  border-radius: 3px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.6);
}

/* 差异高亮 */
.bg-red-50 {
  position: relative;
}

.bg-green-50 {
  position: relative;
}

/* 深色模式下的差异色彩调整 */
.dark .bg-red-50 {
  background-color: rgba(239, 68, 68, 0.1);
}

.dark .bg-green-50 {
  background-color: rgba(34, 197, 94, 0.1);
}
</style>
