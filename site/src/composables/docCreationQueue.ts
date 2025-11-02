import { computed, markRaw } from 'vue'
import { useState } from '#app'
import { useEventBus } from '@vueuse/core'

export type TaskStatus = 'queued' | 'running' | 'success' | 'error'
export type DocCreationType = 'cv' | 'ps' | 'rec' | string

export interface DocCreationResult {
  docIds?: string[]
  message?: string
  metadata?: Record<string, any>
}

export interface DocCreationTaskContext {
  update: (message: string) => void
  signal: AbortSignal
}

export type DocCreationRunner = (ctx: DocCreationTaskContext) => Promise<DocCreationResult | void>

export interface QueueTask {
  id: string
  userId: string | number
  type: DocCreationType
  title: string
  status: TaskStatus
  progress: string
  updates: string[]
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  docIds: string[]
  error?: string
  runner?: DocCreationRunner
}

export interface QueueEventPayload {
  taskId: string
  type: DocCreationType
  userId: string | number
  docIds: string[]
  timestamp: number
  metadata?: Record<string, any>
}

interface QueueState {
  tasks: QueueTask[]
  perUserLimit: number
  lastTaskId: number
}

const CLEANUP_DELAY = 15_000
const DEFAULT_LIMIT = 5
const MAX_UPDATES = 20

const createInitialState = (): QueueState => ({
  tasks: [],
  perUserLimit: DEFAULT_LIMIT,
  lastTaskId: 0,
})

const createTaskId = (state: QueueState) => {
  state.lastTaskId += 1
  return `task_${Date.now()}_${state.lastTaskId}`
}

const normalizeMessage = (message: string) => message?.trim() || ''

export function useDocCreationQueue() {
  const state = useState<QueueState>('doc-creation-queue', createInitialState)
  const createdBus = useEventBus<QueueEventPayload>('resumes:created')

  const updateTask = (taskId: string, patch: Partial<QueueTask>) => {
    const index = state.value.tasks.findIndex(task => task.id === taskId)
    if (index === -1) return
    const now = Date.now()
    const next = state.value.tasks.slice()
    next[index] = {
      ...next[index],
      ...patch,
      updatedAt: now,
    }
    state.value.tasks = next
  }

  const appendUpdate = (taskId: string, message: string) => {
    const text = normalizeMessage(message)
    if (!text) return
    const index = state.value.tasks.findIndex(task => task.id === taskId)
    if (index === -1) return
    const next = state.value.tasks.slice()
    const task = next[index]
    next[index] = {
      ...task,
      progress: text,
      updates: task.updates.concat(text).slice(-MAX_UPDATES),
      updatedAt: Date.now(),
    }
    state.value.tasks = next
  }

  const removeTask = (taskId: string) => {
    state.value.tasks = state.value.tasks.filter(task => task.id !== taskId)
  }

  const scheduleCleanup = (taskId: string) => {
    if (import.meta.server) return
    setTimeout(() => removeTask(taskId), CLEANUP_DELAY)
  }

  const runningCountForUser = (userId: string | number) => state.value.tasks
    .filter(task => task.userId === userId && task.status === 'running').length

  const startTask = (taskId: string) => {
    const task = state.value.tasks.find(item => item.id === taskId)
    if (!task || task.status !== 'queued' || !task.runner) return

    const controller = new AbortController()
    updateTask(taskId, {
      status: 'running',
      startedAt: Date.now(),
      progress: '处理中…',
    })

    const ctx: DocCreationTaskContext = {
      update: (message: string) => appendUpdate(taskId, message),
      signal: controller.signal,
    }

    Promise.resolve()
      .then(() => task.runner?.(ctx) || {})
      .then((result) => {
        const payload = (result || {}) as DocCreationResult
        const docIds = Array.isArray(payload.docIds) ? payload.docIds.filter(Boolean) : []
        updateTask(taskId, {
          status: 'success',
          completedAt: Date.now(),
          progress: payload.message ? normalizeMessage(payload.message) || '已完成' : '已完成',
          docIds,
          runner: undefined,
        })
        createdBus.emit({
          taskId,
          type: task.type,
          userId: task.userId,
          docIds,
          metadata: payload.metadata,
          timestamp: Date.now(),
        })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error ?? 'Unknown error')
        updateTask(taskId, {
          status: 'error',
          completedAt: Date.now(),
          progress: normalizeMessage(message) || '创建失败',
          error: message,
          runner: undefined,
        })
      })
      .finally(() => {
        scheduleCleanup(taskId)
        queueTick()
      })
  }

  const queueTick = () => {
    for (const task of state.value.tasks) {
      if (task.status !== 'queued') continue
      if (runningCountForUser(task.userId) >= state.value.perUserLimit) continue
      startTask(task.id)
    }
  }

  const enqueue = (
    userId: string | number,
    type: DocCreationType,
    title: string,
    runner: DocCreationRunner,
  ) => {
    const now = Date.now()
    const id = createTaskId(state.value)
    const next: QueueTask = {
      id,
      userId,
      type,
      title,
      status: 'queued',
      progress: '等待中…',
      updates: [],
      createdAt: now,
      updatedAt: now,
      docIds: [],
      runner: markRaw(runner),
    }
    state.value.tasks = state.value.tasks.concat(next)
    queueTick()
    return id
  }

  const tasks = computed(() => state.value.tasks)
  const activeTasks = computed(() => state.value.tasks.filter(task => task.status === 'queued' || task.status === 'running'))

  return {
    tasks,
    activeTasks,
    enqueue,
    removeTask,
    setPerUserLimit(limit: number) {
      state.value.perUserLimit = limit > 0 ? limit : DEFAULT_LIMIT
      queueTick()
    },
  }
}
