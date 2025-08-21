<template>
  <div class="vertical-tabs-toolbar flex h-full w-64 bg-c border-r border-c">
    <!-- 左侧标签导航 -->
    <div class="tabs-nav flex flex-col w-12 bg-darker-c border-r border-c">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'tab-btn flex-center flex-col p-2 text-xs transition-all duration-200',
          activeTab === tab.id
            ? 'bg-brand text-white shadow-md'
            : 'text-c hover:bg-dark-c hover:text-dark-c'
        ]"
        :title="tab.label"
      >
        <span :class="tab.icon" class="text-lg mb-1" />
        <span class="leading-tight">{{ tab.shortLabel }}</span>
      </button>
    </div>

    <!-- 右侧内容区域 -->
    <div class="tab-content flex-1 overflow-y-auto">
      <div class="p-3">
        <h3 class="text-sm font-medium text-dark-c mb-3 flex items-center">
          <span :class="currentTab.icon" class="mr-2" />
          {{ currentTab.label }}
        </h3>
        
        <!-- 动态内容区域 -->
        <div class="space-y-3">
          <div v-if="activeTab === 'document'">
            <File />
          </div>
          <div v-else-if="activeTab === 'style'" class="space-y-6">
            <ThemeColor />
            <FontFamily />
            <FontSize />
          </div>
          <div v-else-if="activeTab === 'layout'" class="space-y-6">
            <Paper />
            <Margins />
            <ParagraphSpace />
            <LineHeight />
          </div>
          <div v-else-if="activeTab === 'tools'">
            <CorrectCase />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import File from './toolbar/File.vue'
import Paper from './toolbar/Paper.vue'
import ThemeColor from './toolbar/ThemeColor.vue'
import FontFamily from './toolbar/FontFamily.vue'
import FontSize from './toolbar/FontSize.vue'
import Margins from './toolbar/Margins.vue'
import ParagraphSpace from './toolbar/ParagraphSpace.vue'
import LineHeight from './toolbar/LineHeight.vue'
import CorrectCase from './toolbar/CorrectCase.vue'

const activeTab = ref('document')

const tabs = [
  {
    id: 'document',
    label: '文档管理',
    shortLabel: '文档',
    icon: 'i-carbon:document'
  },
  {
    id: 'style',
    label: '样式设计',
    shortLabel: '样式',
    icon: 'i-material-symbols:palette-outline'
  },
  {
    id: 'layout',
    label: '页面布局',
    shortLabel: '布局',
    icon: 'i-majesticons:paper-fold-line'
  },
  {
    id: 'tools',
    label: '编辑工具',
    shortLabel: '工具',
    icon: 'i-carbon:tools'
  }
]

const currentTab = computed(() => tabs.find(tab => tab.id === activeTab.value) || tabs[0])
</script>

<style scoped>
.tab-btn {
  min-height: 64px;
  border-bottom: 1px solid var(--un-c-border-c);
}

.tab-btn:last-child {
  border-bottom: none;
}

.tab-content {
  background: linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(255,255,255,0));
}

.tab-content::-webkit-scrollbar {
  width: 4px;
}

.tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.tab-content::-webkit-scrollbar-thumb {
  background: var(--un-c-border-c);
  border-radius: 2px;
}
</style>
