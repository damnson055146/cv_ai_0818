<template>
  <div class="fix-in-chat-demo p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        🔧 Fix-in-Chat 功能演示与调试
      </h1>
      
      <!-- 功能概述 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
        <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">功能流程</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">1</div>
            <h3 class="font-medium text-sm text-gray-900 dark:text-white">框选文本</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400">在编辑器中选中需要修改的文本</p>
          </div>
          <div class="text-center">
            <div class="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">2</div>
            <h3 class="font-medium text-sm text-gray-900 dark:text-white">点击Fix按钮</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400">点击悬浮的"Fix in Chat"按钮</p>
          </div>
          <div class="text-center">
            <div class="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">3</div>
            <h3 class="font-medium text-sm text-gray-900 dark:text-white">输入指令</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400">在聊天框中描述修改要求</p>
          </div>
          <div class="text-center">
            <div class="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">4</div>
            <h3 class="font-medium text-sm text-gray-900 dark:text-white">确认应用</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400">预览差异并应用修改</p>
          </div>
        </div>
      </div>

      <!-- 调试工具 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
        <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">调试工具</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <button
            @click="runTest('health-check')"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="text-green-500 text-2xl mb-2">💚</div>
            <h3 class="font-medium text-gray-900 dark:text-white">健康检查</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">检查所有组件状态</p>
          </button>
          
          <button
            @click="runTest('test-context-extractor')"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="text-blue-500 text-2xl mb-2">🔍</div>
            <h3 class="font-medium text-gray-900 dark:text-white">上下文提取</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">测试文本分析功能</p>
          </button>
          
          <button
            @click="runTest('test-intent-parse')"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="text-purple-500 text-2xl mb-2">🧠</div>
            <h3 class="font-medium text-gray-900 dark:text-white">意图解析</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">测试用户指令理解</p>
          </button>
          
          <button
            @click="runTest('test-content-generate')"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="text-orange-500 text-2xl mb-2">✨</div>
            <h3 class="font-medium text-gray-900 dark:text-white">内容生成</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">测试AI文本修改</p>
          </button>
          
          <button
            @click="runTest('test-diff-preview')"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="text-red-500 text-2xl mb-2">📊</div>
            <h3 class="font-medium text-gray-900 dark:text-white">差异预览</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">测试修改对比显示</p>
          </button>
          
          <button
            @click="simulateFixInChat"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="text-yellow-500 text-2xl mb-2">🔧</div>
            <h3 class="font-medium text-gray-900 dark:text-white">模拟Fix-in-Chat</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">模拟完整流程</p>
          </button>
        </div>
        
        <!-- 测试输入区域 -->
        <div class="border-t border-gray-200 dark:border-gray-600 pt-4">
          <h3 class="font-medium text-gray-900 dark:text-white mb-3">自定义测试</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                测试文本
              </label>
              <textarea
                v-model="testText"
                class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows="4"
                placeholder="输入要测试的文本..."
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                修改指令
              </label>
              <textarea
                v-model="testInstruction"
                class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows="4"
                placeholder="输入修改指令..."
              ></textarea>
            </div>
          </div>
          <button
            @click="runCustomTest"
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            :disabled="!testText || !testInstruction"
          >
            运行自定义测试
          </button>
        </div>
      </div>

      <!-- 测试结果 -->
      <div v-if="testResults.length > 0" class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">测试结果</h2>
        
        <div class="space-y-4">
          <div
            v-for="(result, index) in testResults"
            :key="index"
            class="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-900 dark:text-white">{{ result.title }}</h3>
              <span
                :class="{
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': result.success,
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': !result.success
                }"
                class="px-2 py-1 rounded text-xs font-medium"
              >
                {{ result.success ? '成功' : '失败' }}
              </span>
            </div>
            
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {{ result.timestamp }}
            </div>
            
            <pre class="bg-gray-100 dark:bg-gray-700 p-3 rounded text-xs overflow-auto">{{ JSON.stringify(result.data, null, 2) }}</pre>
          </div>
        </div>
        
        <button
          @click="clearResults"
          class="mt-4 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          清空结果
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// 测试状态
const testText = ref('**北京大学** | 计算机科学与技术 | 本科 | 2018-2022')
const testInstruction = ref('改成清华大学，并添加更多学术详情')
const testResults = ref<Array<{
  title: string
  success: boolean
  timestamp: string
  data: any
}>>([])

/**
 * 运行指定的测试
 */
async function runTest(action: string) {
  try {
    console.log(`[FixInChatDemo] 运行测试: ${action}`)
    
    const params = new URLSearchParams({
      action,
      selectedText: testText.value,
      instruction: testInstruction.value,
      originalText: testText.value
    })
    
    const response = await $fetch(`/api/debug-fix-in-chat?${params}`)
    
    testResults.value.unshift({
      title: getTestTitle(action),
      success: response.success,
      timestamp: new Date().toLocaleString(),
      data: response
    })
    
    console.log(`[FixInChatDemo] 测试完成:`, response)
    
  } catch (error) {
    console.error(`[FixInChatDemo] 测试失败:`, error)
    
    testResults.value.unshift({
      title: getTestTitle(action),
      success: false,
      timestamp: new Date().toLocaleString(),
      data: { error: error.message }
    })
  }
}

/**
 * 运行自定义测试
 */
async function runCustomTest() {
  await runTest('test-content-generate')
}

/**
 * 模拟完整的 Fix-in-Chat 流程
 */
function simulateFixInChat() {
  console.log('[FixInChatDemo] 模拟 Fix-in-Chat 流程')
  
  // 模拟触发 Fix-in-Chat 事件
  const mockEvent = new CustomEvent('start-fix-in-chat', {
    detail: {
      selectedText: testText.value,
      position: {
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: testText.value.length
      },
      context: {
        beforeContext: '# 简历\n\n## 教育经历\n\n',
        afterContext: '\n\n## 工作经历\n',
        sectionType: 'education'
      }
    }
  })
  
  window.dispatchEvent(mockEvent)
  
  testResults.value.unshift({
    title: '模拟 Fix-in-Chat 流程',
    success: true,
    timestamp: new Date().toLocaleString(),
    data: {
      message: 'Fix-in-Chat 事件已触发，请检查聊天框是否打开',
      eventDetail: mockEvent.detail
    }
  })
}

/**
 * 获取测试标题
 */
function getTestTitle(action: string): string {
  const titles: Record<string, string> = {
    'health-check': '系统健康检查',
    'test-context-extractor': '上下文提取器测试',
    'test-intent-parse': '意图解析测试',
    'test-content-generate': '内容生成测试',
    'test-diff-preview': '差异预览测试'
  }
  return titles[action] || action
}

/**
 * 清空测试结果
 */
function clearResults() {
  testResults.value = []
}
</script>

<style scoped>
.fix-in-chat-demo {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* 自定义滚动条 */
pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

pre::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

pre::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

pre::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}
</style>
