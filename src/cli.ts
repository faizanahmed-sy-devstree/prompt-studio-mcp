/**
 * The bit a person runs, as opposed to the bit Claude talks to.
 *
 * Only what has to happen outside an MCP session: signing in, checking that
 * signing in worked, and signing out. Everything else is a tool, because
 * everything else is something Claude should be doing.
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { Api, ApiError, login } from "./api"
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

const command = process.argv[2] ?? "help"
let code = 0
if (command === "login") code = await doLogin()
else if (command === "whoami") code = await doWhoami()
else if (command === "logout") code = doLogout()
else if (command === "serve") {
  // Importing rather than spawning, so `serve` is the same process Claude
  // talks to over stdio.
  await import("./server")
} else {
  console.log(USAGE)
  code = command === "help" || command === "--help" || command === "-h" ? 0 : 1
}
if (command !== "serve") process.exit(code)
