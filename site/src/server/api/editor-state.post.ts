import { defineEventHandler, readBody, setResponseStatus } from 'h3'

type SelectionState = {
  hasSelection: boolean
  start: number
  end: number
  text?: string
  startLine?: number
  startColumn?: number
  endLine?: number
  endColumn?: number
}

type EditorState = {
  selection: SelectionState
  doc: string
  updatedAt: number
}

type StateMap = Map<string, EditorState>

const states: StateMap = (globalThis as any).__editorStates__ || new Map()
;(globalThis as any).__editorStates__ = states

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event) as any
  const tokenRequired = !!cfg.mcpQueueToken
  const clientToken = event.node.req.headers['x-mcp-token'] as string | undefined

  if (tokenRequired && clientToken !== cfg.mcpQueueToken) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  const body = await readBody<any>(event)
  const clientId = String(body?.clientId || '')
  if (!clientId) {
    setResponseStatus(event, 400)
    return { error: 'clientId is required' }
  }

  const partialSel = body?.selection || {}
  const selection: SelectionState = {
    hasSelection: !!partialSel?.hasSelection,
    start: typeof partialSel?.start === 'number' ? Math.max(0, Math.floor(partialSel.start)) : 0,
    end: typeof partialSel?.end === 'number' ? Math.max(0, Math.floor(partialSel.end)) : 0,
    text: typeof partialSel?.text === 'string' ? partialSel.text : undefined,
    startLine: typeof partialSel?.startLine === 'number' ? Math.max(1, Math.floor(partialSel.startLine)) : undefined,
    startColumn: typeof partialSel?.startColumn === 'number' ? Math.max(1, Math.floor(partialSel.startColumn)) : undefined,
    endLine: typeof partialSel?.endLine === 'number' ? Math.max(1, Math.floor(partialSel.endLine)) : undefined,
    endColumn: typeof partialSel?.endColumn === 'number' ? Math.max(1, Math.floor(partialSel.endColumn)) : undefined
  }

  const doc = typeof body?.doc === 'string' ? body.doc : undefined
  const prev = states.get(clientId)
  const next: EditorState = {
    selection,
    doc: doc !== undefined ? doc : (prev?.doc || ''),
    updatedAt: Date.now()
  }
  states.set(clientId, next)
  return { ok: true }
})

