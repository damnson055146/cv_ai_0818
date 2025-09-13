// Minimal viable context stores for local-only memory
// - Per-document conversation memory (append-only)
// - Cross-document rules (global + by docType/language)

export type ChatRole = 'user' | 'assistant'

export interface ConversationMessageRecord {
  id: string
  documentId: string
  role: ChatRole
  content: string
  timestamp: number
}

function now(): number { return Date.now() }

const ls = {
  read<T>(key: string): T | null {
    try {
      if (typeof localStorage === 'undefined') return null as any
      const s = localStorage.getItem(key)
      if (!s) return null as any
      return JSON.parse(s) as T
    } catch {
      return null as any
    }
  },
  write<T>(key: string, value: T): void {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },
  append<T>(key: string, item: T): void {
    try {
      const arr = (ls.read<T[]>(key) || []) as T[]
      arr.push(item)
      ls.write(key, arr)
    } catch {}
  }
}

// Keys
const K = {
  convo: (docId: string) => `cv_conv_${docId}`,
  rulesGlobal: 'cv_rules_global',
  rulesByType: (docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp') => `cv_rules_${docType}_${language}`
}

export const convStore = {
  appendMessage(documentId: string, role: ChatRole, content: string): ConversationMessageRecord | null {
    if (!documentId) return null
    const rec: ConversationMessageRecord = {
      id: `conv_${documentId}_${now()}_${Math.random().toString(36).slice(2,8)}`,
      documentId,
      role,
      content,
      timestamp: now()
    }
    ls.append(K.convo(documentId), rec)
    // limit history length (~200 messages)
    const list = (ls.read<ConversationMessageRecord[]>(K.convo(documentId)) || [])
    const excess = list.length - 200
    if (excess > 0) {
      for (let i = 0; i < excess; i++) list.shift()
      ls.write(K.convo(documentId), list)
    }
    return rec
  },
  loadMessages(documentId: string, limit = 30): ConversationMessageRecord[] {
    const list = (ls.read<ConversationMessageRecord[]>(K.convo(documentId)) || [])
    if (limit <= 0) return list
    const start = Math.max(0, list.length - limit)
    const result: ConversationMessageRecord[] = []
    for (let i = start; i < list.length; i++) result.push(list[i])
    return result
  },
  clear(documentId: string): void {
    ls.write(K.convo(documentId), [])
  }
}

export const lmemStore = {
  setGlobalRules(text: string): void {
    ls.write(K.rulesGlobal, { text, updatedAt: now() })
  },
  getGlobalRules(): string {
    const v = ls.read<{ text: string; updatedAt: number } | null>(K.rulesGlobal)
    return v?.text || ''
  },
  setDocTypeRules(docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp', text: string): void {
    ls.write(K.rulesByType(docType, language), { text, updatedAt: now() })
  },
  getDocTypeRules(docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp'): string {
    const v = ls.read<{ text: string; updatedAt: number } | null>(K.rulesByType(docType, language))
    return v?.text || ''
  },
  getMergedRules(docType: 'cv' | 'letter' | 'ps', language: 'zh-cn' | 'en' | 'sp'): string {
    const g = lmemStore.getGlobalRules()
    const d = lmemStore.getDocTypeRules(docType, language)
    const parts: string[] = []
    if (g.trim()) parts.push(g.trim())
    if (d.trim()) parts.push(d.trim())
    return parts.join('\n')
  }
}


