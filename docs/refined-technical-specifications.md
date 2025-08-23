# 精简化技术规范文档

## 1. 核心设计原则

### 设计原则
- **扁平化存储**: 避免嵌套结构，使用数组索引关联
- **前端解析**: 所有MD解析在前端完成，后端只做AI调用
- **追加模式**: 只追加不覆盖，保证数据安全
- **明文存储**: 便于调试和维护
- **闭包流程**: 每个操作都能回到起始状态
- **序列化友好**: 所有数据结构都支持JSON序列化

### 去除的复杂功能
- ❌ 分支管理（只保留简单版本快照）
- ❌ 复杂合并冲突处理
- ❌ 嵌套数据结构
- ❌ 图结构关系
- ❌ 复杂的压缩算法

## 2. 核心数据结构

### 2.1 段落存储结构

```typescript
interface ParagraphItem {
  // 基础标识
  id: string                    // 格式: "p_001", "p_002", "p_003"
  index: number                 // 段落序号: 0, 1, 2, 3...
  
  // 内容信息
  content: string               // 段落完整内容（明文存储）
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'quote'
  level?: number                // 标题级别(1-6)或列表缩进级别
  
  // 位置信息（显式定义，避免计算）
  startPosition: number         // 在文档中的起始字符位置
  endPosition: number           // 在文档中的结束字符位置
  charCount: number             // 字符数量（长度）
  lineNumber: number            // 起始行号
  
  // 时间戳
  timestamp: number             // 创建/最后更新时间
}

// LocalStorage键: "paragraphs_array"
// 存储格式: ParagraphItem[]
```

### 2.2 句子存储结构

```typescript
interface SentenceItem {
  // 基础标识
  id: string                    // 格式: "s_001", "s_002", "s_003"
  paragraphId: string           // 所属段落ID，关联到ParagraphItem.id
  index: number                 // 在段落中的句子序号: 0, 1, 2...
  
  // 内容信息
  content: string               // 句子完整内容（明文存储）
  
  // 绝对位置信息
  startPosition: number         // 在整个文档中的绝对字符位置
  endPosition: number           // 在整个文档中的绝对字符位置
  charCount: number             // 字符数量（长度）
  
  // 相对位置信息
  relativeStart: number         // 在所属段落中的相对起始位置
  relativeEnd: number           // 在所属段落中的相对结束位置
  
  // 时间戳
  timestamp: number             // 创建/最后更新时间
}

// LocalStorage键: "sentences_array"
// 存储格式: SentenceItem[]
```

### 2.3 位置索引结构

```typescript
interface PositionIndex {
  // 文档基础信息
  documentId: string            // 当前文档ID
  totalCharCount: number        // 文档总字符数
  paragraphCount: number        // 段落总数
  sentenceCount: number         // 句子总数
  lastUpdated: number           // 最后更新时间戳
  
  // 快速定位映射表
  charToParagraph: {
    [charPosition: number]: string  // 字符位置 -> 段落ID
  }
  
  charToSentence: {
    [charPosition: number]: string  // 字符位置 -> 句子ID
  }
  
  // 段落边界信息
  paragraphBoundaries: {
    [paragraphId: string]: {
      start: number               // 段落起始位置
      end: number                 // 段落结束位置
      sentenceIds: string[]       // 包含的句子ID列表
      sentenceCount: number       // 句子数量
    }
  }
}

// LocalStorage键: "position_index"
// 存储格式: PositionIndex
```

### 2.4 版本快照结构（简化）

```typescript
interface VersionSnapshot {
  // 基础信息
  id: string                    // 版本ID: "v_" + timestamp
  timestamp: number             // 创建时间戳
  description: string           // 版本描述
  
  // 变更信息
  changes: {
    type: 'paragraph_update' | 'paragraph_add' | 'paragraph_delete' | 
          'sentence_update' | 'sentence_add' | 'sentence_delete'
    targetId: string            // 目标段落/句子ID
    oldContent?: string         // 原内容（用于回退）
    newContent?: string         // 新内容
    position?: number           // 位置信息
  }[]
  
  // 操作元数据
  source: 'user' | 'chatbot'    // 操作来源
  operation: string             // 操作类型描述
  userInput?: string            // 用户原始输入
}

// LocalStorage键: "version_snapshots"
// 存储格式: VersionSnapshot[]（按时间顺序追加）
```

### 2.5 记忆项结构

```typescript
interface MemoryItem {
  // 基础信息
  id: string                    // 记忆ID: "m_" + timestamp
  timestamp: number             // 创建时间戳
  type: 'operation' | 'preference' | 'pattern'
  
  // 操作记忆
  operationData?: {
    userInput: string           // 用户原始输入
    targetType: 'paragraph' | 'sentence'
    targetId: string            // 目标ID
    operation: 'keep' | 'rewrite' | 'delete'
    result: string              // 操作结果
    success: boolean            // 是否成功
  }
  
  // 偏好记忆
  preferenceData?: {
    category: 'style' | 'content' | 'format'
    preference: string          // 偏好描述
    frequency: number           // 使用频率
  }
  
  // 模式记忆
  patternData?: {
    inputPattern: string        // 输入模式
    operationSequence: string[] // 操作序列
    successRate: number         // 成功率
    context: string             // 上下文
  }
}

// LocalStorage键: "memory_items"
// 存储格式: MemoryItem[]（按时间顺序追加）
```

### 2.6 工作状态结构

```typescript
interface WorkspaceState {
  // 当前状态
  currentDocumentId: string     // 当前文档ID
  currentVersionId: string      // 当前版本ID
  lastSaved: number             // 最后保存时间
  
  // 选择状态
  selection: {
    type: 'none' | 'paragraph' | 'sentence'
    targetId?: string           // 选中的段落/句子ID
    startChar?: number          // 选择起始字符位置
    endChar?: number            // 选择结束字符位置
  }
  
  // 编辑状态
  editing: {
    isEditing: boolean          // 是否正在编辑
    targetId?: string           // 正在编辑的目标ID
    operation?: 'keep' | 'rewrite' | 'delete'
    aiProcessing?: boolean      // AI是否在处理
  }
  
  // 界面状态
  ui: {
    chatbotMode: 'ask' | 'edit'
    showOperationPanel: boolean
    lastUserInput: string
  }
}

// LocalStorage键: "workspace_state"
// 存储格式: WorkspaceState
```

## 3. 前端解析器实现

### 3.1 核心解析类

```typescript
class FlatMarkdownParser {
  
  /**
   * 解析用户意图
   */
  parseUserIntent(input: string): {
    action: 'keep' | 'rewrite' | 'delete' | 'analyze'
    targetType: 'paragraph' | 'sentence' | 'range'
    targetIndex?: number
    targetRange?: { start: number; end: number }
    instruction?: string
  } {
    const input_lower = input.toLowerCase()
    
    // 提取目标类型和位置
    const paragraphMatch = input_lower.match(/第(\d+)段|段落(\d+)|第(\d+)个段落/)
    const sentenceMatch = input_lower.match(/第(\d+)句|句子(\d+)|第(\d+)个句子/)
    
    // 提取操作类型
    let action: 'keep' | 'rewrite' | 'delete' | 'analyze' = 'rewrite'
    if (input_lower.includes('删除') || input_lower.includes('delete')) {
      action = 'delete'
    } else if (input_lower.includes('保留') || input_lower.includes('keep')) {
      action = 'keep'
    } else if (input_lower.includes('分析') || input_lower.includes('analyze')) {
      action = 'analyze'
    }
    
    if (paragraphMatch) {
      const index = parseInt(paragraphMatch[1] || paragraphMatch[2] || paragraphMatch[3]) - 1
      return {
        action,
        targetType: 'paragraph',
        targetIndex: index,
        instruction: input
      }
    }
    
    if (sentenceMatch) {
      const index = parseInt(sentenceMatch[1] || sentenceMatch[2] || sentenceMatch[3]) - 1
      return {
        action,
        targetType: 'sentence',
        targetIndex: index,
        instruction: input
      }
    }
    
    return {
      action,
      targetType: 'paragraph',
      instruction: input
    }
  }
  
  /**
   * 解析文档为扁平结构
   */
  parseDocumentToFlat(markdown: string): {
    paragraphs: ParagraphItem[]
    sentences: SentenceItem[]
    positionIndex: PositionIndex
  } {
    const paragraphs: ParagraphItem[] = []
    const sentences: SentenceItem[] = []
    
    // 按双换行分割段落
    const paragraphTexts = markdown.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    let currentPosition = 0
    let sentenceGlobalIndex = 0
    
    paragraphTexts.forEach((paragraphText, paragraphIndex) => {
      const trimmedText = paragraphText.trim()
      
      // 创建段落项
      const paragraph: ParagraphItem = {
        id: `p_${paragraphIndex.toString().padStart(3, '0')}`,
        index: paragraphIndex,
        content: trimmedText,
        type: this.detectParagraphType(trimmedText),
        level: this.detectLevel(trimmedText),
        startPosition: currentPosition,
        endPosition: currentPosition + trimmedText.length,
        charCount: trimmedText.length,
        lineNumber: this.calculateLineNumber(markdown, currentPosition),
        timestamp: Date.now()
      }
      
      paragraphs.push(paragraph)
      
      // 解析段落中的句子
      const paragraphSentences = this.extractSentences(
        trimmedText, 
        paragraph.id, 
        currentPosition,
        sentenceGlobalIndex
      )
      
      sentences.push(...paragraphSentences)
      sentenceGlobalIndex += paragraphSentences.length
      
      // 更新位置（包括分隔符）
      currentPosition += paragraphText.length + 2 // +2 for \n\n
    })
    
    // 生成位置索引
    const positionIndex = this.generatePositionIndex(paragraphs, sentences)
    
    return { paragraphs, sentences, positionIndex }
  }
  
  /**
   * 提取句子
   */
  private extractSentences(
    paragraphContent: string,
    paragraphId: string,
    paragraphStartPos: number,
    startIndex: number
  ): SentenceItem[] {
    const sentences: SentenceItem[] = []
    
    // 使用正则表达式分割句子
    const sentencePattern = /[^.!?。！？]*[.!?。！？]+/g
    let match
    let sentenceIndex = 0
    
    while ((match = sentencePattern.exec(paragraphContent)) !== null) {
      const sentenceContent = match[0].trim()
      if (sentenceContent.length > 0) {
        const relativeStart = match.index
        const relativeEnd = match.index + sentenceContent.length
        
        const sentence: SentenceItem = {
          id: `s_${(startIndex + sentenceIndex).toString().padStart(3, '0')}`,
          paragraphId,
          index: sentenceIndex,
          content: sentenceContent,
          startPosition: paragraphStartPos + relativeStart,
          endPosition: paragraphStartPos + relativeEnd,
          charCount: sentenceContent.length,
          relativeStart,
          relativeEnd,
          timestamp: Date.now()
        }
        
        sentences.push(sentence)
        sentenceIndex++
      }
    }
    
    return sentences
  }
  
  /**
   * 生成位置索引
   */
  private generatePositionIndex(
    paragraphs: ParagraphItem[],
    sentences: SentenceItem[]
  ): PositionIndex {
    const charToParagraph: { [key: number]: string } = {}
    const charToSentence: { [key: number]: string } = {}
    const paragraphBoundaries: { [key: string]: any } = {}
    
    // 建立字符位置到段落的映射
    paragraphs.forEach(paragraph => {
      for (let i = paragraph.startPosition; i <= paragraph.endPosition; i++) {
        charToParagraph[i] = paragraph.id
      }
      
      // 建立段落边界信息
      const paragraphSentences = sentences.filter(s => s.paragraphId === paragraph.id)
      paragraphBoundaries[paragraph.id] = {
        start: paragraph.startPosition,
        end: paragraph.endPosition,
        sentenceIds: paragraphSentences.map(s => s.id),
        sentenceCount: paragraphSentences.length
      }
    })
    
    // 建立字符位置到句子的映射
    sentences.forEach(sentence => {
      for (let i = sentence.startPosition; i <= sentence.endPosition; i++) {
        charToSentence[i] = sentence.id
      }
    })
    
    return {
      documentId: 'current',
      totalCharCount: Math.max(...paragraphs.map(p => p.endPosition)),
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      lastUpdated: Date.now(),
      charToParagraph,
      charToSentence,
      paragraphBoundaries
    }
  }
  
  /**
   * 检测段落类型
   */
  private detectParagraphType(content: string): ParagraphItem['type'] {
    if (content.match(/^#{1,6}\s/)) return 'heading'
    if (content.match(/^[-*+]\s/) || content.match(/^\d+\.\s/)) return 'list'
    if (content.match(/^```/) || content.match(/^    /)) return 'code'
    if (content.match(/^>/)) return 'quote'
    return 'paragraph'
  }
  
  /**
   * 检测级别
   */
  private detectLevel(content: string): number | undefined {
    const headingMatch = content.match(/^(#{1,6})\s/)
    if (headingMatch) return headingMatch[1].length
    return undefined
  }
  
  /**
   * 计算行号
   */
  private calculateLineNumber(fullText: string, position: number): number {
    return fullText.substring(0, position).split('\n').length
  }
}
```

## 4. 存储管理器实现

### 4.1 本地存储管理器

```typescript
class LocalStorageManager {
  private readonly KEYS = {
    PARAGRAPHS: 'paragraphs_array',
    SENTENCES: 'sentences_array',
    POSITION_INDEX: 'position_index',
    VERSION_SNAPSHOTS: 'version_snapshots',
    MEMORY_ITEMS: 'memory_items',
    WORKSPACE_STATE: 'workspace_state'
  }
  
  /**
   * 保存段落数组
   */
  async saveParagraphs(paragraphs: ParagraphItem[]): Promise<void> {
    localStorage.setItem(this.KEYS.PARAGRAPHS, JSON.stringify(paragraphs))
  }
  
  /**
   * 加载段落数组
   */
  async loadParagraphs(): Promise<ParagraphItem[]> {
    const data = localStorage.getItem(this.KEYS.PARAGRAPHS)
    return data ? JSON.parse(data) : []
  }
  
  /**
   * 保存句子数组
   */
  async saveSentences(sentences: SentenceItem[]): Promise<void> {
    localStorage.setItem(this.KEYS.SENTENCES, JSON.stringify(sentences))
  }
  
  /**
   * 加载句子数组
   */
  async loadSentences(): Promise<SentenceItem[]> {
    const data = localStorage.getItem(this.KEYS.SENTENCES)
    return data ? JSON.parse(data) : []
  }
  
  /**
   * 保存位置索引
   */
  async savePositionIndex(index: PositionIndex): Promise<void> {
    localStorage.setItem(this.KEYS.POSITION_INDEX, JSON.stringify(index))
  }
  
  /**
   * 加载位置索引
   */
  async loadPositionIndex(): Promise<PositionIndex | null> {
    const data = localStorage.getItem(this.KEYS.POSITION_INDEX)
    return data ? JSON.parse(data) : null
  }
  
  /**
   * 追加版本快照
   */
  async appendVersionSnapshot(snapshot: VersionSnapshot): Promise<void> {
    const existing = await this.loadVersionSnapshots()
    existing.push(snapshot)
    
    // 只保留最近50个版本
    if (existing.length > 50) {
      existing.splice(0, existing.length - 50)
    }
    
    localStorage.setItem(this.KEYS.VERSION_SNAPSHOTS, JSON.stringify(existing))
  }
  
  /**
   * 加载版本快照
   */
  async loadVersionSnapshots(): Promise<VersionSnapshot[]> {
    const data = localStorage.getItem(this.KEYS.VERSION_SNAPSHOTS)
    return data ? JSON.parse(data) : []
  }
  
  /**
   * 追加记忆项
   */
  async appendMemoryItem(memory: MemoryItem): Promise<void> {
    const existing = await this.loadMemoryItems()
    existing.push(memory)
    
    // 只保留最近200个记忆
    if (existing.length > 200) {
      existing.splice(0, existing.length - 200)
    }
    
    localStorage.setItem(this.KEYS.MEMORY_ITEMS, JSON.stringify(existing))
  }
  
  /**
   * 加载记忆项
   */
  async loadMemoryItems(): Promise<MemoryItem[]> {
    const data = localStorage.getItem(this.KEYS.MEMORY_ITEMS)
    return data ? JSON.parse(data) : []
  }
  
  /**
   * 保存工作状态
   */
  async saveWorkspaceState(state: WorkspaceState): Promise<void> {
    localStorage.setItem(this.KEYS.WORKSPACE_STATE, JSON.stringify(state))
  }
  
  /**
   * 加载工作状态
   */
  async loadWorkspaceState(): Promise<WorkspaceState | null> {
    const data = localStorage.getItem(this.KEYS.WORKSPACE_STATE)
    return data ? JSON.parse(data) : null
  }
  
  /**
   * 按ID更新段落
   */
  async updateParagraph(paragraphId: string, newContent: string): Promise<void> {
    const paragraphs = await this.loadParagraphs()
    const index = paragraphs.findIndex(p => p.id === paragraphId)
    
    if (index >= 0) {
      // 创建快照
      await this.createOperationSnapshot('paragraph_update', paragraphId, newContent, paragraphs[index].content)
      
      // 更新内容
      paragraphs[index].content = newContent
      paragraphs[index].charCount = newContent.length
      paragraphs[index].timestamp = Date.now()
      
      await this.saveParagraphs(paragraphs)
    }
  }
  
  /**
   * 按ID更新句子
   */
  async updateSentence(sentenceId: string, newContent: string): Promise<void> {
    const sentences = await this.loadSentences()
    const index = sentences.findIndex(s => s.id === sentenceId)
    
    if (index >= 0) {
      // 创建快照
      await this.createOperationSnapshot('sentence_update', sentenceId, newContent, sentences[index].content)
      
      // 更新内容
      sentences[index].content = newContent
      sentences[index].charCount = newContent.length
      sentences[index].timestamp = Date.now()
      
      await this.saveSentences(sentences)
    }
  }
  
  /**
   * 创建操作快照
   */
  private async createOperationSnapshot(
    type: VersionSnapshot['changes'][0]['type'],
    targetId: string,
    newContent: string,
    oldContent: string
  ): Promise<void> {
    const snapshot: VersionSnapshot = {
      id: `v_${Date.now()}`,
      timestamp: Date.now(),
      description: `${type}: ${targetId}`,
      changes: [{
        type,
        targetId,
        newContent,
        oldContent
      }],
      source: 'user',
      operation: type
    }
    
    await this.appendVersionSnapshot(snapshot)
  }
}
```

## 5. 操作控制器实现

### 5.1 核心操作控制器

```typescript
class OperationController {
  private parser: FlatMarkdownParser
  private storage: LocalStorageManager
  private aiService: AIService
  
  constructor() {
    this.parser = new FlatMarkdownParser()
    this.storage = new LocalStorageManager()
    this.aiService = new AIService()
  }
  
  /**
   * 执行用户操作
   */
  async executeUserOperation(userInput: string): Promise<{
    success: boolean
    message: string
    result?: any
  }> {
    try {
      // 1. 解析用户意图
      const intent = this.parser.parseUserIntent(userInput)
      
      // 2. 定位目标
      const target = await this.locateTarget(intent)
      if (!target) {
        return {
          success: false,
          message: '未找到指定的目标段落或句子'
        }
      }
      
      // 3. 执行操作
      const result = await this.executeOperation(intent, target, userInput)
      
      // 4. 记录到记忆
      await this.recordToMemory(userInput, intent, target, result)
      
      return {
        success: true,
        message: '操作完成',
        result
      }
      
    } catch (error) {
      return {
        success: false,
        message: `操作失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
  
  /**
   * 定位目标
   */
  private async locateTarget(intent: any): Promise<{
    type: 'paragraph' | 'sentence'
    id: string
    content: string
    item: ParagraphItem | SentenceItem
  } | null> {
    if (intent.targetType === 'paragraph' && intent.targetIndex !== undefined) {
      const paragraphs = await this.storage.loadParagraphs()
      const paragraph = paragraphs[intent.targetIndex]
      
      if (paragraph) {
        return {
          type: 'paragraph',
          id: paragraph.id,
          content: paragraph.content,
          item: paragraph
        }
      }
    }
    
    if (intent.targetType === 'sentence' && intent.targetIndex !== undefined) {
      const sentences = await this.storage.loadSentences()
      const sentence = sentences[intent.targetIndex]
      
      if (sentence) {
        return {
          type: 'sentence',
          id: sentence.id,
          content: sentence.content,
          item: sentence
        }
      }
    }
    
    return null
  }
  
  /**
   * 执行具体操作
   */
  private async executeOperation(intent: any, target: any, userInput: string): Promise<any> {
    switch (intent.action) {
      case 'rewrite':
        return await this.executeRewrite(target, intent.instruction || userInput)
        
      case 'delete':
        return await this.executeDelete(target)
        
      case 'keep':
        return await this.executeKeep(target)
        
      case 'analyze':
        return await this.executeAnalyze(target)
        
      default:
        throw new Error(`不支持的操作类型: ${intent.action}`)
    }
  }
  
  /**
   * 执行重写操作
   */
  private async executeRewrite(target: any, instruction: string): Promise<any> {
    try {
      // 调用AI服务
      const newContent = await this.aiService.rewriteContent(target.content, instruction)
      
      // 更新存储
      if (target.type === 'paragraph') {
        await this.storage.updateParagraph(target.id, newContent)
      } else {
        await this.storage.updateSentence(target.id, newContent)
      }
      
      return {
        type: 'rewrite',
        targetId: target.id,
        oldContent: target.content,
        newContent,
        success: true
      }
      
    } catch (error) {
      // AI失败时保持原内容
      return {
        type: 'rewrite',
        targetId: target.id,
        oldContent: target.content,
        newContent: target.content,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  
  /**
   * 执行删除操作
   */
  private async executeDelete(target: any): Promise<any> {
    // 删除就是用空内容替换
    if (target.type === 'paragraph') {
      await this.storage.updateParagraph(target.id, '')
    } else {
      await this.storage.updateSentence(target.id, '')
    }
    
    return {
      type: 'delete',
      targetId: target.id,
      oldContent: target.content,
      newContent: '',
      success: true
    }
  }
  
  /**
   * 执行保留操作
   */
  private async executeKeep(target: any): Promise<any> {
    // 保留就是不做任何更改，只记录操作
    return {
      type: 'keep',
      targetId: target.id,
      oldContent: target.content,
      newContent: target.content,
      success: true
    }
  }
  
  /**
   * 执行分析操作
   */
  private async executeAnalyze(target: any): Promise<any> {
    try {
      const analysis = await this.aiService.analyzeContent(target.content)
      
      return {
        type: 'analyze',
        targetId: target.id,
        content: target.content,
        analysis,
        success: true
      }
      
    } catch (error) {
      return {
        type: 'analyze',
        targetId: target.id,
        content: target.content,
        analysis: '分析失败',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  
  /**
   * 记录到记忆
   */
  private async recordToMemory(userInput: string, intent: any, target: any, result: any): Promise<void> {
    const memory: MemoryItem = {
      id: `m_${Date.now()}`,
      timestamp: Date.now(),
      type: 'operation',
      operationData: {
        userInput,
        targetType: target.type,
        targetId: target.id,
        operation: intent.action,
        result: result.newContent || result.analysis || '',
        success: result.success
      }
    }
    
    await this.storage.appendMemoryItem(memory)
  }
}
```

## 6. AI服务接口

### 6.1 AI服务类

```typescript
class AIService {
  private readonly API_ENDPOINT = '/api/ai'
  
  /**
   * 重写内容
   */
  async rewriteContent(content: string, instruction: string): Promise<string> {
    const prompt = `请根据以下要求重写内容：\n要求：${instruction}\n原内容：${content}\n\n只返回重写后的内容，不要添加任何解释。`
    
    const response = await fetch(this.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'o3',
        input: prompt,
        max_output_tokens: 2000
      })
    })
    
    if (!response.ok) {
      throw new Error(`AI服务错误: ${response.status}`)
    }
    
    const data = await response.json()
    return this.extractContentFromResponse(data)
  }
  
  /**
   * 生成内容
   */
  async generateContent(context: string, requirement: string): Promise<string> {
    const prompt = `根据上下文和要求生成内容：\n上下文：${context}\n要求：${requirement}\n\n只返回生成的内容，不要添加任何解释。`
    
    const response = await fetch(this.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'o3',
        input: prompt,
        max_output_tokens: 1500
      })
    })
    
    if (!response.ok) {
      throw new Error(`AI服务错误: ${response.status}`)
    }
    
    const data = await response.json()
    return this.extractContentFromResponse(data)
  }
  
  /**
   * 分析内容
   */
  async analyzeContent(content: string): Promise<string> {
    const prompt = `请分析以下内容的特点、优缺点和改进建议：\n内容：${content}`
    
    const response = await fetch(this.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'o3',
        input: prompt,
        max_output_tokens: 1000
      })
    })
    
    if (!response.ok) {
      throw new Error(`AI服务错误: ${response.status}`)
    }
    
    const data = await response.json()
    return this.extractContentFromResponse(data)
  }
  
  /**
   * 从AI响应中提取内容
   */
  private extractContentFromResponse(response: any): string {
    // 处理不同的响应格式
    if (typeof response?.output_text === 'string') return response.output_text
    if (typeof response?.text === 'string') return response.text
    
    const arr = Array.isArray(response?.output) ? response.output : []
    for (const item of arr) {
      if (item?.type === 'message' && Array.isArray(item?.content)) {
        const outTxt = item.content.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string')
        if (outTxt) return outTxt.text as string
        const anyTxt = item.content.find((c: any) => typeof c?.text === 'string')
        if (anyTxt) return anyTxt.text as string
      }
    }
    
    // 后备解析
    return response?.choices?.[0]?.message?.content || 
           response?.reply || 
           (typeof response === 'string' ? response : '处理失败')
  }
}
```

## 7. 总结

这个精简化的设计具有以下特点：

### ✅ 优势
1. **扁平化结构**: 避免复杂嵌套，易于理解和维护
2. **前端解析**: 减少后端依赖，提高响应速度
3. **明文存储**: 便于调试和数据恢复
4. **追加模式**: 保证数据安全，避免覆盖
5. **闭包流程**: 每个操作都能回到起始状态
6. **简化版本控制**: 去掉复杂的分支功能，只保留必要的快照

### 🎯 性能目标
- **解析速度**: < 100ms（1万字文档）
- **存储效率**: < 5MB（单个简历完整数据）
- **操作响应**: < 200ms（不含AI调用）
- **AI调用**: < 3s（网络请求）

### 📝 实施建议
1. 先实现核心的数据结构和解析器
2. 集成到现有的Chatbot组件
3. 逐步添加AI服务集成
4. 最后完善记忆和学习功能

这个设计遵循了你提出的所有要求：扁平化、避免图结构、序列化友好、前端解析为主、去掉分支功能、保证流程闭包。
