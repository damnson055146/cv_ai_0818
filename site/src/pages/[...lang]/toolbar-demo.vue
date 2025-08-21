<template>
  <div class="toolbar-demo-page h-screen bg-gray-50 dark:bg-slate-900">
    <!-- 头部导航 -->
    <div class="demo-header bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <span class="i-carbon:toolbar mr-3 text-purple-500" />
          工具栏方案演示
        </h1>
        
        <!-- 方案切换器 -->
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-600 dark:text-gray-300">选择方案:</span>
          <div class="flex space-x-2">
            <button
              v-for="scheme in schemes"
              :key="scheme.id"
              @click="currentScheme = scheme.id"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                currentScheme === scheme.id
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              ]"
            >
              <span :class="scheme.icon" class="mr-2" />
              {{ scheme.name }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- 当前方案描述 -->
      <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div class="flex items-start space-x-3">
          <span :class="currentSchemeData.icon" class="text-lg text-blue-500 mt-0.5" />
          <div>
            <h3 class="font-semibold text-blue-900 dark:text-blue-100">{{ currentSchemeData.name }}</h3>
            <p class="text-sm text-blue-700 dark:text-blue-200 mt-1">{{ currentSchemeData.description }}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span
                v-for="feature in currentSchemeData.features"
                :key="feature"
                class="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs rounded-full"
              >
                {{ feature }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 演示区域 -->
    <div class="demo-workspace flex h-full">
      <!-- 模拟编辑器区域 -->
      <div class="flex-1 flex">
        <div class="editor-mock flex-1 bg-white dark:bg-slate-800 m-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div class="editor-header bg-gray-50 dark:bg-slate-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600 rounded-t-xl">
            <div class="flex items-center space-x-2">
              <div class="flex space-x-1">
                <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div class="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <span class="text-sm text-gray-600 dark:text-gray-300 ml-4">简历编辑器 - 演示模式</span>
            </div>
          </div>
          
          <div class="editor-content p-6 h-full overflow-auto">
            <div class="space-y-4">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white"># 张三的简历</h2>
              <p class="text-gray-600 dark:text-gray-300">这是一个演示编辑器，用于展示不同的工具栏方案效果。</p>
              
              <div class="bg-gray-100 dark:bg-slate-700 p-4 rounded-lg">
                <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">个人信息</h3>
                <ul class="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>📧 zhangsan@example.com</li>
                  <li>📱 +86 138-0013-8000</li>
                  <li>🏠 北京市朝阳区</li>
                </ul>
              </div>
              
              <div class="bg-gray-100 dark:bg-slate-700 p-4 rounded-lg">
                <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">工作经验</h3>
                <div class="text-sm text-gray-600 dark:text-gray-300">
                  <p class="font-medium">高级前端工程师 - ABC科技公司</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">2020.01 - 至今</p>
                  <p class="mt-1">负责公司主要产品的前端开发，使用Vue.js和TypeScript...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 工具栏区域 -->
      <div class="toolbar-area">
        <component
          :is="currentSchemeComponent"
          :key="currentScheme"
          class="toolbar-demo-instance"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import ToolbarScheme1 from '~/components/edit/ToolbarScheme1.vue'
import ToolbarScheme2 from '~/components/edit/ToolbarScheme2.vue'
import ToolbarScheme3 from '~/components/edit/ToolbarScheme3.vue'

const currentScheme = ref('scheme1')

const schemes = [
  {
    id: 'scheme1',
    name: '垂直标签卡',
    icon: 'i-carbon:tabs',
    description: '类似IDE的垂直标签卡设计，左侧为功能图标导航，右侧为对应内容区域。适合功能较多需要清晰分类的应用。',
    features: ['IDE风格', '功能分组', '减少滚动', '熟悉界面'],
    component: ToolbarScheme1
  },
  {
    id: 'scheme2',
    name: '可折叠分组',
    icon: 'i-carbon:accordion-horizontal',
    description: '手风琴式折叠面板设计，每组可独立展开/收起。适合空间受限，需要灵活展开收起的界面。',
    features: ['节省空间', '分组折叠', '功能计数', '快速操作'],
    component: ToolbarScheme2
  },
  {
    id: 'scheme3',
    name: '浮动面板',
    icon: 'i-carbon:floating-ip',
    description: '现代化浮动面板设计，支持拖拽调整位置，毛玻璃效果。适合追求现代化设计的应用。',
    features: ['毛玻璃效果', '可拖拽', '按需显示', '现代设计'],
    component: ToolbarScheme3
  }
]

const currentSchemeData = computed(() => {
  return schemes.find(s => s.id === currentScheme.value) || schemes[0]
})

const currentSchemeComponent = computed(() => {
  return currentSchemeData.value.component
})

// 设置页面标题
useHead({
  title: '工具栏方案演示 - Markdown Resume'
})
</script>

<style scoped>
.toolbar-demo-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.demo-workspace {
  height: calc(100vh - 140px);
}

.toolbar-area {
  background: linear-gradient(135deg, rgba(139, 69, 19, 0.1), rgba(160, 82, 45, 0.1));
  border-left: 1px solid rgba(139, 69, 19, 0.2);
}

.toolbar-demo-instance {
  height: 100%;
}

.editor-mock {
  max-height: calc(100vh - 180px);
}

.editor-content {
  max-height: calc(100vh - 240px);
}

/* 为不同方案添加特殊样式 */
.toolbar-area :deep(.floating-toolbar) {
  width: 100%;
  position: relative;
}

.toolbar-area :deep(.main-dock) {
  position: absolute;
  right: 20px;
  transform: translateY(-50%);
}

.toolbar-area :deep(.floating-panel) {
  position: absolute;
}
</style>
