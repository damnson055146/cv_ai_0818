<template>
  <div class="flex flex-col items-center p-2 space-y-2 w-10 select-none">
    <button class="round-btn" title="Collapse/Expand" @click="collapsed = !collapsed">{{ collapsed ? '⮟' : '⮝' }}</button>

    <div v-show="!collapsed" class="flex flex-col items-center space-y-2 w-full">
      <button class="round-btn" :class="{ active: state.italic }" title="Italic *" @click="$emit('toggle-italic')">*</button>
      <button class="round-btn" :class="{ active: state.bold }" title="Bold **" @click="$emit('toggle-bold')">**</button>
      <button class="round-btn" :class="{ active: state.strike }" title="Strike ~~" @click="$emit('toggle-strike')">~~</button>
      <button class="round-btn" :class="{ active: state.code }" title="Inline Code `" @click="$emit('toggle-code')">`</button>
      <button class="round-btn" :class="{ active: state.span }" title="HTML <span>" @click="$emit('toggle-span')">span</button>

      <button class="round-btn" :class="{ active: state.h1 }" title="H1 #" @click="$emit('toggle-h1')">#</button>
      <button class="round-btn" :class="{ active: state.h2 }" title="H2 ##" @click="$emit('toggle-h2')">##</button>
      <button class="round-btn" :class="{ active: state.h3 }" title="H3 ###" @click="$emit('toggle-h3')">###</button>

      <button class="round-btn" :class="{ active: state.ul }" title="List -" @click="$emit('toggle-list')">-</button>
      <button class="round-btn" :class="{ active: state.ol }" title="Ordered 1." @click="$emit('toggle-ol')">1.</button>
      <button class="round-btn" :class="{ active: state.quote }" title="Quote >" @click="$emit('toggle-quote')">&gt;</button>
      <button class="round-btn" :class="{ active: state.colon }" title="Colon :" @click="$emit('toggle-colon')">:</button>

      <button class="round-btn" title="Code Block ```" @click="$emit('toggle-codeblock')">```</button>

      <button class="round-btn text-xs" :class="{ active: state.link }" title="Link [text](url)" @click="promptLink">[↗]</button>
      <button class="round-btn text-xs" :class="{ active: state.image }" title="Image ![alt](url)" @click="promptImage">![]</button>
      <button class="round-btn text-xs" :class="{ active: state.crossrefInline }" title="Wrap with [~name]" @click="promptRef">[~]</button>
      <button class="round-btn text-xs" :class="{ active: state.crossrefDef }" title="Insert [~name]: at line start" @click="promptRefDef">[~]:</button>
    </div>
  </div>
  
</template>

<script lang="ts" setup>
const collapsed = ref(false);
const props = defineProps<{ state: {
  italic: boolean;
  bold: boolean;
  strike: boolean;
  code: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  ul: boolean;
  ol: boolean;
  quote: boolean;
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
  (e: "toggle-strike"): void;
  (e: "toggle-code"): void;
  (e: "toggle-span"): void;
  (e: "toggle-h1"): void;
  (e: "toggle-h2"): void;
  (e: "toggle-h3"): void;
  (e: "toggle-list"): void;
  (e: "toggle-ol"): void;
  (e: "toggle-quote"): void;
  (e: "toggle-colon"): void;
  (e: "toggle-codeblock"): void;
  (e: "wrap-link", url: string): void;
  (e: "wrap-image", url: string): void;
  (e: "wrap-crossref", name: string): void;
  (e: "insert-crossref-def", name: string): void;
}>();
</script>

<style scoped>
.active {
  outline: 2px solid var(--un-c-border, #94a3b8);
}
</style>


