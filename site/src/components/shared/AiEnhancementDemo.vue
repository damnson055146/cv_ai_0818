<!--
  AI增强功能演示组件
  展示Ask/Edit模式切换和智能编辑功能
-->
<template>
  <div class="ai-enhancement-demo p-6 bg-c border border-c/30 rounded-lg">
    <h3 class="text-lg font-bold mb-4">🚀 AI增强功能演示</h3>
    
    <!-- 功能介绍 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">✨ 新增功能</h4>
      <ul class="space-y-1 text-sm text-light-c">
        <li>• <strong>双模式切换</strong>：Ask问答模式 + Edit编辑模式</li>
        <li>• <strong>小LLM识别</strong>：无选中文本时智能识别操作范围</li>
        <li>• <strong>双LLM协作</strong>：硅基流动小模型 + OpenAI大模型</li>
        <li>• <strong>智能编辑</strong>：全文/段落/标题级别的精确操作</li>
      </ul>
    </div>
    
    <!-- 模式说明 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">🎛️ 模式说明</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-3 border border-c/20 rounded">
          <div class="flex items-center space-x-2 mb-2">
            <span class="i-ph:chat-duotone text-blue-500"></span>
            <strong class="text-sm">Ask 问答模式</strong>
          </div>
          <div class="text-xs text-light-c">
            直接与AI对话，获取答案和建议，不会修改文档内容
          </div>
          <div class="text-xs text-green-600 mt-1">
            示例：什么是人工智能？
          </div>
        </div>
        
        <div class="p-3 border border-c/20 rounded">
          <div class="flex items-center space-x-2 mb-2">
            <span class="i-ph:pencil-duotone text-orange-500"></span>
            <strong class="text-sm">Edit 编辑模式</strong>
          </div>
          <div class="text-xs text-light-c">
            AI会分析并修改文档内容，支持选中编辑和全文智能编辑
          </div>
          <div class="text-xs text-green-600 mt-1">
            示例：把这篇文章翻译成英文
          </div>
        </div>
      </div>
    </div>
    
    <!-- 智能编辑范围 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">🧠 智能编辑范围识别</h4>
      <div class="space-y-2">
        <div class="text-sm">当无选中文本时，小LLM会分析以下操作范围：</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">全文编辑</div>
          <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded">段落修改</div>
          <div class="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">标题调整</div>
          <div class="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">列表格式</div>
        </div>
      </div>
    </div>
    
    <!-- 使用流程 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">📋 使用流程</h4>
      <ol class="space-y-2 text-sm text-light-c">
        <li><span class="font-medium text-c">1.</span> 点击聊天机器人图标打开AI助手</li>
        <li><span class="font-medium text-c">2.</span> 选择模式：Ask（问答）或 Edit（编辑）</li>
        <li><span class="font-medium text-c">3.</span> 输入指令或问题</li>
        <li><span class="font-medium text-c">4.</span> Edit模式下：
          <ul class="ml-4 mt-1 space-y-1">
            <li>• 有选中文本：直接编辑选中内容</li>
            <li>• 无选中文本：小LLM分析范围 → 大LLM执行编辑</li>
          </ul>
        </li>
      </ol>
    </div>
    
    <!-- API配置说明 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">⚙️ API配置</h4>
      <div class="p-3 bg-gray-50 dark:bg-slate-700 rounded text-xs">
        <div class="space-y-1">
          <div><strong>硅基流动API</strong>：用于快速意图识别（小模型）</div>
          <div class="text-light-c">端点：/api/siliconflow</div>
          <div class="text-light-c">模型：Qwen/Qwen2.5-7B-Instruct（默认）</div>
          <div class="text-light-c">用途：分析操作范围和意图</div>
          <div class="mt-2"><strong>OpenAI API</strong>：用于具体内容生成（大模型）</div>
          <div class="text-light-c">端点：/api/ai</div>
          <div class="text-light-c">模型：o3/GPT系列</div>
          <div class="text-light-c">用途：执行实际的文本编辑操作</div>
        </div>
      </div>
    </div>
    
    <!-- 示例命令 -->
    <div class="mb-6">
      <h4 class="font-medium mb-2">💡 示例命令</h4>
      <div class="space-y-3">
        <div>
          <div class="text-sm font-medium">Ask模式示例：</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">"什么是机器学习？"</div>
            <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">"如何提高写作水平？"</div>
          </div>
        </div>
        
        <div>
          <div class="text-sm font-medium">Edit模式示例：</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
            <div class="p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs">"把整篇文档翻译成英文"</div>
            <div class="p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs">"修改所有标题格式"</div>
            <div class="p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs">"润色第二段内容"</div>
            <div class="p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs">"在文档开头添加摘要"</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 技术架构 -->
    <div class="mb-4">
      <h4 class="font-medium mb-2">🏗️ 技术架构</h4>
      <div class="text-xs space-y-1 text-light-c">
        <div><strong>前端：</strong> Vue 3 + Nuxt 3 + Monaco Editor</div>
        <div><strong>后端：</strong> Nuxt Server API + 代理转发</div>
        <div><strong>AI服务：</strong> 硅基流动（小模型识别）+ OpenAI（大模型执行）</div>
        <div><strong>状态管理：</strong> Pinia + 事件驱动架构</div>
        <div><strong>工作流：</strong> 双LLM协作 + 异步操作队列</div>
      </div>
    </div>
    
    <!-- 当前状态 -->
    <div class="border-t border-c/20 pt-4">
      <div class="text-sm font-medium mb-2">📊 当前系统状态</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div class="text-light-c">AI助手</div>
          <div :class="workspaceState.aiAssistantActive ? 'text-green-600' : 'text-gray-500'">
            {{ workspaceState.aiAssistantActive ? '已激活' : '未激活' }}
          </div>
        </div>
        <div>
          <div class="text-light-c">模式</div>
          <div class="text-blue-600">{{ getCurrentMode() }}</div>
        </div>
        <div>
          <div class="text-light-c">锁定状态</div>
          <div :class="workspaceState.isLocked ? 'text-orange-600' : 'text-green-600'">
            {{ workspaceState.isLocked ? '已锁定' : '正常' }}
          </div>
        </div>
        <div>
          <div class="text-light-c">操作队列</div>
          <div>{{ runningOperations.length }} 个运行中</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '~/composables/stores/workspace'
import { useLocalStorage } from '@vueuse/core'

const workspaceStore = useWorkspaceStore()

// 获取当前模式
const currentMode = useLocalStorage<'ask' | 'edit'>('chatbot.mode', 'edit')

// 计算属性
const workspaceState = computed(() => workspaceStore.state)
const runningOperations = computed(() => workspaceStore.runningOperations)

// 方法
const getCurrentMode = () => {
  return currentMode.value === 'ask' ? 'Ask 问答模式' : 'Edit 编辑模式'
}
</script>

<style scoped>
.ai-enhancement-demo {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
