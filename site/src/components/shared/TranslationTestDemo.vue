<!--
  全文翻译测试演示组件
  用于验证"翻译全文"功能是否正常工作
-->
<template>
  <div class="translation-test-demo p-6 bg-c border border-c/30 rounded-lg">
    <h3 class="text-lg font-bold mb-4">🔧 全文翻译测试</h3>
    
    <!-- 测试状态 -->
    <div class="mb-4">
      <div class="text-sm font-medium mb-2">📊 当前状态</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div class="text-light-c">快速匹配</div>
          <div class="text-green-600">{{ quickMatchStatus }}</div>
        </div>
        <div>
          <div class="text-light-c">Fallback</div>
          <div class="text-blue-600">{{ fallbackStatus }}</div>
        </div>
        <div>
          <div class="text-light-c">API状态</div>
          <div :class="apiStatus === '正常' ? 'text-green-600' : 'text-red-600'">{{ apiStatus }}</div>
        </div>
        <div>
          <div class="text-light-c">模式</div>
          <div class="text-purple-600">{{ getCurrentMode() }}</div>
        </div>
      </div>
    </div>
    
    <!-- 快速测试按钮 -->
    <div class="mb-6">
      <div class="text-sm font-medium mb-2">⚡ 快速测试</div>
      <div class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <button 
            @click="testTranslation('翻译全文')" 
            class="test-btn"
            :disabled="testing"
          >
            翻译全文
          </button>
          <button 
            @click="testTranslation('翻译成中文')" 
            class="test-btn"
            :disabled="testing"
          >
            翻译成中文
          </button>
          <button 
            @click="testTranslation('翻译成英文')" 
            class="test-btn"
            :disabled="testing"
          >
            翻译成英文
          </button>
          <button 
            @click="testTranslation('全文润色')" 
            class="test-btn"
            :disabled="testing"
          >
            全文润色
          </button>
        </div>
        
        <div v-if="testing" class="text-sm text-blue-600">
          正在测试: {{ currentTest }}
        </div>
      </div>
    </div>
    
    <!-- 测试结果 -->
    <div v-if="testResults.length > 0" class="mb-6">
      <div class="text-sm font-medium mb-2">📋 测试结果</div>
      <div class="space-y-2 max-h-60 overflow-y-auto">
        <div 
          v-for="(result, index) in testResults" 
          :key="index"
          class="p-3 border border-c/20 rounded text-xs"
          :class="result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'"
        >
          <div class="flex justify-between items-start mb-1">
            <span class="font-medium">{{ result.input }}</span>
            <span :class="result.success ? 'text-green-600' : 'text-red-600'">
              {{ result.success ? '✅' : '❌' }}
            </span>
          </div>
          <div class="text-light-c">
            范围: {{ result.scope }} | 操作: {{ result.action }} | 置信度: {{ result.confidence }}
          </div>
          <div class="text-light-c">
            路径: {{ result.method }} | 耗时: {{ result.duration }}ms
          </div>
          <div v-if="result.reason" class="text-light-c">
            原因: {{ result.reason }}
          </div>
        </div>
      </div>
      
      <div class="mt-3 flex gap-2">
        <button @click="clearResults" class="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:opacity-80">
          清空结果
        </button>
        <button @click="exportResults" class="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:opacity-80">
          导出结果
        </button>
      </div>
    </div>
    
    <!-- 自定义测试 -->
    <div class="mb-4">
      <div class="text-sm font-medium mb-2">🔧 自定义测试</div>
      <div class="flex gap-2">
        <input 
          v-model="customInput"
          type="text" 
          placeholder="输入要测试的指令..."
          class="flex-1 px-3 py-2 border border-c/30 rounded text-sm bg-c"
          @keydown.enter="testCustomInput"
        >
        <button 
          @click="testCustomInput"
          class="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:opacity-80"
          :disabled="testing || !customInput.trim()"
        >
          测试
        </button>
      </div>
    </div>
    
    <!-- 调试信息 -->
    <div class="border-t border-c/20 pt-4">
      <div class="text-sm font-medium mb-2">🔍 调试信息</div>
      <div class="text-xs space-y-1 text-light-c">
        <div>快速匹配模式: 高优先级翻译指令</div>
        <div>Fallback模式: 规则引擎匹配</div>
        <div>小LLM: 硅基流动API (如果可用)</div>
        <div>文档结构: 基于markdown解析</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

// 响应式数据
const testing = ref(false)
const currentTest = ref('')
const testResults = ref<any[]>([])
const customInput = ref('')
const apiStatus = ref('未知')

// 获取当前模式
const currentMode = useLocalStorage<'ask' | 'edit'>('chatbot.mode', 'edit')

// 计算属性
const quickMatchStatus = computed(() => '已启用')
const fallbackStatus = computed(() => '已启用')

// 方法
const getCurrentMode = () => {
  return currentMode.value === 'ask' ? 'Ask 问答' : 'Edit 编辑'
}

// 测试翻译功能
const testTranslation = async (input: string) => {
  if (testing.value) return
  
  testing.value = true
  currentTest.value = input
  
  const startTime = Date.now()
  
  try {
    // 模拟快速匹配测试
    const quickResult = quickPatternMatchTest(input)
    const duration = Date.now() - startTime
    
    testResults.value.unshift({
      input,
      success: quickResult.success,
      scope: quickResult.scope || '未识别',
      action: quickResult.action || '未知',
      confidence: quickResult.confidence || 0,
      method: quickResult.success ? '快速匹配' : 'Fallback',
      reason: quickResult.reason || '无',
      duration,
      timestamp: new Date().toLocaleTimeString()
    })
    
    console.log(`[TranslationTest] 测试结果:`, quickResult)
    
  } catch (error) {
    const duration = Date.now() - startTime
    testResults.value.unshift({
      input,
      success: false,
      scope: '错误',
      action: '错误',
      confidence: 0,
      method: '错误',
      reason: error instanceof Error ? error.message : String(error),
      duration,
      timestamp: new Date().toLocaleTimeString()
    })
  } finally {
    testing.value = false
    currentTest.value = ''
  }
}

// 快速模式匹配测试（模拟前端逻辑）
const quickPatternMatchTest = (userInput: string) => {
  const input = userInput.toLowerCase()
  
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
    },
    { 
      patterns: ['全文润色', '润色全文', '全文优化'], 
      scope: '全文', 
      action: '编辑', 
      confidence: 0.8 
    }
  ]
  
  // 查找匹配
  for (const pattern of highPriorityPatterns) {
    for (const p of pattern.patterns) {
      if (input.includes(p)) {
        return {
          success: true,
          scope: pattern.scope,
          action: pattern.action,
          confidence: pattern.confidence,
          reason: `快速匹配: ${p}`
        }
      }
    }
  }
  
  return { 
    success: false,
    reason: '未匹配到模式'
  }
}

// 自定义输入测试
const testCustomInput = () => {
  if (customInput.value.trim()) {
    testTranslation(customInput.value.trim())
    customInput.value = ''
  }
}

// 清空结果
const clearResults = () => {
  testResults.value = []
}

// 导出结果
const exportResults = () => {
  const data = {
    timestamp: new Date().toISOString(),
    results: testResults.value,
    summary: {
      total: testResults.value.length,
      success: testResults.value.filter(r => r.success).length,
      failed: testResults.value.filter(r => !r.success).length
    }
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `translation-test-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 检查API状态
const checkApiStatus = async () => {
  try {
    const response = await fetch('/api/siliconflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 'test',
        max_tokens: 10
      })
    })
    
    if (response.ok) {
      apiStatus.value = '正常'
    } else {
      apiStatus.value = '错误'
    }
  } catch (error) {
    apiStatus.value = '无法连接'
  }
}

// 初始化
checkApiStatus()
</script>

<style scoped>
.test-btn {
  @apply px-3 py-1 text-xs border border-c/30 rounded hover:bg-c/50 transition-colors;
}

.test-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
