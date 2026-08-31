// Runs the server exactly as the plugin manifest declares it: resolve
// ${CLAUDE_PLUGIN_ROOT} against the repo, then speak MCP to whatever comes up.
import { readFileSync } from "node:fs"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const root = process.argv[2]
const cfg = JSON.parse(readFileSync(`${root}/.claude-plugin/mcp.json`, "utf8")).mcpServers["prompt-studio"]
const args = cfg.args.map((a) => a.replaceAll("${CLAUDE_PLUGIN_ROOT}", root))
console.log(`command: ${cfg.command} ${args.join(" ")}`)

const client = new Client({ name: "plugin-smoke", version: "1.0.0" })
await client.connect(new StdioClientTransport({ command: cfg.command, args, env: { ...process.env, PROMPT_STUDIO_HOME: "/nonexistent-on-purpose" } }))
const { tools } = await client.listTools()
console.log(`tools: ${tools.length}`)
const guide = await client.callTool({ name: "flow_language_guide", arguments: {} })
const text = guide.content.map((c) => c.text).join("")
console.log(`guide without credentials: ${text.length} chars`)
const gated = await client.callTool({ name: "list_projects", arguments: {} })
console.log(`signed out list_projects -> ${gated.content.map((c) => c.text).join("").slice(0, 90)}`)
await client.close()
