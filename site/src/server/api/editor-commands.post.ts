import { defineEventHandler, readBody, setResponseStatus } from 'h3'

interface EditorCommandBase {
  type: 'replace' | 'smart_edit' | 'select'
}

interface ReplaceCommand extends EditorCommandBase {
  type: 'replace'
  target: 'selection' | 'document'
  text: string
}

interface SmartEditCommand extends EditorCommandBase {
  type: 'smart_edit'
  target: 'selection' | 'document'
  prompt: string
}

interface SelectCommand extends EditorCommandBase {
  type: 'select'
  range: { start: number; end: number }
}

type EditorCommand = ReplaceCommand | SmartEditCommand | SelectCommand

type QueueMap = Map<string, EditorCommand[]>

// In-memory command queues per clientId (server lifecycle scoped)
const queues: QueueMap = (globalThis as any).__editorCommandQueues__ || new Map()
;(globalThis as any).__editorCommandQueues__ = queues

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event) as any
  const tokenRequired = !!cfg.mcpQueueToken
  const clientToken = event.node.req.headers['x-mcp-token'] as string | undefined

  // Guard: reject enqueue of edit commands when client declares chat/ask mode
  try {
    const strict = !!cfg?.public?.chatbot?.strictAskNoEdit
    const modeHeader = (event.node.req.headers['x-chatbot-mode'] || '').toString().toLowerCase().trim()
    if (strict && modeHeader === 'ask') {
      setResponseStatus(event, 409)
      return { error: 'Chat mode forbids editor commands' }
    }
  } catch {}

  if (tokenRequired && clientToken !== cfg.mcpQueueToken) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  const body = await readBody<any>(event)
  const clientId: string | undefined = body?.clientId
  const command: EditorCommand | undefined = body?.command

  if (!clientId || !command) {
    setResponseStatus(event, 400)
    return { error: 'clientId and command are required' }
  }

  // Basic validation
  if (command.type === 'replace' && typeof (command as any).text !== 'string') {
    setResponseStatus(event, 400)
    return { error: 'replace command requires text' }
  }
  if (command.type === 'smart_edit' && typeof (command as any).prompt !== 'string') {
    setResponseStatus(event, 400)
    return { error: 'smart_edit command requires prompt' }
  }
  if (command.type === 'select') {
    const r = (command as any).range
    if (!r || typeof r.start !== 'number' || typeof r.end !== 'number') {
      setResponseStatus(event, 400)
      return { error: 'select command requires range {start,end}' }
    }
  }

  const list = queues.get(clientId) || []
  list.push(command)
  queues.set(clientId, list)

  return { ok: true, queued: list.length }
})


