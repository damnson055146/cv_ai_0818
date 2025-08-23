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
    maxVersionHistory: 100,
    maxOperationHistory: 1000,
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
    
    // 保持版本数量限制
    while (versions.length > this.config.maxVersionHistory) {
      versions.shift()
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
    
    // 保持操作记录数量限制
    while (operations.length > this.config.maxOperationHistory) {
      operations.shift()
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
   * 文档状态管理 - 直接覆盖写入
   */
  async saveDocumentState(state: DocumentState): Promise<void> {
    await this.saveToLocalStorage(`${this.keys.DOCUMENT_STATE}_${state.documentId}`, state)
  }

  async loadDocumentState(documentId: string): Promise<DocumentState | null> {
    return await this.loadFromLocalStorage(`${this.keys.DOCUMENT_STATE}_${documentId}`)
  }

  /**
   * 简历数据管理 - 直接覆盖写入  
   */
  async saveFlatResumeItem(item: FlatResumeStorageItem): Promise<void> {
    const items = await this.loadAllFlatResumeItems()
    const index = items.findIndex(existing => existing.id === item.id)
    
    if (index >= 0) {
      items[index] = item
    } else {
      items.push(item)
    }
    
    await this.saveToLocalStorage(this.keys.RESUME_ITEMS, items)
  }

  async loadFlatResumeItem(id: string): Promise<FlatResumeStorageItem | null> {
    const items = await this.loadAllFlatResumeItems()
    return items.find(item => item.id === id) || null
  }

  async loadAllFlatResumeItems(): Promise<FlatResumeStorageItem[]> {
    return await this.loadFromLocalStorage(this.keys.RESUME_ITEMS) || []
  }

  /**
   * 用户管理 - append-only和覆盖写入
   */
  async saveUserRecord(user: UserRecord): Promise<void> {
    const users = await this.loadAllUsers()
    const index = users.findIndex(existing => existing.id === user.id)
    
    if (index >= 0) {
      users[index] = user
    } else {
      users.push(user)
    }
    
    await this.saveToLocalStorage(this.userKeys.USERS, users)
  }

  async loadUserRecord(userId: string): Promise<UserRecord | null> {
    const users = await this.loadAllUsers()
    return users.find(user => user.id === userId) || null
  }

  async loadAllUsers(): Promise<UserRecord[]> {
    return await this.loadFromLocalStorage(this.userKeys.USERS) || []
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
    userDocs.push(userDoc)
    await this.saveToLocalStorage(`${this.userKeys.USER_DOCUMENTS}_${userDoc.userId}`, userDocs)
  }

  async updateUserDocumentRecord(userDoc: UserDocumentRecord): Promise<void> {
    const userDocs = await this.loadUserDocumentRecords(userDoc.userId)
    const index = userDocs.findIndex(existing => existing.id === userDoc.id)
    
    if (index >= 0) {
      userDocs[index] = userDoc
    } else {
      userDocs.push(userDoc)
    }
    
    await this.saveToLocalStorage(`${this.userKeys.USER_DOCUMENTS}_${userDoc.userId}`, userDocs)
  }

  async loadUserDocumentRecords(userId: string): Promise<UserDocumentRecord[]> {
    return await this.loadFromLocalStorage(`${this.userKeys.USER_DOCUMENTS}_${userId}`) || []
  }

  async loadUserDocumentRecord(userId: string, documentId: string): Promise<UserDocumentRecord | null> {
    const userDocs = await this.loadUserDocumentRecords(userId)
    return userDocs.find(doc => doc.documentId === documentId) || null
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
    
    // 保持最近100个会话记录
    while (sessions.length > 100) {
      sessions.shift()
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
   * 用户偏好设置管理 - 覆盖写入
   */
  async saveUserPreferenceRecord(preference: UserPreferenceRecord): Promise<void> {
    const preferences = await this.loadUserPreferenceRecords(preference.userId)
    const index = preferences.findIndex(
      existing => existing.category === preference.category && existing.settingKey === preference.settingKey
    )
    
    if (index >= 0) {
      preferences[index] = preference
    } else {
      preferences.push(preference)
    }
    
    await this.saveToLocalStorage(`${this.userKeys.USER_PREFERENCES}_${preference.userId}`, preferences)
  }

  async loadUserPreferenceRecords(userId: string): Promise<UserPreferenceRecord[]> {
    return await this.loadFromLocalStorage(`${this.userKeys.USER_PREFERENCES}_${userId}`) || []
  }

  async loadUserPreference(userId: string, category: string, settingKey: string): Promise<UserPreferenceRecord | null> {
    const preferences = await this.loadUserPreferenceRecords(userId)
    return preferences.find(pref => pref.category === category && pref.settingKey === settingKey) || null
  }

  /**
   * 文档模板管理 - append-only和覆盖写入
   */
  async saveDocumentTemplate(template: DocumentTemplateRecord): Promise<void> {
    const templates = await this.loadAllDocumentTemplates()
    const index = templates.findIndex(existing => existing.id === template.id)
    
    if (index >= 0) {
      templates[index] = template
    } else {
      templates.push(template)
    }
    
    await this.saveToLocalStorage(this.templateKeys.DOCUMENT_TEMPLATES, templates)
  }

  async loadAllDocumentTemplates(): Promise<DocumentTemplateRecord[]> {
    return await this.loadFromLocalStorage(this.templateKeys.DOCUMENT_TEMPLATES) || []
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
    const templates = await this.loadAllDocumentTemplates()
    const template = templates.find(t => t.id === templateId)
    
    if (template) {
      template.useCount += 1
      await this.saveToLocalStorage(this.templateKeys.DOCUMENT_TEMPLATES, templates)
    }
  }

  /**
   * 文档类型配置管理 - 覆盖写入
   */
  async saveDocumentTypeConfigs(configs: DocumentTypeConfig[]): Promise<void> {
    await this.saveToLocalStorage(this.templateKeys.DOCUMENT_TYPE_CONFIGS, configs)
  }

  async loadDocumentTypeConfigs(): Promise<DocumentTypeConfig[]> {
    return await this.loadFromLocalStorage(this.templateKeys.DOCUMENT_TYPE_CONFIGS) || this.getDefaultDocumentTypeConfigs()
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
   * 基础的LocalStorage操作 - 明文存储，便于调试
   */
  private async saveToLocalStorage(key: string, data: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(data)
      localStorage.setItem(key, jsonString)
      
      if (this.config.debugMode) {
        console.log(`[FlatStorage] Saved to ${key}, size: ${jsonString.length} chars`)
      }
    } catch (error) {
      console.error(`[FlatStorage] Failed to save ${key}:`, error)
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