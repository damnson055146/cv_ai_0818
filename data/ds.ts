// 扁平化数据结构设计 - 避免嵌套和图结构
// 所有数据便于序列化，采用append-only模式

/**
 * 文档版本记录 - 扁平化存储
 */
export interface DocumentVersion {
  id: string
  documentId: string
  content: string
  contentLength: number // 显式字符长度
  contentEncoding: 'utf-8' // 明确编码
  timestamp: number
  versionNumber: number // 递增版本号，替代图结构
  operationType: 'manual' | 'ai' | 'direct_edit' | 'chatbot_edit' | 'save'
  operationSource: 'user' | 'chatbot' | 'system'
  operationDescription: string
  userInput?: string // 用户原始输入（chatbot场景）
  aiPrompt?: string // AI处理提示（AI场景）
  charactersAdded: number
  charactersRemoved: number
  editingTimeMs: number
}

/**
 * 段落数据 - 扁平化结构
 */
export interface ParagraphRecord {
  id: string
  documentId: string
  versionId: string
  index: number // 段落在文档中的序号
  content: string
  contentLength: number
  contentEncoding: 'utf-8'
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'quote'
  level: number // 标题级别或嵌套级别
  startPosition: number // 在文档中的绝对字符位置
  endPosition: number
  lineNumber: number
  timestamp: number
  createdBy: 'parse' | 'user' | 'ai'
}

/**
 * 句子数据 - 扁平化结构
 */
export interface SentenceRecord {
  id: string
  documentId: string
  versionId: string
  paragraphId: string
  index: number // 句子在段落中的序号
  globalIndex: number // 句子在整个文档中的序号
  content: string
  contentLength: number
  contentEncoding: 'utf-8'
  startPosition: number // 在文档中的绝对字符位置
  endPosition: number
  relativeStartInParagraph: number // 在段落中的相对位置
  relativeEndInParagraph: number
  timestamp: number
  createdBy: 'parse' | 'user' | 'ai'
}

/**
 * 操作记录 - 追加式存储
 */
export interface OperationRecord {
  id: string
  documentId: string
  versionId: string
  sequence: number // 操作序列号，严格递增
  timestamp: number
  operationType: 'direct_edit' | 'chatbot_edit' | 'save' | 'parse'
  operationSource: 'user' | 'chatbot' | 'system'
  userInput?: string // 用户原始输入
  targetType: 'document' | 'paragraph' | 'sentence'
  targetId?: string // 目标段落或句子ID
  targetIndex?: number // 目标索引位置
  oldContent?: string
  newContent?: string
  oldContentLength: number
  newContentLength: number
  contentEncoding: 'utf-8'
  charactersAdded: number
  charactersRemoved: number
  editingTimeMs: number
  isPersisted: boolean // 是否已持久化保存
}

/**
 * 位置信息 - 显式编码定义
 */
export interface PositionInfo {
  line: number // 1-based 行号
  column: number // 1-based 列号
  absolutePosition: number // 0-based 绝对字符位置
  contentLength: number // 内容长度
  contentEncoding: 'utf-8' // 字符编码
  byteLength: number // 字节长度（UTF-8）
}

/**
 * 范围位置 - 扁平化设计
 */
export interface RangePosition {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  startAbsolute: number // 起始绝对字符位置
  endAbsolute: number // 结束绝对字符位置
  contentLength: number
  contentEncoding: 'utf-8'
  byteLength: number
}

/**
 * 文档状态记录 - 实时状态追踪
 */
export interface DocumentState {
  documentId: string
  currentVersionId: string
  currentVersionNumber: number
  lastSavedVersionId: string
  lastSavedTimestamp: number
  hasUnsavedChanges: boolean
  unsavedChangeCount: number
  lastOperationId: string
  lastOperationTimestamp: number
  lastOperationSource: 'user' | 'chatbot' | 'system'
  editingSource?: 'direct' | 'chatbot'
  isLocked: boolean
  lockedBy?: 'user' | 'ai' | 'system'
  lockTimestamp?: number
  totalEditTimeMs: number
  operationCount: number
}

/**
 * 解析结果记录 - 扁平化存储
 */
export interface ParseResult {
  id: string
  documentId: string
  versionId: string
  parseTimestamp: number
  sourceContent: string
  sourceContentLength: number
  sourceContentEncoding: 'utf-8'
  paragraphCount: number
  sentenceCount: number
  totalCharacters: number
  parseTimeMs: number
  parseSuccess: boolean
  parseErrors: string[] // 简单字符串数组
  createdParagraphIds: string[]
  createdSentenceIds: string[]
}

/**
 * 智能解析记录 - 意图和定位
 */
export interface IntentParseRecord {
  id: string
  documentId: string
  timestamp: number
  userInput: string
  userInputLength: number
  userInputEncoding: 'utf-8'
  intentType: 'modify' | 'insert' | 'delete' | 'query' | 'format'
  targetType: 'paragraph' | 'sentence' | 'document'
  targetId?: string
  targetIndex?: number
  confidence: number // 0-1
  contextContent: string
  contextLength: number
  contextEncoding: 'utf-8'
  aiPrompt: string
  aiPromptLength: number
  parseTimeMs: number
}

/**
 * 简历存储项 - 扁平化增强版本
 */
export interface FlatResumeStorageItem {
  // 基础信息
  id: string
  name: string
  createdAt: number
  lastModified: number
  
  // 当前状态
  currentContent: string
  currentContentLength: number
  currentContentEncoding: 'utf-8'
  currentVersionId: string
  currentVersionNumber: number
  
  // 样式和设置
  css: string
  cssLength: number
  styles: Record<string, any> // 简单键值对
  
  // 统计信息
  totalEditTimeMs: number
  totalOperations: number
  hasUnsavedChanges: boolean
  lastSavedAt: number
}

/**
 * 存储键定义 - 用于LocalStorage
 */
export interface StorageKeys {
  readonly DOCUMENT_VERSIONS: string
  readonly PARAGRAPH_RECORDS: string
  readonly SENTENCE_RECORDS: string
  readonly OPERATION_RECORDS: string
  readonly DOCUMENT_STATE: string
  readonly PARSE_RESULTS: string
  readonly INTENT_RECORDS: string
  readonly RESUME_ITEMS: string
}

/**
 * 存储配置 - 简单配置项
 */
export interface StorageConfig {
  maxVersionHistory: number
  maxOperationHistory: number
  autoSaveIntervalMs: number
  debugMode: boolean
  enablePersistence: boolean
}

/**
 * 文档类型配置 - 三种文档类型的元数据
 */
export interface DocumentTypeConfig {
  type: 'cv' | 'letter' | 'ps'
  displayName: string
  displayNameCN: string
  description: string
  defaultTemplate: string
  suggestedSections: string[]
  maxRecommendedLength: number // 建议字符数
  commonKeywords: string[]
}

/**
 * 文档模板记录 - 扁平化设计
 */
export interface DocumentTemplateRecord {
  id: string
  name: string
  documentType: 'cv' | 'letter' | 'ps'
  language: 'zh-cn' | 'en' | 'sp'
  content: string
  contentLength: number
  contentEncoding: 'utf-8'
  isDefault: boolean
  isPublic: boolean
  createdBy: string // userId或'system'
  createdAt: number
  useCount: number
  rating: number // 0-5星评分
  tags: string[]
  description: string
}

/**
 * 用户表 - 扁平化设计
 */
export interface UserRecord {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string
  createdAt: number
  lastLoginAt: number
  isActive: boolean
  preferredLanguage: 'zh-cn' | 'en' | 'sp'
  timezone: string
  totalDocuments: number
  totalEditTimeMs: number
  subscriptionType: 'free' | 'premium' | 'enterprise'
  subscriptionExpiresAt?: number
  storageUsedBytes: number
  storageQuotaBytes: number
}

/**
 * 用户文档关联表 - 扁平化设计
 */
export interface UserDocumentRecord {
  id: string
  userId: string
  documentId: string
  documentName: string
  documentType: 'cv' | 'letter' | 'ps' // CV简历、求职信、个人陈述
  role: 'owner' | 'editor' | 'viewer'
  accessLevel: 'private' | 'shared' | 'public'
  createdAt: number
  lastAccessedAt: number
  lastModifiedAt: number
  isBookmarked: boolean
  isTrashed: boolean
  trashedAt?: number
  shareUrl?: string
  shareExpiresAt?: number
  collaboratorCount: number
  versionCount: number
  totalEditTimeMs: number
  documentSizeBytes: number
}

/**
 * 用户会话记录 - 扁平化设计
 */
export interface UserSessionRecord {
  id: string
  userId: string
  sessionToken: string
  deviceInfo: string
  browserInfo: string
  ipAddress: string
  createdAt: number
  expiresAt: number
  lastActivityAt: number
  isActive: boolean
  activityCount: number
}

/**
 * 用户偏好设置 - 扁平化设计
 */
export interface UserPreferenceRecord {
  id: string
  userId: string
  category: 'ui' | 'editor' | 'ai' | 'export' | 'privacy'
  settingKey: string
  settingValue: string
  settingType: 'string' | 'number' | 'boolean' | 'json'
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

// 扁平化数据结构设计完成 - 简单可靠，便于序列化