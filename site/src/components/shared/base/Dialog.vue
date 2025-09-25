<template>
  <div v-bind="api.triggerProps">
    <slot name="button">Open dialog</slot>
  </div>

  <Teleport to="body" v-if="mounted">
    <div v-if="api.isOpen">
      <div v-bind="api.backdropProps" class="fixed inset-0 z-60 bg-black/30 backdrop-blur-sm" />
      <div v-bind="api.positionerProps" class="z-60">
        <div
          v-bind="api.contentProps"
          class="font-ui h-fit z-70 fixed inset-0 m-auto bg-c flex flex-col overflow-hidden text-c shadow-c"
          :class="boxClass"
          :style="{ transform: draggable ? `translate(${dx}px, ${dy}px)` : undefined }"
          border="1 gray-400 dark:gray-500 rounded-md"
        >
          <div hstack justify-between pl-4 pr-3 py-2.5 @pointerdown.stop.prevent="onDragStart">
            <div hstack text-sm>
              <span :class="icon" />
              <span mx-2 text-light-c>/</span>
              <span v-bind="api.titleProps">{{ title }}</span>
            </div>

            <button
              class="circle p-1 duration-100 hover:(bg-dark-c rotate-90)"
              v-bind="api.closeTriggerProps"
            >
              <span i-ic:baseline-close />
            </button>
          </div>

          <slot name="content" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import * as dialog from "@zag-js/dialog";
import { normalizeProps, useMachine } from "@zag-js/vue";
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  id: string;
  title: string;
  icon: string;
  boxClass?: string;
  closeOnBackdrop?: boolean; // default true
  draggable?: boolean; // default false
}>();

const [state, send] = useMachine(dialog.machine({
  id: props.id,
  closeOnOutsideClick: props.closeOnBackdrop !== false,
}));
const api = computed(() => dialog.connect(state.value, send, normalizeProps));

const draggable = computed(() => props.draggable === true)
const dx = ref(0)
const dy = ref(0)
let dragging = false
let startX = 0
let startY = 0

function onDragStart(e: PointerEvent) {
  if (!draggable.value) return
  dragging = true
  startX = e.clientX
  startY = e.clientY
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}
function onDragMove(e: PointerEvent) {
  if (!dragging) return
  const dxDelta = e.clientX - startX
  const dyDelta = e.clientY - startY
  dx.value += dxDelta
  dy.value += dyDelta
  startX = e.clientX
  startY = e.clientY
}
function onDragEnd() {
  dragging = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
}

const mounted = ref(false)
onMounted(() => { mounted.value = true })
onUnmounted(() => { onDragEnd() })
</script>

