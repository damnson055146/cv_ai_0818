import { defineEventHandler, getQuery, setResponseStatus } from 'h3'

type EditorState = {
  selection: {
    hasSelection: boolean
    start: number
    end: number
    text?: string
    startLine?: number
    startColumn?: number
    endLine?: number
    endColumn?: number
  }
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

  const q = getQuery(event)
  const clientId = typeof q.clientId === 'string' ? q.clientId : ''
  if (!clientId) {
    setResponseStatus(event, 400)
    return { error: 'clientId is required' }
  }
  const st = states.get(clientId)
  if (!st) return { ok: true, selection: { hasSelection: false, start: 0, end: 0, text: '' }, doc: '' }
  return { ok: true, selection: st.selection, doc: st.doc, updatedAt: st.updatedAt }
})

