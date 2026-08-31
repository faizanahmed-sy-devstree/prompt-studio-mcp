/**
 * The whole thing, over the real MCP protocol, against a real backend.
 *
 * The unit tests cover the pure logic; this covers everything they cannot —
 * that the server starts, speaks MCP, authenticates as a real account, and
 * that a write actually lands in the database with a version behind it.
 *
 *   PROMPT_STUDIO_API_URL=http://localhost:8010 node tests/e2e.mjs
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const API = process.env.PROMPT_STUDIO_API_URL ?? "http://localhost:8010"
const here = resolve(fileURLToPath(import.meta.url), "..", "..")
const SERVER = join(here, "dist/server.mjs")

const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const tag = Math.random().toString(36).slice(2, 10)
const email = `mcp.${tag}@mailinator.com`
const password = "Str0ng!Passw0rd"

async function register() {
  const response = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, display_name: "MCP E2E" }),
  })
  if (!response.ok) throw new Error(`register failed: ${await response.text()}`)
}

const SOURCE = `screen login "Sign in"
screen home "Home"

flow { login -> home : "on success" }
`

async function main() {
  await register()

  const home = mkdtempSync(join(tmpdir(), "ps-mcp-home-"))
  const repo = mkdtempSync(join(tmpdir(), "ps-mcp-repo-"))

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    cwd: repo,
    env: {
      ...process.env,
      PROMPT_STUDIO_HOME: home,
      PROMPT_STUDIO_API_URL: API,
      PROMPT_STUDIO_EMAIL: email,
      PROMPT_STUDIO_PASSWORD: password,
    },
  })
  const client = new Client({ name: "e2e", version: "1.0.0" })

  try {
    await client.connect(transport)
    check("the server speaks MCP", true)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    check("it exposes the documented tools", names.length >= 13, names.join(","))
    for (const expected of [
      "flow_language_guide",
      "list_projects",
      "read_project",
      "check_flow",
      "write_flow",
      "create_project",
      "build_prompt",
      "list_versions",
      "save_version",
      "read_version",
      "restore_version",
      "link_project",
      "pull_flow",
      "push_flow",
      "sync_status",
    ]) {
      check(`  tool ${expected}`, names.includes(expected), names.join(","))
    }

    const say = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args })
      return result.content.map((c) => c.text).join("\n")
    }

    // ── the grammar is reachable without a project ──────────────────────────
    const guide = await say("flow_language_guide")
    check("the grammar guide is served", guide.length > 1000, `${guide.length} chars`)

    // ── checking costs nothing ──────────────────────────────────────────────
    const checked = await say("check_flow", { source: SOURCE })
    check("check_flow parses valid source", checked.includes("Parsed cleanly"), checked)

    const bad = await say("check_flow", { source: `app "Nothing" {\n  builds web\n}` })
    check("check_flow reports source that describes nothing", bad.includes("Did not parse"), bad)

    // ── creating ────────────────────────────────────────────────────────────
    const created = await say("create_project", {
      name: `MCP ${tag}`,
      source: SOURCE,
    })
    const projectId = created.match(/\(([0-9a-f-]{36})\)/)?.[1]
    check("create_project makes a real project", Boolean(projectId), created)
    if (!projectId) throw new Error("no project id")

    const listed = await say("list_projects")
    check("it appears in list_projects", listed.includes(projectId), listed.slice(0, 200))

    // ── reading it back as Flow ─────────────────────────────────────────────
    const read = await say("read_project", { project_id: projectId })
    check("read_project returns Flow", read.includes('screen login "Sign in"'), read.slice(0, 200))
    check("read_project states the version to write back", /version \d+/.test(read), read.slice(0, 120))

    // ── writing, and the snapshot that precedes it ──────────────────────────
    const written = await say("write_flow", {
      project_id: projectId,
      source: `screen billing "Billing"`,
      mode: "merge",
      label: "Add billing",
    })
    check("write_flow saves", written.includes("Saved as version"), written)
    check("write_flow snapshots first", written.includes("Snapshot saved"), written)

    const after = await say("read_project", { project_id: projectId })
    check("the new screen is there", after.includes("billing"), after.slice(0, 300))
    check("merge kept the screens it was not told about", after.includes("login"), after.slice(0, 300))

    // ── version history ─────────────────────────────────────────────────────
    const versions = await say("list_versions", { project_id: projectId })
    check("the snapshot is in the history", versions.includes("Add billing"), versions)
    const versionId = versions.match(/([0-9a-f-]{36})/)?.[1]
    check("a version can be identified", Boolean(versionId), versions)

    if (versionId) {
      const past = await say("read_version", { project_id: projectId, version_id: versionId })
      check("a past version reads back as Flow", past.includes("screen"), past.slice(0, 200))

      const restored = await say("restore_version", {
        project_id: projectId,
        version_id: versionId,
      })
      check("restore puts it back", restored.includes("Restored"), restored)
      check("restore snapshots the current state first", restored.includes("saved as v"), restored)

      const afterRestore = await say("read_project", { project_id: projectId })
      check(
        "the restored document is the pre-billing one",
        !afterRestore.includes("billing"),
        afterRestore.slice(0, 300)
      )
    }

    // ── the linked .flow file ───────────────────────────────────────────────
    const unlinked = await say("sync_status")
    check("sync_status says so when nothing is linked", unlinked.includes("not linked"), unlinked)

    const linked = await say("link_project", { project_id: projectId, flow_file: "app.flow" })
    check("link_project writes the file", linked.includes("Linked"), linked)
    const onDisk = readFileSync(join(repo, "app.flow"), "utf8")
    check("the file holds the project's Flow", onDisk.includes("screen login"), onDisk.slice(0, 120))
    const linkJson = JSON.parse(readFileSync(join(repo, ".prompt-studio.json"), "utf8"))
    check("the link records the project", linkJson.projects[projectId]?.flowFile === "app.flow")

    const status = await say("sync_status")
    check("sync_status reports in sync right after linking", status.includes("in sync"), status)

    // A write through another tool must not leave the file stale — that is the
    // failure this whole feature exists to prevent.
    await say("write_flow", {
      project_id: projectId,
      source: `screen reports "Reports"`,
      mode: "merge",
      label: "Add reports",
    })
    const afterWrite = readFileSync(join(repo, "app.flow"), "utf8")
    check("write_flow keeps the linked file current", afterWrite.includes("reports"), afterWrite.slice(0, 160))
    const statusAfter = await say("sync_status")
    check("and sync_status agrees", statusAfter.includes("in sync"), statusAfter)

    // ── errors a model has to be able to act on ─────────────────────────────
    const missing = await say("read_project", { project_id: "00000000-0000-0000-0000-000000000000" })
    check("a project you cannot see explains itself", /does not exist|never added/i.test(missing), missing)

    const refused = await say("write_flow", {
      project_id: projectId,
      source: `app "Nothing" {\n  builds web\n}`,
      mode: "merge",
    })
    check("a write of unparseable source is refused", refused.includes("Refused"), refused)
  } finally {
    await client.close().catch(() => {})
    rmSync(home, { recursive: true, force: true })
    rmSync(repo, { recursive: true, force: true })
  }

  console.log(fails.length ? `\n${fails.length} FAILED` : "\nall good")
  process.exit(fails.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
