<template>
  <div class="horizontal-tabs-sidebar w-full bg-c/50 border-r border-c">
    <!-- 标签头部 -->
    <div class="tabs-header flex border-b border-c bg-c">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'tab-header flex-1 px-3 py-2 text-xs font-medium transition-all duration-200 border-r border-c last:border-r-0',
          activeTab === tab.id
            ? 'bg-brand text-white shadow-sm'
            : 'text-c hover:bg-dark-c/50 hover:text-dark-c'
        ]"
        :title="tab.label"
      >
        <span :class="tab.icon" class="mr-1" />
        {{ tab.shortLabel }}
      </button>
    </div>

    <!-- 标签内容 -->
    <div class="tab-content p-3 h-full overflow-y-auto">
      <!-- 基础格式 -->
      <div v-if="activeTab === 'format'" class="space-y-3">
        <div class="tool-group">
          <h4 class="text-xs font-medium text-c mb-2">文本样式</h4>
          <div class="grid grid-cols-3 gap-1">
            <button class="tool-btn" :class="{ active: state.italic }" title="Italic *" @click="$emit('toggle-italic')">
              <span class="i-material-symbols:format-italic" />
            </button>
            <button class="tool-btn" :class="{ active: state.bold }" title="Bold **" @click="$emit('toggle-bold')">
              <span class="i-material-symbols:format-bold" />
            </button>
            <button class="tool-btn" :class="{ active: state.span }" title="HTML span" @click="$emit('toggle-span')">
              <span class="text-xs">span</span>
            </button>
          </div>
        </div>

        <div class="tool-group">
          <h4 class="text-xs font-medium text-c mb-2">标题层级</h4>
          <div class="grid grid-cols-3 gap-1">
            <button class="tool-btn" :class="{ active: state.h1 }" title="H1 #" @click="$emit('toggle-h1')">H1</button>
            <button class="tool-btn" :class="{ active: state.h2 }" title="H2 ##" @click="$emit('toggle-h2')">H2</button>
            <button class="tool-btn" :class="{ active: state.h3 }" title="H3 ###" @click="$emit('toggle-h3')">H3</button>
          </div>
        </div>

        <div class="tool-group">
          <h4 class="text-xs font-medium text-c mb-2">列表</h4>
          <div class="grid grid-cols-3 gap-1">
            <button class="tool-btn" :class="{ active: state.ul }" title="List -" @click="$emit('toggle-list')">
              <span class="i-material-symbols:format-list-bulleted" />
            </button>
            <button class="tool-btn" :class="{ active: state.ol }" title="Ordered 1." @click="$emit('toggle-ol')">
              <span class="i-material-symbols:format-list-numbered" />
            </button>
            <button class="tool-btn" :class="{ active: state.colon }" title="Colon :" @click="$emit('toggle-colon')">:</button>
          </div>
        </div>
      </div>

      <!-- 链接和媒体 -->
      <div v-else-if="activeTab === 'media'" class="space-y-3">
        <div class="tool-group">
          <h4 class="text-xs font-medium text-c mb-2">链接和媒体</h4>
          <div class="space-y-2">
            <button class="tool-btn-full" :class="{ active: state.link }" title="Link" @click="promptLink">
              <span class="i-material-symbols:link mr-2" />
              插入链接
            </button>
            <button class="tool-btn-full" :class="{ active: state.image }" title="Image" @click="promptImage">
              <span class="i-material-symbols:image mr-2" />
              插入图片
            </button>
            <button class="tool-btn-full" :class="{ active: state.crossrefInline }" title="Cross reference" @click="promptRef">
              <span class="i-material-symbols:link mr-2" />
              交叉引用
            </button>
            <button class="tool-btn-full" :class="{ active: state.crossrefDef }" title="Reference definition" @click="promptRefDef">
              <span class="i-material-symbols:bookmark mr-2" />
              引用定义
            </button>
          </div>
        </div>
      </div>

      <!-- 简历模板 -->
      <div v-else-if="activeTab === 'templates'" class="space-y-3">
        <div class="tool-group">
          <h4 class="text-xs font-medium text-c mb-2">简历模板</h4>
          <div class="space-y-2">
            <div class="template-category">
              <button class="category-btn" @click="toggleCategory('internship')">
                <span class="i-material-symbols:work mr-2" />
                实习经历
                <span :class="expandedCategories.has('internship') ? 'i-ic:round-keyboard-arrow-up' : 'i-ic:round-keyboard-arrow-down'" class="ml-auto" />
              </button>
              <div v-show="expandedCategories.has('internship')" class="category-content">
                <button class="template-btn" @click="$emit('add-internship-title')">
                  <span class="i-material-symbols:add mr-1" />
                  添加标题
                </button>
                <button class="template-btn" @click="$emit('add-internship-entry')">
                  <span class="i-material-symbols:add mr-1" />
                  添加条目
                </button>
              </div>
            </div>

            <div class="template-category">
              <button class="category-btn" @click="toggleCategory('education')">
                <span class="i-material-symbols:school mr-2" />
                校园活动
                <span :class="expandedCategories.has('education') ? 'i-ic:round-keyboard-arrow-up' : 'i-ic:round-keyboard-arrow-down'" class="ml-auto" />
              </button>
              <div v-show="expandedCategories.has('education')" class="category-content">
                <button class="template-btn" @click="$emit('add-campus-title')">
                  <span class="i-material-symbols:add mr-1" />
                  添加标题
                </button>
                <button class="template-btn" @click="$emit('add-campus-entry')">
                  <span class="i-material-symbols:add mr-1" />
                  添加条目
                </button>
              </div>
            </div>

            <div class="template-category">
              <button class="category-btn" @click="toggleCategory('research')">
                <span class="i-material-symbols:science mr-2" />
                研究经历
                <span :class="expandedCategories.has('research') ? 'i-ic:round-keyboard-arrow-up' : 'i-ic:round-keyboard-arrow-down'" class="ml-auto" />
              </button>
              <div v-show="expandedCategories.has('research')" class="category-content">
                <button class="template-btn" @click="$emit('add-research-title')">
                  <span class="i-material-symbols:add mr-1" />
                  添加标题
                </button>
                <button class="template-btn" @click="$emit('add-research-entry')">
                  <span class="i-material-symbols:add mr-1" />
                  添加条目
                </button>
              </div>
            </div>

            <div class="template-category">
              <button class="category-btn" @click="toggleCategory('project')">
                <span class="i-material-symbols:code mr-2" />
                项目经历
                <span :class="expandedCategories.has('project') ? 'i-ic:round-keyboard-arrow-up' : 'i-ic:round-keyboard-arrow-down'" class="ml-auto" />
              </button>
              <div v-show="expandedCategories.has('project')" class="category-content">
                <button class="template-btn" @click="$emit('add-project-title')">
                  <span class="i-material-symbols:add mr-1" />
                  添加标题
                </button>
                <button class="template-btn" @click="$emit('add-project-entry')">
                  <span class="i-material-symbols:add mr-1" />
                  添加条目
                </button>
              </div>
            </div>

            <button class="tool-btn-full" @click="$emit('add-skills')">
              <span class="i-material-symbols:psychology mr-2" />
              添加技能部分
            </button>
          </div>
        </div>
      </div>
    </div>
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

const activeTab = ref('format')
const expandedCategories = ref(new Set(['internship']))

const tabs = [
  {
    id: 'format',
    label: '格式工具',
    shortLabel: '格式',
    icon: 'i-material-symbols:format-paint'
  },
  {
    id: 'media',
    label: '链接媒体',
    shortLabel: '媒体',
    icon: 'i-material-symbols:link'
  },
  {
    id: 'templates',
    label: '简历模板',
    shortLabel: '模板',
    icon: 'i-material-symbols:description'
  }
]

const toggleCategory = (categoryId) => {
  const newExpanded = new Set(expandedCategories.value)
  if (newExpanded.has(categoryId)) {
    newExpanded.delete(categoryId)
  } else {
    newExpanded.add(categoryId)
  }
  expandedCategories.value = newExpanded
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

const promptRefDef = () => {
  const name = window.prompt("Crossref name for definition", "P1");
  if (name) emit("insert-crossref-def", name);
};
</script>

<style scoped>
.tool-btn {
  @apply w-8 h-8 rounded-md border border-c bg-c hover:bg-dark-c/50 flex-center text-xs font-medium transition-colors duration-200;
}

.tool-btn.active {
  @apply bg-brand text-white border-brand;
}

.tool-btn-full {
  @apply w-full px-3 py-2 rounded-md border border-c bg-c hover:bg-dark-c/50 flex items-center text-xs font-medium transition-colors duration-200;
}

.tool-btn-full.active {
  @apply bg-brand text-white border-brand;
}

.category-btn {
  @apply w-full px-3 py-2 rounded-md border border-c bg-c hover:bg-dark-c/50 flex items-center text-xs font-medium transition-colors duration-200;
}

.category-content {
  @apply mt-2 space-y-1 pl-2;
}

.template-btn {
  @apply w-full px-3 py-1.5 rounded border-0 bg-dark-c/30 hover:bg-dark-c/50 flex items-center text-xs transition-colors duration-200;
}

.tool-group {
  @apply pb-3 border-b border-c/50 last:border-b-0;
}

.template-category {
  @apply space-y-1;
}
</style>
