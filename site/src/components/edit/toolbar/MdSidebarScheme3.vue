<template>
  <div class="minimal-sidebar w-12 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 border-r border-c relative">
    <!-- 核心工具组 -->
    <div class="core-tools p-2 space-y-1">
      <!-- 最常用工具 -->
      <div class="tool-group mb-3">
        <button
          v-for="tool in coreTools"
          :key="tool.id"
          @click="tool.action"
          :class="[
            'core-tool-btn w-8 h-8 rounded-lg transition-all duration-200 flex-center relative group',
            tool.isActive?.() ? 'bg-brand text-white shadow-md' : 'hover:bg-brand/10 text-c hover:text-brand'
          ]"
          :title="tool.tooltip"
        >
          <span :class="tool.icon" class="text-base" />
          
          <!-- 工具提示 -->
          <div class="tooltip absolute left-full ml-2 px-2 py-1 bg-dark-c text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
            {{ tool.tooltip }}
          </div>
        </button>
      </div>

      <!-- 分隔线 -->
      <div class="divider h-px bg-c/50 mx-1 my-2" />

      <!-- 高级工具切换 -->
      <button
        @click="showAdvanced = !showAdvanced"
        :class="[
          'advanced-toggle w-8 h-8 rounded-lg transition-all duration-200 flex-center',
          showAdvanced ? 'bg-purple-500 text-white' : 'hover:bg-purple-100 text-purple-500'
        ]"
        title="更多工具"
      >
        <span :class="showAdvanced ? 'i-carbon:chevron-up' : 'i-carbon:chevron-down'" class="text-sm" />
      </button>
    </div>

    <!-- 高级工具（可折叠） -->
    <div
      v-show="showAdvanced"
      class="advanced-tools bg-gradient-to-b from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 border-t border-c/50 p-2"
    >
      <!-- 标题工具 -->
      <div class="tool-section mb-3">
        <div class="section-label text-xs text-c mb-1 px-1">标题</div>
        <div class="flex flex-col space-y-1">
          <button
            v-for="heading in headingTools"
            :key="heading.id"
            @click="heading.action"
            :class="[
              'heading-tool w-8 h-6 rounded text-xs font-bold transition-all duration-200',
              heading.isActive?.() ? 'bg-blue-500 text-white' : 'hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400'
            ]"
            :title="heading.tooltip"
          >
            {{ heading.label }}
          </button>
        </div>
      </div>

      <!-- 快速模板 -->
      <div class="tool-section">
        <div class="section-label text-xs text-c mb-1 px-1">模板</div>
        <div class="flex flex-col space-y-1">
          <button
            v-for="template in quickTemplates"
            :key="template.id"
            @click="template.action"
            class="template-tool w-8 h-6 rounded text-xs transition-all duration-200 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 flex-center"
            :title="template.tooltip"
          >
            <span :class="template.icon" class="text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- 底部快捷操作 -->
    <div class="bottom-actions absolute bottom-2 left-2 right-2 space-y-1">
      <!-- 快速链接 -->
      <button
        @click="quickLink"
        class="quick-action w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex-center group"
        title="快速插入链接"
      >
        <span class="i-material-symbols:link text-sm group-hover:scale-110 transition-transform" />
      </button>

      <!-- 智能建议 -->
      <button
        @click="toggleSuggestions"
        :class="[
          'smart-suggest w-8 h-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex-center group',
          showSuggestions ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'
        ]"
        title="智能建议"
      >
        <span class="i-material-symbols:auto-awesome text-sm text-white group-hover:scale-110 transition-transform" />
      </button>
    </div>

    <!-- 智能建议面板 -->
    <div
      v-if="showSuggestions"
      class="suggestions-panel absolute left-full top-0 ml-2 w-48 bg-white dark:bg-slate-800 border border-c rounded-xl shadow-2xl p-3 z-50"
    >
      <h4 class="text-sm font-semibold text-dark-c mb-2 flex items-center">
        <span class="i-material-symbols:lightbulb mr-1 text-yellow-500" />
        智能建议
      </h4>
      <div class="space-y-2">
        <button
          v-for="suggestion in smartSuggestions"
          :key="suggestion.id"
          @click="applySuggestion(suggestion)"
          class="suggestion-item w-full text-left px-2 py-1.5 rounded hover:bg-brand/10 text-xs transition-colors"
        >
          <div class="font-medium text-dark-c">{{ suggestion.title }}</div>
          <div class="text-c">{{ suggestion.description }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['state'])

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

const showAdvanced = ref(false)
const showSuggestions = ref(false)

// 核心工具（最常用）
const coreTools = [
  {
    id: 'bold',
    icon: 'i-material-symbols:format-bold',
    tooltip: '粗体 **text**',
    action: () => emit('toggle-bold'),
    isActive: () => props.state.bold
  },
  {
    id: 'italic',
    icon: 'i-material-symbols:format-italic',
    tooltip: '斜体 *text*',
    action: () => emit('toggle-italic'),
    isActive: () => props.state.italic
  },
  {
    id: 'list',
    icon: 'i-material-symbols:format-list-bulleted',
    tooltip: '列表 - item',
    action: () => emit('toggle-list'),
    isActive: () => props.state.ul
  },
  {
    id: 'image',
    icon: 'i-material-symbols:image',
    tooltip: '插入图片',
    action: () => promptImage(),
    isActive: () => props.state.image
  }
]

// 标题工具
const headingTools = [
  {
    id: 'h1',
    label: 'H1',
    tooltip: '一级标题 #',
    action: () => emit('toggle-h1'),
    isActive: () => props.state.h1
  },
  {
    id: 'h2',
    label: 'H2',
    tooltip: '二级标题 ##',
    action: () => emit('toggle-h2'),
    isActive: () => props.state.h2
  },
  {
    id: 'h3',
    label: 'H3',
    tooltip: '三级标题 ###',
    action: () => emit('toggle-h3'),
    isActive: () => props.state.h3
  }
]

// 快速模板
const quickTemplates = [
  {
    id: 'work',
    icon: 'i-material-symbols:work',
    tooltip: '添加实习经历',
    action: () => emit('add-internship-title')
  },
  {
    id: 'school',
    icon: 'i-material-symbols:school',
    tooltip: '添加教育经历',
    action: () => emit('add-campus-title')
  },
  {
    id: 'code',
    icon: 'i-material-symbols:code',
    tooltip: '添加项目经历',
    action: () => emit('add-project-title')
  },
  {
    id: 'skills',
    icon: 'i-material-symbols:psychology',
    tooltip: '添加技能部分',
    action: () => emit('add-skills')
  }
]

// 智能建议
const smartSuggestions = [
  {
    id: 'add-contact',
    title: '添加联系信息',
    description: '包含邮箱、电话、地址',
    action: () => emit('add-internship-title')
  },
  {
    id: 'format-dates',
    title: '格式化日期',
    description: '统一日期格式显示',
    action: () => emit('toggle-bold')
  },
  {
    id: 'add-skills-section',
    title: '完善技能部分',
    description: '添加技术栈和工具',
    action: () => emit('add-skills')
  }
]

const quickLink = () => {
  const url = window.prompt("快速插入链接 URL:", "https://");
  if (url != null) emit("wrap-link", url);
}

const promptImage = () => {
  const url = window.prompt("图片 URL:", "https://");
  if (url != null) emit("wrap-image", url);
}

const toggleSuggestions = () => {
  showSuggestions.value = !showSuggestions.value
}

const applySuggestion = (suggestion) => {
  suggestion.action()
  showSuggestions.value = false
}

// 点击外部关闭建议面板
onMounted(() => {
  const closeOnClickOutside = (event) => {
    if (!event.target.closest('.suggestions-panel') && !event.target.closest('.smart-suggest')) {
      showSuggestions.value = false
    }
  }
  document.addEventListener('click', closeOnClickOutside)
  
  onBeforeUnmount(() => {
    document.removeEventListener('click', closeOnClickOutside)
  })
})
</script>

<style scoped>
.core-tool-btn:hover .tooltip {
  animation: tooltipSlideIn 0.2s ease-out;
}

@keyframes tooltipSlideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.advanced-tools {
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

.suggestions-panel {
  animation: panelFadeIn 0.2s ease-out;
}

@keyframes panelFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.quick-action:hover {
  transform: scale(1.1);
}

.smart-suggest:hover {
  transform: scale(1.1);
}

.suggestion-item:hover {
  transform: translateX(2px);
}

.section-label {
  font-weight: 500;
  letter-spacing: 0.025em;
}
</style>
