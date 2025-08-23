# 双输入模式存储设计

## 1. 核心存储策略

### 存储层级
- **临时存储 (LocalStorage)**: 实时保存所有变更，包含完整元数据
- **硬存储 (IndexedDB/LocalForage)**: 用户主动保存的持久化数据
- **自动更新**: 两种输入都触发相同的更新流程

## 2. 双输入源处理

### 2.1 直接编辑工作区
```typescript
// 监听编辑器变更
interface DirectEditEvent {
  type: 'direct_edit'
  source: 'monaco_editor'
  timestamp: number
  changes: {
    range: {
      startLine: number
      startColumn: number
      endLine: number
      endColumn: number
    }
    text: string
    oldText: string
  }[]
  fullContent: string
}
```

### 2.2 Chatbot对话输入
```typescript
// Chatbot操作结果
interface ChatbotEditEvent {
  type: 'chatbot_edit'
  source: 'chatbot'
  timestamp: number
  userInput: string
  operation: 'rewrite' | 'delete' | 'insert' | 'keep'
  targetId: string
  targetType: 'paragraph' | 'sentence'
  result: {
    oldContent: string
    newContent: string
    success: boolean
  }
  fullContent: string
}
```

## 3. 统一的更新数据结构

### 3.1 操作记录结构
```typescript
interface OperationRecord {
  id: string                    // 操作ID: "op_" + timestamp
  timestamp: number             // 操作时间戳
  type: 'direct_edit' | 'chatbot_edit'
  source: 'monaco_editor' | 'chatbot'
  
  // 操作内容
  operation: {
    type: 'insert' | 'delete' | 'replace' | 'rewrite'
    targetId?: string           // 目标段落/句子ID（chatbot操作有）
    targetType?: 'paragraph' | 'sentence'
    position?: {                // 位置信息（直接编辑有）
      start: number
      end: number
    }
    oldContent: string
    newContent: string
  }
  
  // 用户输入（如果是chatbot）
  userInput?: string
  
  // 文档状态
  documentState: {
    totalLength: number
    paragraphCount: number
    sentenceCount: number
    lastParagraphId: string
    lastSentenceId: string
  }
  
  // 是否已硬存储
  isPersisted: boolean
}

// LocalStorage键: "operation_records"
// 存储格式: OperationRecord[]
```

### 3.2 实时文档状态
```typescript
interface LiveDocumentState {
  // 基础信息
  documentId: string
  lastUpdated: number
  updateSource: 'direct_edit' | 'chatbot_edit'
  
  // 当前内容结构
  content: {
    fullText: string
    paragraphs: ParagraphItem[]
    sentences: SentenceItem[]
    positionIndex: PositionIndex
  }
  
  // 未保存的变更
  unsavedChanges: {
    hasChanges: boolean
    lastSavedAt: number
    changeCount: number
    lastOperationId: string
  }
  
  // 编辑状态
  editingState: {
    isEditing: boolean
    editingSource: 'direct' | 'chatbot' | null
    currentOperation?: string
    lockedBy?: string
  }
}

// LocalStorage键: "live_document_state"
// 存储格式: LiveDocumentState
```

### 3.3 硬存储数据结构
```typescript
interface PersistedDocument {
  // 文档标识
  id: string
  name: string
  
  // 保存时的完整状态
  savedAt: number
  version: string               // 格式: "v_" + timestamp
  
  // 文档内容
  content: {
    markdown: string            // 完整markdown内容
    paragraphs: ParagraphItem[] // 段落结构
    sentences: SentenceItem[]   // 句子结构
    positionIndex: PositionIndex // 位置索引
  }
  
  // 操作历史（保存时的快照）
  operationHistory: OperationRecord[]
  
  // 元数据
  metadata: {
    totalOperations: number
    editingSessions: number
    chatbotOperations: number
    directEdits: number
    totalEditingTime: number    // 毫秒
    averageSessionDuration: number
    lastEditSource: 'direct' | 'chatbot'
  }
  
  // 样式和配置
  styles: ResumeStyles
  css: string
}

// IndexedDB/LocalForage存储
// 键格式: resume_id
```

## 4. 更新处理器实现

### 4.1 统一更新管理器
```typescript
class UnifiedUpdateManager {
  private storage: LocalStorageManager
  private parser: FlatMarkdownParser
  private hardStorage: LocalForage
  
  constructor() {
    this.storage = new LocalStorageManager()
    this.parser = new FlatMarkdownParser()
    this.hardStorage = localForage.createInstance({
      name: 'ResumeHardStorage',
      storeName: 'persisted_documents'
    })
  }
  
  /**
   * 处理直接编辑更新
   */
  async handleDirectEdit(editEvent: DirectEditEvent): Promise<void> {
    console.log('[UpdateManager] 处理直接编辑:', editEvent)
    
    // 1. 解析新的文档结构
    const parseResult = this.parser.parseDocumentToFlat(editEvent.fullContent)
    
    // 2. 创建操作记录
    const operationRecord: OperationRecord = {
      id: `op_${Date.now()}`,
      timestamp: editEvent.timestamp,
      type: 'direct_edit',
      source: 'monaco_editor',
      operation: {
        type: 'replace',
        position: {
          start: this.calculateAbsolutePosition(editEvent.changes[0].range),
          end: this.calculateAbsolutePosition(editEvent.changes[0].range, true)
        },
        oldContent: editEvent.changes[0].oldText,
        newContent: editEvent.changes[0].text
      },
      documentState: {
        totalLength: editEvent.fullContent.length,
        paragraphCount: parseResult.paragraphs.length,
        sentenceCount: parseResult.sentences.length,
        lastParagraphId: parseResult.paragraphs[parseResult.paragraphs.length - 1]?.id || '',
        lastSentenceId: parseResult.sentences[parseResult.sentences.length - 1]?.id || ''
      },
      isPersisted: false
    }
    
    // 3. 更新存储
    await this.updateTemporaryStorage(parseResult, operationRecord, 'direct_edit')
  }
  
  /**
   * 处理Chatbot编辑更新
   */
  async handleChatbotEdit(chatbotEvent: ChatbotEditEvent): Promise<void> {
    console.log('[UpdateManager] 处理Chatbot编辑:', chatbotEvent)
    
    // 1. 解析新的文档结构
    const parseResult = this.parser.parseDocumentToFlat(chatbotEvent.fullContent)
    
    // 2. 创建操作记录
    const operationRecord: OperationRecord = {
      id: `op_${Date.now()}`,
      timestamp: chatbotEvent.timestamp,
      type: 'chatbot_edit',
      source: 'chatbot',
      operation: {
        type: chatbotEvent.operation as any,
        targetId: chatbotEvent.targetId,
        targetType: chatbotEvent.targetType,
        oldContent: chatbotEvent.result.oldContent,
        newContent: chatbotEvent.result.newContent
      },
      userInput: chatbotEvent.userInput,
      documentState: {
        totalLength: chatbotEvent.fullContent.length,
        paragraphCount: parseResult.paragraphs.length,
        sentenceCount: parseResult.sentences.length,
        lastParagraphId: parseResult.paragraphs[parseResult.paragraphs.length - 1]?.id || '',
        lastSentenceId: parseResult.sentences[parseResult.sentences.length - 1]?.id || ''
      },
      isPersisted: false
    }
    
    // 3. 更新存储
    await this.updateTemporaryStorage(parseResult, operationRecord, 'chatbot_edit')
  }
  
  /**
   * 更新临时存储
   */
  private async updateTemporaryStorage(
    parseResult: any, 
    operationRecord: OperationRecord,
    source: 'direct_edit' | 'chatbot_edit'
  ): Promise<void> {
    // 1. 保存解析结果
    await this.storage.saveParagraphs(parseResult.paragraphs)
    await this.storage.saveSentences(parseResult.sentences)
    await this.storage.savePositionIndex(parseResult.positionIndex)
    
    // 2. 追加操作记录
    await this.appendOperationRecord(operationRecord)
    
    // 3. 更新实时状态
    const liveState: LiveDocumentState = {
      documentId: 'current',
      lastUpdated: Date.now(),
      updateSource: source,
      content: {
        fullText: this.reconstructFullText(parseResult.paragraphs),
        paragraphs: parseResult.paragraphs,
        sentences: parseResult.sentences,
        positionIndex: parseResult.positionIndex
      },
      unsavedChanges: {
        hasChanges: true,
        lastSavedAt: await this.getLastSavedTime(),
        changeCount: await this.getUnsavedChangeCount() + 1,
        lastOperationId: operationRecord.id
      },
      editingState: {
        isEditing: false,
        editingSource: source === 'direct_edit' ? 'direct' : 'chatbot',
        currentOperation: operationRecord.operation.type
      }
    }
    
    await this.storage.saveLiveDocumentState(liveState)
    
    // 4. 通知界面更新
    this.notifyUIUpdate(liveState)
  }
  
  /**
   * 用户点击保存 - 硬存储
   */
  async handleUserSave(resumeId: string, resumeName: string): Promise<void> {
    console.log('[UpdateManager] 用户保存操作')
    
    try {
      // 1. 获取当前状态
      const liveState = await this.storage.loadLiveDocumentState()
      if (!liveState) {
        throw new Error('没有找到待保存的文档状态')
      }
      
      // 2. 获取操作历史
      const operationHistory = await this.storage.loadOperationRecords()
      
      // 3. 获取样式和CSS
      const { data } = useDataStore()
      
      // 4. 创建持久化文档
      const persistedDoc: PersistedDocument = {
        id: resumeId,
        name: resumeName,
        savedAt: Date.now(),
        version: `v_${Date.now()}`,
        content: {
          markdown: liveState.content.fullText,
          paragraphs: liveState.content.paragraphs,
          sentences: liveState.content.sentences,
          positionIndex: liveState.content.positionIndex
        },
        operationHistory: operationHistory.map(op => ({ ...op, isPersisted: true })),
        metadata: this.calculateMetadata(operationHistory),
        styles: await this.getCurrentStyles(),
        css: data.cssContent
      }
      
      // 5. 保存到硬存储
      await this.hardStorage.setItem(resumeId, persistedDoc)
      
      // 6. 更新实时状态 - 清除未保存标记
      liveState.unsavedChanges = {
        hasChanges: false,
        lastSavedAt: Date.now(),
        changeCount: 0,
        lastOperationId: ''
      }
      await this.storage.saveLiveDocumentState(liveState)
      
      // 7. 标记操作记录为已持久化
      const updatedRecords = operationHistory.map(op => ({ ...op, isPersisted: true }))
      await this.storage.saveOperationRecords(updatedRecords)
      
      console.log('[UpdateManager] 保存完成')
      
    } catch (error) {
      console.error('[UpdateManager] 保存失败:', error)
      throw error
    }
  }
  
  /**
   * 追加操作记录
   */
  private async appendOperationRecord(record: OperationRecord): Promise<void> {
    const existing = await this.storage.loadOperationRecords()
    existing.push(record)
    
    // 只保留最近1000条记录
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 1000)
    }
    
    await this.storage.saveOperationRecords(existing)
  }
  
  /**
   * 重构完整文本
   */
  private reconstructFullText(paragraphs: ParagraphItem[]): string {
    return paragraphs
      .filter(p => p.content.trim().length > 0)
      .map(p => p.content)
      .join('\n\n')
  }
  
  /**
   * 计算元数据
   */
  private calculateMetadata(operationHistory: OperationRecord[]): PersistedDocument['metadata'] {
    const directEdits = operationHistory.filter(op => op.type === 'direct_edit').length
    const chatbotOps = operationHistory.filter(op => op.type === 'chatbot_edit').length
    
    return {
      totalOperations: operationHistory.length,
      editingSessions: this.calculateSessions(operationHistory),
      chatbotOperations: chatbotOps,
      directEdits: directEdits,
      totalEditingTime: this.calculateTotalTime(operationHistory),
      averageSessionDuration: 0, // 计算平均会话时长
      lastEditSource: operationHistory[operationHistory.length - 1]?.source === 'monaco_editor' ? 'direct' : 'chatbot'
    }
  }
  
  /**
   * 获取未保存变更数量
   */
  private async getUnsavedChangeCount(): Promise<number> {
    const records = await this.storage.loadOperationRecords()
    return records.filter(r => !r.isPersisted).length
  }
  
  /**
   * 获取最后保存时间
   */
  private async getLastSavedTime(): Promise<number> {
    const records = await this.storage.loadOperationRecords()
    const lastSaved = records.filter(r => r.isPersisted).pop()
    return lastSaved?.timestamp || 0
  }
  
  /**
   * 通知界面更新
   */
  private notifyUIUpdate(liveState: LiveDocumentState): void {
    // 触发自定义事件通知界面更新
    const event = new CustomEvent('document-updated', {
      detail: {
        hasUnsavedChanges: liveState.unsavedChanges.hasChanges,
        changeCount: liveState.unsavedChanges.changeCount,
        lastUpdateSource: liveState.updateSource,
        documentState: liveState
      }
    })
    
    document.dispatchEvent(event)
  }
}
```

## 5. 集成到现有组件

### 5.1 编辑器集成
```typescript
// 在 Editor.vue 中添加
const updateManager = new UnifiedUpdateManager()

// 监听Monaco编辑器变更
editor.onDidChangeModelContent((event) => {
  const changes = event.changes.map(change => ({
    range: {
      startLine: change.range.startLineNumber,
      startColumn: change.range.startColumn,
      endLine: change.range.endLineNumber,
      endColumn: change.range.endColumn
    },
    text: change.text,
    oldText: model.getValueInRange(change.range)
  }))
  
  const editEvent: DirectEditEvent = {
    type: 'direct_edit',
    source: 'monaco_editor',
    timestamp: Date.now(),
    changes,
    fullContent: model.getValue()
  }
  
  updateManager.handleDirectEdit(editEvent)
})
```

### 5.2 Chatbot集成
```typescript
// 在 Chatbot.vue 中添加
const updateManager = new UnifiedUpdateManager()

// 在操作完成后调用
async function onChatbotOperationComplete(result: any) {
  const chatbotEvent: ChatbotEditEvent = {
    type: 'chatbot_edit',
    source: 'chatbot',
    timestamp: Date.now(),
    userInput: lastUserInput,
    operation: result.operation,
    targetId: result.targetId,
    targetType: result.targetType,
    result: {
      oldContent: result.oldContent,
      newContent: result.newContent,
      success: result.success
    },
    fullContent: await getCurrentDocumentContent()
  }
  
  await updateManager.handleChatbotEdit(chatbotEvent)
}
```

### 5.3 保存按钮处理
```typescript
// 在保存按钮组件中
async function handleSave() {
  try {
    const { data } = useDataStore()
    await updateManager.handleUserSave(
      data.curResumeId || 'new_resume',
      data.curResumeName || 'New Resume'
    )
    
    // 显示保存成功提示
    const toast = useToast()
    toast.save()
    
  } catch (error) {
    console.error('保存失败:', error)
    // 显示错误提示
  }
}
```

## 6. 存储键设计

### LocalStorage 键名
- `paragraphs_array` - 段落数组
- `sentences_array` - 句子数组  
- `position_index` - 位置索引
- `operation_records` - 操作记录
- `live_document_state` - 实时文档状态

### IndexedDB/LocalForage 键名
- `resume_{id}` - 持久化的简历文档

这个设计实现了：
1. ✅ 双输入源统一处理
2. ✅ 实时LocalStorage存储
3. ✅ 用户主动保存到硬存储
4. ✅ 完整的元数据记录
5. ✅ 闭环的更新流程
