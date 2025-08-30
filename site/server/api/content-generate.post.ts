// Mock Content Generate API - returns JSON always
import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const previousContent: string = body?.previousContent || ''
    const userInput: string = body?.userInput || ''

    let ops: Array<{ action: 'replace'|'insert'|'delete'; oldText?: string; newText?: string }> = []
    // simple heuristic: replace Optimized -> Improved when user asks to improve
    if (/optimized/i.test(previousContent) && /improv/i.test(userInput)) {
      ops.push({ action: 'replace', oldText: 'Optimized', newText: 'Improved' })
    }

    return { status: 'ok', operations: ops }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'content-generate failed' }
  }
}
)
