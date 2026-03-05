#!/usr/bin/env node
/**
 * Laputa MCP Server — lightweight vault tools for AI agents.
 *
 * The agent has full shell access (bash, read, write, edit).
 * These MCP tools provide Laputa-specific capabilities that
 * native tools cannot replace:
 *
 *   - search_notes: full-text search across vault notes
 *   - get_vault_context: vault structure overview (types, note count, folders)
 *   - get_note: parsed frontmatter + content (convenience over raw cat)
 *   - open_note: signal Laputa UI to open a note as a tab
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import WebSocket from 'ws'
import { searchNotes, getNote, vaultContext } from './vault.js'

const VAULT_PATH = process.env.VAULT_PATH || process.env.HOME + '/Laputa'
const WS_UI_PORT = parseInt(process.env.WS_UI_PORT || '9711', 10)
const WS_UI_URL = `ws://localhost:${WS_UI_PORT}`

// Connect as a WebSocket CLIENT to the UI bridge (run by ws-bridge.js).
// The bridge relays messages to all other clients (the React frontend).
let uiSocket = null
const RECONNECT_INTERVAL_MS = 3000

function connectUiBridge() {
  try {
    const ws = new WebSocket(WS_UI_URL)
    ws.on('open', () => {
      uiSocket = ws
      console.error(`[mcp] Connected to UI bridge at ${WS_UI_URL}`)
    })
    ws.on('close', () => {
      uiSocket = null
      setTimeout(connectUiBridge, RECONNECT_INTERVAL_MS)
    })
    ws.on('error', () => {
      // Silent — bridge may not be running yet, will retry
    })
  } catch {
    setTimeout(connectUiBridge, RECONNECT_INTERVAL_MS)
  }
}
connectUiBridge()

function broadcastUiAction(action, payload) {
  if (!uiSocket || uiSocket.readyState !== WebSocket.OPEN) return
  uiSocket.send(JSON.stringify({ type: 'ui_action', action, ...payload }))
}

const TOOLS = [
  {
    name: 'search_notes',
    description: 'Full-text search across vault notes by title or content. Returns matching paths, titles, and snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_vault_context',
    description: 'Get vault orientation: entity types, total note count, top-level folders, and 20 most recently modified notes.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_note',
    description: 'Read a note with parsed YAML frontmatter and markdown content. Returns {path, frontmatter, content}.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note (e.g. "project/my-project.md")' },
      },
      required: ['path'],
    },
  },
  {
    name: 'open_note',
    description: 'Open a note in the Laputa UI as a new tab. Use after creating or editing a note so the user can see it.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
      },
      required: ['path'],
    },
  },
]

const TOOL_HANDLERS = {
  search_notes: handleSearchNotes,
  get_vault_context: handleVaultContext,
  get_note: handleGetNote,
  open_note: handleOpenNote,
}

async function handleSearchNotes(args) {
  const results = await searchNotes(VAULT_PATH, args.query, args.limit)
  const text = results.length === 0
    ? 'No matching notes found.'
    : results.map(r => `**${r.title}** (${r.path})\n${r.snippet}`).join('\n\n')
  return { content: [{ type: 'text', text }] }
}

async function handleVaultContext() {
  const ctx = await vaultContext(VAULT_PATH)
  return { content: [{ type: 'text', text: JSON.stringify(ctx, null, 2) }] }
}

async function handleGetNote(args) {
  const note = await getNote(VAULT_PATH, args.path)
  return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] }
}

function handleOpenNote(args) {
  broadcastUiAction('open_tab', { path: args.path })
  return { content: [{ type: 'text', text: `Opening ${args.path} in Laputa` }] }
}

// --- Server setup ---

const server = new Server(
  { name: 'laputa-mcp-server', version: '0.2.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const handler = TOOL_HANDLERS[name]
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`)
  }
  try {
    return await handler(args)
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`Laputa MCP server running (vault: ${VAULT_PATH})`)
}

main().catch(console.error)
