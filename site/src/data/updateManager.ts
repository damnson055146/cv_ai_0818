// UpdateManager orchestrates edit/chatbot/save flows aligned with the sequence diagram
import { FlatStorageManager } from './storage'
import { MarkdownFlatParser } from './markdownFlatParser'
import { VersionManager } from './versionManager'
import { KeywordAnalyzer, searchParagraphsWithContext } from './keywordAnalyzer'
import { CVSectionLocator, type LocatorInput } from './cvSectionLocator'
import { OperationApplier, type ApplyOperationsInput } from './operationApplier'
import type { 
  ParagraphKeywordRecord,
  IntentParseRequest,
  IntentParseResponse,
  CVSectionLocation,
  EditOperation
} from './ds'
import type {
  OperationRecord,
  IntentParseRecord,
  DocumentState
} from './ds'

/**
 * 撤销历史记录项
 */
interface UndoHistoryItem {
  id: string
  timestamp: number
  documentId: string
  operationType: 'fix-in-chat' | 'direct_edit' | 'chatbot_edit'
  position: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }
  oldText: string
  newText: string
  description: string
}

function id(prefix: string) {
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now()}_${r}`
}

export class UpdateManager {
  private storage = new FlatStorageManager()
  private parser = new MarkdownFlatParser(this.storage)
  private versionMgr = new VersionManager(this.storage)
  private locator = new CVSectionLocator(this.storage)
  private applier = new OperationApplier(this.storage)

  // Direct edit path (Editor -> UpdateMgr)
  async handleDirectEdit(documentId: string, newContent: string, oldContent: string): Promise<void> {
    const now = Date.now()
    const op: OperationRecord = {
      id: id('op'),
      documentId,
      versionId: '',
      sequence: now,
      timestamp: now,
      operationType: 'direct_edit',
      operationSource: 'user',
      targetType: 'document',
      oldContent,
      newContent,
      oldContentLength: oldContent.length,
      newContentLength: newContent.length,
      contentEncoding: 'utf-8',
      charactersAdded: Math.max(0, newContent.length - oldContent.length),
      charactersRemoved: Math.max(0, oldContent.length - newContent.length),
      editingTimeMs: 0,
      isPersisted: false
    }
    await this.storage.appendOperationRecord(op)

    // parse to update paragraphs/sentences
    const parsed = await this.parser.parseAndStore(newContent, {
      documentId,
      versionId: 'live',
      timestamp: now
    })

    // keyword analysis（默认按 cv/zh-cn，可由调用方参数化）
    const dict = await this.storage.loadKeywordDictionaries('cv','zh-cn')
    const analyzer = new KeywordAnalyzer(dict)
    const kwRecords = analyzer.analyzeParagraphs(parsed.paragraphs, { docType: 'cv', language: 'zh-cn' })
    for (const r of kwRecords) await this.storage.appendParagraphKeywordRecord(r)

    // also create a version for direct edit
    const version = await this.versionMgr.createVersion({
      documentId,
      content: newContent,
      operationType: 'direct_edit',
      operationSource: 'user',
      operationDescription: 'direct edit',
      charactersAdded: op.charactersAdded,
      charactersRemoved: op.charactersRemoved
    })
    // notify same-tab listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv_doc_versions_updated', { detail: { documentId } }))
    }
  }

  // Chatbot path with prior intent parsing (Parser -> Chatbot -> UpdateMgr)
  async handleChatbotEdit(documentId: string, intent: IntentParseRecord, appliedContent: string, previousContent: string): Promise<void> {
    const now = Date.now()
    await this.storage.appendIntentRecord(documentId, intent)

    const op: OperationRecord = {
      id: id('op'),
      documentId,
      versionId: '',
      sequence: now,
      timestamp: now,
      operationType: 'chatbot_edit',
      operationSource: 'chatbot',
      userInput: intent.userInput,
      targetType: intent.targetType,
      targetId: intent.targetId,
      targetIndex: intent.targetIndex,
      oldContent: previousContent,
      newContent: appliedContent,
      oldContentLength: previousContent.length,
      newContentLength: appliedContent.length,
      contentEncoding: 'utf-8',
      charactersAdded: Math.max(0, appliedContent.length - previousContent.length),
      charactersRemoved: Math.max(0, previousContent.length - appliedContent.length),
      editingTimeMs: intent.parseTimeMs,
      isPersisted: false
    }
    await this.storage.appendOperationRecord(op)

    const parsed2 = await this.parser.parseAndStore(appliedContent, {
      documentId,
      versionId: 'live',
      timestamp: now
    })

    const dict2 = await this.storage.loadKeywordDictionaries('cv','zh-cn')
    const analyzer2 = new KeywordAnalyzer(dict2)
    const kwRecords2 = analyzer2.analyzeParagraphs(parsed2.paragraphs, { docType: 'cv', language: 'zh-cn' })
    for (const r of kwRecords2) await this.storage.appendParagraphKeywordRecord(r)

    // also create a version for chatbot edit
    const version = await this.versionMgr.createVersion({
      documentId,
      content: appliedContent,
      operationType: 'chatbot_edit',
      operationSource: 'chatbot',
      operationDescription: 'chatbot edit',
      charactersAdded: op.charactersAdded,
      charactersRemoved: op.charactersRemoved
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv_doc_versions_updated', { detail: { documentId } }))
    }
  }

  // Save path (Editor -> UpdateMgr)
  async handleSave(documentId: string, content: string): Promise<void> {
    const latestState = await this.storage.loadDocumentState(documentId)
    const prevContentLength = content.length // simplistic; caller can provide previous
    const version = await this.versionMgr.createVersion({
      documentId,
      content,
      operationType: 'save',
      operationSource: 'user',
      operationDescription: 'manual save',
      charactersAdded: 0,
      charactersRemoved: 0
    })

    // Optionally clear unsaved flag via a new state snapshot
    const state: DocumentState = {
      documentId,
      currentVersionId: version.id,
      currentVersionNumber: version.versionNumber,
      lastSavedVersionId: version.id,
      lastSavedTimestamp: Date.now(),
      hasUnsavedChanges: false,
      unsavedChangeCount: 0,
      lastOperationId: version.id,
      lastOperationTimestamp: Date.now(),
      lastOperationSource: 'user',
      editingSource: 'direct',
      isLocked: false,
      totalEditTimeMs: (latestState?.totalEditTimeMs ?? 0),
      operationCount: (latestState?.operationCount ?? 0) + 1
    }
    await this.storage.saveDocumentState(state)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv_doc_versions_updated', { detail: { documentId } }))
    }
  }

  // ====== 关键词分析：对当前最新段落重跑（docType/language 可配置） ======
  async analyzeDocument(
    documentId: string,
    opts: { docType: 'cv' | 'letter' | 'ps'; language: 'zh-cn' | 'en' | 'sp' }
  ): Promise<void> {
    const paragraphs = await this.loadLatestParagraphs(documentId)
    const dict = await this.storage.loadKeywordDictionaries(opts.docType, opts.language)
    const analyzer = new KeywordAnalyzer(dict)
    const kwRecords = analyzer.analyzeParagraphs(paragraphs, opts)
    for (const r of kwRecords) await this.storage.appendParagraphKeywordRecord(r)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv_para_keywords_updated', { detail: { documentId } }))
    }
  }

  // ====== 关键词检索：返回命中段落及前后上下文 ======
  async searchKeywordContext(
    documentId: string,
    query: string,
    before = 1,
    after = 1
  ): Promise<ReturnType<typeof searchParagraphsWithContext>> {
    const paragraphs = await this.loadLatestParagraphs(documentId)
    return searchParagraphsWithContext(paragraphs, query, { before, after })
  }

  // ====== 智能编辑流程：定位 -> 意图解析 -> 内容生成 -> 应用 ======
  async handleSmartEdit(
    documentId: string,
    userInput: string,
    options: {
      selectedRange?: { startPosition: number; endPosition: number }
      docType?: 'cv' | 'letter' | 'ps'
      language?: 'zh-cn' | 'en' | 'sp'
      template?: string // 模板命令（如"翻译"、"修改"）
    } = {}
  ): Promise<{
    success: boolean
    appliedContent?: string
    location?: CVSectionLocation
    error?: string
    confidence?: number
  }> {
    const { selectedRange, docType = 'cv', language = 'zh-cn', template } = options
    
    try {
      // 1. 定位目标内容
      const location = await this.locateContent({
        documentId,
        userInput,
        selectedRange,
        docType,
        language
      })

      if (location.confidence < 0.3) {
        return {
          success: false,
          location,
          error: 'Content location confidence too low. Please select a specific section.'
        }
      }

      // 2. 构建意图解析请求
      const intentRequest: IntentParseRequest = {
        documentId,
        mode: template ? 'template-direct' : 'structured-intent',
        userInput,
        context: {
          sectionTag: location.sectionTag,
          targetType: location.targetType,
          targetIds: location.targetIds,
          text: location.contextText
        },
        docType,
        language,
        template
      }

      // 3. 调用后端意图解析
      const intentResponse = await this.callIntentParse(intentRequest)
      
      if (intentResponse.status === 'error' || !intentResponse.intent) {
        return {
          success: false,
          location,
          error: intentResponse.error || 'Intent parsing failed'
        }
      }

      // 4. 调用后端内容生成
      const currentContent = await this.getCurrentDocumentContent(documentId)
      const contentResponse = await this.callContentGenerate({
        documentId,
        intent: intentResponse.intent,
        context: intentRequest.context,
        userInput,
        docType,
        language,
        previousContent: currentContent
      })

      if (contentResponse.status === 'error' || !contentResponse.operations) {
        return {
          success: false,
          location,
          error: contentResponse.error || 'Content generation failed'
        }
      }

      // 5. 应用操作到文档
      const positionalOps = await this.toPositionalOperations(documentId, currentContent, contentResponse.operations, location)
      const applyResult = await this.applier.applyOperations({
        documentId,
        operations: positionalOps,
        previousContent: currentContent
      })

      if (!applyResult.success) {
        return {
          success: false,
          location,
          error: `Operation application failed: ${applyResult.errors.join(', ')}`
        }
      }

      // 6. 创建意图记录并更新文档
      const intentRecord: IntentParseRecord = {
        id: id('intent'),
        documentId,
        timestamp: Date.now(),
        userInput,
        userInputLength: userInput.length,
        userInputEncoding: 'utf-8',
        intentType: intentResponse.intent.intentType,
        targetType: intentResponse.intent.targetType,
        targetId: location.targetIds[0],
        targetIds: location.targetIds,
        confidence: intentResponse.intent.confidence,
        contextContent: location.contextText,
        contextLength: location.contextText.length,
        contextEncoding: 'utf-8',
        aiPrompt: `${intentRequest.mode}: ${userInput}`,
        aiPromptLength: userInput.length,
        parseTimeMs: 0,
        sectionTag: location.sectionTag
      }

      // 7. 使用现有的chatbot编辑处理流程
      await this.handleChatbotEdit(
        documentId,
        intentRecord,
        applyResult.appliedContent,
        currentContent
      )

      return {
        success: true,
        appliedContent: applyResult.appliedContent,
        location,
        confidence: intentResponse.intent.confidence
      }

    } catch (error) {
      console.error('[UpdateManager] Smart edit failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ====== 辅助方法 ======
  async locateContent(input: LocatorInput): Promise<CVSectionLocation> {
    return await this.locator.locateSection(input)
  }

  private async getCurrentDocumentContent(documentId: string): Promise<string> {
    // 从最新版本获取内容，或者从最新段落重建
    const versions = await this.storage.loadDocumentVersions(documentId)
    if (versions.length > 0) {
      return versions[versions.length - 1].content
    }

    // 没有版本时，从段落重建
    const paragraphs = await this.loadLatestParagraphs(documentId)
    return paragraphs.map(p => p.content).join('\n\n')
  }

  private async callIntentParse(request: IntentParseRequest): Promise<IntentParseResponse> {
    if (typeof fetch === 'undefined') {
      throw new Error('Fetch is not available (server-side context)')
    }

    const response = await fetch('/api/intent-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`Intent parse API failed: ${response.status}`)
    }

    return await response.json()
  }

  private async callContentGenerate(request: any): Promise<any> {
    if (typeof fetch === 'undefined') {
      throw new Error('Fetch is not available (server-side context)')
    }

    const response = await fetch('/api/content-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`Content generate API failed: ${response.status}`)
    }

    return await response.json()
  }

  private async toPositionalOperations(
    documentId: string,
    previousContent: string,
    ops: Array<{ action: 'replace'|'insert'|'delete'; targetId?: string; oldText?: string; newText?: string }> = [],
    location?: any
  ) {
    const paragraphs = await this.loadLatestParagraphs(documentId)
    const idToStart = new Map<string, number>()
    for (const p of paragraphs) idToStart.set(p.id, p.startPosition)
    const result: Array<{ type: 'replace'|'insert'|'delete'; startAbsolute: number; endAbsolute?: number; newText?: string }> = []
    for (const op of ops) {
      if (op.action === 'replace') {
        if (op.oldText) {
          const idx = previousContent.indexOf(op.oldText)
          if (idx >= 0) result.push({ type: 'replace', startAbsolute: idx, endAbsolute: idx + op.oldText.length, newText: op.newText || '' })
        } else if (op.targetId && idToStart.has(op.targetId)) {
          const start = idToStart.get(op.targetId) as number
          const end = start + (op.oldText ? op.oldText.length : 0)
          result.push({ type: 'replace', startAbsolute: start, endAbsolute: end, newText: op.newText || '' })
        }
      } else if (op.action === 'insert') {
        let pos = 0
        if (op.targetId && idToStart.has(op.targetId)) pos = idToStart.get(op.targetId) as number
        else if (location?.targetIds?.length && idToStart.has(location.targetIds[0])) pos = idToStart.get(location.targetIds[0]) as number
        result.push({ type: 'insert', startAbsolute: pos, newText: op.newText || '' })
      } else if (op.action === 'delete') {
        if (op.oldText) {
          const idx = previousContent.indexOf(op.oldText)
          if (idx >= 0) result.push({ type: 'delete', startAbsolute: idx, endAbsolute: idx + op.oldText.length })
        }
      }
    }
    return result
  }

  // ====== 模板命令支持 ======
  async handleTemplateCommand(
    documentId: string,
    templateType: 'translate' | 'modify' | 'format',
    userInput: string,
    selectedRange?: { startPosition: number; endPosition: number }
  ): Promise<{
    success: boolean
    appliedContent?: string
    error?: string
  }> {
    return await this.handleSmartEdit(documentId, userInput, {
      selectedRange,
      template: templateType
    })
  }

  // ====== 内部：基于 append-only 段落记录，提取"当前最新"段落集合 ======
  private async loadLatestParagraphs(documentId: string) {
    const all = await this.storage.loadParagraphRecords(documentId)
    const byIndex = new Map<number, any>()
    for (const p of all) {
      const existing = byIndex.get(p.index)
      if (!existing || (p.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
        byIndex.set(p.index, p)
      }
      }
  return Array.from(byIndex.entries()).sort((a, b) => a[0] - b[0]).map(([, p]) => p)
}

  // ====== Fix-in-Chat 撤销/重做功能 ======
  
  // 撤销历史栈（内存中存储，最多保留50条）
  private undoHistory: UndoHistoryItem[] = []
  private redoHistory: UndoHistoryItem[] = []
  private maxHistorySize = 50

  /**
   * 记录可撤销操作
   */
  recordUndoableOperation(item: Omit<UndoHistoryItem, 'id' | 'timestamp'>): void {
    const historyItem: UndoHistoryItem = {
      ...item,
      id: id('undo'),
      timestamp: Date.now()
    }
    
    // 添加到撤销历史
    this.undoHistory.push(historyItem)
    
    // 清空重做历史（新操作后不能再重做）
    this.redoHistory = []
    
    // 限制历史大小
    if (this.undoHistory.length > this.maxHistorySize) {
      this.undoHistory.shift()
    }
    
    console.log('[UpdateManager] 记录撤销操作:', {
      type: historyItem.operationType,
      description: historyItem.description,
      historySize: this.undoHistory.length
    })
  }

  /**
   * 撤销上一个操作
   */
  async undoLastOperation(): Promise<{ success: boolean; item?: UndoHistoryItem; error?: string }> {
    if (this.undoHistory.length === 0) {
      return { success: false, error: '没有可撤销的操作' }
    }
    
    const lastItem = this.undoHistory.pop()!
    
    try {
      // 创建重做项（撤销当前状态）
      const redoItem: UndoHistoryItem = {
        ...lastItem,
        id: id('redo'),
        timestamp: Date.now(),
        oldText: lastItem.newText, // 交换新旧文本
        newText: lastItem.oldText,
        description: `重做: ${lastItem.description}`
      }
      
      // 添加到重做历史
      this.redoHistory.push(redoItem)
      
      console.log('[UpdateManager] 撤销操作:', {
        type: lastItem.operationType,
        description: lastItem.description,
        position: lastItem.position
      })
      
      return { success: true, item: lastItem }
      
    } catch (error: any) {
      // 撤销失败，恢复历史项
      this.undoHistory.push(lastItem)
      console.error('[UpdateManager] 撤销操作失败:', error)
      return { success: false, error: error.message || '撤销操作失败' }
    }
  }

  /**
   * 重做上一个撤销的操作
   */
  async redoLastOperation(): Promise<{ success: boolean; item?: UndoHistoryItem; error?: string }> {
    if (this.redoHistory.length === 0) {
      return { success: false, error: '没有可重做的操作' }
    }
    
    const redoItem = this.redoHistory.pop()!
    
    try {
      // 重新添加到撤销历史
      this.undoHistory.push({
        ...redoItem,
        id: id('undo'),
        timestamp: Date.now(),
        oldText: redoItem.newText, // 交换回来
        newText: redoItem.oldText,
        description: redoItem.description.replace('重做: ', '')
      })
      
      console.log('[UpdateManager] 重做操作:', {
        type: redoItem.operationType,
        description: redoItem.description,
        position: redoItem.position
      })
      
      return { success: true, item: redoItem }
      
    } catch (error: any) {
      // 重做失败，恢复重做项
      this.redoHistory.push(redoItem)
      console.error('[UpdateManager] 重做操作失败:', error)
      return { success: false, error: error.message || '重做操作失败' }
    }
  }

  /**
   * 获取撤销历史信息
   */
  getUndoRedoStatus(): { canUndo: boolean; canRedo: boolean; undoCount: number; redoCount: number } {
    return {
      canUndo: this.undoHistory.length > 0,
      canRedo: this.redoHistory.length > 0,
      undoCount: this.undoHistory.length,
      redoCount: this.redoHistory.length
    }
  }

  /**
   * 清空撤销/重做历史
   */
  clearUndoRedoHistory(): void {
    this.undoHistory = []
    this.redoHistory = []
    console.log('[UpdateManager] 撤销/重做历史已清空')
  }
}


