<template>
  <div class="collapsible-toolbar w-72 h-full bg-c overflow-y-auto">
    <!-- 工具栏头部 -->
    <div class="toolbar-header p-4 border-b border-c bg-gradient-to-r from-purple-50 to-rose-50 dark:from-purple-900/20 dark:to-rose-900/20">
      <h2 class="text-lg font-semibold text-dark-c flex items-center">
        <span class="i-carbon:tools mr-2" />
        可折叠工具栏
      </h2>
      <p class="text-xs text-c mt-1">点击展开需要的工具组</p>
    </div>

    <!-- 可折叠分组 -->
    <div class="accordion-groups">
      <div class="group-item border-b border-c/50">
        <!-- 文档分组 -->
        <button
          @click="documentExpanded = !documentExpanded"
          class="group-header w-full flex items-center justify-between p-4 hover:bg-dark-c/30 transition-colors duration-200"
        >
          <div class="flex items-center space-x-3">
            <span class="i-carbon:document-multiple text-lg text-brand" />
            <div class="text-left">
              <span class="font-medium text-dark-c">文档操作</span>
              <div class="text-xs text-c">文件导入导出、模板管理</div>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-xs bg-brand/20 text-brand px-2 py-1 rounded-full">1</span>
            <span
              :class="[
                'transition-transform duration-200',
                documentExpanded ? 'rotate-180' : 'rotate-0'
              ]"
              class="i-ic:round-keyboard-arrow-down text-c"
            />
          </div>
        </button>

        <div v-show="documentExpanded" class="group-content bg-dark-c/10 border-t border-c/30">
          <div class="p-3">
            <File />
          </div>
        </div>
      </div>

      <div class="group-item border-b border-c/50">
        <!-- 样式分组 -->
        <button
          @click="styleExpanded = !styleExpanded"
          class="group-header w-full flex items-center justify-between p-4 hover:bg-dark-c/30 transition-colors duration-200"
        >
          <div class="flex items-center space-x-3">
            <span class="i-material-symbols:palette-outline text-lg text-brand" />
            <div class="text-left">
              <span class="font-medium text-dark-c">外观样式</span>
              <div class="text-xs text-c">主题、字体、颜色设置</div>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-xs bg-brand/20 text-brand px-2 py-1 rounded-full">3</span>
            <span
              :class="[
                'transition-transform duration-200',
                styleExpanded ? 'rotate-180' : 'rotate-0'
              ]"
              class="i-ic:round-keyboard-arrow-down text-c"
            />
          </div>
        </button>

        <div v-show="styleExpanded" class="group-content bg-dark-c/10 border-t border-c/30">
          <div class="p-3 space-y-3">
            <ThemeColor />
            <FontFamily />
            <FontSize />
          </div>
        </div>
      </div>

      <div class="group-item border-b border-c/50">
        <!-- 布局分组 -->
        <button
          @click="layoutExpanded = !layoutExpanded"
          class="group-header w-full flex items-center justify-between p-4 hover:bg-dark-c/30 transition-colors duration-200"
        >
          <div class="flex items-center space-x-3">
            <span class="i-carbon:layout text-lg text-brand" />
            <div class="text-left">
              <span class="font-medium text-dark-c">页面布局</span>
              <div class="text-xs text-c">页面设置、边距、间距</div>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-xs bg-brand/20 text-brand px-2 py-1 rounded-full">4</span>
            <span
              :class="[
                'transition-transform duration-200',
                layoutExpanded ? 'rotate-180' : 'rotate-0'
              ]"
              class="i-ic:round-keyboard-arrow-down text-c"
            />
          </div>
        </button>

        <div v-show="layoutExpanded" class="group-content bg-dark-c/10 border-t border-c/30">
          <div class="p-3 space-y-3">
            <Paper />
            <Margins />
            <ParagraphSpace />
            <LineHeight />
          </div>
        </div>
      </div>

      <div class="group-item">
        <!-- 工具分组 -->
        <button
          @click="toolsExpanded = !toolsExpanded"
          class="group-header w-full flex items-center justify-between p-4 hover:bg-dark-c/30 transition-colors duration-200"
        >
          <div class="flex items-center space-x-3">
            <span class="i-carbon:ai-results text-lg text-brand" />
            <div class="text-left">
              <span class="font-medium text-dark-c">智能工具</span>
              <div class="text-xs text-c">AI助手、格式检查</div>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-xs bg-brand/20 text-brand px-2 py-1 rounded-full">1</span>
            <span
              :class="[
                'transition-transform duration-200',
                toolsExpanded ? 'rotate-180' : 'rotate-0'
              ]"
              class="i-ic:round-keyboard-arrow-down text-c"
            />
          </div>
        </button>

        <div v-show="toolsExpanded" class="group-content bg-dark-c/10 border-t border-c/30">
          <div class="p-3">
            <CorrectCase />
          </div>
        </div>
      </div>
    </div>

    <!-- 快速操作区 -->
    <div class="quick-actions p-4 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-900/10 dark:to-cyan-900/10">
      <h3 class="text-sm font-medium text-dark-c mb-3 flex items-center">
        <span class="i-carbon:flash mr-2" />
        快速操作
      </h3>
      <div class="flex flex-wrap gap-2">
        <button class="quick-btn" @click="expandAll">
          <span class="i-carbon:expand-all mr-1" />
          全部展开
        </button>
        <button class="quick-btn" @click="collapseAll">
          <span class="i-carbon:collapse-all mr-1" />
          全部收起
        </button>
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

const documentExpanded = ref(true)
const styleExpanded = ref(false)
const layoutExpanded = ref(false)
const toolsExpanded = ref(false)

const expandAll = () => {
  documentExpanded.value = true
  styleExpanded.value = true
  layoutExpanded.value = true
  toolsExpanded.value = true
}

const collapseAll = () => {
  documentExpanded.value = false
  styleExpanded.value = false
  layoutExpanded.value = false
  toolsExpanded.value = false
}
</script>

<style scoped>
.collapsible-toolbar::-webkit-scrollbar {
  width: 6px;
}

.collapsible-toolbar::-webkit-scrollbar-track {
  background: transparent;
}

.collapsible-toolbar::-webkit-scrollbar-thumb {
  background: var(--un-c-border-c);
  border-radius: 3px;
}

.group-header:active {
  transform: scale(0.98);
}

.quick-btn {
  @apply text-xs px-3 py-1.5 bg-white/70 dark:bg-slate-700/70 border border-c/50 rounded-lg;
  @apply hover:bg-white dark:hover:bg-slate-600 transition-colors duration-200;
  @apply flex items-center text-c hover:text-dark-c;
}

.group-content {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
