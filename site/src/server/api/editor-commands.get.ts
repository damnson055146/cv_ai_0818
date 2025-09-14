import { defineEventHandler, getQuery, setResponseStatus } from 'h3'

type EditorCommand =
  | { type: 'replace'; target: 'selection' | 'document'; text: string }
  | { type: 'smart_edit'; target: 'selection' | 'document'; prompt: string }

type QueueMap = Map<string, EditorCommand[]>

const queues: QueueMap = (globalThis as any).__editorCommandQueues__ || new Map()
;(globalThis as any).__editorCommandQueues__ = queues

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

  const list = queues.get(clientId) || []
  // pop-all semantics
  queues.set(clientId, [])

  return { ok: true, commands: list }
})


