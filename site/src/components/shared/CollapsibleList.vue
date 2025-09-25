<template>
  <div>
    <ul class="list-disc pl-5 space-y-1">
      <li v-for="(item, idx) in displayed" :key="idx" class="leading-5">{{ item }}</li>
    </ul>
    <div v-if="items.length > previewCount" class="mt-1">
      <button type="button" class="text-xs text-blue-600 hover:underline" @click="toggle">
        {{ expanded ? collapseText : `${expandText}（共${items.length}项）` }}
      </button>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  items: string[]
  previewCount?: number
  expandText?: string
  collapseText?: string
}>(), {
  previewCount: 6,
  expandText: '展开更多',
  collapseText: '收起'
})

const expanded = ref(false)
const displayed = computed(() => (expanded.value ? props.items : props.items.slice(0, props.previewCount)))
function toggle() { expanded.value = !expanded.value }
</script>

<style scoped>
</style>

