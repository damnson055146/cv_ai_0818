# 简化扁平化数据结构设计

## 核心原则
- 扁平化存储，避免嵌套结构
- 明文存储，避免复杂编码
- 追加模式，避免覆盖操作
- 序列化解析，明确位置信息
- 前端解析，后端最小化

## 1. 段落存储结构

```typescript
// 段落数组 - 扁平化存储
interface ParagraphItem {
  id: string                    // 段落唯一ID: "p_001", "p_002"
  index: number                 // 段落序号: 0, 1, 2, 3...
  content: string               // 段落原始内容
  startPosition: number         // 在文档中的起始字符位置
  endPosition: number           // 在文档中的结束字符位置
  charCount: number             // 字符数量（显式定义）
  lineNumber: number            // 行号
  type: 'heading' | 'paragraph' | 'list' | 'code'  // 段落类型
  level?: number                // 标题级别或列表缩进
  timestamp: number             // 创建/更新时间戳
}

// LocalStorage键: "paragraphs_array"
// 存储格式: ParagraphItem[]
```

## 2. 句子存储结构

```typescript
// 句子数组 - 扁平化存储
interface SentenceItem {
  id: string                    // 句子唯一ID: "s_001", "s_002"
  paragraphId: string           // 所属段落ID: "p_001"
  index: number                 // 在段落中的句子序号: 0, 1, 2...
  content: string               // 句子原始内容
  startPosition: number         // 在文档中的绝对字符位置
  endPosition: number           // 在文档中的绝对字符位置
  charCount: number             // 字符数量（显式定义）
  relativeStart: number         // 在段落中的相对位置
  relativeEnd: number           // 在段落中的相对位置
  timestamp: number             // 创建/更新时间戳
}

// LocalStorage键: "sentences_array"
// 存储格式: SentenceItem[]
```

## 3. 位置索引结构

```typescript
// 位置索引 - 快速定位
interface PositionIndex {
  documentId: string            // 文档ID
  totalCharCount: number        // 文档总字符数
  paragraphCount: number        // 段落总数
  sentenceCount: number         // 句子总数
  lastUpdated: number           // 最后更新时间
  
  // 字符位置到段落的映射
  charToParagraph: {
    [charPosition: number]: string  // 字符位置 -> 段落ID
  }
  
  // 字符位置到句子的映射
  charToSentence: {
    [charPosition: number]: string  // 字符位置 -> 句子ID
  }
  
  // 段落边界信息
  paragraphBoundaries: {
    [paragraphId: string]: {
      start: number
      end: number
      sentenceIds: string[]
    }
  }
}

// LocalStorage键: "position_index"
// 存储格式: PositionIndex
```

## 4. 版本快照结构

```typescript
// 版本快照 - 简化版本控制
interface VersionSnapshot {
  id: string                    // 版本ID: "v_001", "v_002"
  timestamp: number             // 创建时间戳
  description: string           // 版本描述
  
  // 快照数据 - 仅存储变更
  changes: {
    type: 'paragraph_add' | 'paragraph_update' | 'paragraph_delete' | 
          'sentence_add' | 'sentence_update' | 'sentence_delete'
    targetId: string            // 目标段落/句子ID
    content?: string            // 新内容（如果是添加/更新）
    oldContent?: string         // 原内容（用于回退）
    position?: number           // 位置信息
  }[]
  
  // 操作来源
  source: 'user' | 'chatbot'
  operation: string             // 操作描述
}

// LocalStorage键: "version_snapshots"
// 存储格式: VersionSnapshot[]
```

## 5. Chatbot记忆结构

```typescript
// 聊天记忆 - 扁平化存储
interface ChatMemoryItem {
  id: string                    // 记忆ID: "m_001", "m_002"
  timestamp: number             // 时间戳
  type: 'operation' | 'preference' | 'pattern'
  
  // 操作记忆
  operationData?: {
    userInput: string           // 用户原始输入
    targetType: 'paragraph' | 'sentence'
    targetId: string            // 目标ID
    operation: 'keep' | 'rewrite' | 'delete'
    result: string              // 操作结果
  }
  
  // 偏好记忆
  preferenceData?: {
    category: string            // 偏好类别
    key: string                 // 偏好键
    value: string               // 偏好值
    frequency: number           // 使用频率
  }
  
  // 模式记忆
  patternData?: {
    sequence: string[]          // 操作序列
    context: string             // 上下文描述
    successRate: number         // 成功率
  }
}

// LocalStorage键: "chat_memories"
// 存储格式: ChatMemoryItem[]
```

## 6. 当前状态结构

```typescript
// 当前工作状态
interface WorkspaceState {
  currentDocumentId: string     // 当前文档ID
  currentVersionId: string      // 当前版本ID
  lastSaved: number             // 最后保存时间
  
  // 当前选择状态
  selection: {
    type: 'none' | 'paragraph' | 'sentence' | 'range'
    targetId?: string           // 选中的段落/句子ID
    startChar?: number          // 选择起始字符位置
    endChar?: number            // 选择结束字符位置
  }
  
  // 编辑状态
  editing: {
    isEditing: boolean
    targetId?: string           // 正在编辑的目标ID
    operation?: string          // 当前操作类型
    aiProcessing?: boolean      // AI是否在处理
  }
}

// LocalStorage键: "workspace_state"
// 存储格式: WorkspaceState
```

## 7. 解析器实现

```typescript
// 前端解析器 - 处理MD到结构化数据
class FlatMarkdownParser {
  
  // 解析完整文档
  parseDocument(markdown: string): {
    paragraphs: ParagraphItem[]
    sentences: SentenceItem[]
    positionIndex: PositionIndex
  } {
    const paragraphs: ParagraphItem[] = []
    const sentences: SentenceItem[] = []
    
    // 按行分割
    const lines = markdown.split('\n')
    let currentPosition = 0
    let paragraphIndex = 0
    let sentenceGlobalIndex = 0
    
    let currentParagraph = ''
    let paragraphStartPos = 0
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex].trim()
      
      // 空行表示段落结束
      if (line === '') {
        if (currentParagraph) {
          const paragraphItem = this.createParagraphItem(
            currentParagraph, 
            paragraphIndex, 
            paragraphStartPos, 
            currentPosition,
            lineIndex
          )
          paragraphs.push(paragraphItem)
          
          // 解析段落中的句子
          const paragraphSentences = this.parseSentences(
            currentParagraph, 
            paragraphItem.id, 
            paragraphStartPos,
            sentenceGlobalIndex
          )
          sentences.push(...paragraphSentences)
          sentenceGlobalIndex += paragraphSentences.length
          
          paragraphIndex++
          currentParagraph = ''
        }
        paragraphStartPos = currentPosition + 1
      } else {
        if (currentParagraph === '') {
          paragraphStartPos = currentPosition
        }
        currentParagraph += (currentParagraph ? '\n' : '') + line
      }
      
      currentPosition += lines[lineIndex].length + 1 // +1 for \n
    }
    
    // 处理最后一个段落
    if (currentParagraph) {
      const paragraphItem = this.createParagraphItem(
        currentParagraph, 
        paragraphIndex, 
        paragraphStartPos, 
        currentPosition,
        lines.length
      )
      paragraphs.push(paragraphItem)
      
      const paragraphSentences = this.parseSentences(
        currentParagraph, 
        paragraphItem.id, 
        paragraphStartPos,
        sentenceGlobalIndex
      )
      sentences.push(...paragraphSentences)
    }
    
    // 生成位置索引
    const positionIndex = this.generatePositionIndex(paragraphs, sentences)
    
    return { paragraphs, sentences, positionIndex }
  }
  
  // 创建段落项
  private createParagraphItem(
    content: string, 
    index: number, 
    startPos: number, 
    endPos: number,
    lineNumber: number
  ): ParagraphItem {
    return {
      id: `p_${index.toString().padStart(3, '0')}`,
      index,
      content,
      startPosition: startPos,
      endPosition: endPos,
      charCount: content.length,
      lineNumber,
      type: this.detectParagraphType(content),
      level: this.detectLevel(content),
      timestamp: Date.now()
    }
  }
  
  // 解析句子
  private parseSentences(
    paragraphContent: string, 
    paragraphId: string, 
    paragraphStartPos: number,
    startIndex: number
  ): SentenceItem[] {
    const sentences: SentenceItem[] = []
    
    // 简单句子分割（可以优化）
    const sentenceRegex = /[^.!?。！？]*[.!?。！？]+/g
    let match
    let sentenceIndex = 0
    
    while ((match = sentenceRegex.exec(paragraphContent)) !== null) {
      const sentence = match[0].trim()
      if (sentence.length > 0) {
        const relativeStart = match.index
        const relativeEnd = match.index + sentence.length
        
        sentences.push({
          id: `s_${(startIndex + sentenceIndex).toString().padStart(3, '0')}`,
          paragraphId,
          index: sentenceIndex,
          content: sentence,
          startPosition: paragraphStartPos + relativeStart,
          endPosition: paragraphStartPos + relativeEnd,
          charCount: sentence.length,
          relativeStart,
          relativeEnd,
          timestamp: Date.now()
        })
        
        sentenceIndex++
      }
    }
    
    return sentences
  }
}
```

## 8. 存储操作接口

```typescript
// 存储操作类 - 仅追加模式
class FlatStorageManager {
  
  // 保存解析结果
  async saveParsedContent(
    paragraphs: ParagraphItem[], 
    sentences: SentenceItem[], 
    positionIndex: PositionIndex
  ): Promise<void> {
    await Promise.all([
      localStorage.setItem('paragraphs_array', JSON.stringify(paragraphs)),
      localStorage.setItem('sentences_array', JSON.stringify(sentences)),
      localStorage.setItem('position_index', JSON.stringify(positionIndex))
    ])
  }
  
  // 追加新段落
  async appendParagraph(paragraph: ParagraphItem): Promise<void> {
    const existing = await this.getParagraphs()
    existing.push(paragraph)
    await localStorage.setItem('paragraphs_array', JSON.stringify(existing))
  }
  
  // 更新段落内容
  async updateParagraph(paragraphId: string, newContent: string): Promise<void> {
    const paragraphs = await this.getParagraphs()
    const index = paragraphs.findIndex(p => p.id === paragraphId)
    
    if (index >= 0) {
      // 创建版本快照
      await this.createSnapshot('paragraph_update', paragraphId, newContent, paragraphs[index].content)
      
      // 更新内容
      paragraphs[index].content = newContent
      paragraphs[index].charCount = newContent.length
      paragraphs[index].timestamp = Date.now()
      
      await localStorage.setItem('paragraphs_array', JSON.stringify(paragraphs))
    }
  }
  
  // 创建版本快照
  async createSnapshot(
    type: VersionSnapshot['changes'][0]['type'],
    targetId: string,
    newContent?: string,
    oldContent?: string
  ): Promise<void> {
    const snapshots = await this.getSnapshots()
    const snapshot: VersionSnapshot = {
      id: `v_${Date.now()}`,
      timestamp: Date.now(),
      description: `${type} - ${targetId}`,
      changes: [{
        type,
        targetId,
        content: newContent,
        oldContent
      }],
      source: 'user',
      operation: type
    }
    
    snapshots.push(snapshot)
    await localStorage.setItem('version_snapshots', JSON.stringify(snapshots))
  }
  
  // 获取数据方法
  async getParagraphs(): Promise<ParagraphItem[]> {
    const data = localStorage.getItem('paragraphs_array')
    return data ? JSON.parse(data) : []
  }
  
  async getSentences(): Promise<SentenceItem[]> {
    const data = localStorage.getItem('sentences_array')
    return data ? JSON.parse(data) : []
  }
  
  async getPositionIndex(): Promise<PositionIndex | null> {
    const data = localStorage.getItem('position_index')
    return data ? JSON.parse(data) : null
  }
  
  async getSnapshots(): Promise<VersionSnapshot[]> {
    const data = localStorage.getItem('version_snapshots')
    return data ? JSON.parse(data) : []
  }
}
```

这种扁平化设计的优势：

1. **简单可靠**: 避免复杂的嵌套结构
2. **快速定位**: 通过位置索引快速找到段落和句子
3. **追加模式**: 避免覆盖操作，减少数据丢失风险
4. **明文存储**: 易于调试和维护
5. **前端解析**: 减少后端依赖，提高响应速度
6. **序列化友好**: 适合localStorage的JSON序列化
