import { defineEventHandler, readBody, setResponseStatus } from 'h3'

/**
 * Minimal JSON-RPC endpoint to expose editor tools for MCP-style clients.
 * Tools are executed by enqueueing commands into /api/editor-commands.
 */

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: any
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: string | number | null
  result?: any
  error?: { code: number; message: string; data?: any }
}

function makeError(id: any, code: number, message: string, data?: any): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } }
}

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event) as any
  const tokenRequired = !!cfg.mcpQueueToken
  const clientToken = event.node.req.headers['x-mcp-token'] as string | undefined
  if (tokenRequired && clientToken !== cfg.mcpQueueToken) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  const body = (await readBody(event)) as JsonRpcRequest | JsonRpcRequest[]
  const handleOne = async (req: JsonRpcRequest): Promise<JsonRpcResponse> => {
    try {
      if (!req || req.jsonrpc !== '2.0') return makeError(req?.id, -32600, 'Invalid Request')
      const id = req.id ?? null
      const method = req.method
      const params = req.params || {}

      if (method === 'tools/list' || method === 'mcp.tools.list') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'apply_replace',
                description: 'Replace selection or whole document with given text',
                input_schema: {
                  type: 'object',
                  properties: {
                    clientId: { type: 'string' },
                    target: { type: 'string', enum: ['selection', 'document'] },
                    text: { type: 'string' }
                  },
                  required: ['clientId', 'target', 'text']
                }
              },
              {
                name: 'read_selection',
                description: 'Read current editor selection text and range for a client',
                input_schema: {
                  type: 'object',
                  properties: {
                    clientId: { type: 'string' }
                  },
                  required: ['clientId']
                }
              },
              {
                name: 'read_document',
                description: 'Read full document or a character range (start/end) for a client',
                input_schema: {
                  type: 'object',
                  properties: {
                    clientId: { type: 'string' },
                    start: { type: 'number' },
                    end: { type: 'number' }
                  },
                  required: ['clientId']
                }
              },
              {
                name: 'select_range',
                description: 'Set current selection by character offsets [start,end)',
                input_schema: {
                  type: 'object',
                  properties: {
                    clientId: { type: 'string' },
                    start: { type: 'number' },
                    end: { type: 'number' }
                  },
                  required: ['clientId', 'start', 'end']
                }
              },
              {
                name: 'replace_range',
                description: 'Replace text in [start,end) with provided text',
                input_schema: {
                  type: 'object',
                  properties: {
                    clientId: { type: 'string' },
                    start: { type: 'number' },
                    end: { type: 'number' },
                    text: { type: 'string' }
                  },
                  required: ['clientId', 'start', 'end', 'text']
                }
              },
              {
                name: 'smart_edit',
                description: 'Run smart edit via LLM and apply to selection or document',
                input_schema: {
                  type: 'object',
                  properties: {
                    clientId: { type: 'string' },
                    target: { type: 'string', enum: ['selection', 'document'] },
                    prompt: { type: 'string' }
                  },
                  required: ['clientId', 'target', 'prompt']
                }
              },
              {
                name: 'queue_status',
                description: 'Return queued command count for the client',
                input_schema: {
                  type: 'object',
                  properties: { clientId: { type: 'string' } },
                  required: ['clientId']
                }
              },
              { name: 'ping', description: 'Health check', input_schema: { type: 'object', properties: {} } }
            ]
          }
        }
      }

      if (method === 'tools/call' || method === 'mcp.tools.call') {
        const name = params?.name as string
        const args = params?.arguments || {}
        if (name === 'ping') return { jsonrpc: '2.0', id, result: { ok: true } }
        if (!args?.clientId) return makeError(id, -32602, 'clientId is required')

        if (name === 'apply_replace') {
          const payload = {
            clientId: String(args.clientId),
            command: { type: 'replace', target: args.target === 'document' ? 'document' : 'selection', text: String(args.text || '') }
          }
          const res = await $fetch('/api/editor-commands', {
            method: 'POST',
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined),
            body: payload
          })
          return { jsonrpc: '2.0', id, result: { queued: res?.queued ?? 0 } }
        }

        if (name === 'read_selection') {
          const url = `/api/editor-state?clientId=${encodeURIComponent(String(args.clientId))}`
          const res: any = await $fetch(url, { headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined) })
          const sel = res?.selection || {}
          return { jsonrpc: '2.0', id, result: { hasSelection: !!sel?.hasSelection, text: sel?.text || '', start: sel?.start ?? 0, end: sel?.end ?? 0, startLine: sel?.startLine ?? null, startColumn: sel?.startColumn ?? null, endLine: sel?.endLine ?? null, endColumn: sel?.endColumn ?? null } }
        }

        if (name === 'read_document') {
          const url = `/api/editor-state?clientId=${encodeURIComponent(String(args.clientId))}`
          const res: any = await $fetch(url, { headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined) })
          const doc: string = typeof res?.doc === 'string' ? res.doc : ''
          let content = doc
          const start = typeof args.start === 'number' ? Math.max(0, Math.floor(args.start)) : undefined
          const end = typeof args.end === 'number' ? Math.max(0, Math.floor(args.end)) : undefined
          if (start !== undefined || end !== undefined) {
            const s = start ?? 0
            const e = end !== undefined ? end : doc.length
            content = doc.slice(Math.max(0, Math.min(s, doc.length)), Math.max(0, Math.min(e, doc.length)))
          }
          return { jsonrpc: '2.0', id, result: { length: doc.length, content } }
        }

        if (name === 'select_range') {
          const payload = {
            clientId: String(args.clientId),
            command: { type: 'select', range: { start: Number(args.start), end: Number(args.end) } }
          }
          const res = await $fetch('/api/editor-commands', {
            method: 'POST',
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined),
            body: payload
          })
          return { jsonrpc: '2.0', id, result: { queued: res?.queued ?? 0 } }
        }

        if (name === 'replace_range') {
          // enqueue select then replace selection with text
          const clientId = String(args.clientId)
          const start = Number(args.start)
          const end = Number(args.end)
          const text = String(args.text || '')
          await $fetch('/api/editor-commands', {
            method: 'POST',
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined),
            body: { clientId, command: { type: 'select', range: { start, end } } }
          })
          const res = await $fetch('/api/editor-commands', {
            method: 'POST',
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined),
            body: { clientId, command: { type: 'replace', target: 'selection', text } }
          })
          return { jsonrpc: '2.0', id, result: { queued: res?.queued ?? 0 } }
        }

        if (name === 'smart_edit') {
          const payload = {
            clientId: String(args.clientId),
            command: { type: 'smart_edit', target: args.target === 'document' ? 'document' : 'selection', prompt: String(args.prompt || '') }
          }
          const res = await $fetch('/api/editor-commands', {
            method: 'POST',
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined),
            body: payload
          })
          return { jsonrpc: '2.0', id, result: { queued: res?.queued ?? 0 } }
        }

        if (name === 'queue_status') {
          // Not keeping queue length per client without consuming; just return ok
          return { jsonrpc: '2.0', id, result: { ok: true } }
        }

        return makeError(id, -32601, `Unknown tool: ${name}`)
      }

      return makeError(req.id, -32601, 'Method not found')
    } catch (e: any) {
      return makeError(req?.id, -32000, 'Server error', { message: e?.message || String(e) })
    }
  }

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(handleOne))
    return results
  } else {
    return await handleOne(body)
  }
})


