import { defineEventHandler, readBody } from 'h3'

/**
 * Server-side HTML -> DOCX conversion to avoid browser polyfill issues.
 * Returns a JSON with base64 docx content.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ html?: string, options?: any, filename?: string }>(event)
    const html = String(body?.html || '')
    if (!html.trim()) {
      return { ok: false, error: 'empty_html' }
    }

    const toDocxMod: any = await import('html-to-docx')
    const toDocx: any = (toDocxMod as any).default || toDocxMod

    const blob: any = await toDocx(html, body?.options || { table: { row: { cantSplit: true } }, footer: true, pageNumber: true })

    // Normalize to Buffer and base64
    const arrayBuffer = typeof blob?.arrayBuffer === 'function' ? await blob.arrayBuffer() : (blob?.buffer ? blob.buffer : blob)
    const buffer: Buffer = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    return { ok: true, base64 }
  } catch (error: any) {
    console.error('[api/html-to-docx] failed:', error)
    return { ok: false, error: error?.message || 'html-to-docx failed' }
  }
})


