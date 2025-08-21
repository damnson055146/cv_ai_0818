<template>
  <div class="floating-tools-sidebar relative w-14 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-r border-c">
    <!-- 主工具栏 -->
    <div class="main-tools flex flex-col items-center py-3 space-y-2">
      <!-- 快速格式工具 -->
      <div class="quick-tools bg-white dark:bg-slate-700 rounded-lg p-2 shadow-sm border border-c/50">
        <div class="grid grid-cols-2 gap-1">
          <button class="quick-tool-btn" :class="{ active: state.bold }" title="Bold **" @click="$emit('toggle-bold')">
            <span class="i-material-symbols:format-bold text-sm" />
          </button>
          <button class="quick-tool-btn" :class="{ active: state.italic }" title="Italic *" @click="$emit('toggle-italic')">
            <span class="i-material-symbols:format-italic text-sm" />
          </button>
          <button class="quick-tool-btn" :class="{ active: state.ul }" title="List" @click="$emit('toggle-list')">
            <span class="i-material-symbols:format-list-bulleted text-sm" />
          </button>
          <button class="quick-tool-btn" :class="{ active: state.link }" title="Link" @click="promptLink">
            <span class="i-material-symbols:link text-sm" />
          </button>
        </div>
      </div>

      <!-- 工具分组按钮 -->
      <div class="tool-groups space-y-2">
        <button
          v-for="group in toolGroups"
          :key="group.id"
          @click="togglePanel(group.id)"
          :class="[
            'group-btn w-10 h-10 rounded-xl shadow-md transition-all duration-300',
            activePanels.has(group.id)
              ? 'bg-brand text-white shadow-lg scale-105'
              : 'bg-white dark:bg-slate-700 text-c hover:bg-brand/20 hover:scale-105'
          ]"
          :title="group.label"
        >
          <span :class="group.icon" class="text-lg" />
        </button>
      </div>
    </div>

    <!-- 浮动面板 -->
    <div
      v-for="group in toolGroups"
      :key="`panel-${group.id}`"
      v-show="activePanels.has(group.id)"
      class="floating-panel fixed z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg border border-c/40 rounded-2xl shadow-2xl p-4"
      :style="getPanelStyle(group.id)"
    >
      <!-- 面板头部 -->
      <div class="panel-header flex items-center justify-between mb-4">
        <h3 class="font-semibold text-dark-c flex items-center">
          <span :class="group.icon" class="mr-2" />
          {{ group.label }}
        </h3>
        <button
          @click="closePanel(group.id)"
          class="close-btn w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/30 flex-center text-red-500 transition-colors"
        >
          <span class="i-carbon:close text-sm" />
        </button>
      </div>

      <!-- 面板内容 -->
      <div class="panel-content">
        <!-- 标题工具 -->
        <div v-if="group.id === 'headings'" class="space-y-3">
          <div class="tool-section">
            <h4 class="section-title">标题层级</h4>
            <div class="flex space-x-2">
              <button class="heading-btn" :class="{ active: state.h1 }" @click="$emit('toggle-h1')">H1</button>
              <button class="heading-btn" :class="{ active: state.h2 }" @click="$emit('toggle-h2')">H2</button>
              <button class="heading-btn" :class="{ active: state.h3 }" @click="$emit('toggle-h3')">H3</button>
            </div>
          </div>
          <div class="tool-section">
            <h4 class="section-title">文本样式</h4>
            <div class="flex space-x-2">
              <button class="style-btn" :class="{ active: state.bold }" @click="$emit('toggle-bold')">
                <span class="i-material-symbols:format-bold" />
              </button>
              <button class="style-btn" :class="{ active: state.italic }" @click="$emit('toggle-italic')">
                <span class="i-material-symbols:format-italic" />
              </button>
              <button class="style-btn" :class="{ active: state.span }" @click="$emit('toggle-span')">
                <span class="text-xs">span</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 列表工具 -->
        <div v-else-if="group.id === 'lists'" class="space-y-3">
          <div class="tool-section">
            <h4 class="section-title">列表类型</h4>
            <div class="grid grid-cols-2 gap-2">
              <button class="list-btn" :class="{ active: state.ul }" @click="$emit('toggle-list')">
                <span class="i-material-symbols:format-list-bulleted mr-2" />
                无序列表
              </button>
              <button class="list-btn" :class="{ active: state.ol }" @click="$emit('toggle-ol')">
                <span class="i-material-symbols:format-list-numbered mr-2" />
                有序列表
              </button>
              <button class="list-btn" :class="{ active: state.colon }" @click="$emit('toggle-colon')">
                <span class="text-lg mr-2">:</span>
                定义列表
              </button>
            </div>
          </div>
        </div>

        <!-- 链接媒体工具 -->
        <div v-else-if="group.id === 'media'" class="space-y-3">
          <div class="tool-section">
            <h4 class="section-title">插入内容</h4>
            <div class="space-y-2">
              <button class="media-btn" @click="promptLink">
                <span class="i-material-symbols:link mr-2" />
                插入链接
              </button>
              <button class="media-btn" @click="promptImage">
                <span class="i-material-symbols:image mr-2" />
                插入图片
              </button>
              <button class="media-btn" @click="promptRef">
                <span class="i-material-symbols:bookmark mr-2" />
                交叉引用
              </button>
            </div>
          </div>
        </div>

        <!-- 模板工具 -->
        <div v-else-if="group.id === 'templates'" class="space-y-3">
          <div class="tool-section">
            <h4 class="section-title">简历模板</h4>
            <div class="grid grid-cols-2 gap-2">
              <button class="template-btn" @click="$emit('add-internship-title')">
                <span class="i-material-symbols:work mr-1" />
                实习
              </button>
              <button class="template-btn" @click="$emit('add-campus-title')">
                <span class="i-material-symbols:school mr-1" />
                校园
              </button>
              <button class="template-btn" @click="$emit('add-research-title')">
                <span class="i-material-symbols:science mr-1" />
                研究
              </button>
              <button class="template-btn" @click="$emit('add-project-title')">
                <span class="i-material-symbols:code mr-1" />
                项目
              </button>
            </div>
            <button class="w-full mt-2 px-3 py-2 bg-brand/20 text-brand rounded-lg hover:bg-brand/30 transition-colors text-sm font-medium" @click="$emit('add-skills')">
              <span class="i-material-symbols:psychology mr-2" />
              添加技能部分
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 面板背景遮罩 -->
    <div
      v-if="activePanels.size > 0"
      class="panel-overlay fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
      @click="closeAllPanels"
    />
  </div>
</template>

<script setup>
defineProps(['state'])

const emit = defineEmits([
  'toggle-italic',
  'toggle-bold',
  'toggle-span',
  'toggle-h1',
  'toggle-h2',
  'toggle-h3',
  'toggle-list',
  'toggle-ol',
  'toggle-colon',
  'wrap-link',
  'wrap-image',
  'wrap-crossref',
  'insert-crossref-def',
  'add-internship-title',
  'add-internship-entry',
  'add-campus-title',
  'add-campus-entry',
  'add-research-title',
  'add-research-entry',
  'add-project-title',
  'add-project-entry',
  'add-skills'
])

const activePanels = ref(new Set())

const toolGroups = [
  {
    id: 'headings',
    label: '标题样式',
    icon: 'i-material-symbols:title',
    position: { top: '20%', left: '70px' }
  },
  {
    id: 'lists',
    label: '列表工具',
    icon: 'i-material-symbols:format-list-bulleted',
    position: { top: '35%', left: '70px' }
  },
  {
    id: 'media',
    label: '链接媒体',
    icon: 'i-material-symbols:link',
    position: { top: '50%', left: '70px' }
  },
  {
    id: 'templates',
    label: '简历模板',
    icon: 'i-material-symbols:description',
    position: { top: '65%', left: '70px' }
  }
]

const togglePanel = (groupId) => {
  const newActivePanels = new Set(activePanels.value)
  if (newActivePanels.has(groupId)) {
    newActivePanels.delete(groupId)
  } else {
    newActivePanels.clear() // 只保持一个面板打开
    newActivePanels.add(groupId)
  }
  activePanels.value = newActivePanels
}

const closePanel = (groupId) => {
  const newActivePanels = new Set(activePanels.value)
  newActivePanels.delete(groupId)
  activePanels.value = newActivePanels
}

const closeAllPanels = () => {
  activePanels.value = new Set()
}

const getPanelStyle = (groupId) => {
  const group = toolGroups.find(g => g.id === groupId)
  return {
    top: group?.position.top || '20%',
    left: group?.position.left || '70px',
    width: '280px',
    maxHeight: '400px'
  }
}

const promptLink = () => {
  const url = window.prompt("URL", "https://");
  if (url != null) emit("wrap-link", url);
};

const promptImage = () => {
  const url = window.prompt("Image URL", "https://");
  if (url != null) emit("wrap-image", url);
};

const promptRef = () => {
  const name = window.prompt("Crossref name", "P1");
  if (name) emit("wrap-crossref", name);
};
</script>

<style scoped>
.quick-tool-btn {
  @apply w-6 h-6 rounded flex-center transition-all duration-200;
  @apply hover:bg-brand/20 text-c hover:text-brand;
}

.quick-tool-btn.active {
  @apply bg-brand text-white;
}

.group-btn {
  @apply flex-center border border-c/20;
}

.floating-panel {
  animation: panelSlideIn 0.3s ease-out;
}

@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.section-title {
  @apply text-xs font-medium text-c mb-2;
}

.heading-btn, .style-btn {
  @apply px-3 py-1.5 rounded-lg border border-c bg-c hover:bg-brand/20 text-sm font-medium transition-colors;
}

.heading-btn.active, .style-btn.active {
  @apply bg-brand text-white border-brand;
}

.list-btn, .media-btn, .template-btn {
  @apply w-full px-3 py-2 rounded-lg border border-c bg-c hover:bg-brand/20 text-sm font-medium transition-colors flex items-center;
}

.list-btn.active, .media-btn.active, .template-btn.active {
  @apply bg-brand text-white border-brand;
}

.tool-section {
  @apply pb-3 border-b border-c/30 last:border-b-0;
}
</style>
