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

export function getPsMeta(id: string): PsDocMeta | null {
  try {
    const raw = localStorage.getItem(META_PREFIX + id)
    return raw ? (JSON.parse(raw) as PsDocMeta) : null
  } catch {
    return null
  }
}

export function setPsMeta(id: string, meta: PsDocMeta): void {
  localStorage.setItem(META_PREFIX + id, JSON.stringify(meta))
}

export function setPsMetaForPair(params: { outlineId: string; bodyId: string; chatId: string; initialOutlineHash?: string }): void {
  const { outlineId, bodyId, chatId, initialOutlineHash } = params
  const outlineMeta: PsDocMeta = { docType: 'ps', sub: 'outline', chatId, siblingId: bodyId, baselineOutlineHash: initialOutlineHash }
  const bodyMeta: PsDocMeta = { docType: 'ps', sub: 'body', chatId, siblingId: outlineId, baselineOutlineHash: initialOutlineHash }
  setPsMeta(outlineId, outlineMeta)
  setPsMeta(bodyId, bodyMeta)
}

export function markOutlineComplete(chatId: string, complete = true): void {
  localStorage.setItem(OUTLINE_STATUS_PREFIX + chatId, complete ? '1' : '0')
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


