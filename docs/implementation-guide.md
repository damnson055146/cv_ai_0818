# 实施指南

## 1. 实施概述

本指南提供了增强型Chatbot工作区交互系统的详细实施步骤、最佳实践和注意事项。

### 1.1 实施目标
- 在现有系统基础上渐进式升级
- 保持系统稳定性和向后兼容性
- 实现高性能和良好的用户体验
- 建立可扩展的架构基础

### 1.2 技术要求
- **前端**: Nuxt 3 + Vue 3 + TypeScript
- **状态管理**: Pinia
- **存储**: IndexedDB + LocalForage
- **编辑器**: Monaco Editor
- **AI服务**: 兼容现有API

## 2. 分阶段实施计划

### Phase 1: 基础架构 (Week 1-3)

#### 2.1.1 数据结构实施

**步骤1: 创建核心类型定义**

```bash
# 创建类型定义文件
mkdir -p site/src/types/enhanced
touch site/src/types/enhanced/version.ts
touch site/src/types/enhanced/memory.ts
touch site/src/types/enhanced/cache.ts
touch site/src/types/enhanced/operation.ts
```

**文件: `site/src/types/enhanced/version.ts`**
```typescript
// 实施版本控制相关类型
export interface DocumentVersion {
  id: string
  content: string
  contentHash: string
  timestamp: number
  type: 'manual' | 'ai' | 'merge' | 'cherry-pick' | 'revert'
  metadata: VersionMetadata
  size: number
  parentId?: string
  childrenIds: string[]
  branchName: string
  tags: string[]
}

// ... 其他类型定义
```

**步骤2: 创建基础工具类**

```bash
# 创建工具类文件
mkdir -p site/src/utils/enhanced
touch site/src/utils/enhanced/hash.ts
touch site/src/utils/enhanced/diff.ts
touch site/src/utils/enhanced/compression.ts
```

**文件: `site/src/utils/enhanced/hash.ts`**
```typescript
import { createHash } from 'crypto'

export class HashUtils {
  static generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }
  
  static generateId(prefix: string = ''): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `${prefix}${timestamp}_${random}`
  }
}
```

#### 2.1.2 存储系统升级

**步骤1: 创建增强存储管理器**

```bash
touch site/src/composables/enhancedStorage.ts
```

**文件: `site/src/composables/enhancedStorage.ts`**
```typescript
import * as localForage from 'localforage'
import type { EnhancedResumeStorageItem, DocumentVersion, ChatMemory } from '~/types/enhanced'

export class EnhancedStorage {
  private baseStorage = localForage.createInstance({
    name: 'MarkdownResumeEnhanced',
    storeName: 'enhanced_data'
  })
  
  private versionStorage = localForage.createInstance({
    name: 'MarkdownResumeVersions', 
    storeName: 'versions'
  })

  async saveEnhancedResume(id: string, resume: EnhancedResumeStorageItem): Promise<void> {
    // 分离存储以优化性能
    const { versionHistory, chatMemories, cache, ...baseData } = resume
    
    await Promise.all([
      this.baseStorage.setItem(id, baseData),
      this.saveVersionHistory(id, versionHistory),
      this.saveMemories(id, chatMemories)
    ])
  }

  // 实施其他存储方法...
}
```

**步骤2: 数据迁移脚本**

```bash
touch site/src/utils/migration.ts
```

**文件: `site/src/utils/migration.ts`**
```typescript
import { getStorage } from '~/utils/database'
import type { ResumeStorage, EnhancedResumeStorageItem } from '~/types'

export class DataMigration {
  static async migrateToEnhanced(): Promise<void> {
    const oldStorage = await getStorage()
    if (!oldStorage) return

    for (const [id, resume] of Object.entries(oldStorage)) {
      const enhanced: EnhancedResumeStorageItem = {
        ...resume,
        currentVersionId: 'initial',
        versionHistory: [{
          id: 'initial',
          content: resume.markdown,
          contentHash: HashUtils.generateContentHash(resume.markdown),
          timestamp: Date.now(),
          type: 'manual',
          metadata: {
            operation: 'initial_import',
            source: 'user',
            description: '从旧系统导入',
            affectedRanges: [],
            operationStats: {
              charactersAdded: resume.markdown.length,
              charactersRemoved: 0,
              sectionsModified: 0,
              timeSpent: 0,
              operationCount: 1
            }
          },
          size: resume.markdown.length,
          childrenIds: [],
          branchName: 'main',
          tags: ['import']
        }],
        branches: [{
          name: 'main',
          id: 'main',
          headVersionId: 'initial',
          baseVersionId: 'initial',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
          metadata: {
            description: '主分支',
            creator: 'system',
            purpose: 'feature',
            mergeStatus: 'open'
          }
        }],
        chatMemories: [],
        userPreferences: [],
        cache: this.createEmptyCache(),
        enhancedMetadata: {
          createdAt: Date.now(),
          lastModified: Date.now(),
          totalEditTime: 0,
          operationCount: 1,
          aiAssistanceUsage: {
            totalRequests: 0,
            totalTokensUsed: 0,
            averageResponseTime: 0,
            successRate: 0,
            preferredModels: {},
            costEstimate: 0
          },
          collaborationHistory: [],
          backupInfo: {
            lastBackup: 0,
            backupFrequency: 'never',
            cloudSync: false,
            localBackups: []
          }
        }
      }

      await enhancedStorage.saveEnhancedResume(id, enhanced)
    }
  }
}
```

#### 2.1.3 版本控制管理器

**步骤1: 创建版本管理器**

```bash
touch site/src/composables/versionManager.ts
```

**文件: `site/src/composables/versionManager.ts`**
```typescript
import type { DocumentVersion, VersionMetadata, Branch } from '~/types/enhanced'
import { HashUtils } from '~/utils/enhanced/hash'

export class VersionManager {
  private storage: EnhancedStorage
  private currentResumeId: string | null = null
  
  constructor(storage: EnhancedStorage) {
    this.storage = storage
  }

  async createVersion(
    content: string, 
    metadata: Omit<VersionMetadata, 'operationStats'>
  ): Promise<DocumentVersion> {
    const id = HashUtils.generateId('v_')
    const contentHash = HashUtils.generateContentHash(content)
    
    const version: DocumentVersion = {
      id,
      content,
      contentHash,
      timestamp: Date.now(),
      type: metadata.operation.includes('ai') ? 'ai' : 'manual',
      metadata: {
        ...metadata,
        operationStats: this.calculateOperationStats(content, metadata)
      },
      size: content.length,
      parentId: await this.getCurrentVersionId(),
      childrenIds: [],
      branchName: await this.getCurrentBranch(),
      tags: []
    }

    await this.storage.saveVersion(version)
    await this.updateVersionRelations(version)
    
    return version
  }

  async getCurrentVersion(): Promise<DocumentVersion> {
    const currentId = await this.getCurrentVersionId()
    return await this.storage.getVersion(currentId)
  }

  async switchToBranch(branchName: string): Promise<void> {
    const branch = await this.storage.getBranch(branchName)
    if (!branch) throw new Error(`分支 ${branchName} 不存在`)
    
    const headVersion = await this.storage.getVersion(branch.headVersionId)
    await this.setCurrentVersion(headVersion.id)
    await this.setCurrentBranch(branchName)
  }

  // 实施其他版本管理方法...
}
```

### Phase 2: 核心功能 (Week 4-7)

#### 2.2.1 精确控制器实施

**步骤1: 扩展文档解析器**

```bash
# 扩展现有的文档解析器
# 文件: site/src/composables/documentStructureParser.ts
```

在现有文档解析器基础上添加：

```typescript
// 添加到现有文件
export class EnhancedDocumentParser extends DocumentStructureParser {
  /**
   * 解析为精确范围
   */
  parseToRanges(content: string): ContentRange[] {
    const structure = this.parseDocumentStructure(content)
    const ranges: ContentRange[] = []
    
    // 1. 文档级别
    ranges.push(this.createDocumentRange(content, structure))
    
    // 2. 章节级别
    structure.sections.forEach((section, index) => {
      ranges.push(this.createSectionRange(section, index))
      
      // 3. 句子级别
      const sentences = this.parseSentences(section.content, section.startLine)
      ranges.push(...sentences)
    })
    
    return ranges
  }

  private createDocumentRange(content: string, structure: DocumentStructure): ContentRange {
    return {
      id: 'doc-root',
      type: 'document',
      position: {
        start: { line: 1, column: 1, character: 0 },
        end: { line: structure.totalLines, column: -1, character: content.length },
        absoluteStart: 0,
        absoluteEnd: content.length
      },
      content,
      metadata: {
        depth: 0,
        syntaxType: 'markdown',
        formatting: this.analyzeFormatting(content),
        contextId: 'document',
        semanticRole: 'content'
      }
    }
  }

  private parseSentences(content: string, startLine: number): ContentRange[] {
    const sentences: ContentRange[] = []
    const lines = content.split('\n')
    let absolutePosition = 0
    
    lines.forEach((line, lineIndex) => {
      const actualLine = startLine + lineIndex
      
      // 使用更精确的句子分割
      const sentenceRegex = /[^.!?。！？]*[.!?。！？]+/g
      let match
      let columnOffset = 0
      
      while ((match = sentenceRegex.exec(line)) !== null) {
        const sentence = match[0].trim()
        if (sentence.length > 0) {
          sentences.push({
            id: `sentence-${actualLine}-${columnOffset}`,
            type: 'sentence',
            position: {
              start: { 
                line: actualLine, 
                column: columnOffset + 1,
                character: absolutePosition + columnOffset
              },
              end: { 
                line: actualLine, 
                column: columnOffset + sentence.length,
                character: absolutePosition + columnOffset + sentence.length
              },
              absoluteStart: absolutePosition + columnOffset,
              absoluteEnd: absolutePosition + columnOffset + sentence.length
            },
            content: sentence,
            metadata: {
              depth: 2,
              syntaxType: 'text',
              formatting: this.analyzeFormatting(sentence),
              contextId: `line-${actualLine}`,
              semanticRole: 'content'
            }
          })
        }
        columnOffset = match.index + match[0].length
      }
      
      absolutePosition += line.length + 1 // +1 for newline
    })
    
    return sentences
  }
}
```

**步骤2: 创建精确控制器**

```bash
touch site/src/composables/precisionController.ts
```

**文件: `site/src/composables/precisionController.ts`**
```typescript
import type { ContentRange, ContentOperation, OperationResult } from '~/types/enhanced'

export class PrecisionController {
  private parser: EnhancedDocumentParser
  private versionManager: VersionManager
  
  constructor(parser: EnhancedDocumentParser, versionManager: VersionManager) {
    this.parser = parser
    this.versionManager = versionManager
  }

  async executeOperation(operation: ContentOperation): Promise<OperationResult> {
    const startTime = Date.now()
    
    try {
      // 1. 验证操作
      const validation = await this.validateOperation(operation)
      if (!validation.valid) {
        throw new Error(`操作验证失败: ${validation.errors.join(', ')}`)
      }

      // 2. 获取当前版本
      const currentVersion = await this.versionManager.getCurrentVersion()
      const ranges = this.parser.parseToRanges(currentVersion.content)
      
      // 3. 执行操作
      const result = await this.applyOperation(operation, currentVersion.content, ranges)
      
      // 4. 创建新版本
      if (result.success && result.newContent) {
        const newVersion = await this.versionManager.createVersion(result.newContent, {
          operation: `精确操作: ${operation.type}`,
          source: 'user',
          description: operation.reason,
          affectedRanges: [ranges.find(r => r.id === operation.rangeId)!]
        })
        result.newVersionId = newVersion.id
      }

      // 5. 记录性能指标
      result.performanceMetrics = {
        executionTime: Date.now() - startTime,
        memoryUsage: this.calculateMemoryUsage(),
        cacheHits: 0, // 将由缓存管理器提供
        cacheMisses: 0,
        networkRequests: operation.type === 'rewrite' ? 1 : 0
      }

      return result
      
    } catch (error) {
      return {
        success: false,
        operationId: operation.id,
        affectedRanges: [],
        performanceMetrics: {
          executionTime: Date.now() - startTime,
          memoryUsage: 0,
          cacheHits: 0,
          cacheMisses: 0,
          networkRequests: 0
        },
        warnings: [],
        errors: [{
          type: 'system',
          message: error instanceof Error ? error.message : String(error),
          code: 'EXECUTION_FAILED',
          details: error
        }]
      }
    }
  }

  private async applyOperation(
    operation: ContentOperation, 
    content: string, 
    ranges: ContentRange[]
  ): Promise<Partial<OperationResult>> {
    const targetRange = ranges.find(r => r.id === operation.rangeId)
    if (!targetRange) {
      throw new Error(`范围 ${operation.rangeId} 不存在`)
    }

    let newContent = content
    const affectedRanges = [targetRange]

    switch (operation.type) {
      case 'keep':
        // 不做任何操作
        break
        
      case 'rewrite':
        if (!operation.newContent) {
          // 调用AI重写
          operation.newContent = await this.callAiForRewrite(targetRange.content, operation.reason)
        }
        newContent = this.replaceRange(content, targetRange, operation.newContent)
        break
        
      case 'delete':
        newContent = this.replaceRange(content, targetRange, '')
        break
        
      case 'insert':
        newContent = this.insertAtRange(content, targetRange, operation.newContent || '')
        break
        
      default:
        throw new Error(`不支持的操作类型: ${operation.type}`)
    }

    return {
      success: true,
      newContent,
      affectedRanges,
      warnings: [],
      errors: []
    }
  }

  private replaceRange(content: string, range: ContentRange, newText: string): string {
    const before = content.substring(0, range.position.absoluteStart)
    const after = content.substring(range.position.absoluteEnd)
    return before + newText + after
  }

  private async callAiForRewrite(originalContent: string, reason: string): Promise<string> {
    // 调用现有的AI API
    const prompt = `请重写以下内容：${originalContent}\n\n要求：${reason}\n\n只返回重写后的内容，不要添加任何解释。`
    
    try {
      const response = await $fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'o3',
          input: prompt,
          max_output_tokens: 1000
        })
      })
      
      return this.extractContentFromAiResponse(response)
    } catch (error) {
      throw new Error(`AI重写失败: ${error}`)
    }
  }
}
```

#### 2.2.2 记忆管理器实施

**步骤1: 创建记忆管理器**

```bash
touch site/src/composables/memoryManager.ts
```

**文件: `site/src/composables/memoryManager.ts`**
```typescript
import type { ChatMemory, OperationPattern, UserPreference } from '~/types/enhanced'

export class MemoryManager {
  private storage: EnhancedStorage
  private cache: Map<string, ChatMemory[]> = new Map()
  private searchIndex: Map<string, Set<string>> = new Map()
  
  constructor(storage: EnhancedStorage) {
    this.storage = storage
    this.initializeIndex()
  }

  async storeMemory(memory: Omit<ChatMemory, 'id' | 'timestamp'>): Promise<string> {
    const id = HashUtils.generateId('mem_')
    const fullMemory: ChatMemory = {
      ...memory,
      id,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    }
    
    // 存储到缓存
    const contextMemories = this.cache.get(memory.contextId) || []
    contextMemories.push(fullMemory)
    this.cache.set(memory.contextId, contextMemories)
    
    // 更新搜索索引
    await this.updateSearchIndex(fullMemory)
    
    // 持久化存储
    await this.storage.saveMemory(fullMemory)
    
    return id
  }

  async learnFromOperation(result: OperationResult): Promise<void> {
    if (!result.success) return

    // 提取操作模式
    const pattern = this.extractOperationPattern(result)
    if (pattern) {
      await this.storeMemory({
        type: 'pattern',
        content: { pattern },
        contextId: 'operation-patterns',
        relevanceScore: this.calculatePatternRelevance(pattern),
        metadata: {
          sessionId: this.getCurrentSessionId(),
          tags: ['pattern', 'operation', result.operationId],
          confidence: 0.8,
          importance: 0.7,
          volatility: 0.3,
          associatedMemories: []
        }
      })
    }

    // 学习用户偏好
    const preferences = this.extractPreferences(result)
    for (const preference of preferences) {
      await this.updateUserPreference(preference)
    }
  }

  async findRelevantMemories(
    query: string, 
    contextId: string, 
    options: {
      type?: ChatMemory['type']
      limit?: number
      minRelevance?: number
    } = {}
  ): Promise<ChatMemory[]> {
    const { type, limit = 10, minRelevance = 0.3 } = options
    
    // 从缓存中检索
    const contextMemories = this.cache.get(contextId) || []
    
    // 计算相关性
    const candidates: Array<ChatMemory & { score: number }> = []
    const queryKeywords = this.extractKeywords(query)
    
    for (const memory of contextMemories) {
      if (type && memory.type !== type) continue
      
      const similarity = this.calculateSimilarity(queryKeywords, memory)
      if (similarity >= minRelevance) {
        memory.accessCount++
        memory.lastAccessed = Date.now()
        candidates.push({ ...memory, score: similarity })
      }
    }
    
    // 排序并返回
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...memory }) => memory)
  }

  private extractOperationPattern(result: OperationResult): OperationPattern | null {
    // 分析操作结果，提取模式
    return {
      sequence: [result.operationId],
      frequency: 1,
      successRate: result.success ? 1 : 0,
      averageTime: result.performanceMetrics.executionTime,
      context: {
        documentType: 'resume',
        sectionTypes: result.affectedRanges.map(r => r.metadata.sectionType).filter(Boolean),
        timeOfDay: this.getTimeOfDay(),
        sessionDuration: this.getSessionDuration()
      }
    }
  }

  private calculateSimilarity(keywords: string[], memory: ChatMemory): number {
    // 实施相似性计算算法
    const memoryText = JSON.stringify(memory.content).toLowerCase()
    let matches = 0
    
    for (const keyword of keywords) {
      if (memoryText.includes(keyword.toLowerCase())) {
        matches++
      }
    }
    
    const baseSimilarity = matches / keywords.length
    
    // 考虑记忆的重要性和新鲜度
    const importanceBoost = memory.metadata.importance * 0.2
    const freshnessBoost = this.calculateFreshnessScore(memory.timestamp) * 0.1
    
    return Math.min(1, baseSimilarity + importanceBoost + freshnessBoost)
  }
}
```

#### 2.2.3 集成到现有Chatbot

**步骤1: 扩展现有Chatbot组件**

在 `site/src/components/shared/Chatbot.vue` 中添加增强功能：

```typescript
// 在现有文件中添加导入
import { VersionManager } from '~/composables/versionManager'
import { PrecisionController } from '~/composables/precisionController'
import { MemoryManager } from '~/composables/memoryManager'
import { EnhancedStorage } from '~/composables/enhancedStorage'

// 在现有组件中添加
const enhancedStorage = new EnhancedStorage()
const versionManager = new VersionManager(enhancedStorage)
const precisionController = new PrecisionController(documentParser, versionManager)
const memoryManager = new MemoryManager(enhancedStorage)

// 修改现有的processSmartEdit函数
async function processSmartEdit(userText: string) {
  console.log('[Chatbot] 执行智能编辑 - 增强版')
  
  isThinking.value = true
  pushMessage({ 
    role: "assistant", 
    content: "正在分析编辑范围..."
  })
  
  try {
    // 1. 获取文档内容和结构
    const currentDocumentContent = await getCurrentDocumentContent()
    const ranges = documentParser.parseToRanges(currentDocumentContent)
    
    // 2. 检索相关记忆
    const relevantMemories = await memoryManager.findRelevantMemories(
      userText, 
      'editing-context',
      { type: 'operation', limit: 5 }
    )
    
    // 3. 分析操作意图（结合记忆）
    const scopeAnalysis = await analyzeScopeWithMemory(userText, ranges, relevantMemories)
    
    // 4. 显示操作选项给用户
    if (scopeAnalysis.success) {
      await showOperationOptions(scopeAnalysis, ranges)
    }
    
  } catch (error) {
    console.error('[Chatbot] 增强编辑失败:', error)
    pushMessage({ 
      role: "assistant", 
      content: `编辑失败: ${error instanceof Error ? error.message : String(error)}`
    })
  } finally {
    isThinking.value = false
  }
}

// 新增函数：显示操作选项
async function showOperationOptions(analysis: any, ranges: ContentRange[]) {
  const targetRanges = ranges.filter(r => analysis.targetRangeIds.includes(r.id))
  
  pushMessage({
    role: "assistant",
    content: `检测到 ${targetRanges.length} 个可操作区域。请选择操作方式：
    
${targetRanges.map((range, index) => `
${index + 1}. ${range.content.substring(0, 50)}...
   [保留] [重写] [删除]
`).join('')}

发送"执行"来应用选择，或"取消"来放弃操作。`
  })
  
  // 存储操作上下文到组件状态
  currentOperationContext.value = {
    analysis,
    targetRanges,
    selectedOperations: []
  }
}
```

### Phase 3: 高级特性 (Week 8-10)

#### 2.3.1 分支管理界面

**步骤1: 创建版本控制面板组件**

```bash
touch site/src/components/shared/VersionControlPanel.vue
```

**文件: `site/src/components/shared/VersionControlPanel.vue`**
```vue
<template>
  <div class="version-control-panel">
    <!-- 分支选择器 -->
    <div class="branch-selector">
      <h3>当前分支</h3>
      <select v-model="currentBranch" @change="switchBranch">
        <option v-for="branch in branches" :key="branch.name" :value="branch.name">
          {{ branch.name }} ({{ branch.metadata.description }})
        </option>
      </select>
      <button @click="createNewBranch">新建分支</button>
    </div>

    <!-- 版本历史 -->
    <div class="version-history">
      <h3>版本历史</h3>
      <div class="version-timeline">
        <div 
          v-for="version in versionHistory" 
          :key="version.id"
          class="version-item"
          :class="{ 
            active: version.id === currentVersionId,
            'ai-generated': version.type === 'ai'
          }"
          @click="selectVersion(version.id)"
        >
          <div class="version-header">
            <span class="version-time">{{ formatTime(version.timestamp) }}</span>
            <span class="version-type" :class="`type-${version.type}`">
              {{ getTypeLabel(version.type) }}
            </span>
          </div>
          <div class="version-desc">{{ version.metadata.description }}</div>
          <div class="version-stats">
            <span>{{ version.metadata.operationStats.charactersAdded }}+ </span>
            <span>{{ version.metadata.operationStats.charactersRemoved }}- </span>
            <span>{{ version.metadata.operationStats.sectionsModified }} sections</span>
          </div>
          <div class="version-actions">
            <button @click.stop="revertToVersion(version.id)" class="action-btn revert">
              回退
            </button>
            <button @click.stop="createBranchFrom(version.id)" class="action-btn branch">
              分支
            </button>
            <button @click.stop="showVersionDiff(version.id)" class="action-btn diff">
              对比
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 精确操作控制 -->
    <div class="precision-control">
      <h3>精确编辑控制</h3>
      <div class="operation-mode">
        <label>
          <input type="radio" v-model="operationMode" value="preview">
          预览模式
        </label>
        <label>
          <input type="radio" v-model="operationMode" value="direct">
          直接执行
        </label>
      </div>
      
      <div v-if="availableRanges.length > 0" class="content-ranges">
        <h4>可操作范围</h4>
        <div 
          v-for="range in availableRanges" 
          :key="range.id"
          class="range-item"
          :class="{ selected: selectedRanges.includes(range.id) }"
          @click="toggleRangeSelection(range.id)"
        >
          <div class="range-preview">
            <span class="range-type">{{ range.type }}</span>
            <span class="range-content">{{ range.content.substring(0, 60) }}...</span>
          </div>
          <div class="range-actions">
            <button 
              @click.stop="setOperation(range.id, 'keep')"
              :class="{ active: getOperationType(range.id) === 'keep' }"
            >
              保留
            </button>
            <button 
              @click.stop="setOperation(range.id, 'rewrite')"
              :class="{ active: getOperationType(range.id) === 'rewrite' }"
            >
              重写
            </button>
            <button 
              @click.stop="setOperation(range.id, 'delete')"
              :class="{ active: getOperationType(range.id) === 'delete' }"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 批量操作 -->
      <div class="batch-operations">
        <button 
          @click="executeOperations" 
          :disabled="!hasSelectedOperations"
          class="primary-btn"
        >
          {{ operationMode === 'preview' ? '预览效果' : '执行操作' }}
        </button>
        <button @click="clearAllOperations" class="secondary-btn">
          清除选择
        </button>
        <button 
          v-if="operationMode === 'preview' && previewResult"
          @click="applyPreviewedOperations"
          class="confirm-btn"
        >
          确认应用
        </button>
      </div>
    </div>

    <!-- 智能建议 -->
    <div v-if="suggestions.length > 0" class="suggestions-panel">
      <h3>智能建议</h3>
      <div class="suggestions-list">
        <div 
          v-for="suggestion in suggestions" 
          :key="suggestion.id"
          class="suggestion-item"
          @click="applySuggestion(suggestion)"
        >
          <div class="suggestion-desc">{{ suggestion.description }}</div>
          <div class="suggestion-confidence">
            信心度: {{ (suggestion.confidence * 100).toFixed(0) }}%
          </div>
          <div class="suggestion-impact">
            影响: {{ suggestion.estimatedImpact.characterDelta > 0 ? '+' : '' }}{{ suggestion.estimatedImpact.characterDelta }} 字符
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocumentVersion, Branch, ContentRange, ContentOperation, OperationSuggestion } from '~/types/enhanced'

// 组件状态
const currentBranch = ref('main')
const currentVersionId = ref('')
const versionHistory = ref<DocumentVersion[]>([])
const branches = ref<Branch[]>([])
const availableRanges = ref<ContentRange[]>([])
const selectedRanges = ref<string[]>([])
const pendingOperations = ref<Map<string, ContentOperation>>(new Map())
const operationMode = ref<'preview' | 'direct'>('preview')
const previewResult = ref<string | null>(null)
const suggestions = ref<OperationSuggestion[]>([])

// 依赖注入
const versionManager = inject('versionManager') as VersionManager
const precisionController = inject('precisionController') as PrecisionController
const memoryManager = inject('memoryManager') as MemoryManager

// 生命周期
onMounted(async () => {
  await loadVersionData()
  await loadSuggestions()
})

// 方法实现
async function loadVersionData() {
  try {
    versionHistory.value = await versionManager.getVersionHistory()
    branches.value = await versionManager.getBranches()
    currentVersionId.value = await versionManager.getCurrentVersionId()
    currentBranch.value = await versionManager.getCurrentBranch()
    
    // 解析当前文档获取可操作范围
    const currentVersion = await versionManager.getCurrentVersion()
    availableRanges.value = documentParser.parseToRanges(currentVersion.content)
  } catch (error) {
    console.error('加载版本数据失败:', error)
  }
}

async function executeOperations() {
  if (pendingOperations.value.size === 0) return
  
  try {
    const operations = Array.from(pendingOperations.value.values())
    
    if (operationMode.value === 'preview') {
      const preview = await precisionController.previewOperations(operations)
      previewResult.value = preview.preview
      // 显示预览界面
      showPreviewModal(preview)
    } else {
      // 直接执行
      for (const operation of operations) {
        await precisionController.executeOperation(operation)
      }
      
      // 刷新数据
      await loadVersionData()
      clearAllOperations()
    }
  } catch (error) {
    console.error('执行操作失败:', error)
  }
}

function setOperation(rangeId: string, type: ContentOperation['type']) {
  const range = availableRanges.value.find(r => r.id === rangeId)
  if (!range) return
  
  const operation: ContentOperation = {
    id: `op_${Date.now()}_${rangeId}`,
    type,
    rangeId,
    reason: `用户选择${type}操作`,
    confidence: 1.0,
    metadata: {
      timestamp: Date.now(),
      source: 'user',
      priority: 1,
      dependencies: [],
      reversible: true,
      estimatedImpact: {
        characterDelta: type === 'delete' ? -range.content.length : 0,
        sectionCount: 1,
        complexityScore: 0.3,
        riskLevel: 'low'
      }
    }
  }
  
  pendingOperations.value.set(rangeId, operation)
}

// 计算属性
const hasSelectedOperations = computed(() => pendingOperations.value.size > 0)

// 工具函数
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function getTypeLabel(type: DocumentVersion['type']): string {
  const labels = {
    manual: '手动',
    ai: 'AI',
    merge: '合并',
    'cherry-pick': '精选',
    revert: '回退'
  }
  return labels[type] || type
}
</script>

<style scoped>
.version-control-panel {
  width: 300px;
  height: 100vh;
  border-left: 1px solid #e0e0e0;
  background: #fafafa;
  padding: 16px;
  overflow-y: auto;
}

.version-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.version-item:hover {
  border-color: #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
}

.version-item.active {
  border-color: #2196f3;
  background: #e3f2fd;
}

.version-item.ai-generated {
  border-left: 4px solid #ff9800;
}

.type-ai {
  background: #ff9800;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.type-manual {
  background: #4caf50;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.range-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
  cursor: pointer;
}

.range-item.selected {
  border-color: #2196f3;
  background: #e3f2fd;
}

.range-actions button {
  margin-right: 4px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.range-actions button.active {
  background: #2196f3;
  color: white;
}

.primary-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.secondary-btn {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

#### 2.3.2 性能优化

**步骤1: 创建缓存管理器**

```bash
touch site/src/composables/cacheManager.ts
```

**文件: `site/src/composables/cacheManager.ts`**
```typescript
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map()
  private config: CacheConfig
  private storage: EnhancedStorage
  
  constructor(config: CacheConfig, storage: EnhancedStorage) {
    this.config = config
    this.storage = storage
    this.initializeCache()
  }

  async cacheVersion(version: DocumentVersion): Promise<void> {
    const entry: CacheEntry = {
      data: version,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      compressed: false,
      size: JSON.stringify(version).length
    }

    // 检查是否需要压缩
    if (entry.size > this.config.compressionThreshold) {
      entry.data = await this.compressData(version)
      entry.compressed = true
      entry.size = JSON.stringify(entry.data).length
    }

    this.cache.set(`version:${version.id}`, entry)
    
    // 清理过期缓存
    await this.cleanupCache()
  }

  async getVersion(versionId: string): Promise<DocumentVersion | null> {
    const cacheKey = `version:${versionId}`
    const entry = this.cache.get(cacheKey)
    
    if (entry) {
      entry.accessCount++
      entry.lastAccessed = Date.now()
      
      let data = entry.data
      if (entry.compressed) {
        data = await this.decompressData(entry.data)
      }
      
      return data as DocumentVersion
    }
    
    // 缓存未命中，从存储加载
    const version = await this.storage.getVersion(versionId)
    if (version) {
      await this.cacheVersion(version)
    }
    
    return version
  }

  async preloadVersions(versionIds: string[]): Promise<void> {
    const uncachedIds = versionIds.filter(id => !this.cache.has(`version:${id}`))
    
    if (uncachedIds.length === 0) return
    
    // 并行加载
    const loadPromises = uncachedIds.map(async (id) => {
      const version = await this.storage.getVersion(id)
      if (version) {
        await this.cacheVersion(version)
      }
    })
    
    await Promise.all(loadPromises)
  }

  private async compressData(data: any): Promise<CompressedData> {
    // 使用LZ压缩算法
    const jsonString = JSON.stringify(data)
    const compressed = LZString.compress(jsonString)
    
    return {
      compressed: true,
      algorithm: 'lz-string',
      originalSize: jsonString.length,
      compressedSize: compressed.length,
      data: compressed
    }
  }

  private async decompressData(compressedData: CompressedData): Promise<any> {
    if (!compressedData.compressed) return compressedData
    
    const decompressed = LZString.decompress(compressedData.data)
    return JSON.parse(decompressed)
  }

  private async cleanupCache(): Promise<void> {
    const now = Date.now()
    const maxAge = this.config.maxAge || 3600000 // 1小时
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > maxAge) {
        this.cache.delete(key)
      }
    }
    
    // 检查缓存大小限制
    if (this.getTotalCacheSize() > this.config.maxSize) {
      await this.evictLeastRecentlyUsed()
    }
  }
}
```

### Phase 4: 测试和优化 (Week 11-12)

#### 2.4.1 测试策略

**步骤1: 创建测试套件**

```bash
mkdir -p tests/enhanced
touch tests/enhanced/versionManager.test.ts
touch tests/enhanced/precisionController.test.ts
touch tests/enhanced/memoryManager.test.ts
```

**文件: `tests/enhanced/versionManager.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { VersionManager } from '~/composables/versionManager'
import { EnhancedStorage } from '~/composables/enhancedStorage'

describe('VersionManager', () => {
  let versionManager: VersionManager
  let storage: EnhancedStorage

  beforeEach(() => {
    storage = new EnhancedStorage()
    versionManager = new VersionManager(storage)
  })

  it('should create a new version', async () => {
    const content = '# Test Document\n\nThis is a test.'
    const metadata = {
      operation: 'test_create',
      source: 'user' as const,
      description: 'Test version creation',
      affectedRanges: []
    }

    const version = await versionManager.createVersion(content, metadata)

    expect(version.id).toBeDefined()
    expect(version.content).toBe(content)
    expect(version.metadata.description).toBe('Test version creation')
    expect(version.timestamp).toBeCloseTo(Date.now(), -3)
  })

  it('should maintain version hierarchy', async () => {
    // 创建父版本
    const parentVersion = await versionManager.createVersion('Parent content', {
      operation: 'create_parent',
      source: 'user',
      description: 'Parent version',
      affectedRanges: []
    })

    // 创建子版本
    const childVersion = await versionManager.createVersion('Child content', {
      operation: 'create_child', 
      source: 'user',
      description: 'Child version',
      affectedRanges: []
    })

    expect(childVersion.parentId).toBe(parentVersion.id)
    expect(parentVersion.childrenIds).toContain(childVersion.id)
  })

  it('should handle branch operations', async () => {
    const baseVersion = await versionManager.createVersion('Base content', {
      operation: 'create_base',
      source: 'user',
      description: 'Base version',
      affectedRanges: []
    })

    const branchId = await versionManager.createBranch(baseVersion.id, 'feature-branch')
    await versionManager.switchToBranch('feature-branch')

    const branchVersion = await versionManager.createVersion('Branch content', {
      operation: 'branch_edit',
      source: 'user', 
      description: 'Branch version',
      affectedRanges: []
    })

    expect(branchVersion.branchName).toBe('feature-branch')
    expect(await versionManager.getCurrentBranch()).toBe('feature-branch')
  })
})
```

#### 2.4.2 性能测试

**步骤1: 创建性能测试**

```bash
touch tests/performance/cachePerformance.test.ts
```

**文件: `tests/performance/cachePerformance.test.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { CacheManager } from '~/composables/cacheManager'
import { performance } from 'perf_hooks'

describe('Cache Performance', () => {
  it('should handle large version caching efficiently', async () => {
    const cacheManager = new CacheManager(defaultCacheConfig, mockStorage)
    
    // 生成大量版本数据
    const versions = generateTestVersions(1000)
    
    const startTime = performance.now()
    
    // 缓存所有版本
    for (const version of versions) {
      await cacheManager.cacheVersion(version)
    }
    
    const cachingTime = performance.now() - startTime
    
    // 测试检索性能
    const retrievalStart = performance.now()
    
    for (const version of versions.slice(0, 100)) {
      const cached = await cacheManager.getVersion(version.id)
      expect(cached).toBeDefined()
    }
    
    const retrievalTime = performance.now() - retrievalStart
    
    console.log(`Caching 1000 versions: ${cachingTime}ms`)
    console.log(`Retrieving 100 versions: ${retrievalTime}ms`)
    
    // 性能断言
    expect(cachingTime).toBeLessThan(5000) // 5秒内完成缓存
    expect(retrievalTime).toBeLessThan(1000) // 1秒内完成检索
  })

  it('should maintain cache hit rate above 85%', async () => {
    const cacheManager = new CacheManager(defaultCacheConfig, mockStorage)
    
    // 模拟真实使用模式
    const accessPattern = generateRealisticAccessPattern()
    let hits = 0
    let total = 0
    
    for (const versionId of accessPattern) {
      const startTime = performance.now()
      const version = await cacheManager.getVersion(versionId)
      const accessTime = performance.now() - startTime
      
      if (accessTime < 10) { // 小于10ms认为是缓存命中
        hits++
      }
      total++
    }
    
    const hitRate = hits / total
    console.log(`Cache hit rate: ${(hitRate * 100).toFixed(2)}%`)
    
    expect(hitRate).toBeGreaterThan(0.85)
  })
})
```

## 3. 部署和运维

### 3.1 部署配置

**步骤1: 更新构建配置**

```bash
# 更新 nuxt.config.ts
```

在 `nuxt.config.ts` 中添加：

```typescript
export default defineNuxtConfig({
  // 现有配置...
  
  // 增强功能配置
  runtimeConfig: {
    public: {
      enhancedFeatures: {
        versionControl: true,
        precisionEditing: true,
        intelligentMemory: true,
        aiIntegration: true
      },
      cacheConfig: {
        maxSize: 50 * 1024 * 1024, // 50MB
        compressionThreshold: 1024 * 1024, // 1MB
        maxAge: 3600000 // 1小时
      }
    }
  },
  
  // 构建优化
  build: {
    transpile: ['enhanced-storage', 'version-manager']
  },
  
  // Vite配置
  vite: {
    define: {
      __ENHANCED_FEATURES__: true
    },
    optimizeDeps: {
      include: ['lz-string', 'crypto-js']
    }
  }
})
```

### 3.2 监控和维护

**步骤1: 创建系统监控**

```bash
touch site/src/composables/systemMonitor.ts
```

**文件: `site/src/composables/systemMonitor.ts`**
```typescript
export class SystemMonitor {
  private metrics: Map<string, MetricEntry> = new Map()
  private alertCallbacks: Map<string, Function[]> = new Map()
  
  startMonitoring() {
    // 性能监控
    this.monitorPerformance()
    
    // 存储监控
    this.monitorStorage()
    
    // 错误监控
    this.monitorErrors()
    
    // 用户行为监控
    this.monitorUserBehavior()
  }

  private monitorPerformance() {
    setInterval(() => {
      const memory = (performance as any).memory
      if (memory) {
        this.recordMetric('memory.used', memory.usedJSHeapSize)
        this.recordMetric('memory.total', memory.totalJSHeapSize)
      }
      
      // 检查响应时间
      this.measureResponseTime()
    }, 30000) // 30秒间隔
  }

  private async measureResponseTime() {
    const start = performance.now()
    try {
      // 测试关键操作的响应时间
      await this.testVersionLoad()
      await this.testCacheAccess()
      await this.testMemorySearch()
      
      const responseTime = performance.now() - start
      this.recordMetric('response.time', responseTime)
      
      // 响应时间告警
      if (responseTime > 2000) {
        this.triggerAlert('performance', `响应时间过长: ${responseTime}ms`)
      }
    } catch (error) {
      this.recordMetric('response.errors', 1)
      this.triggerAlert('error', `系统响应错误: ${error}`)
    }
  }

  recordMetric(name: string, value: number) {
    const entry: MetricEntry = {
      name,
      value,
      timestamp: Date.now(),
      tags: this.getContextTags()
    }
    
    this.metrics.set(`${name}_${Date.now()}`, entry)
    
    // 保持最近1000条记录
    if (this.metrics.size > 1000) {
      const oldestKey = Array.from(this.metrics.keys())[0]
      this.metrics.delete(oldestKey)
    }
  }

  getMetrics(name: string, timeWindow: number = 3600000): MetricEntry[] {
    const now = Date.now()
    return Array.from(this.metrics.values())
      .filter(entry => 
        entry.name === name && 
        now - entry.timestamp <= timeWindow
      )
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  generateReport(): SystemReport {
    const now = Date.now()
    const oneHour = 3600000
    
    return {
      timestamp: now,
      performance: {
        averageResponseTime: this.calculateAverage('response.time', oneHour),
        memoryUsage: this.getLatestMetric('memory.used'),
        errorRate: this.calculateRate('response.errors', oneHour)
      },
      storage: {
        cacheHitRate: this.calculateHitRate(oneHour),
        storageUsage: this.getStorageUsage(),
        compressionRatio: this.getCompressionRatio()
      },
      userActivity: {
        activeUsers: this.getActiveUserCount(),
        operationsPerHour: this.getOperationRate(oneHour),
        mostUsedFeatures: this.getMostUsedFeatures(oneHour)
      }
    }
  }
}
```

## 4. 维护和扩展

### 4.1 版本升级策略

```typescript
// site/src/utils/upgradeManager.ts
export class UpgradeManager {
  static async upgradeToVersion(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion()
    const upgradePath = this.getUpgradePath(currentVersion, targetVersion)
    
    for (const step of upgradePath) {
      await this.executeUpgradeStep(step)
    }
  }

  static async executeUpgradeStep(step: UpgradeStep): Promise<void> {
    switch (step.type) {
      case 'data-migration':
        await this.migrateData(step.config)
        break
      case 'schema-update':
        await this.updateSchema(step.config)
        break
      case 'feature-enable':
        await this.enableFeature(step.config)
        break
    }
  }
}
```

### 4.2 扩展点设计

```typescript
// site/src/types/extensions.ts
export interface ExtensionPoint {
  name: string
  version: string
  hooks: ExtensionHook[]
}

export interface ExtensionHook {
  event: string
  callback: (context: HookContext) => Promise<void>
  priority: number
}

// 扩展管理器
export class ExtensionManager {
  private extensions: Map<string, ExtensionPoint> = new Map()
  
  registerExtension(extension: ExtensionPoint): void {
    this.extensions.set(extension.name, extension)
  }

  async executeHooks(event: string, context: HookContext): Promise<void> {
    const hooks = Array.from(this.extensions.values())
      .flatMap(ext => ext.hooks)
      .filter(hook => hook.event === event)
      .sort((a, b) => a.priority - b.priority)
    
    for (const hook of hooks) {
      await hook.callback(context)
    }
  }
}
```

---

## 总结

这份实施指南提供了完整的分阶段实施方案，包括：

✅ **Phase 1**: 基础架构搭建 (3周)
✅ **Phase 2**: 核心功能实现 (4周)  
✅ **Phase 3**: 高级特性开发 (3周)
✅ **Phase 4**: 测试和优化 (2周)

### 关键成功因素

1. **渐进式升级**: 保持系统稳定性
2. **向后兼容**: 不破坏现有功能
3. **性能优先**: 确保良好的用户体验
4. **全面测试**: 保证功能质量
5. **持续监控**: 及时发现和解决问题

### 风险控制

- 每个阶段都有明确的验收标准
- 关键功能有完整的测试覆盖
- 性能监控和告警机制
- 数据备份和恢复策略
- 回滚方案和应急预案

这个实施方案可以确保系统的稳定升级和功能的可靠交付。
