<!--
  工作区状态指示器组件
  显示当前工作区的状态，包括AI操作进度、锁定状态等
-->
<template>
  <div v-if="showIndicator" class="workspace-status-indicator fixed top-4 right-4 z-40 bg-c/90 border border-c/60 rounded-lg shadow-lg backdrop-blur-md p-3 text-sm max-w-sm">
    <!-- 锁定状态指示 -->
    <div v-if="workspaceState.isLocked" class="flex items-center space-x-2 text-orange-600 dark:text-orange-400">
      <span class="i-ph:lock-duotone text-lg animate-pulse"></span>
      <div>
        <div class="font-medium">工作区已锁定</div>
        <div class="text-xs opacity-80">{{ workspaceState.lockReason }}</div>
      </div>
    </div>
    
    <!-- AI处理状态 -->
    <div v-else-if="workspaceState.aiProcessing" class="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
      <span class="i-ph:robot-duotone text-lg animate-spin"></span>
      <div>
        <div class="font-medium">AI正在处理</div>
        <div class="text-xs opacity-80">请等待操作完成...</div>
      </div>
    </div>
    
    <!-- 正常状态 -->
    <div v-else-if="workspaceState.aiAssistantActive" class="flex items-center space-x-2 text-green-600 dark:text-green-400">
      <span class="i-ph:check-circle-duotone text-lg"></span>
      <div>
        <div class="font-medium">AI助手已激活</div>
        <div class="text-xs opacity-80">可以通过聊天操作工作区</div>
      </div>
    </div>
    
    <!-- 运行中的操作列表 -->
    <div v-if="runningOperations.length > 0" class="mt-2 pt-2 border-t border-c/30">
      <div class="text-xs font-medium mb-1">正在执行 ({{ runningOperations.length }})</div>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        <div v-for="op in runningOperations" :key="op.id" class="flex items-center justify-between text-xs">
          <span class="truncate flex-1">{{ op.description }}</span>
          <button @click="cancelOperation(op.id)" class="ml-2 text-red-500 hover:text-red-700" title="取消操作">
            <span class="i-ph:x-circle-duotone"></span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 操作统计 -->
    <div v-if="showStats" class="mt-2 pt-2 border-t border-c/30">
      <div class="text-xs font-medium mb-1">操作统计</div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>总计: {{ stats.total }}</div>
        <div>成功: {{ stats.completed }}</div>
        <div>失败: {{ stats.failed }}</div>
        <div>成功率: {{ stats.successRate }}%</div>
      </div>
    </div>
    
    <!-- 控制按钮 -->
    <div class="mt-2 pt-2 border-t border-c/30 flex items-center justify-between">
      <div class="flex space-x-1">
        <button @click="showStats = !showStats" class="text-xs text-light-c hover:text-c" title="显示/隐藏统计">
          <span class="i-ph:chart-bar-duotone"></span>
        </button>
        <button @click="exportHistory" class="text-xs text-light-c hover:text-c" title="导出操作历史">
          <span class="i-ph:download-duotone"></span>
        </button>
        <button @click="clearHistory" class="text-xs text-light-c hover:text-c" title="清除历史">
          <span class="i-ph:trash-duotone"></span>
        </button>
      </div>
      <div class="flex space-x-1">
        <button v-if="workspaceState.isLocked" @click="forceUnlock" class="text-xs text-orange-500 hover:text-orange-700" title="强制解锁">
          <span class="i-ph:lock-open-duotone"></span>
        </button>
        <button @click="hideIndicator" class="text-xs text-light-c hover:text-c" title="隐藏指示器">
          <span class="i-ph:eye-slash-duotone"></span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- 隐藏状态下的小图标 -->
  <button v-if="!showIndicator && (workspaceState.isLocked || workspaceState.aiProcessing)" 
          @click="showIndicator = true"
          class="workspace-status-mini fixed top-4 right-4 z-40 size-10 circle bg-c/90 border border-c/60 shadow-lg backdrop-blur-md flex items-center justify-center"
          :class="workspaceState.isLocked ? 'text-orange-500' : 'text-blue-500'">
    <span :class="workspaceState.isLocked ? 'i-ph:lock-duotone animate-pulse' : 'i-ph:robot-duotone animate-spin'"></span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '~/composables/stores/workspace'

const workspaceStore = useWorkspaceStore()
const showIndicator = ref(true)
const showStats = ref(false)

// 计算属性
const workspaceState = computed(() => workspaceStore.state)
const runningOperations = computed(() => workspaceStore.runningOperations)
const stats = computed(() => workspaceStore.getWorkspaceStats())

// 方法
const cancelOperation = (operationId: string) => {
  if (confirm('确定要取消这个操作吗？')) {
    workspaceStore.cancelOperation(operationId)
  }
}

const forceUnlock = () => {
  if (confirm('强制解锁可能会中断正在进行的操作，确定继续吗？')) {
    workspaceStore.forceUnlock()
  }
}

const exportHistory = () => {
  workspaceStore.exportOperationHistory()
}

const clearHistory = () => {
  if (confirm('确定要清除所有操作历史吗？')) {
    workspaceStore.clearOperationHistory()
  }
}

const hideIndicator = () => {
  showIndicator.value = false
}

// 监听状态变化，自动显示指示器
watch(() => workspaceState.value.isLocked, (locked) => {
  if (locked) showIndicator.value = true
})

watch(() => workspaceState.value.aiProcessing, (processing) => {
  if (processing) showIndicator.value = true
})
</script>

<style scoped>
.workspace-status-indicator {
  animation: slideInRight 0.3s ease-out;
}

.workspace-status-mini {
  animation: bounceIn 0.3s ease-out;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes bounceIn {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
