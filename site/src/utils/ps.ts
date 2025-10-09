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

const isQuotaError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const name = (error as any).name
  const code = (error as any).code
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22
}

const prunePsStorage = () => {
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
  try {
    const raw = localStorage.getItem(META_PREFIX + id)
    return raw ? (JSON.parse(raw) as PsDocMeta) : null
  } catch {
    return null
  }
}

export function setPsMeta(id: string, meta: PsDocMeta): void {
  safeSetItem(META_PREFIX + id, JSON.stringify(meta))
}

export function setPsMetaForPair(params: { outlineId: string; bodyId: string; chatId: string; initialOutlineHash?: string }): void {
  const { outlineId, bodyId, chatId, initialOutlineHash } = params
  const outlineMeta: PsDocMeta = { docType: 'ps', sub: 'outline', chatId, siblingId: bodyId, baselineOutlineHash: initialOutlineHash }
  const bodyMeta: PsDocMeta = { docType: 'ps', sub: 'body', chatId, siblingId: outlineId, baselineOutlineHash: initialOutlineHash }
  setPsMeta(outlineId, outlineMeta)
  setPsMeta(bodyId, bodyMeta)
}

export function markOutlineComplete(chatId: string, complete = true): void {
  safeSetItem(OUTLINE_STATUS_PREFIX + chatId, complete ? '1' : '0')
}

export function isOutlineComplete(chatId: string): boolean {
  return localStorage.getItem(OUTLINE_STATUS_PREFIX + chatId) === '1'
}

export function updateBaselineForBody(bodyId: string, outlineHash: string): void {
  const meta = getPsMeta(bodyId)
  if (!meta) return
  meta.baselineOutlineHash = outlineHash
  setPsMeta(bodyId, meta)
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
