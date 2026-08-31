/**
 * Signing in, once, on this machine.
 *
 * The obvious way to authenticate an MCP server is environment variables, and
 * that is what this started as — `PROMPT_STUDIO_PASSWORD` in the Claude Code
 * config. It works and it is a bad idea: the password ends up in a JSON file
 * that gets committed, shared in screenshots, and read by every process that
 * can see the config.
 *
 * So `prompt-studio-mcp login` exchanges the password for tokens once, and
 * only the tokens are stored — in the user's home directory, owner-readable,
 * outside any repository. The password is never written anywhere.
 *
 * Environment variables still work, because a CI job or a container has no
 * interactive login and no home directory worth writing to. The file is
 * preferred when both exist; someone who ran `login` meant it.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const DEFAULT_API_URL = "https://prompt-studio-backend.onrender.com"

export type StoredCredentials = {
  baseUrl: string
  email: string
  accessToken: string
  refreshToken: string
  savedAt: string
}

/** Overridable so the tests never touch a real home directory. */
export function credentialsPath(): string {
  if (process.env.PROMPT_STUDIO_HOME) {
    return join(process.env.PROMPT_STUDIO_HOME, "credentials.json")
  }
  return join(homedir(), ".prompt-studio", "credentials.json")
}

export function readCredentials(): StoredCredentials | null {
  const path = credentialsPath()
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<StoredCredentials>
    if (!parsed.refreshToken || !parsed.baseUrl) return null
    return {
      baseUrl: parsed.baseUrl,
      email: parsed.email ?? "",
      accessToken: parsed.accessToken ?? "",
      refreshToken: parsed.refreshToken,
      savedAt: parsed.savedAt ?? "",
    }
  } catch {
    // A truncated or hand-edited file is not worth crashing over — it reads as
    // "not signed in", and `login` overwrites it.
    return null
  }
}

export function writeCredentials(credentials: StoredCredentials): string {
  const path = credentialsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`)
  try {
    // Best effort: these are bearer tokens for the user's account, and the
    // default umask on a shared machine is not tight enough for that.
    chmodSync(path, 0o600)
  } catch {
    // Windows, or a filesystem with no permission bits. The file is still in
    // the user's own home directory.
  }
  return path
}

export function clearCredentials(): boolean {
  const path = credentialsPath()
  if (!existsSync(path)) return false
  rmSync(path)
  return true
}

export type Resolved =
  | { kind: "stored"; credentials: StoredCredentials }
  | { kind: "password"; baseUrl: string; email: string; password: string }
  | { kind: "none"; baseUrl: string }

/**
 * What this process should authenticate with.
 *
 * Stored tokens win over environment variables. Someone who ran `login` has
 * expressed a preference, and silently preferring a stale env var over it is
 * the kind of thing that takes an hour to work out.
 */
export function resolveAuth(env: NodeJS.ProcessEnv = process.env): Resolved {
  const stored = readCredentials()
  if (stored) return { kind: "stored", credentials: stored }

  const baseUrl = env.PROMPT_STUDIO_API_URL ?? DEFAULT_API_URL
  const email = env.PROMPT_STUDIO_EMAIL ?? ""
  const password = env.PROMPT_STUDIO_PASSWORD ?? ""
  if (email && password) return { kind: "password", baseUrl, email, password }
  return { kind: "none", baseUrl }
}

/** The message a tool shows when nobody has signed in yet. */
/**
 * The command that will actually sign this particular installation in.
 *
 * `npx prompt-studio-mcp login` is right for an npm install and useless for a
 * Claude Code plugin install, where nothing was fetched from npm and there is
 * no bin on PATH. The server knows where it is running from, so it can name
 * the CLI sitting next to it rather than send a plugin user to a package that
 * may not be installed.
 */
export function loginCommand(): string {
  try {
    const self = fileURLToPath(import.meta.url)
    // Bundled, so this module *is* dist/server.mjs; the CLI is its sibling.
    const cli = join(dirname(self), "cli.mjs")
    if (existsSync(cli)) return `node ${JSON.stringify(cli)} login`
  } catch {
    // Not running from a file (tests, a REPL) — fall through to the npm form.
  }
  return "npx prompt-studio-mcp login"
}

export const NOT_SIGNED_IN = [
  "Not signed in to Prompt Studio.",
  "",
  "Run this once, in a terminal:",
  "",
  `    ${loginCommand()}`,
  "",
  "It asks for the email and password of your Prompt Studio account and stores",
  "the resulting tokens in ~/.prompt-studio/credentials.json. Your password is",
  "not saved.",
].join("\n")
