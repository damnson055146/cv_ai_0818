<template>
  <div ref="root" class="editor-sidebar select-none">
    <button
      class="editor-sidebar-btn relative"
      title="Styles"
      type="button"
      :aria-expanded="(!baseCollapsed).toString()"
      @click="baseCollapsed = !baseCollapsed"
    >
      <span class="i-tabler:palette text-lg"></span>
      <span
        :class="baseCollapsed ? 'i-tabler:chevron-down' : 'i-tabler:chevron-up'"
        class="absolute -bottom-1 right-0.5 text-[10px] transition-transform duration-200"
      ></span>
    </button>

    <div v-show="!baseCollapsed" class="flex flex-col items-center gap-3 w-full">
      <span class="editor-sidebar-label">Text Styles</span>
      <div class="flex flex-col items-center gap-2 w-full">
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.italic }]"
          :aria-pressed="state.italic.toString()"
          title="Italic *"
          type="button"
          @click="$emit('toggle-italic')"
        >
          <span class="i-tabler:italic text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.bold }]"
          :aria-pressed="state.bold.toString()"
          title="Bold **"
          type="button"
          @click="$emit('toggle-bold')"
        >
          <span class="i-tabler:bold text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.span }]"
          :aria-pressed="state.span.toString()"
          title="HTML <span>"
          type="button"
          @click="$emit('toggle-span')"
        >
          <span class="i-tabler:code text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.h1 }]"
          :aria-pressed="state.h1.toString()"
          title="H1 #"
          type="button"
          @click="$emit('toggle-h1')"
        >
          <span class="text-[11px] font-semibold tracking-wide">H1</span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.h2 }]"
          :aria-pressed="state.h2.toString()"
          title="H2 ##"
          type="button"
          @click="$emit('toggle-h2')"
        >
          <span class="text-[11px] font-semibold tracking-wide">H2</span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.h3 }]"
          :aria-pressed="state.h3.toString()"
          title="H3 ###"
          type="button"
          @click="$emit('toggle-h3')"
        >
          <span class="text-[11px] font-semibold tracking-wide">H3</span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.ul }]"
          :aria-pressed="state.ul.toString()"
          title="List -"
          type="button"
          @click="$emit('toggle-list')"
        >
          <span class="i-tabler:list text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.ol }]"
          :aria-pressed="state.ol.toString()"
          title="Ordered 1."
          type="button"
          @click="$emit('toggle-ol')"
        >
          <span class="i-tabler:list-numbers text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.colon }]"
          :aria-pressed="state.colon.toString()"
          title="Colon :"
          type="button"
          @click="$emit('toggle-colon')"
        >
          <span class="text-lg font-semibold leading-none">:</span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.link }]"
          :aria-pressed="state.link.toString()"
          title="Link [text](url)"
          type="button"
          @click="promptLink"
        >
          <span class="i-tabler:link text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.image }]"
          :aria-pressed="state.image.toString()"
          title="Image ![alt](url)"
          type="button"
          @click="promptImage"
        >
          <span class="i-tabler:photo text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.crossrefInline }]"
          :aria-pressed="state.crossrefInline.toString()"
          title="Wrap with [~name]"
          type="button"
          @click="promptRef"
        >
          <span class="i-tabler:bookmark text-base"></span>
        </button>
        <button
          :class="['editor-sidebar-btn', { 'editor-sidebar-btn-active': state.crossrefDef }]"
          :aria-pressed="state.crossrefDef.toString()"
          title="Insert [~name]: at line start"
          type="button"
          @click="promptRefDef"
        >
          <span class="i-tabler:bookmark-plus text-base"></span>
        </button>
      </div>
    </div>

    <span class="editor-sidebar-divider"></span>

    <button
      class="editor-sidebar-btn relative"
      title="Structures"
      type="button"
      :aria-expanded="(!advCollapsed).toString()"
      @click="advCollapsed = !advCollapsed"
    >
      <span class="i-tabler:hierarchy-3 text-lg"></span>
      <span
        :class="advCollapsed ? 'i-tabler:chevron-down' : 'i-tabler:chevron-up'"
        class="absolute -bottom-1 right-0.5 text-[10px] transition-transform duration-200"
      ></span>
    </button>

    <div v-show="!advCollapsed" class="flex flex-col items-center gap-3 w-full">
      <span class="editor-sidebar-label">Content Blocks</span>
      <div class="flex flex-col w-full gap-2">
        <div class="relative w-full">
          <button
            :class="['editor-sidebar-chip', { open: internMenuOpen }]"
            title="Internship"
            type="button"
            aria-haspopup="true"
            :aria-expanded="internMenuOpen.toString()"
            @click="toggleInternMenu($event)"
          >
            <span class="i-ri:briefcase-3-fill w-6 h-6 shrink-0 text-2xl text-brand"></span>
            <span class="flex-1 truncate text-left">Internship</span>
            <span
              :class="{ 'rotate-180': internMenuOpen }"
              class="i-tabler:chevron-down text-xs transition-transform duration-200"
            ></span>
          </button>
          <div
            v-show="internMenuOpen"
            ref="internMenu"
            class="submenu absolute left-full ml-3 mt-1 w-48 bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-slate-700/60 rounded-xl shadow-xl p-2 space-y-1 backdrop-blur-md z-50"
          >
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add section"
              @click="$emit('add-internship-title'); closeInternMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Section
            </button>
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add entry"
              @click="$emit('add-internship-entry'); closeInternMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Entry
            </button>
          </div>
        </div>
        <div class="relative w-full">
          <button
            :class="['editor-sidebar-chip', { open: campusMenuOpen }]"
            title="Campus Activity"
            type="button"
            aria-haspopup="true"
            :aria-expanded="campusMenuOpen.toString()"
            @click="toggleCampusMenu($event)"
          >
            <span class="i-ri:graduation-cap-fill w-6 h-6 shrink-0 text-2xl text-brand"></span>
            <span class="flex-1 truncate text-left">Campus</span>
            <span
              :class="{ 'rotate-180': campusMenuOpen }"
              class="i-tabler:chevron-down text-xs transition-transform duration-200"
            ></span>
          </button>
          <div
            v-show="campusMenuOpen"
            ref="campusMenu"
            class="submenu absolute left-full ml-3 mt-1 w-48 bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-slate-700/60 rounded-xl shadow-xl p-2 space-y-1 backdrop-blur-md z-50"
          >
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add section"
              @click="$emit('add-campus-title'); closeCampusMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Section
            </button>
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add entry"
              @click="$emit('add-campus-entry'); closeCampusMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Entry
            </button>
          </div>
        </div>
        <div class="relative w-full">
          <button
            :class="['editor-sidebar-chip', { open: researchMenuOpen }]"
            title="Research"
            type="button"
            aria-haspopup="true"
            :aria-expanded="researchMenuOpen.toString()"
            @click="toggleResearchMenu($event)"
          >
            <span class="i-ri:test-tube-fill w-6 h-6 shrink-0 text-2xl text-brand"></span>
            <span class="flex-1 truncate text-left">Research</span>
            <span
              :class="{ 'rotate-180': researchMenuOpen }"
              class="i-tabler:chevron-down text-xs transition-transform duration-200"
            ></span>
          </button>
          <div
            v-show="researchMenuOpen"
            ref="researchMenu"
            class="submenu absolute left-full ml-3 mt-1 w-48 bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-slate-700/60 rounded-xl shadow-xl p-2 space-y-1 backdrop-blur-md z-50"
          >
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add section"
              @click="$emit('add-research-title'); closeResearchMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Section
            </button>
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add entry"
              @click="$emit('add-research-entry'); closeResearchMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Entry
            </button>
          </div>
        </div>
        <div class="relative w-full">
          <button
            :class="['editor-sidebar-chip', { open: projectMenuOpen }]"
            title="Project"
            type="button"
            aria-haspopup="true"
            :aria-expanded="projectMenuOpen.toString()"
            @click="toggleProjectMenu($event)"
          >
            <span class="i-ri:clipboard-fill w-6 h-6 shrink-0 text-2xl text-brand"></span>
            <span class="flex-1 truncate text-left">Project</span>
            <span
              :class="{ 'rotate-180': projectMenuOpen }"
              class="i-tabler:chevron-down text-xs transition-transform duration-200"
            ></span>
          </button>
          <div
            v-show="projectMenuOpen"
            ref="projectMenu"
            class="submenu absolute left-full ml-3 mt-1 w-48 bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-slate-700/60 rounded-xl shadow-xl p-2 space-y-1 backdrop-blur-md z-50"
          >
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add section"
              @click="$emit('add-project-title'); closeProjectMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Section
            </button>
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add entry"
              @click="$emit('add-project-entry'); closeProjectMenu()"
            >
              <span class="i-ri:add-fill text-sm"></span>
              Entry
            </button>
          </div>
        </div>
        <div class="relative w-full">
          <button
            :class="['editor-sidebar-chip', { open: publicationMenuOpen }]"
            title="Publications"
            type="button"
            aria-haspopup="true"
            :aria-expanded="publicationMenuOpen.toString()"
            @click="togglePublicationMenu($event)"
          >
            <span class="i-ri:book-2-fill w-6 h-6 shrink-0 text-2xl text-brand"></span>
            <span class="flex-1 truncate text-left">Publications</span>
            <span
              :class="{ 'rotate-180': publicationMenuOpen }"
              class="i-tabler:chevron-down text-xs transition-transform duration-200"
            ></span>
          </button>
          <div
            v-show="publicationMenuOpen"
            ref="publicationMenu"
            class="submenu absolute left-full ml-3 mt-1 w-48 bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-slate-700/60 rounded-xl shadow-xl p-2 space-y-1 backdrop-blur-md z-50"
          >
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add section"
              @click="$emit('add-publication-title'); closePublicationMenu()"
            >
              <span class="i-tabler:plus text-sm"></span>
              Section
            </button>
            <button
              class="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border-0 bg-transparent text-gray-600 dark:text-gray-200 transition-all hover:bg-slate-100/80 hover:pl-3 dark:hover:bg-slate-700/60"
              type="button"
              title="Add entry"
              @click="$emit('add-publication-entry'); closePublicationMenu()"
            >
              <span class="i-tabler:plus text-sm"></span>
              Entry
            </button>
          </div>
        </div>
        <div class="w-full">
          <button
            class="editor-sidebar-chip"
            title="Insert Skills Section"
            type="button"
            @click="$emit('add-skills')"
          >
            <span class="i-ri:tools-fill w-6 h-6 shrink-0 text-2xl text-brand"></span>
            <span class="flex-1 truncate text-left">Skills</span>
            <span class="i-tabler:chevron-right text-xs opacity-40"></span>
          </button>
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
const publicationMenuOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const internMenu = ref<HTMLElement | null>(null);
const campusMenu = ref<HTMLElement | null>(null);
const researchMenu = ref<HTMLElement | null>(null);
const projectMenu = ref<HTMLElement | null>(null);
const publicationMenu = ref<HTMLElement | null>(null);

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

const togglePublicationMenu = (_e: MouseEvent) => {
  publicationMenuOpen.value = !publicationMenuOpen.value;
};

const closePublicationMenu = () => {
  publicationMenuOpen.value = false;
};

const onDocClick = (e: MouseEvent) => {
  const t = e.target as Node;
  if (!root.value) return;
  if (!root.value.contains(t)) internMenuOpen.value = false;
  if (!root.value.contains(t)) campusMenuOpen.value = false;
  if (!root.value.contains(t)) researchMenuOpen.value = false;
  if (!root.value.contains(t)) projectMenuOpen.value = false;
  if (!root.value.contains(t)) publicationMenuOpen.value = false;
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') internMenuOpen.value = false;
  if (e.key === 'Escape') campusMenuOpen.value = false;
  if (e.key === 'Escape') researchMenuOpen.value = false;
  if (e.key === 'Escape') projectMenuOpen.value = false;
  if (e.key === 'Escape') publicationMenuOpen.value = false;
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
  (e: "add-publication-title"): void;
  (e: "add-publication-entry"): void;
  (e: "add-skills"): void;
}>();

// PS quick nav removed; handled by header dropdown
</script>

<style scoped>
.submenu {
  backdrop-filter: blur(12px);
}

.submenu::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 14px;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 8px solid rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.08));
}

html.dark .submenu::before {
  border-right-color: rgba(15, 23, 42, 0.95);
}

.editor-sidebar-chip.open {
  border-color: rgba(168, 85, 247, 0.35);
  color: rgb(126, 34, 206);
  background-image: linear-gradient(
    to bottom,
    rgba(168, 85, 247, 0.12),
    rgba(168, 85, 247, 0.06)
  );
  box-shadow: 0 6px 14px rgba(168, 85, 247, 0.15), 0 1px 2px rgba(0, 0, 0, 0.04);
}

html.dark .editor-sidebar-chip.open {
  color: rgb(251, 113, 133);
  border-color: rgba(244, 114, 182, 0.35);
  background-image: linear-gradient(
    to bottom,
    rgba(244, 114, 182, 0.18),
    rgba(244, 114, 182, 0.10)
  );
  box-shadow: 0 6px 14px rgba(244, 114, 182, 0.18), 0 1px 2px rgba(0, 0, 0, 0.25);
}

/* Use default sizes; switch to bold filled icons for clarity */
</style>
