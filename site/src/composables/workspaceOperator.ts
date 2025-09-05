/**
 * 工作区AI操作管理器
 * 负责处理AI机器人对工作区的操作需求，包括异步事件队列、键鼠锁定等功能
 */

import type { Ref } from 'vue'
import { ref, reactive, nextTick } from 'vue'

// 操作类型枚举
export enum OperationType {
  KEYBOARD = 'keyboard',  // 键盘操作
  MOUSE = 'mouse',       // 鼠标操作
  AI_LLM = 'ai_llm',     // AI/LLM操作
  EDITOR = 'editor',     // 编辑器操作
  SYSTEM = 'system'      // 系统操作
}

// 操作状态枚举
export enum OperationStatus {
  PENDING = 'pending',     // 等待执行
  RUNNING = 'running',     // 执行中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed',       // 失败
  CANCELLED = 'cancelled'  // 已取消
}

// 操作接口定义
export interface WorkspaceOperation {
  id: string
  type: OperationType
  description: string
  priority: number // 优先级，数字越小优先级越高
  payload: any     // 操作参数
  status: OperationStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  error?: string
  onProgress?: (progress: number) => void
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
}

// AI需求解析结果
export interface AiRequirement {
  action: string      // 动作类型：'edit', 'format', 'generate', 'analyze' 等
  target: string      // 操作目标：'selection', 'document', 'css' 等
  parameters: Record<string, any> // 操作参数
  prompt?: string     // 原始用户输入
}

// 锁定状态管理
interface LockState {
  isLocked: boolean
  lockType: OperationType | null
  lockReason: string
  lockedAt: number | null
  operationId: string | null
}

class WorkspaceOperator {
  private operations: Map<string, WorkspaceOperation> = new Map()
  private operationQueue: WorkspaceOperation[] = []
  private isProcessing = ref(false)
  private lockState = reactive<LockState>({
    isLocked: false,
    lockType: null,
    lockReason: '',
    lockedAt: null,
    operationId: null
  })
  
  // 事件监听器存储
  private eventListeners: Map<string, Function[]> = new Map()
  
  // 工作区状态引用（用于获取选中文本等）
  private workspaceState: any = null
  
  constructor() {
    this.initializeEventListeners()
  }
  
  /**
   * 设置工作区状态引用
   */
  public setWorkspaceState(state: any) {
    this.workspaceState = state
  }

  /**
   * 初始化事件监听器
   */
  private initializeEventListeners() {
    // 监听键盘事件
    document.addEventListener('keydown', this.handleKeyboardEvent.bind(this), true)
    document.addEventListener('keyup', this.handleKeyboardEvent.bind(this), true)
    
    // 监听鼠标事件
    document.addEventListener('mousedown', this.handleMouseEvent.bind(this), true)
    document.addEventListener('mouseup', this.handleMouseEvent.bind(this), true)
    document.addEventListener('click', this.handleMouseEvent.bind(this), true)
  }

  /**
   * 处理键盘事件
   */
  private handleKeyboardEvent(event: KeyboardEvent) {
    if (this.lockState.isLocked && this.lockState.lockType === OperationType.AI_LLM) {
      // 如果AI操作正在进行，阻止键盘事件
      event.preventDefault()
      event.stopPropagation()
      console.log('[WorkspaceOperator] 键盘事件已被锁定，原因:', this.lockState.lockReason)
      return false
    }
    
    // 触发键盘操作事件
    this.emitEvent('keyboard', {
      type: event.type,
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    })
  }

  /**
   * 处理鼠标事件
   */
  private handleMouseEvent(event: MouseEvent) {
    if (this.lockState.isLocked && this.lockState.lockType === OperationType.AI_LLM) {
      // 如果AI操作正在进行，阻止鼠标事件
      event.preventDefault()
      event.stopPropagation()
      console.log('[WorkspaceOperator] 鼠标事件已被锁定，原因:', this.lockState.lockReason)
      return false
    }
    
    // 触发鼠标操作事件
    this.emitEvent('mouse', {
      type: event.type,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target
    })
  }

  /**
   * 解析AI对话需求
   */
  public parseAiRequirement(userInput: string): AiRequirement | null {
    const input = userInput.toLowerCase().trim()
    
    // 简单的关键词匹配解析（后续可以用更高级的NLP）
    const patterns = [
      {
        keywords: ['编辑', '修改', '改写', '重写'],
        action: 'edit',
        target: 'selection'
      },
      {
        keywords: ['格式化', '整理', '排版'],
        action: 'format',
        target: 'selection'
      },
      {
        keywords: ['生成', '创建', '写', '添加'],
        action: 'generate',
        target: 'document'
      },
      {
        keywords: ['分析', '检查', '查看'],
        action: 'analyze',
        target: 'document'
      },
      {
        keywords: ['样式', 'css', '外观'],
        action: 'edit',
        target: 'css'
      }
    ]

    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword => input.includes(keyword))) {
        return {
          action: pattern.action,
          target: pattern.target,
          parameters: {},
          prompt: userInput
        }
      }
    }

    return null
  }

  /**
   * 添加操作到队列
   */
  public async addOperation(operation: Omit<WorkspaceOperation, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const fullOperation: WorkspaceOperation = {
      ...operation,
      id,
      status: OperationStatus.PENDING,
      createdAt: Date.now()
    }
    
    this.operations.set(id, fullOperation)
    this.operationQueue.push(fullOperation)
    
    // 按优先级排序
    this.operationQueue.sort((a, b) => a.priority - b.priority)
    
    console.log(`[WorkspaceOperator] 添加操作: ${operation.description} (ID: ${id})`)
    
    // 如果没有正在处理的操作，启动处理
    if (!this.isProcessing.value) {
      this.processQueue()
    }
    
    return id
  }

  /**
   * 处理操作队列
   */
  private async processQueue() {
    if (this.isProcessing.value || this.operationQueue.length === 0) {
      return
    }
    
    this.isProcessing.value = true
    
    // 使用 for 循环替代 while，更清晰的控制流
    const queueLength = this.operationQueue.length
    for (let i = 0; i < queueLength; i++) {
      const operation = this.operationQueue.shift()!
      if (operation) {
        await this.executeOperation(operation)
      }
    }
    
    this.isProcessing.value = false
  }

  /**
   * 执行单个操作
   */
  private async executeOperation(operation: WorkspaceOperation) {
    console.log(`[WorkspaceOperator] 开始执行操作: ${operation.description}`)
    
    // 更新操作状态
    operation.status = OperationStatus.RUNNING
    operation.startedAt = Date.now()
    
    try {
      // 如果是AI/LLM操作，需要锁定键鼠
      if (operation.type === OperationType.AI_LLM) {
        this.lockKeyboardMouse(operation.id, `正在执行AI操作: ${operation.description}`)
      }
      
      // 根据操作类型执行相应的处理
      let result: any
      
      switch (operation.type) {
        case OperationType.AI_LLM:
          result = await this.executeAiOperation(operation)
          break
        case OperationType.EDITOR:
          result = await this.executeEditorOperation(operation)
          break
        case OperationType.SYSTEM:
          result = await this.executeSystemOperation(operation)
          break
        default:
          throw new Error(`不支持的操作类型: ${operation.type}`)
      }
      
      // 操作完成
      operation.status = OperationStatus.COMPLETED
      operation.completedAt = Date.now()
      
      console.log(`[WorkspaceOperator] 操作完成: ${operation.description}`)
      
      // 调用完成回调
      if (operation.onComplete) {
        operation.onComplete(result)
      }
      
    } catch (error) {
      console.error(`[WorkspaceOperator] 操作失败: ${operation.description}`, error)
      
      // 操作失败
      operation.status = OperationStatus.FAILED
      operation.error = error instanceof Error ? error.message : String(error)
      operation.completedAt = Date.now()
      
      // 调用错误回调
      if (operation.onError) {
        operation.onError(error instanceof Error ? error : new Error(String(error)))
      }
      
    } finally {
      // 如果是AI/LLM操作，解除锁定
      if (operation.type === OperationType.AI_LLM) {
        this.unlockKeyboardMouse()
      }
      
      // 触发操作完成事件
      this.emitEvent('operationComplete', {
        operation,
        success: operation.status === OperationStatus.COMPLETED
      })
    }
  }

  /**
   * 执行AI操作
   */
  private async executeAiOperation(operation: WorkspaceOperation): Promise<any> {
    const { action, target, prompt } = operation.payload
    
    // 模拟AI处理延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 根据不同的action执行相应的AI操作
    switch (action) {
      case 'edit':
        return await this.performAiEdit(target, prompt)
      case 'generate':
        return await this.performAiGenerate(target, prompt)
      case 'analyze':
        return await this.performAiAnalyze(target, prompt)
      default:
        throw new Error(`不支持的AI操作: ${action}`)
    }
  }

  /**
   * 执行编辑器操作
   */
  private async executeEditorOperation(operation: WorkspaceOperation): Promise<any> {
    // 这里可以集成Monaco编辑器的操作
    console.log('执行编辑器操作:', operation.payload)
    return { success: true }
  }

  /**
   * 执行系统操作
   */
  private async executeSystemOperation(operation: WorkspaceOperation): Promise<any> {
    // 这里可以执行系统级别的操作
    console.log('执行系统操作:', operation.payload)
    return { success: true }
  }

  /**
   * 执行AI编辑操作
   */
  private async performAiEdit(target: string, prompt: string): Promise<any> {
    console.log(`[WorkspaceOperator] 执行AI编辑操作 - 目标: ${target}`)
    
    try {
      // 获取当前选中的文本
      const selectedText = this.getCurrentSelection()
      
      // 构建AI编辑提示
      const editPrompt = this.buildEditPrompt(prompt, selectedText, target)
      
      // 调用现有的AI API
      const result = await this.callAiApi({
        action: 'edit',
        prompt: editPrompt,
        selectedText,
        target
      })
      
      return {
        text: result.text,
        target,
        originalText: selectedText,
        action: 'edit'
      }
    } catch (error) {
      console.error('[WorkspaceOperator] AI编辑操作失败:', error)
      throw error
    }
  }

  /**
   * 执行AI生成操作
   */
  private async performAiGenerate(target: string, prompt: string): Promise<any> {
    console.log(`[WorkspaceOperator] 执行AI生成操作 - 目标: ${target}`)
    
    try {
      const context = this.getContextForGeneration(target)
      const generatePrompt = this.buildGeneratePrompt(prompt, context, target)
      
      const result = await this.callAiApi({
        action: 'generate',
        prompt: generatePrompt,
        context,
        target
      })
      
      return {
        text: result.text,
        target,
        context,
        action: 'generate'
      }
    } catch (error) {
      console.error('[WorkspaceOperator] AI生成操作失败:', error)
      throw error
    }
  }

  /**
   * 执行AI分析操作
   */
  private async performAiAnalyze(target: string, prompt: string): Promise<any> {
    console.log(`[WorkspaceOperator] 执行AI分析操作 - 目标: ${target}`)
    
    try {
      const analyzeText = this.getTextForAnalysis(target)
      const analyzePrompt = this.buildAnalyzePrompt(prompt, analyzeText, target)
      
      const result = await this.callAiApi({
        action: 'analyze',
        prompt: analyzePrompt,
        text: analyzeText,
        target
      })
      
      return {
        analysis: result.text,
        target,
        originalText: analyzeText,
        action: 'analyze'
      }
    } catch (error) {
      console.error('[WorkspaceOperator] AI分析操作失败:', error)
      throw error
    }
  }

  /**
   * 锁定键盘和鼠标操作
   */
  public lockKeyboardMouse(operationId: string, reason: string) {
    this.lockState.isLocked = true
    this.lockState.lockType = OperationType.AI_LLM
    this.lockState.lockReason = reason
    this.lockState.lockedAt = Date.now()
    this.lockState.operationId = operationId
    
    console.log(`[WorkspaceOperator] 锁定键鼠操作: ${reason}`)
    
    this.emitEvent('lockStateChanged', {
      locked: true,
      reason,
      operationId
    })
  }

  /**
   * 解除键盘和鼠标锁定
   */
  public unlockKeyboardMouse() {
    const wasLocked = this.lockState.isLocked
    
    this.lockState.isLocked = false
    this.lockState.lockType = null
    this.lockState.lockReason = ''
    this.lockState.lockedAt = null
    this.lockState.operationId = null
    
    if (wasLocked) {
      console.log('[WorkspaceOperator] 解除键鼠锁定')
      
      this.emitEvent('lockStateChanged', {
        locked: false,
        reason: '',
        operationId: null
      })
    }
  }

  /**
   * 获取锁定状态
   */
  public getLockState() {
    return { ...this.lockState }
  }

  /**
   * 取消操作
   */
  public cancelOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId)
    if (!operation) {
      return false
    }
    
    if (operation.status === OperationStatus.RUNNING) {
      // 正在运行的操作需要特殊处理
      operation.status = OperationStatus.CANCELLED
      
      // 如果是锁定的操作，解除锁定
      if (this.lockState.operationId === operationId) {
        this.unlockKeyboardMouse()
      }
    } else if (operation.status === OperationStatus.PENDING) {
      // 移除队列中的操作
      const index = this.operationQueue.findIndex(op => op.id === operationId)
      if (index >= 0) {
        this.operationQueue.splice(index, 1)
      }
      operation.status = OperationStatus.CANCELLED
    }
    
    console.log(`[WorkspaceOperator] 取消操作: ${operation.description}`)
    return true
  }

  /**
   * 获取操作状态
   */
  public getOperationStatus(operationId: string): OperationStatus | null {
    const operation = this.operations.get(operationId)
    return operation?.status || null
  }

  /**
   * 获取所有操作
   */
  public getAllOperations(): WorkspaceOperation[] {
    return Array.from(this.operations.values())
  }

  /**
   * 事件监听
   */
  public on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  /**
   * 移除事件监听
   */
  public off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index >= 0) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(event: string, data: any) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[WorkspaceOperator] 事件回调错误 (${event}):`, error)
        }
      })
    }
  }

  /**
   * 调用AI API
   */
  private async callAiApi(params: {
    action: string;
    prompt: string;
    selectedText?: string;
    context?: string;
    text?: string;
    target: string;
  }): Promise<any> {
    try {
      const { action, prompt, selectedText, context, text, target } = params
      
      // 构建API请求体（显式包含选中文本，便于后端检查）
      let apiPrompt = prompt
      
      // 根据操作类型构建不同的提示格式
      if (action === 'edit' && selectedText) {
        apiPrompt = `${prompt}\n\n选中的文本:\n${selectedText}\n\n请保持原有格式，只修改内容。`
      } else if (action === 'generate' && context) {
        apiPrompt = `${prompt}\n\n上下文:\n${context}\n\n请生成相关内容。`
      } else if (action === 'analyze' && text) {
        apiPrompt = `${prompt}\n\n要分析的文本:\n${text}\n\n请提供详细分析。`
      }
      
      const body = {
        model: 'o3',
        input: apiPrompt,
        reasoning: { effort: 'medium' },
        max_output_tokens: 2048,
        meta: {
          target,
          hasSelection: !!selectedText,
          selectedPreview: selectedText?.slice(0, 120) || ''
        }
      }
      
      // 使用现有的API端点
      const base = (typeof window !== 'undefined' && (window as any).__NUXT__?.config?.app?.baseURL) || '/'
      const apiURL = (base.endsWith('/') ? base : base + '/') + 'api/ai'
      
      console.log(`[WorkspaceOperator] 调用AI API: ${action}`, { apiURL, prompt: apiPrompt.substring(0, 100) + '...' })
      
      const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI API调用失败: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      
      // 解析AI响应
      const result = this.parseAiResponse(data)
      
      console.log(`[WorkspaceOperator] AI API响应:`, { action, resultLength: result.text?.length || 0 })
      
      return result
      
    } catch (error) {
      console.error('[WorkspaceOperator] AI API调用失败:', error)
      throw error
    }
  }
  
  /**
   * 解析AI响应
   */
  private parseAiResponse(data: any): { text: string } {
    // 处理不同的响应格式（基于现有的AI工具栏实现）
    if (typeof data?.output_text === 'string') return { text: data.output_text }
    if (typeof data?.text === 'string') return { text: data.text }
    
    const arr = Array.isArray(data?.output) ? data.output : []
    for (const item of arr) {
      if (item?.type === 'message' && Array.isArray(item?.content)) {
        const outTxt = item.content.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string')
        if (outTxt) return { text: outTxt.text as string }
        const anyTxt = item.content.find((c: any) => typeof c?.text === 'string')
        if (anyTxt) return { text: anyTxt.text as string }
      }
    }
    
    // 后备解析
    return { 
      text: data?.choices?.[0]?.message?.content || 
            data?.reply || 
            (typeof data === 'string' ? data : JSON.stringify(data)) 
    }
  }
  
  /**
   * 获取当前选中文本
   */
  private getCurrentSelection(): string {
    try {
      if (this.workspaceState?.currentSelection?.hasSelection) {
        return this.workspaceState.currentSelection.text || ''
      }
      return ''
    } catch (error) {
      console.warn('[WorkspaceOperator] 获取选中文本失败:', error)
      return ''
    }
  }
  
  /**
   * 构建编辑提示
   */
  private buildEditPrompt(userPrompt: string, selectedText: string, target: string): string {
    const examples = `格式保持示例:
- 粗体: **文本**
- 斜体: *文本*
- 代码: \`代码\`
- 链接: [文本](链接)
- 图片: ![描述](链接)
- 交叉引用: [~P1] 和 [~P1]: 定义
- 标题: #, ##, ### 前缀
- 列表: -, 1., >, : 前缀
如果选中内容包含格式标记，请保持结构只修改自然语言文本。`

    return `${userPrompt}\n\n${examples}\n\n目标: ${target}`
  }
  
  /**
   * 构建生成提示
   */
  private buildGeneratePrompt(userPrompt: string, context: string, target: string): string {
    return `${userPrompt}\n\n请根据以下上下文生成内容:\n${context}\n\n目标位置: ${target}`
  }
  
  /**
   * 构建分析提示
   */
  private buildAnalyzePrompt(userPrompt: string, text: string, target: string): string {
    return `${userPrompt}\n\n请分析以下内容并提供详细反馈:\n\n${text}`
  }
  
  /**
   * 获取生成上下文
   */
  private getContextForGeneration(target: string): string {
    // 根据目标获取相应的上下文
    // 实际实现时需要从编辑器获取周围内容
    return '当前文档上下文...'
  }
  
  /**
   * 获取分析文本
   */
  private getTextForAnalysis(target: string): string {
    // 根据目标获取要分析的文本
    // 实际实现时需要从编辑器获取选中文本或文档内容
    return '要分析的文本内容...'
  }

  /**
   * 销毁实例
   */
  public destroy() {
    // 移除事件监听器
    document.removeEventListener('keydown', this.handleKeyboardEvent.bind(this), true)
    document.removeEventListener('keyup', this.handleKeyboardEvent.bind(this), true)
    document.removeEventListener('mousedown', this.handleMouseEvent.bind(this), true)
    document.removeEventListener('mouseup', this.handleMouseEvent.bind(this), true)
    document.removeEventListener('click', this.handleMouseEvent.bind(this), true)
    
    // 清理数据
    this.operations.clear()
    this.operationQueue.length = 0
    this.eventListeners.clear()
    
    // 解除锁定
    this.unlockKeyboardMouse()
  }
}

// 创建单例实例
let workspaceOperatorInstance: WorkspaceOperator | null = null

/**
 * 获取工作区操作管理器实例
 */
export function useWorkspaceOperator(): WorkspaceOperator {
  if (!workspaceOperatorInstance) {
    workspaceOperatorInstance = new WorkspaceOperator()
  }
  return workspaceOperatorInstance
}

/**
 * 销毁工作区操作管理器实例
 */
export function destroyWorkspaceOperator() {
  if (workspaceOperatorInstance) {
    workspaceOperatorInstance.destroy()
    workspaceOperatorInstance = null
  }
}
