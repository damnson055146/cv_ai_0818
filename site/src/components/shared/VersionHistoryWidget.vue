<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { FlatStorageManager } from '~/data/storage'
import type { DocumentVersion } from '~/data/ds'
import { useNuxtApp } from '#app'

const route = useRoute()
const visible = ref(false)
const loading = ref(false)
const versions = ref<DocumentVersion[]>([])
const error = ref<string | null>(null)
const storage = new FlatStorageManager()
const nuxtApp = useNuxtApp()
const toastApi = computed<any>(() => (nuxtApp.$toast as any)?.value)

const documentId = computed(() => {
  const id = route.params?.id
  if (Array.isArray(id)) return id[0]
  return (id as string) || ''
})

async function loadVersions() {
  if (!documentId.value) return
  loading.value = true
  error.value = null
  try {
    const list = await storage.loadDocumentVersions(documentId.value)
    // 最新在前：优先按 versionNumber，其次 timestamp
    versions.value = (list || []).slice().sort((a, b) => {
      const byVer = (b.versionNumber ?? 0) - (a.versionNumber ?? 0)
      if (byVer !== 0) return byVer
      return (b.timestamp ?? 0) - (a.timestamp ?? 0)
    })
    // 重置分页
    page.value = 1
  } catch (e: any) {
    error.value = e?.message || String(e)
    toastApi.value?.create?.({ description: error.value, type: 'error' })
  } finally {
    loading.value = false
  }
}

function formatTime(ts: number) {
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}

async function copyContent(v: DocumentVersion) {
  try {
    await navigator.clipboard.writeText(v.content)
    toastApi.value?.create?.({ description: '内容已复制到剪贴板', type: 'success' })
  } catch (e) {
    toastApi.value?.create?.({ description: '复制失败', type: 'error' })
  }
}

watch(() => documentId.value, () => {
  if (visible.value) loadVersions()
})

// 分页与虚拟列表（增量渲染）
const pageSize = 30
const page = ref(1)
const hasMore = computed(() => (versions.value.length > page.value * pageSize))
const visibleVersions = computed(() => versions.value.slice(0, page.value * pageSize))

function loadMore() {
  if (hasMore.value && !loading.value) page.value += 1
}

// 无限滚动：交叉观察器
const sentinelEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function setupObserver() {
  if (observer) observer.disconnect()
  if (!sentinelEl.value) return
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0]
    if (entry && entry.isIntersecting) loadMore()
  }, { root: panelBodyEl.value, rootMargin: '0px', threshold: 1.0 })
  observer.observe(sentinelEl.value)
}

const panelBodyEl = ref<HTMLElement | null>(null)

// 订阅存储更新（跨标签页）
function handleStorage(e: StorageEvent) {
  if (!e.key || !documentId.value) return
  const keyPrefix = `cv_doc_versions_${documentId.value}`
  if (e.key === keyPrefix) {
    loadVersions()
    toastApi.value?.create?.({ description: '检测到版本更新，已刷新', type: 'info' })
  }
}

// 同页事件（手动触发）
function handleSameTabUpdate(e: Event) {
  const detail = (e as CustomEvent).detail
  if (detail?.documentId === documentId.value) {
    loadVersions()
    toastApi.value?.create?.({ description: '已保存新的版本', type: 'success' })
  }
}

watch(() => visible.value, (v) => {
  if (v) {
    loadVersions()
    setupObserver()
  } else if (observer) {
    observer.disconnect()
  }
})

onMounted(() => {
  // 初次不加载，待用户展开再加载
  window.addEventListener('storage', handleStorage)
  window.addEventListener('cv_doc_versions_updated', handleSameTabUpdate as any)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorage)
  window.removeEventListener('cv_doc_versions_updated', handleSameTabUpdate as any)
  if (observer) observer.disconnect()
})

// ===== 可拖拽支持 =====
const panelEl = ref<HTMLElement | null>(null)
const panelTop = ref<number>(56)
const panelLeft = ref<number>(12)
const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let startTop = 56
let startLeft = 12

function loadSavedPosition() {
  try {
    const raw = localStorage.getItem('cv_vhw_pos')
    if (!raw) return
    const pos = JSON.parse(raw) as { top: number; left: number }
    if (typeof pos.top === 'number') panelTop.value = pos.top
    if (typeof pos.left === 'number') panelLeft.value = pos.left
  } catch {}
}

function savePosition() {
  try {
    localStorage.setItem('cv_vhw_pos', JSON.stringify({ top: panelTop.value, left: panelLeft.value }))
  } catch {}
}

function clampPosition(nt: number, nl: number) {
  const pad = 8
  const ww = window.innerWidth
  const wh = window.innerHeight
  const w = panelEl.value?.offsetWidth ?? 360
  const h = panelEl.value?.offsetHeight ?? 360
  const maxL = Math.max(0, ww - w - pad)
  const maxT = Math.max(0, wh - h - pad)
  return {
    top: Math.min(Math.max(pad, nt), maxT),
    left: Math.min(Math.max(pad, nl), maxL)
  }
}

async function ensureInitialPosition() {
  await nextTick()
  // 若已有保存位置，使用之；否则默认贴近右上角
  loadSavedPosition()
  if (panelLeft.value === 12 && panelTop.value === 56 && panelEl.value) {
    const w = panelEl.value.offsetWidth || 360
    const { left } = clampPosition(panelTop.value, window.innerWidth - w - 12)
    panelLeft.value = left
  }
}

function onDragStart(e: PointerEvent) {
  if (!panelEl.value) return
  dragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  startTop = panelTop.value
  startLeft = panelLeft.value
  // 监听移动/结束
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  const dt = e.clientY - dragStartY
  const dl = e.clientX - dragStartX
  const { top, left } = clampPosition(startTop + dt, startLeft + dl)
  panelTop.value = top
  panelLeft.value = left
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  savePosition()
}

// 暴露给父组件的方法
function show() {
  visible.value = true
  loadVersions()
  ensureInitialPosition()
}

// 暴露方法给父组件使用
defineExpose({
  show
})
</script>

<template>
  <!-- 右上角浮动图标按钮（现在隐藏，通过工具栏调用） -->
  <button
    v-show="false"
    class="vhw-btn"
    title="版本历史"
    @click="visible = !visible; if (visible) { loadVersions(); ensureInitialPosition(); }"
  >
    <!-- 简单图标：时钟/历史 -->
    <span>⏱️</span>
  </button>

  <!-- 卡片面板 -->
  <div
    v-if="visible"
    class="vhw-panel"
    :style="{ top: panelTop + 'px', left: panelLeft + 'px' }"
    ref="panelEl"
  >
    <div class="vhw-header" @pointerdown.stop.prevent="onDragStart">
      <div class="vhw-title">版本历史</div>
      <div class="vhw-actions">
        <button class="vhw-link" @click="loadVersions" :disabled="loading">{{ loading ? '加载中...' : '刷新' }}</button>
        <button class="vhw-link" @click="visible = false">关闭</button>
      </div>
    </div>

    <div v-if="!documentId" class="vhw-empty">未检测到文档ID</div>
    <div v-else-if="error" class="vhw-error">{{ error }}</div>
    <div v-else class="vhw-list" ref="panelBodyEl">
      <div class="vhw-summary" v-if="versions.length">
        共 {{ versions.length }} 条 · 已加载 {{ visibleVersions.length }} 条
      </div>
      <div v-if="!versions.length && !loading" class="vhw-empty">暂无版本记录</div>
      <ul v-else>
        <li v-for="v in visibleVersions" :key="v.id" class="vhw-item">
          <div class="vhw-item-row">
            <div class="vhw-item-title">#{{ v.versionNumber }} · {{ v.operationType }} · {{ formatTime(v.timestamp) }}</div>
            <button class="vhw-mini" @click="copyContent(v)">复制内容</button>
          </div>
          <div class="vhw-meta">来源: {{ v.operationSource }} · 变更: +{{ v.charactersAdded }} / -{{ v.charactersRemoved }}</div>
          <details class="vhw-details">
            <summary>查看内容</summary>
            <pre class="vhw-pre">{{ v.content }}</pre>
          </details>
        </li>
      </ul>
      <div v-if="hasMore && !loading" class="vhw-load-more">
        <button class="vhw-mini" @click="loadMore">加载更多</button>
      </div>
      <div ref="sentinelEl" style="height:1px;"></div>
    </div>
  </div>
</template>

<style scoped>
.vhw-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,0.1);
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  cursor: pointer;
}
.vhw-panel {
  position: fixed;
  z-index: 1000;
  width: 360px;
  max-height: 70vh;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.vhw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  cursor: move;
}
.vhw-title { font-weight: 600; }
.vhw-actions { display: flex; gap: 8px; }
.vhw-link {
  background: transparent;
  border: none;
  color: #2563eb;
  cursor: pointer;
}
.vhw-list { padding: 8px 12px 12px; }
.vhw-summary { padding: 4px 0 8px; color: #64748b; font-size: 12px; }
.vhw-item { padding: 8px 0; border-bottom: 1px dashed rgba(0,0,0,0.06); }
.vhw-item:last-child { border-bottom: none; }
.vhw-item-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vhw-item-title { font-size: 13px; font-weight: 600; }
.vhw-meta { color: #64748b; font-size: 12px; margin-top: 2px; }
.vhw-mini { border: 1px solid rgba(0,0,0,0.1); background: #f8fafc; font-size: 12px; padding: 2px 6px; border-radius: 4px; cursor: pointer; }
.vhw-empty { padding: 12px; color: #64748b; }
.vhw-error { padding: 12px; color: #b91c1c; }
.vhw-details { margin-top: 6px; }
.vhw-pre {
  white-space: pre-wrap;
  background: #f8fafc;
  border: 1px solid rgba(0,0,0,0.06);
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
}
.vhw-load-more { display:flex; justify-content:center; padding: 8px 0; }
</style>


