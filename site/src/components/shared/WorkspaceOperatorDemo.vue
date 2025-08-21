<!--
  工作区AI操作功能演示组件
  展示新增的AI对话操作工作区功能
-->
<template>
  <div class="workspace-operator-demo p-6 bg-c border border-c/30 rounded-lg">
    <h3 class="text-lg font-bold mb-4">🤖 AI工作区操作功能演示</h3>
    
    <!-- 功能介绍 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">✨ 新功能特性</h4>
      <ul class="space-y-1 text-sm text-light-c">
        <li>• <strong>智能对话操作</strong>：通过自然语言与AI对话操作工作区</li>
        <li>• <strong>异步操作队列</strong>：支持多个AI操作并发执行</li>
        <li>• <strong>键鼠锁定机制</strong>：AI操作时自动锁定键鼠，保证操作准确性</li>
        <li>• <strong>操作状态管理</strong>：实时显示操作进度和状态</li>
        <li>• <strong>智能需求解析</strong>：自动识别工作区操作意图</li>
      </ul>
    </div>
    
    <!-- 支持的操作命令 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">🎯 支持的操作命令</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="font-medium text-sm">编辑操作</div>
          <div class="space-y-1 text-xs text-light-c">
            <div>"编辑这段文字"</div>
            <div>"修改选中的内容"</div>
            <div>"重写这一段"</div>
            <div>"润色这段话"</div>
          </div>
        </div>
        
        <div class="space-y-2">
          <div class="font-medium text-sm">格式化操作</div>
          <div class="space-y-1 text-xs text-light-c">
            <div>"格式化这段代码"</div>
            <div>"把这段文字加粗"</div>
            <div>"设为标题"</div>
            <div>"转为列表"</div>
          </div>
        </div>
        
        <div class="space-y-2">
          <div class="font-medium text-sm">生成操作</div>
          <div class="space-y-1 text-xs text-light-c">
            <div>"生成一段介绍"</div>
            <div>"续写这段话"</div>
            <div>"补充内容"</div>
            <div>"扩展这个观点"</div>
          </div>
        </div>
        
        <div class="space-y-2">
          <div class="font-medium text-sm">分析操作</div>
          <div class="space-y-1 text-xs text-light-c">
            <div>"分析这段文字"</div>
            <div>"检查语法错误"</div>
            <div>"统计字数"</div>
            <div>"评估内容质量"</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 使用步骤 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">📝 使用步骤</h4>
      <ol class="space-y-2 text-sm text-light-c">
        <li><span class="font-medium text-c">1.</span> 在编辑器中选中要操作的文本（可选）</li>
        <li><span class="font-medium text-c">2.</span> 点击聊天机器人图标打开对话面板</li>
        <li><span class="font-medium text-c">3.</span> 用自然语言描述你想要的操作</li>
        <li><span class="font-medium text-c">4.</span> AI会自动识别操作意图并执行</li>
        <li><span class="font-medium text-c">5.</span> 操作期间键鼠会被锁定，确保操作准确</li>
        <li><span class="font-medium text-c">6.</span> 查看右上角状态指示器了解操作进度</li>
      </ol>
    </div>
    
    <!-- 演示区域 -->
    <div class="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
      <h4 class="font-medium mb-2">🎮 在线演示</h4>
      <div class="space-y-3">
        <div>
          <label class="text-sm font-medium">选择演示命令：</label>
          <select v-model="selectedDemo" class="ml-2 px-2 py-1 border border-c/30 rounded text-sm">
            <option value="">请选择...</option>
            <option v-for="demo in demoCommands" :key="demo.command" :value="demo.command">
              {{ demo.command }}
            </option>
          </select>
        </div>
        
        <div v-if="selectedDemo">
          <div class="text-sm">
            <strong>命令:</strong> {{ selectedDemo }}<br>
            <strong>预期操作:</strong> {{ getDemoDescription(selectedDemo) }}<br>
            <strong>置信度:</strong> {{ getDemoConfidence(selectedDemo) }}%
          </div>
        </div>
        
        <button @click="testCommand" :disabled="!selectedDemo" class="px-4 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50">
          测试命令解析
        </button>
        
        <div v-if="parseResult" class="text-xs p-2 bg-white dark:bg-slate-600 rounded border">
          <strong>解析结果:</strong>
          <pre>{{ JSON.stringify(parseResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
    
    <!-- 当前状态 -->
    <div class="mb-4">
      <h4 class="font-medium mb-2">📊 当前工作区状态</h4>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="text-light-c">AI助手状态:</div>
          <div :class="workspaceState.aiAssistantActive ? 'text-green-600' : 'text-gray-500'">
            {{ workspaceState.aiAssistantActive ? '已激活' : '未激活' }}
          </div>
        </div>
        <div>
          <div class="text-light-c">锁定状态:</div>
          <div :class="workspaceState.isLocked ? 'text-orange-600' : 'text-green-600'">
            {{ workspaceState.isLocked ? '已锁定' : '正常' }}
          </div>
        </div>
        <div>
          <div class="text-light-c">运行中操作:</div>
          <div>{{ runningOperations.length }}</div>
        </div>
        <div>
          <div class="text-light-c">操作成功率:</div>
          <div>{{ stats.successRate }}%</div>
        </div>
      </div>
    </div>
    
    <!-- 操作历史 -->
    <div v-if="recentOperations.length > 0">
      <h4 class="font-medium mb-2">📋 最近操作 ({{ recentOperations.length }})</h4>
      <div class="space-y-2 max-h-40 overflow-y-auto">
        <div v-for="op in recentOperations.slice(0, 5)" :key="op.id" 
             class="text-xs p-2 border border-c/20 rounded flex items-center justify-between">
          <div class="flex-1">
            <div class="font-medium">{{ op.description }}</div>
            <div class="text-light-c">{{ formatTime(op.createdAt) }}</div>
          </div>
          <div class="flex items-center space-x-2">
            <span :class="getStatusColor(op.status)" class="text-xs px-2 py-1 rounded">
              {{ getStatusText(op.status) }}
            </span>
            <button v-if="op.status === 'running'" @click="cancelOperation(op.id)" 
                    class="text-red-500 hover:text-red-700" title="取消操作">
              <span class="i-ph:x-circle-duotone"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '~/composables/stores/workspace'
import { useAiRequirementParser } from '~/composables/aiRequirementParser'
import { OperationStatus } from '~/composables/workspaceOperator'

const workspaceStore = useWorkspaceStore()
const parser = useAiRequirementParser()

// 计算属性
const workspaceState = computed(() => workspaceStore.state)
const runningOperations = computed(() => workspaceStore.runningOperations)
const stats = computed(() => workspaceStore.getWorkspaceStats())
const recentOperations = computed(() => workspaceStore.state.recentOperations)

// 演示数据
const selectedDemo = ref('')
const parseResult = ref(null)

const demoCommands = [
  { command: '编辑这段文字，让它更专业', description: '编辑选中文本，提升专业度' },
  { command: '把这段话设为标题', description: '将选中文本格式化为标题' },
  { command: '生成一段关于人工智能的介绍', description: '在文档中生成新内容' },
  { command: '分析这段文字的语法错误', description: '分析选中文本的语法问题' },
  { command: '翻译成英文', description: '将选中文本翻译为英文' },
  { command: '续写这段话', description: '基于选中文本继续写作' },
  { command: '格式化代码', description: '格式化选中的代码块' },
  { command: '删除这段内容', description: '删除选中的文本' }
]

// 方法
const getDemoDescription = (command: string) => {
  const demo = demoCommands.find(d => d.command === command)
  return demo?.description || ''
}

const getDemoConfidence = (command: string) => {
  const parsed = parser.parse(command)
  return Math.round(parsed.confidence * 100)
}

const testCommand = () => {
  if (!selectedDemo.value) return
  
  const result = parser.parse(selectedDemo.value)
  parseResult.value = result
}

const cancelOperation = (operationId: string) => {
  workspaceStore.cancelOperation(operationId)
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const getStatusText = (status: OperationStatus) => {
  const statusMap = {
    [OperationStatus.PENDING]: '等待中',
    [OperationStatus.RUNNING]: '执行中',
    [OperationStatus.COMPLETED]: '已完成',
    [OperationStatus.FAILED]: '失败',
    [OperationStatus.CANCELLED]: '已取消'
  }
  return statusMap[status] || status
}

const getStatusColor = (status: OperationStatus) => {
  const colorMap = {
    [OperationStatus.PENDING]: 'bg-gray-100 text-gray-800',
    [OperationStatus.RUNNING]: 'bg-blue-100 text-blue-800',
    [OperationStatus.COMPLETED]: 'bg-green-100 text-green-800',
    [OperationStatus.FAILED]: 'bg-red-100 text-red-800',
    [OperationStatus.CANCELLED]: 'bg-orange-100 text-orange-800'
  }
  return colorMap[status] || 'bg-gray-100 text-gray-800'
}
</script>

<style scoped>
pre {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  overflow-x: auto;
}
</style>
