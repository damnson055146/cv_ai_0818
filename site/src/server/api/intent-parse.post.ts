import { defineEventHandler, readBody } from 'h3'

// Mock-only implementation to ensure a single default export and JSON response
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const template = body?.template as string | undefined
    let intentType: 'modify' | 'insert' | 'delete' | 'translate' | 'format' = 'modify'
    if (template === 'translate') intentType = 'translate'
    else if (template === 'format') intentType = 'format'
    return {
      status: 'ok',
      intent: {
        intentType,
        targetType: 'paragraph',
        sectionTag: body?.context?.sectionTag,
        operations: [],
        confidence: 0.9
      }
    }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'intent-parse failed' }
  }
})
