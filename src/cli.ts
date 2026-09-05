/**
 * The bit a person runs, as opposed to the bit Claude talks to.
 *
 * Only what has to happen outside an MCP session: signing in, checking that
 * signing in worked, and signing out. Everything else is a tool, because
 * everything else is something Claude should be doing.
 */

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { Api, ApiError, login } from "./api"
import {
  collectWeaveArtifacts,
  progressSummary,
  rootsOf,
  sha256,
} from "./discovery"
import { readLinks, resolveLink } from "./link"
import {
  clearCredentials,
  credentialsPath,
  DEFAULT_API_URL,
  readCredentials,
  resolveAuth,
  writeCredentials,
} from "./auth"

const USAGE = `prompt-studio-mcp — Prompt Studio for Claude Code

  npx prompt-studio-mcp login     sign in and store tokens for this machine
  npx prompt-studio-mcp whoami    show who this machine is signed in as
  npx prompt-studio-mcp logout    forget the stored tokens
  npx prompt-studio-mcp serve     run the MCP server on stdio (what Claude runs)

  npx prompt-studio-mcp push-weave [dir]        push weave/ to the linked project
  npx prompt-studio-mcp discovery status        how far through the questions it is
  npx prompt-studio-mcp token create <name>     mint an API token for CI (STUDIO_TOKEN)

Registering it with Claude Code, after logging in once:

  claude mcp add prompt-studio -- npx -y prompt-studio-mcp serve

Environment:
  PROMPT_STUDIO_API_URL   default ${DEFAULT_API_URL}
  PROMPT_STUDIO_EMAIL     for CI, where there is no interactive login
  PROMPT_STUDIO_PASSWORD  for CI. Prefer \`login\` on a personal machine.
`

async function ask(question: string, { hidden = false } = {}): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  if (!hidden) {
    const answer = await rl.question(question)
    rl.close()
    return answer.trim()
  }
  // Suppress the echo so a password is not left on screen or in a scrollback
  // buffer that gets pasted into a bug report later.
  const previous = (rl as unknown as { output: { write: (s: string) => void } }).output.write
  let muted = false
  ;(rl as unknown as { output: { write: (s: string) => void } }).output.write = (chunk: string) => {
    if (!muted) previous.call(stdout, chunk)
  }
  const pending = rl.question(question)
  muted = true
  const answer = await pending
  muted = false
  rl.close()
  stdout.write("\n")
  return answer.trim()
}

async function doLogin(): Promise<number> {
  const baseUrl = process.env.PROMPT_STUDIO_API_URL ?? DEFAULT_API_URL
  console.log(`Signing in to ${baseUrl}\n`)
  const email = process.env.PROMPT_STUDIO_EMAIL || (await ask("Email: "))
  const password =
    process.env.PROMPT_STUDIO_PASSWORD || (await ask("Password: ", { hidden: true }))
  if (!email || !password) {
    console.error("Both an email and a password are needed.")
    return 1
  }
  try {
    const tokens = await login(baseUrl, email, password)
    const path = writeCredentials({
      baseUrl,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      savedAt: new Date().toISOString(),
    })
    console.log(`\nSigned in as ${email}.`)
    console.log(`Tokens stored in ${path} (your password was not saved).`)
    console.log("\nNow register the server with Claude Code:\n")
    console.log("  claude mcp add prompt-studio -- npx -y prompt-studio-mcp serve\n")
    return 0
  } catch (error) {
    console.error(
      error instanceof ApiError
        ? `Could not sign in: ${error.message}`
        : `Could not reach ${baseUrl}: ${(error as Error).message}`
    )
    return 1
  }
}

async function doWhoami(): Promise<number> {
  const stored = readCredentials()
  const auth = resolveAuth()
  if (auth.kind === "none") {
    console.log("Not signed in. Run `npx prompt-studio-mcp login`.")
    return 1
  }
  const api = new Api(auth)
  try {
    const page = await api.listProjects()
    console.log(`Signed in as ${api.identity}`)
    if (stored) console.log(`Credentials: ${credentialsPath()} (saved ${stored.savedAt})`)
    else console.log("Credentials: from the environment")
    console.log(`Projects reachable: ${page.items.length}`)
    return 0
  } catch (error) {
    console.error(`Signed in as ${api.identity}, but the API refused: ${(error as Error).message}`)
    return 1
  }
}

function doLogout(): number {
  console.log(
    clearCredentials()
      ? `Removed ${credentialsPath()}.`
      : "Nothing to remove — no stored credentials."
  )
  return 0
}

/** The project this working copy belongs to, from `.prompt-studio.json`. */
function linkedProject(start: string): string | null {
  return resolveLink(undefined, start)?.projectId ?? null
}

function apiOrExit(): Api | null {
  const auth = resolveAuth()
  if (auth.kind === "none") {
    console.error("Not signed in. Run `npx prompt-studio-mcp login`.")
    return null
  }
  return new Api(auth)
}

async function doPushWeave(dir: string): Promise<number> {
  const root = resolve(dir || process.cwd())
  const project = linkedProject(root)
  if (!project) {
    console.error(`No linked project under ${root}. Run /prompt-studio:link, or pass a directory that has .prompt-studio.json.`)
    return 1
  }
  const artifacts = collectWeaveArtifacts(root)
  if (!artifacts.length) {
    console.error(`Nothing to push — no artifacts under ${join(root, "weave")}.`)
    return 1
  }
  const api = apiOrExit()
  if (!api) return 1
  try {
    const known = new Map<string, string>()
    try {
      for (const summary of await api.listArtifacts(project)) {
        const sha = summary.sha256 ?? summary.sha
        if (sha) known.set(summary.name, sha)
      }
    } catch {
      // First push, or an older backend. Send everything.
    }
    let pushed = 0
    let unchanged = 0
    for (const artifact of artifacts) {
      if (known.get(artifact.name) === sha256(artifact.body)) {
        unchanged += 1
        continue
      }
      await api.putArtifact(project, artifact.name, { kind: artifact.kind, body: artifact.body })
      console.log(`  pushed ${artifact.name}`)
      pushed += 1
    }
    console.log(`\n${pushed} pushed, ${unchanged} unchanged.`)
    if (existsSync(join(root, "weave", "schema.flow"))) {
      console.log("weave/schema.flow is here — run the discovery_push_docs tool to also merge it onto the Data canvas.")
    }
    return 0
  } catch (error) {
    console.error(`Could not push: ${(error as Error).message}`)
    return 1
  }
}

async function doDiscoveryStatus(): Promise<number> {
  const root = process.cwd()
  const project = linkedProject(root)
  if (!project) {
    console.error("No linked project here. Run /prompt-studio:link first.")
    return 1
  }
  // The run id sits beside the link file, not beside wherever this was run from.
  const idFile = join(readLinks(root)?.root ?? root, "weave/discovery/.run-id")
  if (!existsSync(idFile)) {
    console.error("No weave/discovery/.run-id — nothing has been pushed for this repository yet.")
    return 1
  }
  const runId = readFileSync(idFile, "utf8").trim()
  const api = apiOrExit()
  if (!api) return 1
  try {
    const run = await api.getRun(project, runId)
    const open = rootsOf(await api.listItems(project, runId, { unanswered: true }))
    console.log(progressSummary(run, open))
    return run.done ? 0 : 1
  } catch (error) {
    console.error(`Could not read the run: ${(error as Error).message}`)
    return 1
  }
}

async function doTokenCreate(name: string): Promise<number> {
  if (!name) {
    console.error("Give the token a name: `npx prompt-studio-mcp token create \"weaver push on CI\"`.")
    return 1
  }
  const api = apiOrExit()
  if (!api) return 1
  try {
    const token = await api.createApiToken(name)
    console.log(`Created "${token.name}" (${token.id}).\n`)
    console.log(token.token ?? "(the API returned no token value)")
    console.log("\nCopy it now — it is not stored anywhere it can be read back.")
    console.log("Use it as STUDIO_TOKEN, or as a bearer token against /api/v1.")
    return 0
  } catch (error) {
    console.error(`Could not create a token: ${(error as Error).message}`)
    return 1
  }
}

const command = process.argv[2] ?? "help"
let code = 0
if (command === "login") code = await doLogin()
else if (command === "whoami") code = await doWhoami()
else if (command === "logout") code = doLogout()
else if (command === "push-weave") code = await doPushWeave(process.argv[3] ?? "")
else if (command === "discovery" && process.argv[3] === "status") code = await doDiscoveryStatus()
else if (command === "token" && process.argv[3] === "create")
  code = await doTokenCreate(process.argv.slice(4).join(" ").trim())
else if (command === "serve") {
  // Importing rather than spawning, so `serve` is the same process Claude
  // talks to over stdio.
  await import("./server")
} else {
  console.error(USAGE)
  code = command === "help" || command === "--help" || command === "-h" ? 0 : 1
}
if (command !== "serve") process.exit(code)
