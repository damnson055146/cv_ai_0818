MCP Integration for Editor Operations

This document describes the MCP-style endpoints and how to control the editor area via server tools.

Endpoints

- POST `/api/mcp`
  - JSON-RPC 2.0
  - `tools/list` – lists available tools
  - `tools/call` – executes a tool (enqueues an editor command)
  - Auth: optional header `x-mcp-token` (controlled by `MCP_QUEUE_TOKEN`)

- POST `/api/editor-commands`
  - Body: `{ clientId: string, command: { type: 'replace'|'smart_edit', target: 'selection'|'document', text?: string, prompt?: string } }`
  - Auth: optional header `x-mcp-token`

- GET `/api/editor-commands?clientId=...`
  - Returns and clears queued commands for the client.

Client Polling

`Editor.vue` polls `/api/editor-commands` every 2s and applies commands to Monaco editor.

Tools

- apply_replace
  - args: `{ clientId, target: 'selection'|'document', text }`
- smart_edit
  - args: `{ clientId, target: 'selection'|'document', prompt }`

Config

Set env var `MCP_QUEUE_TOKEN` to enable header auth. The token is exposed to client as `public.mcp.queueToken` for polling.


