// site/src/types/versionControl.ts
import type { DocumentSection } from '~/composables/documentStructureParser'

/**
 * 核心版本控制数据结构
 */
export interface DocumentVersion {
  id: string
  content: string
  contentHash: string // SHA-256哈希，用于快速内容比较
  timestamp: number
  type: 'manual' | 'ai' | 'merge' | 'cherry-pick' | 'revert'
  metadata: VersionMetadata
  size: number // 内容字节大小
  parentId?: string // 父版本ID
  childrenIds: string[] // 子版本ID列表
  branchName: string // 所属分支
  tags: string[] // 版本标签
}

export interface VersionMetadata {
  operation: string // 操作描述
  source: 'user' | 'chatbot' | 'system' | 'import'
  description: string // 详细描述
  affectedRanges: ContentRange[] // 受影响的内容范围
  operationStats: OperationStats // 操作统计
  userContext?: UserContext // 用户操作上下文
  aiContext?: AiContext // AI操作上下文
}

export interface OperationStats {
  charactersAdded: number
  charactersRemoved: number
  sectionsModified: number
  timeSpent: number // 毫秒
  operationCount: number // 子操作数量
}

export interface UserContext {
  userId?: string
  sessionId: string
  selectionState: SelectionState
  cursorPosition: Position
  viewportState: ViewportState
}

export interface AiContext {
  modelUsed: string
  prompt: string
  confidence: number
  processingTime: number
  tokensUsed: number
  temperature: number
}

/**
 * 精确内容控制数据结构
 */
export interface ContentRange {
  id: string
  type: 'document' | 'section' | 'paragraph' | 'sentence' | 'phrase' | 'word'
  position: RangePosition
  content: string
  originalContent?: string // 用于回退和diff
  metadata: RangeMetadata
  children?: ContentRange[] // 子范围（如段落包含句子）
  parent?: string // 父范围ID
}

export interface RangePosition {
  start: Position
  end: Position
  absoluteStart: number // 在文档中的绝对字符位置
  absoluteEnd: number
}

export interface Position {
  line: number // 1-based
  column: number // 1-based
  character: number // 0-based绝对字符位置
}

export interface RangeMetadata {
  sectionType?: DocumentSection['type']
  depth: number // 嵌套深度
  syntaxType?: 'markdown' | 'frontmatter' | 'code' | 'text'
  language?: string // 代码块语言
  formatting: FormattingInfo
  contextId: string // 用于关联相关范围
  semanticRole?: 'title' | 'content' | 'list-item' | 'link' | 'emphasis'
}

export interface FormattingInfo {
  isBold: boolean
  isItalic: boolean
  isCode: boolean
  isLink: boolean
  isHeading: boolean
  headingLevel?: number
  listType?: 'ordered' | 'unordered'
  listLevel?: number
}

/**
 * 操作定义数据结构
 */
export interface ContentOperation {
  id: string
  type: 'keep' | 'rewrite' | 'delete' | 'insert' | 'move' | 'merge' | 'split'
  rangeId: string
  newContent?: string
  targetPosition?: Position // 移动或插入的目标位置
  reason: string // 操作原因
  confidence: number // 操作信心度 (0-1)
  metadata: OperationMetadata
}

export interface OperationMetadata {
  timestamp: number
  source: 'user' | 'ai' | 'suggestion'
  priority: number // 优先级，数值越小优先级越高
  dependencies: string[] // 依赖的其他操作ID
  reversible: boolean // 是否可逆
  estimatedImpact: ImpactEstimate
}

export interface ImpactEstimate {
  characterDelta: number
  sectionCount: number
  complexityScore: number // 复杂度评分
  riskLevel: 'low' | 'medium' | 'high'
}

/**
 * 分支管理数据结构
 */
export interface Branch {
  name: string
  id: string
  headVersionId: string // 分支最新版本
  baseVersionId: string // 分支起始版本
  createdAt: number
  updatedAt: number
  isActive: boolean
  metadata: BranchMetadata
}

export interface BranchMetadata {
  description: string
  creator: 'user' | 'system'
  purpose: 'experiment' | 'feature' | 'backup' | 'collaboration'
  mergeStatus: 'open' | 'merged' | 'conflicted' | 'abandoned'
  conflictResolution?: ConflictResolution
}

export interface ConflictResolution {
  conflicts: MergeConflict[]
  resolvedAt: number
  resolvedBy: string
  strategy: 'ours' | 'theirs' | 'manual' | 'ai-assisted'
}

export interface MergeConflict {
  rangeId: string
  baseContent: string
  sourceContent: string
  targetContent: string
  resolutionChoice?: 'source' | 'target' | 'manual'
  manualResolution?: string
}

/**
 * 智能记忆数据结构
 */
export interface ChatMemory {
  id: string
  type: 'conversation' | 'operation' | 'preference' | 'context' | 'pattern' | 'feedback'
  content: MemoryContent
  timestamp: number
  contextId: string
  relevanceScore: number
  accessCount: number // 被访问次数
  lastAccessed: number
  metadata: MemoryMetadata
}

export interface MemoryContent {
  // 对话记忆
  userInput?: string
  aiResponse?: string
  
  // 操作记忆
  operation?: ContentOperation
  operationResult?: OperationResult
  
  // 偏好记忆
  userPreference?: UserPreference
  
  // 上下文记忆
  documentState?: DocumentState
  
  // 模式记忆
  pattern?: OperationPattern
  
  // 反馈记忆
  feedback?: UserFeedback
}

export interface MemoryMetadata {
  userId?: string
  sessionId: string
  documentId: string
  versionId?: string
  tags: string[]
  confidence: number
  importance: number // 重要性评分
  volatility: number // 易变性评分，高分表示容易过时
  associatedMemories: string[] // 关联的记忆ID
}

export interface UserPreference {
  category: 'style' | 'operation' | 'interface' | 'ai-behavior'
  key: string
  value: any
  strength: number // 偏好强度 (0-1)
  frequency: number // 使用频率
  lastUsed: number
}

export interface OperationPattern {
  sequence: string[] // 操作序列
  frequency: number
  successRate: number
  averageTime: number
  context: PatternContext
}

export interface PatternContext {
  documentType: string
  sectionTypes: string[]
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  sessionDuration: number
}

export interface UserFeedback {
  operationId: string
  rating: 'positive' | 'negative' | 'neutral'
  comments?: string
  suggestedImprovement?: string
  problemCategory?: 'accuracy' | 'speed' | 'usability' | 'other'
}

/**
 * 缓存管理数据结构
 */
export interface CacheStructure {
  versions: VersionCache
  memories: MemoryCache
  indexes: IndexCache
  metadata: CacheMetadata
}

export interface VersionCache {
  [versionId: string]: {
    content: string
    metadata: VersionMetadata
    ranges: ContentRange[]
    lastAccessed: number
    accessCount: number
    compressed?: boolean
    compressionRatio?: number
  }
}

export interface MemoryCache {
  [memoryId: string]: {
    memory: ChatMemory
    indexEntries: IndexEntry[]
    lastAccessed: number
    priority: number
  }
}

export interface IndexCache {
  content: ContentIndex // 内容全文搜索索引
  semantic: SemanticIndex // 语义搜索索引
  pattern: PatternIndex // 模式匹配索引
  version: VersionIndex // 版本快速查找索引
}

export interface ContentIndex {
  [term: string]: {
    versionIds: string[]
    rangeIds: string[]
    frequency: number
    lastUpdated: number
  }
}

export interface SemanticIndex {
  [conceptId: string]: {
    vector: number[] // 语义向量
    relatedConcepts: string[]
    associatedRanges: string[]
    strength: number
  }
}

export interface PatternIndex {
  [patternId: string]: {
    pattern: OperationPattern
    similarPatterns: string[]
    applicableContexts: string[]
    lastMatched: number
  }
}

export interface VersionIndex {
  byTime: string[] // 按时间排序的版本ID
  byBranch: { [branchName: string]: string[] }
  byType: { [type: string]: string[] }
  byParent: { [parentId: string]: string[] }
}

/**
 * 扩展现有类型
 */
export interface EnhancedResumeStorageItem extends ResumeStorageItem {
  // 添加版本控制支持
  currentVersionId: string
  versionHistory: DocumentVersion[]
  branches: Branch[]
  
  // 添加记忆支持
  chatMemories: ChatMemory[]
  userPreferences: UserPreference[]
  
  // 添加缓存支持
  cache: CacheStructure
  
  // 扩展元数据
  enhancedMetadata: EnhancedMetadata
}

export interface EnhancedMetadata {
  createdAt: number
  lastModified: number
  totalEditTime: number // 总编辑时长
  operationCount: number // 总操作次数
  aiAssistanceUsage: AiUsageStats
  collaborationHistory: CollaborationRecord[]
  backupInfo: BackupInfo
}

export interface AiUsageStats {
  totalRequests: number
  totalTokensUsed: number
  averageResponseTime: number
  successRate: number
  preferredModels: { [model: string]: number }
  costEstimate: number
}

export interface CollaborationRecord {
  userId: string
  sessionId: string
  startTime: number
  endTime: number
  operationsCount: number
  contributionScore: number
}

export interface BackupInfo {
  lastBackup: number
  backupFrequency: 'never' | 'daily' | 'weekly' | 'monthly'
  cloudSync: boolean
  localBackups: string[] // 本地备份文件路径
}

/**
 * 状态管理数据结构
 */
export interface SelectionState {
  hasSelection: boolean
  selectedRanges: ContentRange[]
  primaryRange?: ContentRange
  cursor: Position
  selectionDirection: 'forward' | 'backward'
}

export interface ViewportState {
  scrollTop: number
  scrollLeft: number
  visibleLines: { start: number; end: number }
  zoomLevel: number
}

export interface DocumentState {
  currentVersionId: string
  currentBranch: string
  unsavedChanges: boolean
  lastSaved: number
  lockState: LockState
  editingState: EditingState
}

export interface LockState {
  isLocked: boolean
  lockType: 'user' | 'ai' | 'system' | 'collaboration'
  lockedBy: string
  lockReason: string
  lockedAt: number
  expectedDuration?: number
}

export interface EditingState {
  mode: 'normal' | 'ai-assisted' | 'collaborative' | 'review'
  activeOperations: ContentOperation[]
  pendingOperations: ContentOperation[]
  operationQueue: string[] // 操作ID队列
}

/**
 * 操作结果数据结构
 */
export interface OperationResult {
  success: boolean
  operationId: string
  newVersionId?: string
  affectedRanges: ContentRange[]
  performanceMetrics: PerformanceMetrics
  warnings: OperationWarning[]
  errors: OperationError[]
}

export interface PerformanceMetrics {
  executionTime: number
  memoryUsage: number
  cacheHits: number
  cacheMisses: number
  networkRequests: number
}

export interface OperationWarning {
  type: 'performance' | 'content' | 'compatibility' | 'user-experience'
  message: string
  severity: 'low' | 'medium' | 'high'
  suggestion?: string
}

export interface OperationError {
  type: 'syntax' | 'semantic' | 'system' | 'network' | 'validation'
  message: string
  code: string
  details?: any
  recovery?: RecoveryOption[]
}

export interface RecoveryOption {
  description: string
  action: () => Promise<void>
  riskLevel: 'low' | 'medium' | 'high'
}

/**
 * 搜索和查询数据结构
 */
export interface SearchQuery {
  text?: string
  type?: ContentRange['type']
  semanticSimilarity?: number[]
  timeRange?: { start: number; end: number }
  author?: string
  tags?: string[]
  versionId?: string
  branchName?: string
}

export interface SearchResult {
  rangeId: string
  versionId: string
  relevanceScore: number
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'pattern'
  highlights: TextHighlight[]
  context: SearchContext
}

export interface TextHighlight {
  start: number
  end: number
  type: 'match' | 'context' | 'related'
}

export interface SearchContext {
  beforeText: string
  afterText: string
  sectionTitle?: string
  versionInfo: {
    id: string
    timestamp: number
    description: string
  }
}

/**
 * 配置和设置数据结构
 */
export interface VersionControlConfig {
  maxVersionHistory: number
  autoSaveInterval: number
  compressionThreshold: number
  cleanupPolicy: CleanupPolicy
  conflictResolution: ConflictResolutionStrategy
}

export interface CleanupPolicy {
  enabled: boolean
  retentionDays: number
  keepMilestones: boolean
  keepBranchHeads: boolean
  compressionAge: number
}

export interface ConflictResolutionStrategy {
  defaultStrategy: 'manual' | 'auto-merge' | 'ask-user'
  autoMergeThreshold: number
  aiAssistedResolution: boolean
}

export interface MemoryConfig {
  maxMemoryEntries: number
  decayRate: number // 记忆衰减速率
  importanceThreshold: number
  autoCleanup: boolean
  learningRate: number
}

export interface CacheConfig {
  maxCacheSize: number // MB
  compressionEnabled: boolean
  persistentCache: boolean
  syncInterval: number
  preloadStrategy: 'none' | 'recent' | 'predicted' | 'all'
}