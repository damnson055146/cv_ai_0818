<template>
  <div class="floating-toolbar relative w-16 h-full">
    <!-- 主控制栏 -->
    <div class="main-dock fixed right-0 top-1/2 transform -translate-y-1/2 z-40">
      <div class="dock-container bg-c/90 backdrop-blur-md border border-c/60 rounded-2xl shadow-2xl p-2">
        <div class="flex flex-col space-y-3">
          <button
            v-for="panel in panels"
            :key="panel.id"
            @click="togglePanel(panel.id)"
            :class="[
              'dock-btn relative group',
              activePanels.has(panel.id) ? 'active' : ''
            ]"
            :title="panel.label"
          >
            <span :class="panel.icon" class="text-xl" />
            <div class="tooltip absolute right-full mr-3 top-1/2 transform -translate-y-1/2 bg-dark-c text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              {{ panel.label }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 浮动面板 -->
    <div
      v-for="panel in panels"
      :key="`panel-${panel.id}`"
      v-show="activePanels.has(panel.id)"
      :class="[
        'floating-panel fixed z-30 bg-c/95 backdrop-blur-lg border border-c/40 rounded-2xl shadow-2xl',
        'transform transition-all duration-300 ease-out',
        activePanels.has(panel.id) ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      ]"
      :style="getPanelPosition(panel.id)"
    >
      <!-- 面板头部 -->
      <div class="panel-header flex items-center justify-between p-4 border-b border-c/30">
        <div class="flex items-center space-x-3">
          <span :class="panel.icon" class="text-lg text-brand" />
          <h3 class="font-semibold text-dark-c">{{ panel.label }}</h3>
        </div>
        <div class="flex items-center space-x-2">
          <button
            @click="minimizePanel(panel.id)"
            class="panel-control-btn"
            title="最小化"
          >
            <span class="i-carbon:minimize" />
          </button>
          <button
            @click="closePanel(panel.id)"
            class="panel-control-btn"
            title="关闭"
          >
            <span class="i-carbon:close" />
          </button>
        </div>
      </div>

      <!-- 面板内容 -->
      <div class="panel-content p-4 max-h-96 overflow-y-auto">
        <div v-if="panel.id === 'document'">
          <File />
        </div>
        <div v-else-if="panel.id === 'style'" class="space-y-4">
          <ThemeColor />
          <FontFamily />
          <FontSize />
        </div>
        <div v-else-if="panel.id === 'layout'" class="space-y-4">
          <Paper />
          <Margins />
          <ParagraphSpace />
          <LineHeight />
        </div>
        <div v-else-if="panel.id === 'ai'">
          <CorrectCase />
        </div>
      </div>

      <!-- 拖拽手柄 -->
      <div
        class="drag-handle absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-c rounded-full cursor-move opacity-50 hover:opacity-100 transition-opacity"
        @mousedown="startDrag(panel.id, $event)"
      />
    </div>

    <!-- 快速工具浮动球 -->
    <div class="quick-tools fixed bottom-6 right-6 z-50">
      <div
        class="quick-ball w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-lg cursor-pointer flex-center text-white hover:scale-110 transition-transform duration-200"
        @click="showQuickMenu = !showQuickMenu"
      >
        <span class="i-carbon:flash text-xl" />
      </div>
      
      <!-- 快速菜单 -->
      <div
        v-show="showQuickMenu"
        class="quick-menu absolute bottom-16 right-0 bg-c/95 backdrop-blur-md border border-c/60 rounded-xl shadow-xl p-2 w-48"
      >
        <div class="space-y-1">
          <button class="quick-menu-item" @click="openAllPanels">
            <span class="i-carbon:grid mr-2" />
            显示所有面板
          </button>
          <button class="quick-menu-item" @click="closeAllPanels">
            <span class="i-carbon:close-outline mr-2" />
            关闭所有面板
          </button>
          <button class="quick-menu-item" @click="resetPanelPositions">
            <span class="i-carbon:reset mr-2" />
            重置面板位置
          </button>
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

const activePanels = ref(new Set())
const showQuickMenu = ref(false)
const panelPositions = ref(new Map())
const isDragging = ref(false)

const panels = [
  {
    id: 'document',
    label: '文档管理',
    icon: 'i-carbon:document-multiple',
    defaultPosition: { top: '10%', right: '80px' }
  },
  {
    id: 'style',
    label: '样式设计',
    icon: 'i-material-symbols:palette-outline',
    defaultPosition: { top: '25%', right: '80px' }
  },
  {
    id: 'layout',
    label: '页面布局',
    icon: 'i-carbon:layout',
    defaultPosition: { top: '40%', right: '80px' }
  },
  {
    id: 'ai',
    label: 'AI 助手',
    icon: 'i-carbon:ai-results',
    defaultPosition: { top: '55%', right: '80px' }
  }
]

const togglePanel = (panelId) => {
  const newActivePanels = new Set(activePanels.value)
  if (newActivePanels.has(panelId)) {
    newActivePanels.delete(panelId)
  } else {
    newActivePanels.add(panelId)
  }
  activePanels.value = newActivePanels
}

const closePanel = (panelId) => {
  const newActivePanels = new Set(activePanels.value)
  newActivePanels.delete(panelId)
  activePanels.value = newActivePanels
}

const minimizePanel = (panelId) => {
  closePanel(panelId)
}

const getPanelPosition = (panelId) => {
  const savedPosition = panelPositions.value.get(panelId)
  const panel = panels.find(p => p.id === panelId)
  const position = savedPosition || panel?.defaultPosition || { top: '20%', right: '80px' }
  
  return {
    top: position.top,
    right: position.right,
    width: '320px'
  }
}

const openAllPanels = () => {
  activePanels.value = new Set(panels.map(p => p.id))
  showQuickMenu.value = false
}

const closeAllPanels = () => {
  activePanels.value = new Set()
  showQuickMenu.value = false
}

const resetPanelPositions = () => {
  panelPositions.value.clear()
  showQuickMenu.value = false
}

const startDrag = (panelId, event) => {
  isDragging.value = true
  const startY = event.clientY
  const startPos = panelPositions.value.get(panelId) || panels.find(p => p.id === panelId)?.defaultPosition || { top: '20%', right: '80px' }
  const startTop = parseInt(startPos.top.replace('%', ''))

  const onMouseMove = (e) => {
    const deltaY = e.clientY - startY
    const newTop = Math.max(0, Math.min(80, startTop + (deltaY / window.innerHeight) * 100))
    
    panelPositions.value.set(panelId, {
      ...startPos,
      top: `${newTop}%`
    })
  }

  const onMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// 点击外部关闭快速菜单
onMounted(() => {
  const closeQuickMenu = (e) => {
    const target = e.target
    if (!target.closest('.quick-tools')) {
      showQuickMenu.value = false
    }
  }
  document.addEventListener('click', closeQuickMenu)
  
  onBeforeUnmount(() => {
    document.removeEventListener('click', closeQuickMenu)
  })
})
</script>

<style scoped>
.dock-btn {
  @apply w-12 h-12 rounded-xl bg-c/50 hover:bg-brand/20 border border-c/30;
  @apply flex-center transition-all duration-200 cursor-pointer;
  @apply hover:scale-110 hover:shadow-lg;
}

.dock-btn.active {
  @apply bg-brand text-white shadow-lg scale-105;
}

.floating-panel {
  min-width: 280px;
  max-width: 400px;
  min-height: 200px;
  max-height: 500px;
}

.panel-control-btn {
  @apply w-6 h-6 rounded-lg bg-c/50 hover:bg-red-500/20 flex-center;
  @apply transition-colors duration-200 text-c hover:text-red-500;
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--un-c-border-c);
  border-radius: 2px;
}

.quick-menu-item {
  @apply w-full flex items-center px-3 py-2 text-sm text-c hover:text-dark-c;
  @apply hover:bg-dark-c/20 rounded-lg transition-colors duration-200;
}

.tooltip {
  font-size: 11px;
  z-index: 1000;
}

/* 面板出现动画 */
.floating-panel {
  animation: panelSlideIn 0.3s ease-out;
}

@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateX(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

/* 拖拽时的样式 */
.floating-panel:active .drag-handle {
  background: var(--un-c-brand);
}
</style>
