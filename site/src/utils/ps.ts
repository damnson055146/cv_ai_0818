export type PsDocSubtype = 'outline' | 'body'

export interface PsDocMeta {
  docType: 'ps'
  sub: PsDocSubtype
  chatId: string
  siblingId: string
  baselineOutlineHash?: string
}

const META_PREFIX = 'ps_doc_meta_'
const OUTLINE_STATUS_PREFIX = 'ps_outline_status_'
const PS_PREFIXES = [META_PREFIX, OUTLINE_STATUS_PREFIX]
const DOC_META_PREFIX = 'doc_meta_'
const DOC_META_MEMORY_KEY = '__psDocMetaMemory__'
const PS_MEMORY_KEY = '__psMetaMemory__'

const getGlobal = () => (typeof window !== 'undefined' ? window : globalThis) as any

const getDocMetaMemory = () => {
  const globalObj = getGlobal()
  if (!globalObj[DOC_META_MEMORY_KEY]) globalObj[DOC_META_MEMORY_KEY] = new Map<string, any>()
  return globalObj[DOC_META_MEMORY_KEY] as Map<string, any>
}

const getPsMemory = () => {
  const globalObj = getGlobal()
  if (!globalObj[PS_MEMORY_KEY]) {
    globalObj[PS_MEMORY_KEY] = {
      psMeta: new Map<string, PsDocMeta>(),
      outlineStatus: new Map<string, boolean>()
    }
  }
  return globalObj[PS_MEMORY_KEY] as { psMeta: Map<string, PsDocMeta>; outlineStatus: Map<string, boolean> }
}

const hasStorage = () => typeof localStorage !== 'undefined'

const isQuotaError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const name = (error as any).name
  const code = (error as any).code
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22
}

const prunePsStorage = () => {
  if (!hasStorage()) return
  try {
    const removeKeys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      if (PS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        removeKeys.push(key)
      }
    }
    // Remove oldest keys first
    for (const key of removeKeys) {
      localStorage.removeItem(key)
    }
  } catch {}
}

const safeSetItem = (key: string, value: string) => {
  if (!hasStorage()) return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (isQuotaError(error)) {
      prunePsStorage()
      try {
        localStorage.setItem(key, value)
        return true
      } catch (err) {
        if (!isQuotaError(err)) throw err
        console.warn('[PS Storage] quota exceeded even after pruning', err)
      }
    } else {
      throw error
    }
  }
  return false
}

export function getPsMeta(id: string): PsDocMeta | null {
  const memory = getPsMemory()
  const fallback = memory.psMeta.get(id)
  if (!hasStorage()) return fallback || null
  try {
    const raw = localStorage.getItem(META_PREFIX + id)
    if (raw) {
      const parsed = JSON.parse(raw) as PsDocMeta
      memory.psMeta.set(id, parsed)
      return parsed
    }
  } catch {}
  if (fallback) return fallback
  return recoverPsMeta(id)
}

export function setPsMeta(id: string, meta: PsDocMeta): void {
  const memory = getPsMemory()
  memory.psMeta.set(id, meta)
  let stored = false
  if (hasStorage()) {
    stored = safeSetItem(META_PREFIX + id, JSON.stringify(meta))
  }
  if (!stored) memory.psMeta.set(id, meta)
  notifyPsMetaUpdate(id, meta)
}

export function setPsMetaForPair(params: { outlineId: string; bodyId: string; chatId: string; initialOutlineHash?: string }): void {
  const { outlineId, bodyId, chatId, initialOutlineHash } = params
  const outlineMeta: PsDocMeta = { docType: 'ps', sub: 'outline', chatId, siblingId: bodyId, baselineOutlineHash: initialOutlineHash }
  const bodyMeta: PsDocMeta = { docType: 'ps', sub: 'body', chatId, siblingId: outlineId, baselineOutlineHash: initialOutlineHash }
  setPsMeta(outlineId, outlineMeta)
  setPsMeta(bodyId, bodyMeta)
}

export function markOutlineComplete(chatId: string, complete = true): void {
  const memory = getPsMemory()
  memory.outlineStatus.set(chatId, complete)
  if (!hasStorage()) return
  safeSetItem(OUTLINE_STATUS_PREFIX + chatId, complete ? '1' : '0')
}

export function isOutlineComplete(chatId: string): boolean {
  const memory = getPsMemory()
  const fallback = memory.outlineStatus.get(chatId)
  if (!hasStorage()) return !!fallback
  try {
    return localStorage.getItem(OUTLINE_STATUS_PREFIX + chatId) === '1'
  } catch {
    return !!fallback
  }
}

export function updateBaselineForBody(bodyId: string, outlineHash: string): void {
  const meta = getPsMeta(bodyId)
  if (!meta) return
  meta.baselineOutlineHash = outlineHash
  setPsMeta(bodyId, meta)
}

function recoverPsMeta(id: string): PsDocMeta | null {
  const memory = getPsMemory()
  const inMemory = memory.psMeta.get(id)
  if (inMemory) return inMemory
  if (!hasStorage()) return null
  try {
    const targetKey = META_PREFIX + id
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || key === targetKey || !key.startsWith(META_PREFIX)) continue
      let candidate: PsDocMeta | null = null
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        candidate = JSON.parse(raw) as PsDocMeta
      } catch {
        continue
      }
      if (!candidate || candidate.docType !== 'ps') continue
      if (candidate.siblingId !== id || !candidate.chatId) continue
      const siblingId = key.slice(META_PREFIX.length)
      const fallbackSub: PsDocSubtype = candidate.sub === 'outline' ? 'body' : 'outline'
      const fallbackMeta: PsDocMeta = {
        docType: 'ps',
        sub: fallbackSub,
        chatId: candidate.chatId,
        siblingId
      }
      if (candidate.baselineOutlineHash) fallbackMeta.baselineOutlineHash = candidate.baselineOutlineHash
      setPsMeta(id, fallbackMeta)
      return fallbackMeta
    }
  } catch {}
  return null
}

function notifyPsMetaUpdate(id: string, meta: PsDocMeta): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ps-meta-updated', { detail: { id, meta } }))
    }
  } catch {}
}

const generateChatId = () => `chat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export async function ensurePsMetaForDoc(docId: string): Promise<PsDocMeta | null> {
  const existing = getPsMeta(docId)
  if (existing) return existing

  const docMetaMemory = getDocMetaMemory()
  let docMeta: { docType?: string; lang?: string; chatId?: string; sub?: PsDocSubtype; siblingId?: string } | null = docMetaMemory.get(docId) || null
  if (hasStorage() && !docMeta) {
    try {
      const raw = localStorage.getItem(DOC_META_PREFIX + docId)
      docMeta = raw ? JSON.parse(raw) : null
      if (docMeta) docMetaMemory.set(docId, docMeta)
    } catch {}
  }
  if (!docMeta || docMeta.docType !== 'ps') return null

  const memory = getPsMemory()
  for (const [otherId, candidate] of memory.psMeta.entries()) {
    if (!candidate || candidate.docType !== 'ps') continue
    if (candidate.siblingId === docId) {
      const inferred: PsDocMeta = {
        docType: 'ps',
        sub: candidate.sub === 'outline' ? 'body' : 'outline',
        chatId: candidate.chatId,
        siblingId: otherId,
        baselineOutlineHash: candidate.baselineOutlineHash
      }
      setPsMeta(docId, inferred)
      return inferred
    }
  }

  if (hasStorage()) {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(META_PREFIX)) continue
        const otherId = key.slice(META_PREFIX.length)
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const candidate = JSON.parse(raw) as PsDocMeta
        if (!candidate || candidate.docType !== 'ps') continue
        memory.psMeta.set(otherId, candidate)
        if (candidate.siblingId === docId) {
          const inferred: PsDocMeta = {
            docType: 'ps',
            sub: candidate.sub === 'outline' ? 'body' : 'outline',
            chatId: candidate.chatId,
            siblingId: otherId,
            baselineOutlineHash: candidate.baselineOutlineHash
          }
          setPsMeta(docId, inferred)
          return inferred
        }
      }
    } catch {}
  }

  const psDocIds: string[] = []
  docMetaMemory.forEach((info, id) => {
    if (info?.docType === 'ps') psDocIds.push(id)
  })
  if (hasStorage()) {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(DOC_META_PREFIX)) continue
        const otherId = key.slice(DOC_META_PREFIX.length)
        let info: { docType?: string } | null = null
        try {
          const raw = localStorage.getItem(key)
          info = raw ? JSON.parse(raw) : null
          if (info) docMetaMemory.set(otherId, info)
        } catch {}
        if (info?.docType === 'ps') psDocIds.push(otherId)
      }
    } catch {}
  }

  if (!psDocIds.includes(docId)) psDocIds.push(docId)
  const uniqueIds = Array.from(new Set(psDocIds))
  if (uniqueIds.length < 2) return null

  let storage: Record<string, any> | null = null
  try {
    const { getStorage } = await import('~/utils/database')
    storage = await getStorage()
  } catch {}

  const detectSubtype = (id: string): PsDocSubtype | null => {
    const item = storage ? storage[id] : null
    const name = (item?.name || '').toLowerCase()
    const markdown = (item?.markdown || '').toLowerCase()
    if (name.includes('outline') || name.includes('大纲')) return 'outline'
    if (name.includes('body') || name.includes('正文')) return 'body'
    if (/##\s*1/.test(markdown) || markdown.includes('## 1')) return 'outline'
    if (markdown.includes('dear') || markdown.includes('尊敬') || markdown.includes('亲爱的')) return 'body'
    return null
  }

  let outlineId = docId
  let bodyId = uniqueIds.find((id) => id !== docId) || docId
  const currentRole = detectSubtype(docId)
  const otherCandidates = uniqueIds.filter((id) => id !== docId)

  for (const candidate of otherCandidates) {
    const role = detectSubtype(candidate)
    if (role === 'outline') outlineId = candidate
    if (role === 'body') bodyId = candidate
  }

  if (currentRole === 'outline') outlineId = docId
  if (currentRole === 'body') bodyId = docId

  if (outlineId === bodyId && otherCandidates.length > 0) bodyId = otherCandidates[0]
  if (!outlineId || !bodyId || outlineId === bodyId) return null

  let outlineHash: string | undefined
  try {
    const outlineItem = storage ? storage[outlineId] : null
    if (outlineItem?.markdown) outlineHash = simpleHash(outlineItem.markdown)
  } catch {}

  const chatId = docMeta.chatId || generateChatId()
  setPsMetaForPair({ outlineId, bodyId, chatId, initialOutlineHash: outlineHash })
  const stored = getPsMeta(docId)
  if (stored) return stored
  return docId === outlineId
    ? { docType: 'ps', sub: 'outline', chatId, siblingId: bodyId, baselineOutlineHash: outlineHash }
    : { docType: 'ps', sub: 'body', chatId, siblingId: outlineId, baselineOutlineHash: outlineHash }
}

export function simpleHash(text: string): string {
  // Non-crypto quick hash sufficient for change detection
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i)
    h |= 0
  }
  return String(h >>> 0)
}
