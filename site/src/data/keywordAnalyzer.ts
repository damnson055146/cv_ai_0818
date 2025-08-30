// KeywordAnalyzer: 按段落（结合 MD 结构 + PS 分段符）提取关键词与执行动词
import type { ParagraphRecord, ParagraphKeywordRecord, KeywordDictionaryRecord } from './ds'

export interface AnalyzeOptions {
  docType: 'cv' | 'letter' | 'ps'
  language: 'zh-cn' | 'en' | 'sp'
}

function tokenize(text: string, lang: AnalyzeOptions['language']): string[] {
  // 简单分词：英文按非字母拆分，中文/西文按空格与常见标点拆分
  if (lang === 'en') {
    return text.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  }
  // zh-cn/sp: 基于常见分隔符切分为词段（并全部转小写）
  return text.toLowerCase().split(/[\s\u3000、，,。.!?？；;:\-\[\]\(\)\{\}\<\>\n\r\t]+/).filter(Boolean)
}

function containsPsSeparator(content: string): boolean {
  // PS 常见分段符：空行、分号多段、破折号，且标题型提示词
  // 实际可扩展：解析器中已经按空行/标题/列表等拆段，这里主要补充 PS 的常见分隔符。
  return /\n\s*\n/.test(content) || /；\s*/.test(content) || /——/.test(content)
}

export class KeywordAnalyzer {
  constructor(private dict: KeywordDictionaryRecord) {}

  analyzeParagraphs(paragraphs: ParagraphRecord[], opts: AnalyzeOptions): ParagraphKeywordRecord[] {
    const records: ParagraphKeywordRecord[] = []

    for (const p of paragraphs) {
      const content = p.content || ''
      const tokens = tokenize(content, opts.language)

      // 动作动词匹配（根据语言与字典）
      const execSet = new Set<string>()
      for (const v of this.dict.actionVerbs) {
        if (!v) continue
        const needle = v.toLowerCase()
        if (tokens.includes(needle) || content.includes(v)) execSet.add(v)
      }

      // 领域词、软技能、学术词
      const kwSet = new Set<string>()
      const sources = [this.dict.domainTerms, this.dict.softSkills, this.dict.academicTerms]
      for (const arr of sources) {
        for (const term of arr) {
          if (!term) continue
          const needle = term.toLowerCase()
          if (tokens.includes(needle) || content.includes(term)) kwSet.add(term)
        }
      }

      // 简单评分
      const wordCount = Math.max(1, tokens.length)
      const density = kwSet.size / wordCount
      const actionVerbScore = execSet.size > 0 ? Math.min(1, execSet.size / 3) : 0
      // relevance：根据 docType 粗略加权（示例）
      let relevance = density
      if (opts.docType === 'cv') relevance += actionVerbScore * 0.5
      if (opts.docType === 'ps') relevance += (kwSet.size > 0 ? 0.1 : 0)
      if (opts.docType === 'letter') relevance += (execSet.size > 0 ? 0.1 : 0)

      // PS 分段符标记（用于后续 UI 提示/定位）
      const hasPsSep = opts.docType === 'ps' ? containsPsSeparator(content) : false

      records.push({
        id: `kw_${p.id}`,
        documentId: p.documentId,
        versionId: p.versionId,
        paragraphId: p.id,
        docType: opts.docType,
        language: opts.language,
        keywords: Array.from(kwSet),
        execVerbs: Array.from(execSet),
        scores: {
          density: Number(density.toFixed(4)),
          actionVerbScore: Number(actionVerbScore.toFixed(4)),
          relevance: Number(relevance.toFixed(4))
        },
        contentLength: content.length,
        contentEncoding: 'utf-8',
        timestamp: Date.now()
      })
    }

    return records
  }
}

export interface KeywordSearchResult {
  hits: Array<{
    paragraph: ParagraphRecord
    before?: ParagraphRecord
    after?: ParagraphRecord
    matched: string[]
  }>
}

export function searchParagraphsWithContext(
  paragraphs: ParagraphRecord[],
  query: string,
  opts: { before: number; after: number }
): KeywordSearchResult {
  const q = query.trim()
  if (!q) return { hits: [] }
  const words = q.split(/[\s,，]+/).filter(Boolean)
  const hits: KeywordSearchResult['hits'] = []

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const lower = (p.content || '').toLowerCase()
    const matched = words.filter(w => lower.includes(w.toLowerCase()))
    if (matched.length > 0) {
      const beforeIdx = Math.max(0, i - opts.before)
      const afterIdx = Math.min(paragraphs.length - 1, i + opts.after)
      hits.push({
        paragraph: p,
        before: beforeIdx < i ? paragraphs[beforeIdx] : undefined,
        after: afterIdx > i ? paragraphs[afterIdx] : undefined,
        matched
      })
    }
  }

  return { hits }
}


