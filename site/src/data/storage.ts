// 扁平化存储系统 - 简单可靠设计
// 采用append-only模式，明文存储，避免复杂的压缩和嵌套

import type {
  DocumentVersion,
  ParagraphRecord,
  SentenceRecord,
  OperationRecord,
  DocumentState,
  ParseResult,
  IntentParseRecord,
  FlatResumeStorageItem,
  UserRecord,
  UserDocumentRecord,
  UserSessionRecord,
  UserPreferenceRecord,
  DocumentTemplateRecord,
  DocumentTypeConfig,
  ParagraphKeywordRecord,
  KeywordDictionaryRecord,
  StorageKeys,
  StorageConfig
} from './ds'

/**
 * 简化的存储管理器 - 基于LocalStorage和简单的append模式
 */
export class FlatStorageManager {
  private readonly keys: StorageKeys = {
    DOCUMENT_VERSIONS: 'cv_doc_versions',
    PARAGRAPH_RECORDS: 'cv_paragraphs',
    SENTENCE_RECORDS: 'cv_sentences', 
    OPERATION_RECORDS: 'cv_operations',
    DOCUMENT_STATE: 'cv_doc_state',
    PARSE_RESULTS: 'cv_parse_results',
    INTENT_RECORDS: 'cv_intent_records',
    RESUME_ITEMS: 'cv_resume_items'
  }

  private readonly userKeys = {
    USERS: 'cv_users',
    USER_DOCUMENTS: 'cv_user_documents',
    USER_SESSIONS: 'cv_user_sessions',
    USER_PREFERENCES: 'cv_user_preferences',
    CURRENT_USER: 'cv_current_user'
  }

  private readonly templateKeys = {
    DOCUMENT_TEMPLATES: 'cv_doc_templates',
    DOCUMENT_TYPE_CONFIGS: 'cv_doc_type_configs'
  }

  private config: StorageConfig = {
    maxVersionHistory: 30,
    maxOperationHistory: 300,
    autoSaveIntervalMs: 30000,
    debugMode: false,
    enablePersistence: true
  }
  /**
   * append-only 操作 - 追加版本记录
   */
  async appendDocumentVersion(version: DocumentVersion): Promise<void> {
    const versions = await this.loadDocumentVersions(version.documentId)
    versions.push(version)
    
    // 保持版本数量限制 - 使用 for 循环替代 while
    const excessCount = versions.length - this.config.maxVersionHistory
    if (excessCount > 0) {
      for (let i = 0; i < excessCount; i++) {
        versions.shift()
      }
    }
    
    await this.saveToLocalStorage(`${this.keys.DOCUMENT_VERSIONS}_${version.documentId}`, versions)
  }

  /**
   * append-only 操作 - 追加段落记录
   */
  async appendParagraphRecord(paragraph: ParagraphRecord): Promise<void> {
    const paragraphs = await this.loadParagraphRecords(paragraph.documentId)
    paragraphs.push(paragraph)
    await this.saveToLocalStorage(`${this.keys.PARAGRAPH_RECORDS}_${paragraph.documentId}`, paragraphs)
  }

  /**
   * append-only 操作 - 追加句子记录
   */
  async appendSentenceRecord(sentence: SentenceRecord): Promise<void> {
    const sentences = await this.loadSentenceRecords(sentence.documentId)
    sentences.push(sentence)
    await this.saveToLocalStorage(`${this.keys.SENTENCE_RECORDS}_${sentence.documentId}`, sentences)
  }

  /**
   * append-only 操作 - 追加操作记录
   */
  async appendOperationRecord(operation: OperationRecord): Promise<void> {
    const operations = await this.loadOperationRecords(operation.documentId)
    operations.push(operation)
    
    // 保持操作记录数量限制 - 使用 for 循环替代 while
    const excessCount = operations.length - this.config.maxOperationHistory
    if (excessCount > 0) {
      for (let i = 0; i < excessCount; i++) {
        operations.shift()
      }
    }
    
    await this.saveToLocalStorage(`${this.keys.OPERATION_RECORDS}_${operation.documentId}`, operations)
  }
  /**
   * 加载方法 - 简单的数组加载
   */
  async loadDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return await this.loadFromLocalStorage(`${this.keys.DOCUMENT_VERSIONS}_${documentId}`) || []
  }

  async loadParagraphRecords(documentId: string): Promise<ParagraphRecord[]> {
    return await this.loadFromLocalStorage(`${this.keys.PARAGRAPH_RECORDS}_${documentId}`) || []
  }

  async loadSentenceRecords(documentId: string): Promise<SentenceRecord[]> {
    return await this.loadFromLocalStorage(`${this.keys.SENTENCE_RECORDS}_${documentId}`) || []
  }

  async loadOperationRecords(documentId: string): Promise<OperationRecord[]> {
    return await this.loadFromLocalStorage(`${this.keys.OPERATION_RECORDS}_${documentId}`) || []
  }

  /**
   * 解析结果 - append-only
   */
  async appendParseResult(result: ParseResult): Promise<void> {
    const key = `${this.keys.PARSE_RESULTS}_${result.documentId}`
    const raw = (await this.loadFromLocalStorage<ParseResult[]>(key)) || []
    raw.push(result)
    await this.saveToLocalStorage(key, raw)
  }

  async loadParseResults(documentId: string): Promise<ParseResult[]> {
    const key = `${this.keys.PARSE_RESULTS}_${documentId}`
    const raw = (await this.loadFromLocalStorage<ParseResult[]>(key)) || []
    return raw
  }

  /**
   * 意图解析记录 - append-only
   */
  async appendIntentRecord(documentId: string, record: IntentParseRecord): Promise<void> {
    const key = `${this.keys.INTENT_RECORDS}_${documentId}`
    const raw = (await this.loadFromLocalStorage<IntentParseRecord[]>(key)) || []
    raw.push(record)
    await this.saveToLocalStorage(key, raw)
  }

  async loadIntentRecords(documentId: string): Promise<IntentParseRecord[]> {
    const key = `${this.keys.INTENT_RECORDS}_${documentId}`
    const raw = (await this.loadFromLocalStorage<IntentParseRecord[]>(key)) || []
    return raw
  }

  /**
   * 文档状态管理 - append-only
   */
  async saveDocumentState(state: DocumentState): Promise<void> {
    const key = `${this.keys.DOCUMENT_STATE}_${state.documentId}`
    const existing = await this.loadFromLocalStorage<any>(key)
    const list: DocumentState[] = Array.isArray(existing)
      ? existing
      : existing
        ? [existing as DocumentState]
        : []
    list.push(state)
    await this.saveToLocalStorage(key, list)
  }

  async loadDocumentState(documentId: string): Promise<DocumentState | null> {
    const key = `${this.keys.DOCUMENT_STATE}_${documentId}`
    const existing = await this.loadFromLocalStorage<any>(key)
    if (!existing) return null
    if (Array.isArray(existing)) {
      return existing.length ? (existing[existing.length - 1] as DocumentState) : null
    }
    return existing as DocumentState
  }

  /**
   * 简历数据管理 - append-only
   */
  async saveFlatResumeItem(item: FlatResumeStorageItem): Promise<void> {
    const items = await this.loadAllFlatResumeItems()
    // 追加而非覆盖，读取时去重获取最新
    items.push(item)
    await this.saveToLocalStorage(this.keys.RESUME_ITEMS, items)
  }

  async loadFlatResumeItem(id: string): Promise<FlatResumeStorageItem | null> {
    const raw = (await this.loadFromLocalStorage<FlatResumeStorageItem[]>(this.keys.RESUME_ITEMS)) || []
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].id === id) return raw[i]
    }
    return null
  }

  async loadAllFlatResumeItems(): Promise<FlatResumeStorageItem[]> {
    const raw = (await this.loadFromLocalStorage<FlatResumeStorageItem[]>(this.keys.RESUME_ITEMS)) || []
    const latestById = new Map<string, FlatResumeStorageItem>()
    for (let i = 0; i < raw.length; i++) {
      // 顺序遍历，后写入覆盖前者，最终得到最新
      latestById.set(raw[i].id, raw[i])
    }
    return Array.from(latestById.values())
  }

  /**
   * 用户管理 - append-only
   */
  async saveUserRecord(user: UserRecord): Promise<void> {
    const raw = (await this.loadFromLocalStorage<UserRecord[]>(this.userKeys.USERS)) || []
    raw.push(user)
    await this.saveToLocalStorage(this.userKeys.USERS, raw)
  }

  async loadUserRecord(userId: string): Promise<UserRecord | null> {
    const raw = (await this.loadFromLocalStorage<UserRecord[]>(this.userKeys.USERS)) || []
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].id === userId) return raw[i]
    }
    return null
  }

  async loadAllUsers(): Promise<UserRecord[]> {
    const raw = (await this.loadFromLocalStorage<UserRecord[]>(this.userKeys.USERS)) || []
    const latestById = new Map<string, UserRecord>()
    for (let i = 0; i < raw.length; i++) {
      latestById.set(raw[i].id, raw[i])
    }
    return Array.from(latestById.values())
  }

  async setCurrentUser(userId: string): Promise<void> {
    await this.saveToLocalStorage(this.userKeys.CURRENT_USER, userId)
  }

  async getCurrentUser(): Promise<UserRecord | null> {
    const userId = await this.loadFromLocalStorage<string>(this.userKeys.CURRENT_USER)
    if (!userId) return null
    return await this.loadUserRecord(userId)
  }

  /**
   * 用户文档关联管理 - append-only
   */
  async appendUserDocumentRecord(userDoc: UserDocumentRecord): Promise<void> {
    const userDocs = await this.loadUserDocumentRecords(userDoc.userId)
    // 直接保存完整历史，读取时去重
    const raw = (await this.loadFromLocalStorage<UserDocumentRecord[]>(`${this.userKeys.USER_DOCUMENTS}_${userDoc.userId}`)) || []
    raw.push(userDoc)
    await this.saveToLocalStorage(`${this.userKeys.USER_DOCUMENTS}_${userDoc.userId}`, raw)
  }

  async updateUserDocumentRecord(userDoc: UserDocumentRecord): Promise<void> {
    // append-only：追加新版本
    const key = `${this.userKeys.USER_DOCUMENTS}_${userDoc.userId}`
    const raw = (await this.loadFromLocalStorage<UserDocumentRecord[]>(key)) || []
    raw.push(userDoc)
    await this.saveToLocalStorage(key, raw)
  }

  async loadUserDocumentRecords(userId: string): Promise<UserDocumentRecord[]> {
    const raw = (await this.loadFromLocalStorage<UserDocumentRecord[]>(`${this.userKeys.USER_DOCUMENTS}_${userId}`)) || []
    const latestById = new Map<string, UserDocumentRecord>()
    for (let i = 0; i < raw.length; i++) {
      latestById.set(raw[i].id, raw[i])
    }
    return Array.from(latestById.values())
  }

  async loadUserDocumentRecord(userId: string, documentId: string): Promise<UserDocumentRecord | null> {
    const raw = (await this.loadFromLocalStorage<UserDocumentRecord[]>(`${this.userKeys.USER_DOCUMENTS}_${userId}`)) || []
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].documentId === documentId) return raw[i]
    }
    return null
  }

  async loadUserDocumentsByType(userId: string, documentType: 'cv' | 'letter' | 'ps'): Promise<UserDocumentRecord[]> {
    const userDocs = await this.loadUserDocumentRecords(userId)
    return userDocs.filter(doc => doc.documentType === documentType && !doc.isTrashed)
  }

  async getUserDocumentStats(userId: string): Promise<{
    totalDocuments: number
    cvCount: number
    letterCount: number
    psCount: number
    trashedCount: number
  }> {
    const userDocs = await this.loadUserDocumentRecords(userId)
      
      return {
      totalDocuments: userDocs.filter(doc => !doc.isTrashed).length,
      cvCount: userDocs.filter(doc => doc.documentType === 'cv' && !doc.isTrashed).length,
      letterCount: userDocs.filter(doc => doc.documentType === 'letter' && !doc.isTrashed).length,
      psCount: userDocs.filter(doc => doc.documentType === 'ps' && !doc.isTrashed).length,
      trashedCount: userDocs.filter(doc => doc.isTrashed).length
    }
  }

  /**
   * 用户会话管理 - append-only
   */
  async appendUserSessionRecord(session: UserSessionRecord): Promise<void> {
    const sessions = await this.loadUserSessionRecords(session.userId)
    sessions.push(session)
    
    // 保持最近100个会话记录 - 使用 for 循环替代 while
    const excessCount = sessions.length - 100
    if (excessCount > 0) {
      for (let i = 0; i < excessCount; i++) {
        sessions.shift()
      }
    }
    
    await this.saveToLocalStorage(`${this.userKeys.USER_SESSIONS}_${session.userId}`, sessions)
  }

  async loadUserSessionRecords(userId: string): Promise<UserSessionRecord[]> {
    return await this.loadFromLocalStorage(`${this.userKeys.USER_SESSIONS}_${userId}`) || []
  }

  async loadActiveUserSession(userId: string): Promise<UserSessionRecord | null> {
    const sessions = await this.loadUserSessionRecords(userId)
    return sessions.find(session => session.isActive && session.expiresAt > Date.now()) || null
  }

  /**
   * 用户偏好设置管理 - append-only
   */
  async saveUserPreferenceRecord(preference: UserPreferenceRecord): Promise<void> {
    const key = `${this.userKeys.USER_PREFERENCES}_${preference.userId}`
    const raw = (await this.loadFromLocalStorage<UserPreferenceRecord[]>(key)) || []
    raw.push(preference)
    await this.saveToLocalStorage(key, raw)
  }

  async loadUserPreferenceRecords(userId: string): Promise<UserPreferenceRecord[]> {
    const raw = (await this.loadFromLocalStorage<UserPreferenceRecord[]>(`${this.userKeys.USER_PREFERENCES}_${userId}`)) || []
    const latestByComposite = new Map<string, UserPreferenceRecord>()
    for (let i = 0; i < raw.length; i++) {
      const key = `${raw[i].category}::${raw[i].settingKey}`
      latestByComposite.set(key, raw[i])
    }
    return Array.from(latestByComposite.values())
  }

  async loadUserPreference(userId: string, category: string, settingKey: string): Promise<UserPreferenceRecord | null> {
    const raw = (await this.loadFromLocalStorage<UserPreferenceRecord[]>(`${this.userKeys.USER_PREFERENCES}_${userId}`)) || []
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].category === category && raw[i].settingKey === settingKey) return raw[i]
    }
    return null
  }

  /**
   * 文档模板管理 - append-only
   */
  async saveDocumentTemplate(template: DocumentTemplateRecord): Promise<void> {
    const raw = (await this.loadFromLocalStorage<DocumentTemplateRecord[]>(this.templateKeys.DOCUMENT_TEMPLATES)) || []
    raw.push(template)
    await this.saveToLocalStorage(this.templateKeys.DOCUMENT_TEMPLATES, raw)
  }

  async loadAllDocumentTemplates(): Promise<DocumentTemplateRecord[]> {
    const raw = (await this.loadFromLocalStorage<DocumentTemplateRecord[]>(this.templateKeys.DOCUMENT_TEMPLATES)) || []
    const latestById = new Map<string, DocumentTemplateRecord>()
    for (let i = 0; i < raw.length; i++) {
      latestById.set(raw[i].id, raw[i])
    }
    return Array.from(latestById.values())
  }

  async loadDocumentTemplatesByType(documentType: 'cv' | 'letter' | 'ps'): Promise<DocumentTemplateRecord[]> {
    const templates = await this.loadAllDocumentTemplates()
    return templates.filter(template => template.documentType === documentType)
  }

  async loadDocumentTemplatesByLanguage(documentType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp'): Promise<DocumentTemplateRecord[]> {
    const templates = await this.loadDocumentTemplatesByType(documentType)
    return templates.filter(template => template.language === language)
  }

  async loadDefaultTemplate(documentType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp'): Promise<DocumentTemplateRecord | null> {
    const templates = await this.loadDocumentTemplatesByLanguage(documentType, language)
    return templates.find(template => template.isDefault) || templates[0] || null
  }

  async incrementTemplateUseCount(templateId: string): Promise<void> {
    const key = this.templateKeys.DOCUMENT_TEMPLATES
    const raw = (await this.loadFromLocalStorage<DocumentTemplateRecord[]>(key)) || []
    // 找到最新模板
    let latest: DocumentTemplateRecord | null = null
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i].id === templateId) { latest = raw[i]; break }
    }
    if (!latest) return
    const updated: DocumentTemplateRecord = { ...latest, useCount: latest.useCount + 1 }
    raw.push(updated)
    await this.saveToLocalStorage(key, raw)
  }

  /**
   * 文档类型配置管理 - append-only（保存完整快照），读取返回最新
   */
  async saveDocumentTypeConfigs(configs: DocumentTypeConfig[]): Promise<void> {
    const key = this.templateKeys.DOCUMENT_TYPE_CONFIGS
    const existing = await this.loadFromLocalStorage<any>(key)
    const snapshots: DocumentTypeConfig[][] = Array.isArray(existing) && Array.isArray(existing[0])
      ? (existing as DocumentTypeConfig[][])
      : existing
        ? [existing as DocumentTypeConfig[]]
        : []
    snapshots.push(configs)
    await this.saveToLocalStorage(key, snapshots)
  }

  async loadDocumentTypeConfigs(): Promise<DocumentTypeConfig[]> {
    const key = this.templateKeys.DOCUMENT_TYPE_CONFIGS
    const existing = await this.loadFromLocalStorage<any>(key)
    if (!existing) return this.getDefaultDocumentTypeConfigs()
    if (Array.isArray(existing) && Array.isArray(existing[0])) {
      const snapshots = existing as DocumentTypeConfig[][]
      return snapshots.length ? snapshots[snapshots.length - 1] : this.getDefaultDocumentTypeConfigs()
    }
    return existing as DocumentTypeConfig[]
  }

  async loadDocumentTypeConfig(documentType: 'cv' | 'letter' | 'ps'): Promise<DocumentTypeConfig | null> {
    const configs = await this.loadDocumentTypeConfigs()
    return configs.find(config => config.type === documentType) || null
  }

  private getDefaultDocumentTypeConfigs(): DocumentTypeConfig[] {
    return [
      {
        type: 'cv',
        displayName: 'Curriculum Vitae',
        displayNameCN: '简历',
        description: 'Professional resume for job applications',
        defaultTemplate: 'default_cv_template',
        suggestedSections: ['Personal Info', 'Education', 'Experience', 'Skills', 'Projects'],
        maxRecommendedLength: 2000,
        commonKeywords: ['experience', 'education', 'skills', 'projects', 'achievements']
      },
      {
        type: 'letter',
        displayName: 'Cover Letter',
        displayNameCN: '求职信',
        description: 'Personalized cover letter for job applications',
        defaultTemplate: 'default_letter_template',
        suggestedSections: ['Header', 'Salutation', 'Opening', 'Body', 'Closing'],
        maxRecommendedLength: 800,
        commonKeywords: ['position', 'company', 'interest', 'qualifications', 'contribution']
      },
      {
        type: 'ps',
        displayName: 'Personal Statement',
        displayNameCN: '个人陈述',
        description: 'Academic personal statement for university applications',
        defaultTemplate: 'default_ps_template',
        suggestedSections: ['Introduction', 'Academic Background', 'Research Interest', 'Career Goals'],
        maxRecommendedLength: 1500,
        commonKeywords: ['research', 'academic', 'goals', 'passion', 'contribution']
      }
    ]
  }

  /**
   * 段落关键词索引（Append-Only）
   */
  async appendParagraphKeywordRecord(record: ParagraphKeywordRecord): Promise<void> {
    const key = `cv_para_keywords_${record.documentId}`
    const raw = (await this.loadFromLocalStorage<ParagraphKeywordRecord[]>(key)) || []
    raw.push(record)
    await this.saveToLocalStorage(key, raw)
  }

  async loadParagraphKeywordRecords(documentId: string): Promise<ParagraphKeywordRecord[]> {
    const key = `cv_para_keywords_${documentId}`
    return (await this.loadFromLocalStorage<ParagraphKeywordRecord[]>(key)) || []
  }

  /**
   * 关键词字典（全量快照，append-only 保存版本）
   */
  async saveKeywordDictionaries(docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp', dict: KeywordDictionaryRecord): Promise<void> {
    const key = `cv_kw_dict_${docType}_${language}`
    const raw = (await this.loadFromLocalStorage<any[]>(key)) || []
    raw.push(dict)
    await this.saveToLocalStorage(key, raw)
  }

  async loadKeywordDictionaries(docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp'): Promise<KeywordDictionaryRecord> {
    const key = `cv_kw_dict_${docType}_${language}`
    const raw = (await this.loadFromLocalStorage<KeywordDictionaryRecord[] | null>(key)) || null
    if (raw && raw.length) return raw[raw.length - 1]
    return this.getDefaultKeywordDictionary(docType, language)
  }

  private getDefaultKeywordDictionary(docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp'): KeywordDictionaryRecord {
    const commonEn = {
      actionVerbs: ['led','owned','built','designed','implemented','optimized','improved','developed','architected','delivered'],
      domainTerms: ['project','system','pipeline','model','dataset','service','frontend','backend','database'],
      softSkills: ['communication','leadership','collaboration','problem-solving','initiative'],
      academicTerms: ['research','paper','publication','methodology','experiment','hypothesis','thesis']
    }
    const commonZh = {
      actionVerbs: ['主导','负责','搭建','设计','实现','优化','改进','研发','架构','交付'],
      domainTerms: ['项目','系统','流水线','模型','数据集','服务','前端','后端','数据库'],
      softSkills: ['沟通','领导力','合作','解决问题','主动性'],
      academicTerms: ['研究','论文','发表','方法','实验','假设','课题']
    }
    const base = language === 'en' ? commonEn : commonZh
    return {
      id: `kwdict_${docType}_${language}`,
      docType,
      language,
      actionVerbs: base.actionVerbs,
      domainTerms: base.domainTerms,
      softSkills: base.softSkills,
      academicTerms: base.academicTerms,
      updatedAt: Date.now()
    }
  }
  /**
   * 基础的LocalStorage操作 - 明文存储，便于调试
   */
  private async saveToLocalStorage(key: string, data: any): Promise<void> {
    try {
      let jsonString = JSON.stringify(data)
      // Preflight: if payload is too big and array-like, thin it proactively
      if (jsonString.length > 4_000_000 && Array.isArray(data)) {
        const keep = key.startsWith(this.keys.DOCUMENT_VERSIONS)
          ? Math.min(10, data.length)
          : key.startsWith(this.keys.OPERATION_RECORDS)
            ? Math.min(100, data.length)
            : Math.max(1, Math.floor(data.length / 3))
        const trimmed = data.slice(-keep)
        jsonString = JSON.stringify(trimmed)
      }
      localStorage.setItem(key, jsonString)
      if (this.config.debugMode) {
        console.log(`[FlatStorage] Saved to ${key}, size: ${jsonString.length} chars`)
      }
    } catch (error: any) {
      const msg = (error && (error.message || error.toString())) || ''
      const isQuota = (error && error.name === 'QuotaExceededError') || /QuotaExceeded/i.test(msg)
      if (isQuota) {
        try {
          // Best-effort trimming for array-like buckets (versions, operations)
          if (Array.isArray(data) && data.length > 1) {
            let trimmed: any[]
            if (key.startsWith(this.keys.DOCUMENT_VERSIONS)) {
              trimmed = data.slice(-10)
            } else if (key.startsWith(this.keys.OPERATION_RECORDS)) {
              trimmed = data.slice(-100)
            } else {
              trimmed = data.slice(Math.floor(data.length / 2))
            }
            const s = JSON.stringify(trimmed)
            localStorage.setItem(key, s)
            console.warn(`[FlatStorage] Quota exceeded: trimmed ${key} -> ${trimmed.length} items`)
            return
          }
        } catch (e) {
          // ignore and fall through
        }
        // As a last resort: skip persistence to keep UI responsive
        console.warn(`[FlatStorage] Quota exceeded: skipped saving ${key}`)
        return
      }
      console.error(`[FlatStorage] Failed to save ${key}:`, error)
      // Non-quota errors: rethrow for visibility
      throw error
    }
  }

  private async loadFromLocalStorage<T>(key: string): Promise<T | null> {
    try {
      const jsonString = localStorage.getItem(key)
      if (!jsonString) return null
      
      const data = JSON.parse(jsonString) as T
      
      if (this.config.debugMode) {
        console.log(`[FlatStorage] Loaded from ${key}, size: ${jsonString.length} chars`)
      }
      
      return data
    } catch (error) {
      console.error(`[FlatStorage] Failed to load ${key}:`, error)
      return null
    }
  }

  /**
   * 清理工具方法
   */
  async clearDocumentData(documentId: string): Promise<void> {
    const keysToRemove = [
      `${this.keys.DOCUMENT_VERSIONS}_${documentId}`,
      `${this.keys.PARAGRAPH_RECORDS}_${documentId}`,
      `${this.keys.SENTENCE_RECORDS}_${documentId}`,
      `${this.keys.OPERATION_RECORDS}_${documentId}`,
      `${this.keys.DOCUMENT_STATE}_${documentId}`,
      `${this.keys.PARSE_RESULTS}_${documentId}`,
      `${this.keys.INTENT_RECORDS}_${documentId}`
    ]
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  async clearUserData(userId: string): Promise<void> {
    const keysToRemove = [
      `${this.userKeys.USER_DOCUMENTS}_${userId}`,
      `${this.userKeys.USER_SESSIONS}_${userId}`,
      `${this.userKeys.USER_PREFERENCES}_${userId}`
    ]
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // 同时从用户列表中移除
    const users = await this.loadAllUsers()
    const filteredUsers = users.filter(user => user.id !== userId)
    await this.saveToLocalStorage(this.userKeys.USERS, filteredUsers)
  }

  async clearAllUserData(): Promise<void> {
    Object.values(this.userKeys).forEach(key => localStorage.removeItem(key))
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): { usedBytes: number; availableBytes: number } {
    let usedBytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('cv_')) {
        const value = localStorage.getItem(key)
        usedBytes += (key.length + (value?.length || 0)) * 2 // UTF-16编码
      }
    }
    
    return {
      usedBytes,
      availableBytes: 5 * 1024 * 1024 - usedBytes // 假设5MB限制
    }
  }
  }
