/**
 * 工作区状态管理
 * 管理工作区的AI操作状态、锁定状态和操作历史
 */

import { acceptHMRUpdate, defineStore } from "pinia"
import { ref, reactive, computed } from "vue"
import { useWorkspaceOperator, type WorkspaceOperation, OperationStatus, OperationType } from "../workspaceOperator"

export interface WorkspaceState {
  // AI助手状态
  aiAssistantActive: boolean
  aiProcessing: boolean
  
  // 键鼠锁定状态
  isLocked: boolean
  lockReason: string
  lockOperationId: string | null
  
  // 操作历史
  recentOperations: WorkspaceOperation[]
  
  // 选区信息
  currentSelection: {
    text: string
    start: number
    end: number
    hasSelection: boolean
  }
  
  // 工作区模式
  mode: 'normal' | 'ai-assistance' | 'locked'
}

export const useWorkspaceStore = defineStore("workspace", () => {
  // 初始化工作区操作管理器
  const operator = useWorkspaceOperator()
  
  // 状态定义
  const state = reactive<WorkspaceState>({
    aiAssistantActive: false,
    aiProcessing: false,
    isLocked: false,
    lockReason: '',
    lockOperationId: null,
    recentOperations: [],
    currentSelection: {
      text: '',
      start: 0,
      end: 0,
      hasSelection: false
    },
    mode: 'normal'
  })
  
  // 计算属性
  const canOperate = computed(() => !state.isLocked && !state.aiProcessing)
  const operationCount = computed(() => state.recentOperations.length)
  const runningOperations = computed(() => 
    state.recentOperations.filter(op => op.status === OperationStatus.RUNNING)
  )
  
  // 初始化事件监听
  const initializeEventListeners = () => {
    // 设置工作区状态引用，让操作管理器可以访问选中文本等信息
    operator.setWorkspaceState(state)
    
    // 监听锁定状态变化
    operator.on('lockStateChanged', (data: { locked: boolean; reason: string; operationId: string | null }) => {
      state.isLocked = data.locked
      state.lockReason = data.reason
      state.lockOperationId = data.operationId
      updateWorkspaceMode()
    })
    
    // 监听操作完成
    operator.on('operationComplete', (data: { operation: WorkspaceOperation; success: boolean }) => {
      updateRecentOperations()
      if (data.operation.type === OperationType.AI_LLM) {
        state.aiProcessing = false
      }
      updateWorkspaceMode()
    })
    
    // 监听键鼠事件（用于调试和状态更新）
    operator.on('keyboard', (data: any) => {
      console.log('[WorkspaceStore] 键盘事件:', data)
    })
    
    operator.on('mouse', (data: any) => {
      console.log('[WorkspaceStore] 鼠标事件:', data)
    })
  }
  
  // 更新工作区模式
  const updateWorkspaceMode = () => {
    if (state.isLocked) {
      state.mode = 'locked'
    } else if (state.aiAssistantActive || state.aiProcessing) {
      state.mode = 'ai-assistance'
    } else {
      state.mode = 'normal'
    }
  }
  
  // 更新最近操作
  const updateRecentOperations = () => {
    const allOps = operator.getAllOperations()
    // 只保留最近20个操作
    state.recentOperations = allOps
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
  }
  
  // 激活AI助手
  const activateAiAssistant = () => {
    state.aiAssistantActive = true
    updateWorkspaceMode()
  }
  
  // 关闭AI助手
  const deactivateAiAssistant = () => {
    state.aiAssistantActive = false
    updateWorkspaceMode()
  }
  
  // 处理AI对话请求
  const processAiRequest = async (userInput: string): Promise<string> => {
    console.log('[WorkspaceStore] 处理AI请求:', userInput)
    
    // 解析用户需求
    const requirement = operator.parseAiRequirement(userInput)
    
    if (requirement) {
      console.log('[WorkspaceStore] 识别到工作区操作需求:', requirement)
      
      // 创建AI操作
      state.aiProcessing = true
      updateWorkspaceMode()
      
      try {
        const operationId = await operator.addOperation({
          type: OperationType.AI_LLM,
          description: `AI ${requirement.action} 操作: ${requirement.prompt}`,
          priority: 1,
          payload: requirement,
          onProgress: (progress: number) => {
            console.log(`[WorkspaceStore] 操作进度: ${progress}%`)
          },
          onComplete: (result: any) => {
            console.log('[WorkspaceStore] AI操作完成:', result)
            // 这里可以处理操作结果，比如更新编辑器内容
          },
          onError: (error: Error) => {
            console.error('[WorkspaceStore] AI操作失败:', error)
            state.aiProcessing = false
            updateWorkspaceMode()
          }
        })
        
        updateRecentOperations()
        return `正在执行${requirement.action}操作，操作ID: ${operationId}`
        
      } catch (error) {
        state.aiProcessing = false
        updateWorkspaceMode()
        console.error('[WorkspaceStore] 创建AI操作失败:', error)
        return `操作创建失败: ${error instanceof Error ? error.message : String(error)}`
      }
    } else {
      // 普通对话，不涉及工作区操作
      console.log('[WorkspaceStore] 普通对话请求，转发给聊天机器人')
      return `收到消息: ${userInput}` // 这里应该转发给原有的聊天机器人
    }
  }
  
  // 更新选区信息
  const updateSelection = (text: string, start: number, end: number) => {
    state.currentSelection = {
      text,
      start,
      end,
      hasSelection: text.length > 0
    }
  }
  
  // 取消操作
  const cancelOperation = (operationId: string): boolean => {
    const success = operator.cancelOperation(operationId)
    if (success) {
      updateRecentOperations()
      // 如果取消的是AI操作，更新处理状态
      const operation = state.recentOperations.find(op => op.id === operationId)
      if (operation && operation.type === OperationType.AI_LLM) {
        state.aiProcessing = false
        updateWorkspaceMode()
      }
    }
    return success
  }
  
  // 获取操作详情
  const getOperationDetails = (operationId: string): WorkspaceOperation | null => {
    return state.recentOperations.find(op => op.id === operationId) || null
  }
  
  // 强制解锁（紧急情况使用）
  const forceUnlock = () => {
    operator.unlockKeyboardMouse()
    state.aiProcessing = false
    updateWorkspaceMode()
    console.warn('[WorkspaceStore] 强制解锁工作区')
  }
  
  // 获取工作区统计信息
  const getWorkspaceStats = () => {
    const total = state.recentOperations.length
    const completed = state.recentOperations.filter(op => op.status === OperationStatus.COMPLETED).length
    const failed = state.recentOperations.filter(op => op.status === OperationStatus.FAILED).length
    const running = runningOperations.value.length
    
    return {
      total,
      completed,
      failed,
      running,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }
  
  // 清理操作历史
  const clearOperationHistory = () => {
    state.recentOperations = []
  }
  
  // 导出操作历史
  const exportOperationHistory = () => {
    // 安全的日期转换函数
    const safeToISOString = (timestamp: number | undefined): string | null => {
      if (!timestamp || isNaN(timestamp)) return null
      try {
        const date = new Date(timestamp)
        if (isNaN(date.getTime())) return null
        return date.toISOString()
      } catch {
        return null
      }
    }

    const data = {
      exportTime: new Date().toISOString(),
      operations: state.recentOperations.map(op => ({
        id: op.id,
        type: op.type,
        description: op.description,
        status: op.status,
        createdAt: safeToISOString(op.createdAt) || new Date().toISOString(),
        startedAt: safeToISOString(op.startedAt),
        completedAt: safeToISOString(op.completedAt),
        duration: op.startedAt && op.completedAt ? op.completedAt - op.startedAt : null,
        error: op.error
      }))
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workspace-operations-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // 初始化
  initializeEventListeners()
  
  return {
    // 状态
    state,
    
    // 计算属性
    canOperate,
    operationCount,
    runningOperations,
    
    // 方法
    activateAiAssistant,
    deactivateAiAssistant,
    processAiRequest,
    updateSelection,
    cancelOperation,
    getOperationDetails,
    forceUnlock,
    getWorkspaceStats,
    clearOperationHistory,
    exportOperationHistory,
    
    // 工具方法
    updateRecentOperations
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useWorkspaceStore, import.meta.hot))
