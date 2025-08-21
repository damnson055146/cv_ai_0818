<!--
  AI操作测试组件
  用于测试和验证AI对话操作功能
-->
<template>
  <div class="ai-operation-test p-6 bg-c border border-c/30 rounded-lg">
    <h3 class="text-lg font-bold mb-4">🧪 AI操作功能测试</h3>
    
    <!-- 测试状态显示 -->
    <div class="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded">
      <div class="flex items-center justify-between mb-2">
        <span class="font-medium">系统状态</span>
        <span :class="systemStatus.class">{{ systemStatus.text }}</span>
      </div>
      <div class="text-sm text-light-c">
        <div>AI助手: {{ workspaceState.aiAssistantActive ? '已激活' : '未激活' }}</div>
        <div>锁定状态: {{ workspaceState.isLocked ? '已锁定' : '正常' }}</div>
        <div>选中文本: {{ hasSelection ? '有选择' : '无选择' }} ({{ selectionLength }}字符)</div>
      </div>
    </div>
    
    <!-- 模拟文本选择区 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">测试文本 (请选择一些文本来模拟编辑器选择)</label>
      <textarea
        v-model="testText"
        @select="updateSelection"
        class="w-full h-32 p-3 border border-c/30 rounded resize-none"
        placeholder="在这里输入一些测试文本，然后选择部分文本来测试AI操作..."
      >{{ defaultTestText }}</textarea>
      <div class="text-xs text-light-c mt-1">
        选中: {{ selectedText.length > 0 ? `"${selectedText}"` : '无' }}
      </div>
    </div>
    
    <!-- 快速测试按钮 -->
    <div class="mb-4">
      <div class="text-sm font-medium mb-2">快速测试命令</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          v-for="cmd in quickCommands"
          :key="cmd.text"
          @click="testCommand(cmd.text, cmd.type)"
          :disabled="isProcessing"
          class="px-3 py-2 text-xs border border-c/30 rounded hover:bg-light-c/10 disabled:opacity-50"
        >
          {{ cmd.text }}
        </button>
      </div>
    </div>
    
    <!-- 自定义命令测试 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">自定义命令测试</label>
      <div class="flex gap-2">
        <input
          v-model="customCommand"
          @keydown.enter="testCustomCommand"
          class="flex-1 px-3 py-2 border border-c/30 rounded text-sm"
          placeholder="输入自定义AI操作命令..."
          :disabled="isProcessing"
        />
        <button
          @click="testCustomCommand"
          :disabled="!customCommand.trim() || isProcessing"
          class="px-4 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          {{ isProcessing ? '处理中...' : '测试' }}
        </button>
      </div>
    </div>
    
    <!-- 测试结果显示 -->
    <div v-if="testResults.length > 0" class="mb-4">
      <div class="text-sm font-medium mb-2">测试结果 ({{ testResults.length }})</div>
      <div class="space-y-2 max-h-60 overflow-y-auto">
        <div
          v-for="(result, index) in testResults"
          :key="index"
          class="p-3 border border-c/20 rounded text-xs"
          :class="result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-medium">{{ result.command }}</span>
            <div class="flex items-center space-x-2">
              <span :class="result.success ? 'text-green-600' : 'text-red-600'">
                {{ result.success ? '✓' : '✗' }}
              </span>
              <span class="text-light-c">{{ result.duration }}ms</span>
            </div>
          </div>
          <div class="text-light-c mb-1">
            操作类型: {{ result.operationType }} | 置信度: {{ result.confidence }}%
          </div>
          <div v-if="result.success && result.result" class="bg-white dark:bg-slate-600 p-2 rounded">
            <strong>AI结果:</strong> {{ result.result.substring(0, 200) }}{{ result.result.length > 200 ? '...' : '' }}
          </div>
          <div v-if="!result.success && result.error" class="text-red-600">
            <strong>错误:</strong> {{ result.error }}
          </div>
        </div>
      </div>
      <button @click="clearResults" class="mt-2 text-xs text-light-c hover:text-c">
        清除结果
      </button>
    </div>
    
    <!-- API 状态检查 -->
    <div class="border-t border-c/20 pt-4">
      <div class="text-sm font-medium mb-2">API状态检查</div>
      <div class="flex gap-2">
        <button
          @click="checkApiStatus"
          :disabled="isCheckingApi"
          class="px-3 py-2 text-xs border border-c/30 rounded hover:bg-light-c/10 disabled:opacity-50"
        >
          {{ isCheckingApi ? '检查中...' : '检查AI API' }}
        </button>
        <span v-if="apiStatus" :class="apiStatus.success ? 'text-green-600' : 'text-red-600'" class="text-xs self-center">
          {{ apiStatus.message }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore } from '~/composables/stores/workspace'
import { useAiRequirementParser } from '~/composables/aiRequirementParser'
import { useWorkspaceOperator } from '~/composables/workspaceOperator'

const workspaceStore = useWorkspaceStore()
const parser = useAiRequirementParser()
const operator = useWorkspaceOperator()

// 测试状态
const isProcessing = ref(false)
const isCheckingApi = ref(false)
const testResults = ref<any[]>([])
const apiStatus = ref<any>(null)

// 测试文本
const defaultTestText = `这是一个测试文档，用于验证AI操作功能。

人工智能正在快速发展，它正在改变我们的生活方式。从智能手机到自动驾驶汽车，AI无处不在。

本段落包含一些**粗体文字**和*斜体文字*，以及一个[链接](https://example.com)。

请选择任意文本进行AI操作测试。`

const testText = ref(defaultTestText)
const selectedText = ref('')
const customCommand = ref('')

// 快速测试命令
const quickCommands = [
  { text: '编辑这段文字', type: 'edit' },
  { text: '翻译成英文', type: 'translate' },
  { text: '设为标题', type: 'format' },
  { text: '分析内容', type: 'analyze' },
  { text: '生成总结', type: 'generate' },
  { text: '检查语法', type: 'check' },
  { text: '加粗文字', type: 'format' },
  { text: '续写内容', type: 'extend' }
]

// 计算属性
const workspaceState = computed(() => workspaceStore.state)
const hasSelection = computed(() => selectedText.value.length > 0)
const selectionLength = computed(() => selectedText.value.length)

const systemStatus = computed(() => {
  if (workspaceState.value.isLocked) {
    return { text: '系统锁定', class: 'text-orange-600' }
  } else if (workspaceState.value.aiProcessing) {
    return { text: 'AI处理中', class: 'text-blue-600' }
  } else if (workspaceState.value.aiAssistantActive) {
    return { text: '就绪', class: 'text-green-600' }
  } else {
    return { text: '未激活', class: 'text-gray-600' }
  }
})

// 方法
const updateSelection = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  const start = target.selectionStart
  const end = target.selectionEnd
  selectedText.value = target.value.substring(start, end)
  
  // 更新工作区选择状态
  workspaceStore.updateSelection(selectedText.value, start, end)
}

const testCommand = async (command: string, type: string) => {
  if (isProcessing.value) return
  
  const startTime = Date.now()
  isProcessing.value = true
  
  try {
    console.log(`[AiOperationTest] 测试命令: ${command}`)
    
    // 1. 解析命令
    const parsed = parser.parse(command)
    console.log(`[AiOperationTest] 解析结果:`, parsed)
    
    if (parsed.type === 'workspace' && parsed.confidence > 0.3) {
      // 2. 执行AI操作
      const result = await workspaceStore.processAiRequest(command)
      
      const duration = Date.now() - startTime
      testResults.value.unshift({
        command,
        operationType: parsed.requirement?.action || 'unknown',
        confidence: Math.round(parsed.confidence * 100),
        success: true,
        result: result,
        duration,
        timestamp: new Date().toLocaleTimeString()
      })
    } else {
      // 3. 置信度太低
      const duration = Date.now() - startTime
      testResults.value.unshift({
        command,
        operationType: 'chat',
        confidence: Math.round(parsed.confidence * 100),
        success: false,
        error: `置信度太低 (${Math.round(parsed.confidence * 100)}%)，被识别为普通对话`,
        duration,
        timestamp: new Date().toLocaleTimeString()
      })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    testResults.value.unshift({
      command,
      operationType: 'error',
      confidence: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
      timestamp: new Date().toLocaleTimeString()
    })
  } finally {
    isProcessing.value = false
  }
}

const testCustomCommand = () => {
  if (customCommand.value.trim()) {
    testCommand(customCommand.value.trim(), 'custom')
    customCommand.value = ''
  }
}

const clearResults = () => {
  testResults.value = []
}

const checkApiStatus = async () => {
  if (isCheckingApi.value) return
  
  isCheckingApi.value = true
  apiStatus.value = null
  
  try {
    const base = (typeof window !== 'undefined' && (window as any).__NUXT__?.config?.app?.baseURL) || '/'
    const apiURL = (base.endsWith('/') ? base : base + '/') + 'api/ai'
    
    const response = await fetch(apiURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'o3',
        input: '测试AI API连接',
        max_output_tokens: 50
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      apiStatus.value = {
        success: true,
        message: `API正常 (${response.status})`
      }
    } else {
      const errorText = await response.text()
      apiStatus.value = {
        success: false,
        message: `API错误: ${response.status} ${errorText.substring(0, 100)}`
      }
    }
  } catch (error) {
    apiStatus.value = {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    isCheckingApi.value = false
  }
}

// 初始化
onMounted(() => {
  console.log('[AiOperationTest] 组件初始化')
  
  // 确保AI助手已激活
  if (!workspaceState.value.aiAssistantActive) {
    workspaceStore.activateAiAssistant()
  }
  
  // 自动进行API状态检查
  setTimeout(() => {
    checkApiStatus()
  }, 1000)
})
</script>

<style scoped>
textarea {
  outline: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.ai-operation-test {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
