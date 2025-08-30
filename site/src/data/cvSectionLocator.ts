// CVSectionLocator: 基于标题/关键词/位置范围进行分块定位
import type { LocatorInput, CVSectionLocation, ParagraphRecord } from './ds'
import { FlatStorageManager } from './storage'

export class CVSectionLocator {
  constructor(private storage = new FlatStorageManager()) {}

  async locateSection(input: LocatorInput): Promise<CVSectionLocation> {
    const { documentId, userInput, selectedRange, docType, language } = input
    const paragraphs = await this.loadLatestParagraphs(documentId)
    if (paragraphs.length === 0) {
      return { sectionTag: 'other', targetType: 'document', targetIds: [], contextText: '', confidence: 0, matchedKeywords: [] }
    }

    // 1) 若有选择范围，则优先命中该范围内的段落
    let candidates = paragraphs
    if (selectedRange) {
      candidates = paragraphs.filter(p => !(p.endPosition < selectedRange.startPosition || p.startPosition > selectedRange.endPosition))
      if (candidates.length === 0) candidates = paragraphs
    }

    // 2) 标题与关键字辅助（粗略规则）
    const keywords = this.extractQueryKeywords(userInput)
    const scored = candidates.map(p => {
      let score = 0
      const lower = (p.content || '').toLowerCase()
      for (const k of keywords) if (lower.includes(k)) score += 1
      // 标题型段落加权
      if (p.type === 'heading') score += 0.5
      return { p, score }
    }).sort((a, b) => b.score - a.score)

    const best = scored[0]?.p || candidates[0]
    const sectionTag = this.inferSectionTag(best)

    // 3) 上下文（前后段落拼接，便于后端理解）
    const idx = paragraphs.findIndex(x => x.id === best.id)
    const before = idx > 0 ? paragraphs[idx - 1].content : ''
    const after = idx < paragraphs.length - 1 ? paragraphs[idx + 1].content : ''
    const contextText = [before, best.content, after].filter(Boolean).join('\n\n')

    const confidence = Math.min(1, (scored[0]?.score ?? 0) / 3 + (selectedRange ? 0.2 : 0))
    return {
      sectionTag,
      targetType: 'paragraph',
      targetIds: [best.id],
      contextText,
      confidence,
      matchedKeywords: keywords
    }
  }

  private extractQueryKeywords(text: string): string[] {
    return text.toLowerCase().split(/[\s,，。.!?？;；:/]+/).filter(x => x.length > 1).slice(0, 8)
  }

  private inferSectionTag(p: ParagraphRecord): CVSectionLocation['sectionTag'] {
    const t = (p.content || '').toLowerCase()
    if (p.type === 'heading') {
      if (/education|学历|教育/.test(t)) return 'education'
      if (/work|experience|经历|工作/.test(t)) return 'work'
      if (/project|项目/.test(t)) return 'projects'
      if (/skill|技能/.test(t)) return 'skills'
      if (/award|获奖|荣誉/.test(t)) return 'awards'
      if (/certificate|证书/.test(t)) return 'certs'
      if (/summary|简介|概述/.test(t)) return 'summary'
      if (/basic|个人信息|联系/.test(t)) return 'basic_info'
    }
    // 非标题基于关键词猜测
    if (/project|项目/.test(t)) return 'projects'
    if (/experience|经历|工作/.test(t)) return 'work'
    if (/education|学历|教育/.test(t)) return 'education'
    if (/skill|技能/.test(t)) return 'skills'
    return 'other'
  }

  private async loadLatestParagraphs(documentId: string) {
    const all = await this.storage.loadParagraphRecords(documentId)
    const byIndex = new Map<number, ParagraphRecord>()
    for (const p of all) {
      const existing = byIndex.get(p.index)
      if (!existing || (p.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
        byIndex.set(p.index, p)
      }
    }
    return Array.from(byIndex.entries()).sort((a, b) => a[0] - b[0]).map(([, p]) => p)
  }
}

// CV分块定位器 - 根据关键词和上下文定位目标段落/句子
import type { 
  ParagraphRecord, 
  SentenceRecord, 
  CVSectionLocation 
} from './ds'
import { FlatStorageManager } from './storage'

export interface LocatorInput {
  documentId: string
  userInput: string
  selectedRange?: {
    startPosition: number
    endPosition: number
  }
  docType?: 'cv' | 'letter' | 'ps'
  language?: 'zh-cn' | 'en' | 'sp'
}

export class CVSectionLocator {
  private storage: FlatStorageManager

  constructor(storage?: FlatStorageManager) {
    this.storage = storage ?? new FlatStorageManager()
  }

  // CV区块关键词映射
  private readonly sectionKeywords = {
    basic_info: {
      'zh-cn': ['个人信息', '基本信息', '联系方式', '姓名', '电话', '邮箱', '地址', '性别', '年龄', '生日'],
      'en': ['personal', 'contact', 'information', 'name', 'phone', 'email', 'address', 'profile', 'bio']
    },
    education: {
      'zh-cn': ['教育经历', '学历', '教育背景', '本科', '研究生', '博士', '学院', '大学', '专业', '系', '学位', '毕业'],
      'en': ['education', 'academic', 'university', 'college', 'degree', 'bachelor', 'master', 'phd', 'school', 'major', 'graduate']
    },
    work: {
      'zh-cn': ['工作经历', '职业经历', '实习经历', '工作经验', '公司', '职位', '岗位', '工作', '实习', '任职'],
      'en': ['work', 'experience', 'employment', 'career', 'job', 'position', 'company', 'internship', 'role']
    },
    projects: {
      'zh-cn': ['项目经历', '项目经验', '参与项目', '负责项目', '项目', '开发', '设计', '实现'],
      'en': ['project', 'projects', 'development', 'implementation', 'design', 'built', 'created', 'developed']
    },
    skills: {
      'zh-cn': ['技能', '专业技能', '技术栈', '编程语言', '工具', '软件', '熟练', '掌握'],
      'en': ['skills', 'technical', 'programming', 'languages', 'tools', 'software', 'proficient', 'expertise']
    },
    awards: {
      'zh-cn': ['获奖情况', '荣誉', '奖项', '获奖', '证书', '认证'],
      'en': ['awards', 'honors', 'achievements', 'recognition', 'certificate', 'certification']
    },
    certs: {
      'zh-cn': ['资格证书', '证书', '认证', '资质'],
      'en': ['certificate', 'certification', 'license', 'credential']
    },
    summary: {
      'zh-cn': ['个人总结', '自我评价', '个人简介', '总结', '概述'],
      'en': ['summary', 'objective', 'profile', 'overview', 'about']
    }
  }

  // 实体关键词映射
  private readonly entityKeywords = {
    'zh-cn': {
      education: ['院校', '学校', '大学', '学院', '系', '专业', '学位', '年级', '毕业时间'],
      work: ['公司', '企业', '机构', '职位', '岗位', '部门', '团队', '入职时间', '离职时间'],
      contact: ['电话', '手机', '邮箱', '地址', '微信', 'QQ'],
      skills: ['语言', '框架', '工具', '技术', '软件', '平台']
    },
    'en': {
      education: ['university', 'college', 'school', 'institute', 'department', 'major', 'degree', 'gpa'],
      work: ['company', 'corporation', 'organization', 'position', 'role', 'department', 'team'],
      contact: ['phone', 'email', 'address', 'linkedin', 'github'],
      skills: ['language', 'framework', 'tool', 'technology', 'software', 'platform']
    }
  }

  async locateSection(input: LocatorInput): Promise<CVSectionLocation> {
    const { documentId, userInput, selectedRange, docType = 'cv', language = 'zh-cn' } = input

    // 1. 如果有选区，优先使用选区
    if (selectedRange) {
      return await this.locateByRange(documentId, selectedRange, userInput)
    }

    // 2. 加载段落和句子数据
    const paragraphs = await this.storage.loadParagraphRecords(documentId)
    const sentences = await this.storage.loadSentenceRecords(documentId)

    if (!paragraphs.length) {
      return this.createFallbackLocation(userInput)
    }

    // 3. 按标题和关键词分析分块
    const sectionAnalysis = this.analyzeSections(paragraphs, language)
    
    // 4. 分析用户输入的关键词
    const userKeywords = this.extractKeywords(userInput, language)
    
    // 5. 匹配最佳分块
    const bestMatch = this.findBestMatch(sectionAnalysis, userKeywords, sentences)
    
    return bestMatch
  }

  private async locateByRange(
    documentId: string, 
    range: { startPosition: number; endPosition: number }, 
    userInput: string
  ): Promise<CVSectionLocation> {
    const sentences = await this.storage.loadSentenceRecords(documentId)
    
    // 找到选区覆盖的句子
    const targetSentences = sentences.filter(s => 
      s.startPosition >= range.startPosition && s.endPosition <= range.endPosition
    )

    if (!targetSentences.length) {
      return this.createFallbackLocation(userInput)
    }

    const contextText = targetSentences.map(s => s.content).join(' ').slice(0, 500)
    
    return {
      sectionTag: 'other',
      targetType: 'sentence',
      targetIds: targetSentences.map(s => s.id),
      contextText,
      confidence: 0.95, // 选区信号最强
      matchedKeywords: []
    }
  }

  private analyzeSections(paragraphs: ParagraphRecord[], language: string): Array<{
    paragraph: ParagraphRecord
    sectionTag: string
    score: number
  }> {
    return paragraphs.map(para => {
      let bestTag = 'other'
      let bestScore = 0

      // 检查每个分块的关键词匹配度
      for (const [tag, keywords] of Object.entries(this.sectionKeywords)) {
        const tagKeywords = keywords[language as keyof typeof keywords] || []
        const score = this.calculateKeywordScore(para.content, tagKeywords)
        
        if (score > bestScore) {
          bestScore = score
          bestTag = tag
        }
      }

      return {
        paragraph: para,
        sectionTag: bestTag,
        score: bestScore
      }
    })
  }

  private extractKeywords(userInput: string, language: string): string[] {
    const keywords: string[] = []
    const entities = this.entityKeywords[language as keyof typeof this.entityKeywords] || {}
    
    // 提取所有可能的关键词
    for (const categoryKeywords of Object.values(entities)) {
      for (const keyword of categoryKeywords) {
        if (userInput.includes(keyword)) {
          keywords.push(keyword)
        }
      }
    }

    // 简单分词（中文按字，英文按词）
    if (language === 'zh-cn') {
      keywords.push(...userInput.match(/[\u4e00-\u9fa5]+/g) || [])
    } else {
      keywords.push(...userInput.toLowerCase().match(/\b\w+\b/g) || [])
    }

    return [...new Set(keywords)] // 去重
  }

  private findBestMatch(
    sectionAnalysis: Array<{ paragraph: ParagraphRecord; sectionTag: string; score: number }>,
    userKeywords: string[],
    sentences: SentenceRecord[]
  ): CVSectionLocation {
    let bestSection = sectionAnalysis[0]
    let bestScore = 0
    let matchedKeywords: string[] = []

    // 找到最佳匹配的分块
    for (const section of sectionAnalysis) {
      const keywordMatches = userKeywords.filter(keyword => 
        section.paragraph.content.includes(keyword)
      )
      
      const score = section.score + keywordMatches.length * 0.3
      
      if (score > bestScore) {
        bestScore = score
        bestSection = section
        matchedKeywords = keywordMatches
      }
    }

    // 在该分块内找到最相关的句子
    const sectionSentences = sentences.filter(s => s.paragraphId === bestSection.paragraph.id)
    const relevantSentences = sectionSentences.filter(s => 
      userKeywords.some(keyword => s.content.includes(keyword))
    )

    const targetSentences = relevantSentences.length > 0 ? relevantSentences : sectionSentences
    const contextText = targetSentences.map(s => s.content).join(' ').slice(0, 500)

    return {
      sectionTag: bestSection.sectionTag as any,
      targetType: 'sentence',
      targetIds: targetSentences.map(s => s.id),
      contextText,
      confidence: Math.min(0.9, bestScore / 2), // 归一化置信度
      matchedKeywords
    }
  }

  private calculateKeywordScore(content: string, keywords: string[]): number {
    let score = 0
    const lowerContent = content.toLowerCase()
    
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        score += 1
      }
    }
    
    return score / keywords.length // 归一化
  }

  private createFallbackLocation(userInput: string): CVSectionLocation {
    return {
      sectionTag: 'other',
      targetType: 'document',
      targetIds: [],
      contextText: userInput.slice(0, 200),
      confidence: 0.1, // 低置信度
      matchedKeywords: []
    }
  }
}
