# API接口规范文档

## 1. 概述

本文档定义了增强型Chatbot工作区交互系统的所有API接口规范，包括版本控制、精确操作、记忆管理和缓存管理等核心功能的接口。

### 1.1 基础信息
- **API版本**: v1.0
- **协议**: HTTP/HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8

### 1.2 通用响应格式

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    timestamp: number
    requestId: string
    executionTime: number
  }
}
```

## 2. 版本控制API

### 2.1 创建版本

```typescript
POST /api/versions

interface CreateVersionRequest {
  content: string
  type: 'manual' | 'ai' | 'merge' | 'cherry-pick'
  description: string
  parentId?: string
  branchName?: string
  metadata?: {
    operation: string
    source: 'user' | 'chatbot'
    affectedRanges: ContentRange[]
  }
}

interface CreateVersionResponse {
  versionId: string
  contentHash: string
  timestamp: number
  size: number
}
```

### 2.2 获取版本信息

```typescript
GET /api/versions/{versionId}

interface GetVersionResponse {
  version: DocumentVersion
  content: string
  ranges: ContentRange[]
  metadata: VersionMetadata
}
```

### 2.3 版本列表

```typescript
GET /api/versions?resumeId={resumeId}&limit={limit}&offset={offset}

interface ListVersionsResponse {
  versions: DocumentVersion[]
  total: number
  hasMore: boolean
  pagination: {
    limit: number
    offset: number
    total: number
  }
}
```

### 2.4 版本比较

```typescript
POST /api/versions/compare

interface CompareVersionsRequest {
  sourceVersionId: string
  targetVersionId: string
  granularity: 'character' | 'word' | 'sentence' | 'paragraph'
}

interface CompareVersionsResponse {
  diff: VersionDiff
  statistics: DiffStatistics
  conflicts: ConflictInfo[]
}

interface VersionDiff {
  additions: DiffSegment[]
  deletions: DiffSegment[]
  modifications: DiffSegment[]
}

interface DiffSegment {
  type: 'add' | 'delete' | 'modify'
  position: RangePosition
  oldContent?: string
  newContent?: string
  confidence: number
}
```

### 2.5 版本回退

```typescript
POST /api/versions/{versionId}/revert

interface RevertVersionRequest {
  targetVersionId: string
  createBranch?: boolean
  branchName?: string
  preserveChanges?: string[] // 保留的范围ID
}

interface RevertVersionResponse {
  newVersionId: string
  revertedChanges: RevertedChange[]
  preservedRanges: ContentRange[]
}
```

## 3. 分支管理API

### 3.1 创建分支

```typescript
POST /api/branches

interface CreateBranchRequest {
  name: string
  baseVersionId: string
  description: string
  type: 'feature' | 'experiment' | 'backup'
}

interface CreateBranchResponse {
  branchId: string
  name: string
  headVersionId: string
  createdAt: number
}
```

### 3.2 分支合并

```typescript
POST /api/branches/{branchName}/merge

interface MergeBranchRequest {
  targetBranch: string
  strategy: 'auto' | 'manual' | 'ai-assisted'
  conflictResolution?: ConflictResolution[]
  createMergeCommit: boolean
}

interface MergeBranchResponse {
  mergeVersionId: string
  conflicts: MergeConflict[]
  mergeStrategy: string
  success: boolean
}
```

### 3.3 分支列表

```typescript
GET /api/branches?resumeId={resumeId}

interface ListBranchesResponse {
  branches: Branch[]
  activeBranch: string
  defaultBranch: string
}
```

## 4. 精确操作API

### 4.1 文档解析

```typescript
POST /api/document/parse

interface ParseDocumentRequest {
  content: string
  granularity: 'section' | 'paragraph' | 'sentence' | 'word'
  includeMetadata: boolean
}

interface ParseDocumentResponse {
  structure: DocumentStructure
  ranges: ContentRange[]
  statistics: {
    totalCharacters: number
    totalWords: number
    totalSentences: number
    totalParagraphs: number
  }
}
```

### 4.2 范围查询

```typescript
GET /api/document/ranges?type={type}&versionId={versionId}

interface QueryRangesResponse {
  ranges: ContentRange[]
  total: number
  filters: {
    type: RangeType[]
    depth: number[]
    syntaxType: string[]
  }
}
```

### 4.3 执行精确操作

```typescript
POST /api/operations/execute

interface ExecuteOperationRequest {
  operations: ContentOperation[]
  versionId: string
  validateOnly?: boolean
  createVersion?: boolean
}

interface ExecuteOperationResponse {
  result: OperationResult
  newVersionId?: string
  affectedRanges: ContentRange[]
  warnings: OperationWarning[]
  preview?: string // 如果是预览模式
}
```

### 4.4 操作预览

```typescript
POST /api/operations/preview

interface PreviewOperationRequest {
  operations: ContentOperation[]
  versionId: string
  includeContext: boolean
}

interface PreviewOperationResponse {
  preview: string
  changes: ChangePreview[]
  impact: ImpactAnalysis
  recommendations: string[]
}

interface ChangePreview {
  rangeId: string
  beforeContent: string
  afterContent: string
  changeType: 'addition' | 'deletion' | 'modification'
}
```

### 4.5 操作验证

```typescript
POST /api/operations/validate

interface ValidateOperationRequest {
  operations: ContentOperation[]
  versionId: string
  checkConflicts: boolean
}

interface ValidateOperationResponse {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: OperationSuggestion[]
}
```

## 5. 记忆管理API

### 5.1 存储记忆

```typescript
POST /api/memory

interface StoreMemoryRequest {
  type: 'conversation' | 'operation' | 'preference' | 'context'
  content: MemoryContent
  contextId: string
  tags: string[]
  importance?: number
}

interface StoreMemoryResponse {
  memoryId: string
  storedAt: number
  indexEntries: string[]
}
```

### 5.2 检索记忆

```typescript
GET /api/memory/search?query={query}&type={type}&limit={limit}

interface SearchMemoryRequest {
  query: string
  type?: MemoryType
  contextId?: string
  timeRange?: TimeRange
  minRelevance?: number
  includeContent?: boolean
}

interface SearchMemoryResponse {
  memories: ChatMemory[]
  total: number
  searchStats: {
    executionTime: number
    indexHits: number
    semanticMatches: number
  }
}
```

### 5.3 学习模式

```typescript
POST /api/memory/learn

interface LearnFromInteractionRequest {
  userInput: string
  systemResponse: string
  operationResult?: OperationResult
  userFeedback?: 'positive' | 'negative' | 'neutral'
  contextId: string
}

interface LearnFromInteractionResponse {
  learnedPatterns: OperationPattern[]
  updatedPreferences: UserPreference[]
  memoryId: string
}
```

### 5.4 获取智能建议

```typescript
POST /api/memory/suggestions

interface GetSuggestionsRequest {
  context: OperationContext
  currentContent: string
  recentOperations: ContentOperation[]
  maxSuggestions?: number
}

interface GetSuggestionsResponse {
  suggestions: OperationSuggestion[]
  confidence: number
  reasoning: string[]
  basedOnPatterns: string[]
}
```

### 5.5 更新偏好

```typescript
PUT /api/memory/preferences

interface UpdatePreferencesRequest {
  preferences: UserPreference[]
  merge: boolean
}

interface UpdatePreferencesResponse {
  updated: UserPreference[]
  conflicts: PreferenceConflict[]
  recommendations: string[]
}
```

## 6. 缓存管理API

### 6.1 缓存状态

```typescript
GET /api/cache/status

interface CacheStatusResponse {
  totalSize: number
  usedSize: number
  hitRate: number
  missRate: number
  entries: {
    versions: number
    memories: number
    indexes: number
  }
  lastCleanup: number
}
```

### 6.2 缓存操作

```typescript
POST /api/cache/operations

interface CacheOperationRequest {
  operation: 'clear' | 'refresh' | 'preload' | 'compress'
  target?: 'all' | 'versions' | 'memories' | 'indexes'
  params?: {
    versionIds?: string[]
    memoryIds?: string[]
    force?: boolean
  }
}

interface CacheOperationResponse {
  success: boolean
  affectedEntries: number
  freedSpace?: number
  compressionRatio?: number
  executionTime: number
}
```

### 6.3 预加载数据

```typescript
POST /api/cache/preload

interface PreloadDataRequest {
  strategy: 'recent' | 'predicted' | 'manual'
  versionIds?: string[]
  memoryContexts?: string[]
  priority: 'low' | 'normal' | 'high'
}

interface PreloadDataResponse {
  preloadedItems: number
  estimatedLoadTime: number
  cacheUtilization: number
}
```

## 7. 搜索和查询API

### 7.1 全文搜索

```typescript
POST /api/search/content

interface ContentSearchRequest {
  query: string
  scope: 'current' | 'all-versions' | 'branch'
  type?: 'exact' | 'fuzzy' | 'semantic'
  filters?: {
    versionIds?: string[]
    dateRange?: TimeRange
    contentTypes?: string[]
  }
  limit?: number
  offset?: number
}

interface ContentSearchResponse {
  results: SearchResult[]
  total: number
  searchTime: number
  suggestions: string[]
  facets: {
    versions: { id: string; count: number }[]
    types: { type: string; count: number }[]
    dates: { range: string; count: number }[]
  }
}
```

### 7.2 语义搜索

```typescript
POST /api/search/semantic

interface SemanticSearchRequest {
  concept: string
  contextVector?: number[]
  similarity_threshold?: number
  includeRelated: boolean
}

interface SemanticSearchResponse {
  concepts: SemanticMatch[]
  relatedConcepts: string[]
  confidence: number
}

interface SemanticMatch {
  conceptId: string
  similarity: number
  relatedRanges: ContentRange[]
  context: string
}
```

### 7.3 模式搜索

```typescript
POST /api/search/patterns

interface PatternSearchRequest {
  operationSequence: string[]
  contextSimilarity?: number
  timeWindow?: number
  minFrequency?: number
}

interface PatternSearchResponse {
  patterns: OperationPattern[]
  matchingContexts: PatternContext[]
  recommendations: PatternRecommendation[]
}
```

## 8. AI集成API

### 8.1 AI内容生成

```typescript
POST /api/ai/generate

interface AiGenerateRequest {
  prompt: string
  context: {
    currentContent: string
    targetRange?: ContentRange
    userPreferences: UserPreference[]
  }
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    style?: string
  }
}

interface AiGenerateResponse {
  generatedContent: string
  alternatives: string[]
  confidence: number
  usageStats: {
    tokensUsed: number
    processingTime: number
    model: string
  }
}
```

### 8.2 AI内容分析

```typescript
POST /api/ai/analyze

interface AiAnalyzeRequest {
  content: string
  analysisType: 'grammar' | 'style' | 'structure' | 'sentiment'
  language?: string
}

interface AiAnalyzeResponse {
  analysis: ContentAnalysis
  suggestions: ImprovementSuggestion[]
  score: number
  details: AnalysisDetail[]
}

interface ContentAnalysis {
  readabilityScore: number
  sentimentScore: number
  grammarIssues: GrammarIssue[]
  styleIssues: StyleIssue[]
  structureIssues: StructureIssue[]
}
```

### 8.3 AI操作建议

```typescript
POST /api/ai/suggest

interface AiSuggestRequest {
  userInput: string
  documentContext: {
    content: string
    currentSelection?: ContentRange
    recentChanges: VersionDiff[]
  }
  preferences: UserPreference[]
}

interface AiSuggestResponse {
  suggestions: AiSuggestion[]
  reasoning: string
  confidence: number
  estimatedImpact: ImpactEstimate
}

interface AiSuggestion {
  type: 'edit' | 'format' | 'structure' | 'content'
  description: string
  operations: ContentOperation[]
  preview: string
  confidence: number
}
```

## 9. 系统管理API

### 9.1 系统状态

```typescript
GET /api/system/status

interface SystemStatusResponse {
  status: 'healthy' | 'degraded' | 'error'
  uptime: number
  performance: {
    responseTime: number
    throughput: number
    errorRate: number
  }
  resources: {
    memoryUsage: number
    storageUsage: number
    cacheUtilization: number
  }
  services: {
    aiService: 'online' | 'offline' | 'degraded'
    storageService: 'online' | 'offline'
    cacheService: 'online' | 'offline'
  }
}
```

### 9.2 数据导出

```typescript
POST /api/system/export

interface ExportDataRequest {
  resumeId: string
  includeVersions: boolean
  includeMemories: boolean
  format: 'json' | 'zip' | 'markdown'
  dateRange?: TimeRange
}

interface ExportDataResponse {
  exportId: string
  downloadUrl: string
  expiresAt: number
  size: number
  checksum: string
}
```

### 9.3 数据导入

```typescript
POST /api/system/import

interface ImportDataRequest {
  data: string | File
  format: 'json' | 'markdown'
  mergeStrategy: 'replace' | 'merge' | 'append'
  validateOnly?: boolean
}

interface ImportDataResponse {
  importId: string
  status: 'success' | 'partial' | 'failed'
  imported: {
    versions: number
    memories: number
    preferences: number
  }
  errors: ImportError[]
  warnings: ImportWarning[]
}
```

## 10. 错误代码定义

### 10.1 通用错误代码

| 代码 | 消息 | 描述 |
|------|------|------|
| `E001` | Invalid request format | 请求格式无效 |
| `E002` | Missing required parameter | 缺少必需参数 |
| `E003` | Authentication required | 需要身份验证 |
| `E004` | Permission denied | 权限不足 |
| `E005` | Resource not found | 资源不存在 |
| `E006` | Conflict detected | 检测到冲突 |
| `E007` | Rate limit exceeded | 超出速率限制 |
| `E008` | Internal server error | 内部服务器错误 |

### 10.2 版本控制错误代码

| 代码 | 消息 | 描述 |
|------|------|------|
| `V001` | Version not found | 版本不存在 |
| `V002` | Invalid version format | 版本格式无效 |
| `V003` | Version already exists | 版本已存在 |
| `V004` | Parent version required | 需要父版本 |
| `V005` | Branch conflict | 分支冲突 |
| `V006` | Merge conflict | 合并冲突 |
| `V007` | Cannot revert version | 无法回退版本 |

### 10.3 操作错误代码

| 代码 | 消息 | 描述 |
|------|------|------|
| `O001` | Invalid operation type | 操作类型无效 |
| `O002` | Range not found | 范围不存在 |
| `O003` | Operation conflict | 操作冲突 |
| `O004` | Validation failed | 验证失败 |
| `O005` | Execution timeout | 执行超时 |
| `O006` | Insufficient permissions | 权限不足 |

### 10.4 记忆管理错误代码

| 代码 | 消息 | 描述 |
|------|------|------|
| `M001` | Memory not found | 记忆不存在 |
| `M002` | Invalid memory type | 记忆类型无效 |
| `M003` | Context required | 需要上下文 |
| `M004` | Learning failed | 学习失败 |
| `M005` | Pattern not recognized | 模式无法识别 |

## 11. 使用示例

### 11.1 创建版本并执行操作

```typescript
// 1. 解析文档结构
const parseResponse = await fetch('/api/document/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: "# 我的简历\n\n## 工作经验\n\n在某公司担任开发工程师...",
    granularity: 'paragraph',
    includeMetadata: true
  })
});
const { structure, ranges } = await parseResponse.json();

// 2. 创建操作
const operations = [
  {
    id: 'op1',
    type: 'rewrite',
    rangeId: ranges[2].id, // 第三段
    newContent: '在某公司担任高级开发工程师，负责前端架构设计...',
    reason: '提升职位描述的专业性',
    confidence: 0.9
  }
];

// 3. 预览操作
const previewResponse = await fetch('/api/operations/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operations,
    versionId: 'current',
    includeContext: true
  })
});

// 4. 执行操作
const executeResponse = await fetch('/api/operations/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operations,
    versionId: 'current',
    createVersion: true
  })
});
```

### 11.2 智能建议获取

```typescript
// 获取基于上下文的智能建议
const suggestionsResponse = await fetch('/api/memory/suggestions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: {
      documentState: currentDocumentState,
      userContext: currentUserContext,
      recentOperations: lastFiveOperations,
      currentSelection: selectedRange
    },
    currentContent: document.content,
    maxSuggestions: 5
  })
});

const { suggestions } = await suggestionsResponse.json();
```

### 11.3 分支操作流程

```typescript
// 1. 创建实验分支
const branchResponse = await fetch('/api/branches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'experiment-new-layout',
    baseVersionId: 'current',
    description: '尝试新的简历布局',
    type: 'experiment'
  })
});

// 2. 在分支中进行操作
// ... 执行一系列操作 ...

// 3. 合并分支
const mergeResponse = await fetch('/api/branches/experiment-new-layout/merge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetBranch: 'main',
    strategy: 'ai-assisted',
    createMergeCommit: true
  })
});
```

---

**文档版本**: v1.0  
**最后更新**: 2024-01-21  
**维护团队**: 后端开发团队  
**相关文档**: [系统设计文档](./enhanced-chatbot-system-design.md)  
