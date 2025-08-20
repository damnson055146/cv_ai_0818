<template>
  <div ref="root" class="relative flex flex-col items-center p-2 space-y-2 w-10 select-none">
    <button class="round-btn" title="Collapse/Expand Base" @click="baseCollapsed = !baseCollapsed">{{ baseCollapsed ? '⮟' : '⮝' }}</button>

    <!-- Base styles -->
    <div v-show="!baseCollapsed" class="flex flex-col items-center space-y-2 w-full">
      <button class="round-btn" :class="{ active: state.italic }" title="Italic *" @click="$emit('toggle-italic')">*</button>
      <button class="round-btn" :class="{ active: state.bold }" title="Bold **" @click="$emit('toggle-bold')">**</button>
      <button class="round-btn" :class="{ active: state.span }" title="HTML <span>" @click="$emit('toggle-span')">span</button>

      <button class="round-btn" :class="{ active: state.h1 }" title="H1 #" @click="$emit('toggle-h1')">#</button>
      <button class="round-btn" :class="{ active: state.h2 }" title="H2 ##" @click="$emit('toggle-h2')">##</button>
      <button class="round-btn" :class="{ active: state.h3 }" title="H3 ###" @click="$emit('toggle-h3')">###</button>

      <button class="round-btn" :class="{ active: state.ul }" title="List -" @click="$emit('toggle-list')">-</button>
      <button class="round-btn" :class="{ active: state.ol }" title="Ordered 1." @click="$emit('toggle-ol')">1.</button>
      <button class="round-btn" :class="{ active: state.colon }" title="Colon :" @click="$emit('toggle-colon')">:</button>

      <button class="round-btn text-xs" :class="{ active: state.link }" title="Link [text](url)" @click="promptLink">[↗]</button>
      <button class="round-btn text-xs" :class="{ active: state.image }" title="Image ![alt](url)" @click="promptImage">![]</button>
      <button class="round-btn text-xs" :class="{ active: state.crossrefInline }" title="Wrap with [~name]" @click="promptRef">[~]</button>
      <button class="round-btn text-xs" :class="{ active: state.crossrefDef }" title="Insert [~name]: at line start" @click="promptRefDef">[~]:</button>
    </div>

    <!-- Advanced styles -->
    <button class="round-btn" title="Collapse/Expand Advanced" @click="advCollapsed = !advCollapsed">{{ advCollapsed ? '⮟' : '⮝' }}</button>
    <div v-show="!advCollapsed" class="flex flex-col items-center space-y-2 w-full">
      <div class="flex flex-col items-center space-y-1 w-full">
        <button class="round-btn text-xs" title="Internship" @click="toggleInternMenu($event)">Internship ▾</button>
        <div v-show="internMenuOpen" ref="internMenu" class="submenu absolute z-20 left-12 mt-1 w-34 bg-c border border-c rounded-md shadow p-1">
          <button class="round-btn w-full text-xs mb-1" title="Add section" @click="$emit('add-internship-title'); closeInternMenu()">+ Section</button>
          <button class="round-btn w-full text-xs" title="Add entry" @click="$emit('add-internship-entry'); closeInternMenu()">+ Entry</button>
        </div>
      </div>
      <div class="flex flex-col items-center space-y-1 w-full">
        <button class="round-btn text-xs" title="Campus Activity" @click="toggleCampusMenu($event)">Campus ▾</button>
        <div v-show="campusMenuOpen" ref="campusMenu" class="submenu absolute z-20 left-12 mt-1 w-34 bg-c border border-c rounded-md shadow p-1">
          <button class="round-btn w-full text-xs mb-1" title="Add section" @click="$emit('add-campus-title'); closeCampusMenu()">+ Section</button>
          <button class="round-btn w-full text-xs" title="Add entry" @click="$emit('add-campus-entry'); closeCampusMenu()">+ Entry</button>
        </div>
      </div>
      <div class="flex flex-col items-center space-y-1 w-full">
        <button class="round-btn text-xs" title="Research" @click="toggleResearchMenu($event)">Research ▾</button>
        <div v-show="researchMenuOpen" ref="researchMenu" class="submenu absolute z-20 left-12 mt-1 w-34 bg-c border border-c rounded-md shadow p-1">
          <button class="round-btn w-full text-xs mb-1" title="Add section" @click="$emit('add-research-title'); closeResearchMenu()">+ Section</button>
          <button class="round-btn w-full text-xs" title="Add entry" @click="$emit('add-research-entry'); closeResearchMenu()">+ Entry</button>
        </div>
      </div>
      <div class="flex flex-col items-center space-y-1 w-full">
        <button class="round-btn text-xs" title="Project" @click="toggleProjectMenu($event)">Project ▾</button>
        <div v-show="projectMenuOpen" ref="projectMenu" class="submenu absolute z-20 left-12 mt-1 w-34 bg-c border border-c rounded-md shadow p-1">
          <button class="round-btn w-full text-xs mb-1" title="Add section" @click="$emit('add-project-title'); closeProjectMenu()">+ Section</button>
          <button class="round-btn w-full text-xs" title="Add entry" @click="$emit('add-project-entry'); closeProjectMenu()">+ Entry</button>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script lang="ts" setup>
const baseCollapsed = ref(false);
const advCollapsed = ref(true);
const internMenuOpen = ref(false);
const campusMenuOpen = ref(false);
const researchMenuOpen = ref(false);
const projectMenuOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const internMenu = ref<HTMLElement | null>(null);
const campusMenu = ref<HTMLElement | null>(null);
const researchMenu = ref<HTMLElement | null>(null);
const projectMenu = ref<HTMLElement | null>(null);

const toggleInternMenu = (_e: MouseEvent) => {
  internMenuOpen.value = !internMenuOpen.value;
};

const closeInternMenu = () => {
  internMenuOpen.value = false;
};

const toggleCampusMenu = (_e: MouseEvent) => {
  campusMenuOpen.value = !campusMenuOpen.value;
};

const closeCampusMenu = () => {
  campusMenuOpen.value = false;
};

const toggleResearchMenu = (_e: MouseEvent) => {
  researchMenuOpen.value = !researchMenuOpen.value;
};

const closeResearchMenu = () => {
  researchMenuOpen.value = false;
};

const toggleProjectMenu = (_e: MouseEvent) => {
  projectMenuOpen.value = !projectMenuOpen.value;
};

const closeProjectMenu = () => {
  projectMenuOpen.value = false;
};

const onDocClick = (e: MouseEvent) => {
  const t = e.target as Node;
  if (!root.value) return;
  if (!root.value.contains(t)) internMenuOpen.value = false;
  if (!root.value.contains(t)) campusMenuOpen.value = false;
  if (!root.value.contains(t)) researchMenuOpen.value = false;
  if (!root.value.contains(t)) projectMenuOpen.value = false;
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') internMenuOpen.value = false;
  if (e.key === 'Escape') campusMenuOpen.value = false;
  if (e.key === 'Escape') researchMenuOpen.value = false;
  if (e.key === 'Escape') projectMenuOpen.value = false;
};

onMounted(() => {
  document.addEventListener('mousedown', onDocClick, true);
  document.addEventListener('keydown', onKeydown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick, true);
  document.removeEventListener('keydown', onKeydown, true);
});
const props = defineProps<{ state: {
  italic: boolean;
  bold: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  ul: boolean;
  ol: boolean;
  colon: boolean;
  link: boolean;
  image: boolean;
  crossrefInline: boolean;
  crossrefDef: boolean;
  span: boolean;
} }>();

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

const emit = defineEmits<{
  (e: "toggle-italic"): void;
  (e: "toggle-bold"): void;
  (e: "toggle-span"): void;
  (e: "toggle-h1"): void;
  (e: "toggle-h2"): void;
  (e: "toggle-h3"): void;
  (e: "toggle-list"): void;
  (e: "toggle-ol"): void;
  (e: "toggle-colon"): void;
  (e: "wrap-link", url: string): void;
  (e: "wrap-image", url: string): void;
  (e: "wrap-crossref", name: string): void;
  (e: "insert-crossref-def", name: string): void;
  (e: "add-internship-title"): void;
  (e: "add-internship-entry"): void;
  (e: "add-campus-title"): void;
  (e: "add-campus-entry"): void;
  (e: "add-research-title"): void;
  (e: "add-research-entry"): void;
  (e: "add-project-title"): void;
  (e: "add-project-entry"): void;
}>();
</script>

<style scoped>
.active {
  outline: 2px solid var(--un-c-border, #94a3b8);
}
.submenu { backdrop-filter: blur(6px); }
</style>


