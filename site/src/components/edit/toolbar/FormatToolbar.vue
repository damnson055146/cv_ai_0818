<template>
  <div class="format-toolbar sticky top-9 z-20 flex flex-wrap items-center gap-3 border-b border-c bg-c px-4 py-2">
    <div class="flex items-center gap-1">
      <button
        class="format-btn"
        :class="{ active: state.bold }"
        title="加粗 Ctrl+B"
        type="button"
        @click="$emit('toggle-bold')"
      >
        <span class="text-sm font-semibold">B</span>
      </button>
      <button
        class="format-btn"
        :class="{ active: state.italic }"
        title="斜体 Ctrl+I"
        type="button"
        @click="$emit('toggle-italic')"
      >
        <span class="text-sm italic">I</span>
      </button>
      <button
        class="format-btn"
        :class="{ active: state.underline }"
        title="下划线 Ctrl+U"
        type="button"
        @click="$emit('toggle-underline')"
      >
        <span class="text-sm underline">U</span>
      </button>
    </div>

    <div class="flex items-center gap-2 text-xs text-light-c">
      <span class="whitespace-nowrap">字号</span>
      <select class="format-select" :value="currentFontSize" @change="handleFontSizeChange">
        <option value="">默认</option>
        <option v-for="size in fontSizes" :key="size" :value="size">{{ size }}px</option>
      </select>
      <button
        class="format-btn !px-2"
        type="button"
        title="清除字号标记"
        @click="$emit('clear-font-size')"
      >
        <span class="i-tabler:eraser text-base" />
      </button>
    </div>

    <div class="flex items-center gap-2 text-xs text-light-c">
      <span class="whitespace-nowrap">行间距</span>
      <select class="format-select" :value="currentLineHeight" @change="handleLineHeightChange">
        <option v-for="option in lineHeightOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useStyleStore } from "~/composables";

const props = defineProps<{
  state: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    fontSize: string | null;
  };
  fontSizes: string[];
}>();

const emit = defineEmits<{
  (e: "toggle-bold"): void;
  (e: "toggle-italic"): void;
  (e: "toggle-underline"): void;
  (e: "apply-font-size", value: string): void;
  (e: "clear-font-size"): void;
}>();

const { styles, setStyle } = useStyleStore();

const currentFontSize = computed(() => props.state.fontSize || "");

const baseLineHeights = ["1.0", "1.15", "1.5", "2.0"];
const currentLineHeight = computed(() => styles.lineHeight.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
const lineHeightOptions = computed(() => {
  const set = new Set(baseLineHeights);
  const current = currentLineHeight.value;
  if (current) set.add(current);
  return Array.from(set);
});

const handleFontSizeChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (!value) {
    emit("clear-font-size");
  } else {
    emit("apply-font-size", value);
  }
};

const handleLineHeightChange = async (event: Event) => {
  const raw = (event.target as HTMLSelectElement).value;
  const parsed = parseFloat(raw);
  if (Number.isFinite(parsed)) await setStyle("lineHeight", parsed);
};
</script>

<style scoped>
.format-btn {
  @apply flex items-center justify-center rounded border border-transparent bg-dark-c/10 px-2.5 py-1 text-sm text-dark-c transition-colors hover:bg-dark-c/20 hover:text-brand dark:text-light-c;
}

.format-btn.active {
  @apply border-brand bg-brand/10 text-brand;
}

.format-select {
  @apply rounded border border-c bg-transparent px-2 py-1 text-dark-c outline-none transition-colors focus:border-brand dark:text-light-c;
}
</style>
