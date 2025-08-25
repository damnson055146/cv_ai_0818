// Front-end markdown parser that produces flat ParagraphRecord and SentenceRecord arrays
// aligned with data/ds.ts. MD-level parsing only: headings, paragraphs, lists, code, quotes.

import type {
  ParagraphRecord,
  SentenceRecord,
  ParseResult
} from './ds'

import { FlatStorageManager } from './storage'

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now()}_${rand}`
}

function getByteLengthUtf8(text: string): number {
  try {
    return new TextEncoder().encode(text).length
  } catch {
    // Fallback: rough estimate (not exact for non-ASCII). Simplicity preferred per spec.
    return encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, 'U').length
  }
}

function detectParagraphType(line: string): { type: ParagraphRecord['type']; level: number } {
  const trimmed = line.trim()
  if (/^#{1,6}\s/.test(trimmed)) {
    const level = Math.min(6, (trimmed.match(/^#+/)?.[0].length || 1))
    return { type: 'heading', level }
  }
  if (/^```/.test(trimmed)) {
    return { type: 'code', level: 0 }
  }
  if (/^>\s?/.test(trimmed)) {
    return { type: 'quote', level: 0 }
  }
  if (/^\s*([-*+]\s+|\d+\.[\s\t]+)/.test(line)) {
    return { type: 'list', level: 0 }
  }
  return { type: 'paragraph', level: 0 }
}

function splitIntoLinesWithOffsets(text: string): { lines: string[]; starts: number[]; lens: number[] } {
  const lines = text.split(/\n/)
  const starts: number[] = []
  const lens: number[] = []
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    starts.push(offset)
    const len = lines[i].length + (i < lines.length - 1 ? 1 : 0) // include newline except last
    lens.push(len)
    offset += len
  }
  return { lines, starts, lens }
}

function splitSentences(content: string): Array<{ start: number; end: number }> {
  // Simple sentence splitter for CN/EN punctuation. Keeps punctuation with sentence.
  const result: Array<{ start: number; end: number }> = []
  let start = 0
  const regex = /([.!?。！？])(\s+|$)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const end = match.index + match[1].length
    if (end > start) {
      result.push({ start, end })
      start = match.index + match[0].length
    }
  }
  if (start < content.length) {
    result.push({ start, end: content.length })
  }
  return result
}

export interface ParseMarkdownOptions {
  documentId: string
  versionId: string
  timestamp?: number
}

export class MarkdownFlatParser {
  private storage: FlatStorageManager

  constructor(storage?: FlatStorageManager) {
    this.storage = storage ?? new FlatStorageManager()
  }

  async parseAndStore(markdown: string, options: ParseMarkdownOptions): Promise<{
    paragraphs: ParagraphRecord[]
    sentences: SentenceRecord[]
    parseResult: ParseResult
  }> {
    const { documentId, versionId } = options
    const timestamp = options.timestamp ?? Date.now()

    const { lines, starts, lens } = splitIntoLinesWithOffsets(markdown)

    const paragraphs: ParagraphRecord[] = []
    const sentences: SentenceRecord[] = []

    let i = 0
    let paragraphIndex = 0
    let globalSentenceIndex = 0
    let inCode = false
    let codeStartLine = -1

    const finalizeParagraph = (
      startLine: number,
      endLine: number,
      forcedType?: ParagraphRecord['type'],
      headingLevel: number = 0
    ) => {
      if (startLine < 0 || endLine < startLine) return
      const startAbs = starts[startLine]
      const endAbs = starts[endLine] + lens[endLine]
      const content = markdown.slice(startAbs, endAbs).replace(/\n$/,'')
      const { type } = forcedType
        ? { type: forcedType }
        : detectParagraphType(lines[startLine])

      const para: ParagraphRecord = {
        id: generateId('para'),
        documentId,
        versionId,
        index: paragraphIndex,
        content,
        contentLength: content.length,
        contentEncoding: 'utf-8',
        type,
        level: headingLevel,
        startPosition: startAbs,
        endPosition: endAbs,
        lineNumber: startLine + 1,
        timestamp,
        createdBy: 'parse'
      }
      paragraphs.push(para)

      // produce sentences for paragraph-like types
      if (type === 'paragraph' || type === 'heading' || type === 'quote') {
        const ranges = splitSentences(content)
        for (let s = 0; s < ranges.length; s++) {
          const { start, end } = ranges[s]
          const sentContent = content.slice(start, end)
          const sent: SentenceRecord = {
            id: generateId('sent'),
            documentId,
            versionId,
            paragraphId: para.id,
            index: s,
            globalIndex: globalSentenceIndex++,
            content: sentContent,
            contentLength: sentContent.length,
            contentEncoding: 'utf-8',
            startPosition: startAbs + start,
            endPosition: startAbs + end,
            relativeStartInParagraph: start,
            relativeEndInParagraph: end,
            timestamp,
            createdBy: 'parse'
          }
          sentences.push(sent)
        }
      }

      paragraphIndex++
    }

    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()
      const typeInfo = detectParagraphType(line)

      if (/^```/.test(trimmed)) {
        if (!inCode) {
          inCode = true
          codeStartLine = i
          i++
          continue
        } else {
          // end code block includes the fence line
          finalizeParagraph(codeStartLine, i, 'code')
          inCode = false
          codeStartLine = -1
          i++
          continue
        }
      }

      if (inCode) {
        i++
        continue
      }

      if (trimmed === '') {
        // blank line boundary; skip
        i++
        continue
      }

      if (typeInfo.type === 'heading') {
        finalizeParagraph(i, i, 'heading', typeInfo.level)
        i++
        continue
      }

      if (typeInfo.type === 'list') {
        const startLine = i
        let endLine = i
        i++
        while (i < lines.length && /^\s*([-*+]\s+|\d+\.[\s\t]+)/.test(lines[i])) {
          endLine = i
          i++
        }
        finalizeParagraph(startLine, endLine, 'list')
        continue
      }

      if (typeInfo.type === 'quote') {
        const startLine = i
        let endLine = i
        i++
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          endLine = i
          i++
        }
        finalizeParagraph(startLine, endLine, 'quote')
        continue
      }

      // normal paragraph: gather until blank or special
      const paraStart = i
      let paraEnd = i
      i++
      while (i < lines.length) {
        const t = lines[i].trim()
        if (t === '' || /^```/.test(t) || /^#{1,6}\s/.test(t) || /^>\s?/.test(t) || /^\s*([-*+]\s+|\d+\.[\s\t]+)/.test(lines[i])) {
          break
        }
        paraEnd = i
        i++
      }
      finalizeParagraph(paraStart, paraEnd, 'paragraph')
    }

    const parseResult: ParseResult = {
      id: generateId('parse'),
      documentId,
      versionId,
      parseTimestamp: timestamp,
      sourceContent: markdown,
      sourceContentLength: markdown.length,
      sourceContentEncoding: 'utf-8',
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      totalCharacters: markdown.length,
      parseTimeMs: 0,
      parseSuccess: true,
      parseErrors: [],
      createdParagraphIds: paragraphs.map(p => p.id),
      createdSentenceIds: sentences.map(s => s.id)
    }

    // persist (append-only style using batch appends)
    for (const p of paragraphs) {
      await this.storage.appendParagraphRecord(p)
    }
    for (const s of sentences) {
      await this.storage.appendSentenceRecord(s)
    }
    await this.storage.appendParseResult(parseResult)

    return { paragraphs, sentences, parseResult }
  }
}


