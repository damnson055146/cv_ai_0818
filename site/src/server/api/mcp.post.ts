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
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined, (event.node.req.headers['x-chatbot-mode'] ? { 'x-chatbot-mode': String(event.node.req.headers['x-chatbot-mode']) } : {})),
            body: payload
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
            headers: Object.assign({}, clientToken ? { 'x-mcp-token': clientToken } : undefined, (event.node.req.headers['x-chatbot-mode'] ? { 'x-chatbot-mode': String(event.node.req.headers['x-chatbot-mode']) } : {})),
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


