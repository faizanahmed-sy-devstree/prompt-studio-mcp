import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  clearCredentials,
  credentialsPath,
  DEFAULT_API_URL,
  readCredentials,
  resolveAuth,
  writeCredentials,
} from "../src/auth"

/**
 * Credentials are the one thing here that outlives the process, so the
 * questions are: where do they land, who can read them, and what happens when
 * the file is missing or damaged.
 */

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "ps-auth-"))
  process.env.PROMPT_STUDIO_HOME = home
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  process.env.PROMPT_STUDIO_HOME = undefined
  delete process.env.PROMPT_STUDIO_HOME
})

const sample = {
  baseUrl: "https://api.example.test",
  email: "dev@example.test",
  accessToken: "acc",
  refreshToken: "ref",
  savedAt: "2026-08-27T00:00:00.000Z",
}

describe("storing credentials", () => {
  it("writes them where it says it does", () => {
    const path = writeCredentials(sample)
    expect(path).toBe(credentialsPath())
    expect(JSON.parse(readFileSync(path, "utf8")).email).toBe("dev@example.test")
  })

  it("never writes the password", () => {
    writeCredentials(sample)
    // The whole reason `login` exists instead of an env var.
    expect(readFileSync(credentialsPath(), "utf8")).not.toMatch(/password/i)
  })

  it("keeps the file to the owner", () => {
    writeCredentials(sample)
    const mode = statSync(credentialsPath()).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it("reads them back", () => {
    writeCredentials(sample)
    expect(readCredentials()).toEqual(sample)
  })

  it("treats a damaged file as not signed in rather than crashing", () => {
    writeCredentials(sample)
    writeFileSync(credentialsPath(), "{ not json")
    expect(readCredentials()).toBeNull()
  })

  it("treats a file with no refresh token as not signed in", () => {
    writeFileSync(credentialsPath(), JSON.stringify({ baseUrl: "x", email: "y" }))
    expect(readCredentials()).toBeNull()
  })

  it("reports nothing to remove when there is nothing", () => {
    expect(clearCredentials()).toBe(false)
  })

  it("removes them on logout", () => {
    writeCredentials(sample)
    expect(clearCredentials()).toBe(true)
    expect(readCredentials()).toBeNull()
  })
})

describe("choosing what to authenticate with", () => {
  it("uses stored tokens when they exist", () => {
    writeCredentials(sample)
    const resolved = resolveAuth({})
    expect(resolved.kind).toBe("stored")
  })

  it("prefers stored tokens over environment variables", () => {
    // Somebody who ran `login` meant it; silently preferring a stale env var
    // over that is an hour of confusion.
    writeCredentials(sample)
    const resolved = resolveAuth({
      PROMPT_STUDIO_EMAIL: "other@example.test",
      PROMPT_STUDIO_PASSWORD: "hunter2",
    })
    expect(resolved.kind).toBe("stored")
    if (resolved.kind !== "stored") return
    expect(resolved.credentials.email).toBe("dev@example.test")
  })

  it("falls back to an email and password from the environment", () => {
    const resolved = resolveAuth({
      PROMPT_STUDIO_EMAIL: "ci@example.test",
      PROMPT_STUDIO_PASSWORD: "hunter2",
    })
    expect(resolved.kind).toBe("password")
  })

  it("is not signed in when the environment has only half a credential", () => {
    expect(resolveAuth({ PROMPT_STUDIO_EMAIL: "ci@example.test" }).kind).toBe("none")
    expect(resolveAuth({ PROMPT_STUDIO_PASSWORD: "hunter2" }).kind).toBe("none")
  })

  it("defaults to the hosted API rather than localhost", () => {
    // The default has to be right for the person installing from npm, not for
    // whoever happens to be running the backend on their laptop.
    const resolved = resolveAuth({})
    expect(resolved.kind).toBe("none")
    if (resolved.kind !== "none") return
    expect(resolved.baseUrl).toBe(DEFAULT_API_URL)
    expect(DEFAULT_API_URL).toMatch(/^https:\/\//)
  })

  it("honours an explicit API url", () => {
    const resolved = resolveAuth({ PROMPT_STUDIO_API_URL: "http://localhost:8010" })
    expect(resolved.kind).toBe("none")
    if (resolved.kind !== "none") return
    expect(resolved.baseUrl).toBe("http://localhost:8010")
  })
})
