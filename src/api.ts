/**
 * The slice of the Prompt Studio API this server needs.
 *
 * Deliberately not the app's own client: that one is built for a browser — it
 * reads tokens from a store that assumes `window`, and hands a 401 to a
 * React-level handler that signs the person out. Here a 401 means "the access
 * token aged out during a long Claude Code session", and the right answer is to
 * refresh once and carry on without anybody being told.
 */

import {
  type Resolved,
  type StoredCredentials,
  writeCredentials,
} from "./auth"

export type Tokens = { access_token: string; refresh_token: string }

export type ProjectSummary = {
  id: string
  name: string
  description: string
  doc_version: number
  screen_count: number
  module_count: number
  is_archived: boolean
  my_role: string | null
  updated_at: string
}

export type ProjectDetail = ProjectSummary & { doc: Record<string, unknown> }

export type VersionSummary = {
  id: string
  label: string
  doc_version: number
  is_auto: boolean
  created_at: string
}

export type VersionDetail = VersionSummary & { doc: Record<string, unknown> }

export type Page<T> = { items: T[]; total: number; has_next: boolean }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class Api {
  private tokens: Tokens | null = null
  private readonly baseUrl: string

  constructor(private readonly auth: Resolved) {
    this.baseUrl =
      auth.kind === "stored" ? auth.credentials.baseUrl : (auth as { baseUrl: string }).baseUrl
    if (auth.kind === "stored") {
      this.tokens = {
        access_token: auth.credentials.accessToken,
        refresh_token: auth.credentials.refreshToken,
      }
    }
  }

  private get root(): string {
    return `${this.baseUrl.replace(/\/+$/, "")}/api/v1`
  }

  /** Who this server is acting as, for `whoami` and for error messages. */
  get identity(): string {
    if (this.auth.kind === "stored") return this.auth.credentials.email || "(signed in)"
    if (this.auth.kind === "password") return this.auth.email
    return "(not signed in)"
  }

  /**
   * Sign in, lazily.
   *
   * Lazily because a Claude Code session may load this server and never use it,
   * and a server that refuses to start because a password is wrong is far
   * harder to diagnose than a tool call that says so.
   */
  private async signIn(): Promise<Tokens> {
    if (this.auth.kind !== "password") {
      throw new ApiError(
        "Not signed in. Run `npx prompt-studio-mcp login` in a terminal.",
        401
      )
    }
    const tokens = await login(this.baseUrl, this.auth.email, this.auth.password)
    this.tokens = tokens
    return tokens
  }

  private async refresh(): Promise<Tokens> {
    if (!this.tokens?.refresh_token) return this.signIn()
    const response = await fetch(`${this.root}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: this.tokens.refresh_token }),
    })
    if (!response.ok) {
      // A refresh token that was revoked or rotated out is not worth
      // surfacing when a password is available; when one is not, it means the
      // stored session is finished and only `login` can fix it.
      if (this.auth.kind === "password") return this.signIn()
      throw new ApiError(
        "Your Prompt Studio session has expired. Run `npx prompt-studio-mcp login` again.",
        401
      )
    }
    this.tokens = unwrap<Tokens>(await readBody(response))
    // Persist the rotated pair, or the next session starts by refreshing a
    // token the server has already retired.
    if (this.auth.kind === "stored") {
      const next: StoredCredentials = {
        ...this.auth.credentials,
        accessToken: this.tokens.access_token,
        refreshToken: this.tokens.refresh_token,
        savedAt: new Date().toISOString(),
      }
      try {
        writeCredentials(next)
      } catch {
        // A read-only home directory should not break the request in flight.
      }
    }
    return this.tokens
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    { retry = true }: { retry?: boolean } = {}
  ): Promise<T> {
    const tokens = this.tokens ?? (await this.signIn())
    const response = await fetch(`${this.root}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.access_token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 401 && retry) {
      await this.refresh()
      return this.request<T>(method, path, body, { retry: false })
    }
    const parsed = await readBody(response)
    if (!response.ok) {
      throw new ApiError(messageOf(parsed) ?? `${method} ${path} failed`, response.status)
    }
    return unwrap<T>(parsed)
  }

  // ── projects ──────────────────────────────────────────────────────────────

  listProjects(): Promise<Page<ProjectSummary>> {
    return this.request<Page<ProjectSummary>>("GET", "/projects?size=100&sort=recent")
  }

  getProject(id: string): Promise<ProjectDetail> {
    return this.request<ProjectDetail>("GET", `/projects/${id}`)
  }

  createProject(body: {
    name: string
    description?: string
    doc: unknown
    schema_version: number
  }): Promise<ProjectDetail> {
    return this.request<ProjectDetail>("POST", "/projects", body)
  }

  saveDocument(
    id: string,
    body: { doc: unknown; base_version: number; schema_version: number }
  ): Promise<ProjectSummary> {
    return this.request<ProjectSummary>("PUT", `/projects/${id}/document`, body)
  }

  // ── version history ───────────────────────────────────────────────────────

  listVersions(id: string): Promise<Page<VersionSummary>> {
    return this.request<Page<VersionSummary>>("GET", `/projects/${id}/versions?size=50`)
  }

  saveVersion(id: string, label: string): Promise<VersionSummary> {
    return this.request<VersionSummary>("POST", `/projects/${id}/versions`, { label })
  }

  getVersion(id: string, versionId: string): Promise<VersionDetail> {
    return this.request<VersionDetail>("GET", `/projects/${id}/versions/${versionId}`)
  }

  restoreVersion(id: string, versionId: string): Promise<ProjectSummary> {
    return this.request<ProjectSummary>("POST", `/projects/${id}/versions/${versionId}/restore`)
  }
}

/** Exchange an email and password for tokens. Used by `login` and by the server. */
export async function login(
  baseUrl: string,
  email: string,
  password: string
): Promise<Tokens> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const body = await readBody(response)
  if (!response.ok) {
    throw new ApiError(messageOf(body) ?? "Could not sign in", response.status)
  }
  return unwrap<Tokens>(body)
}

/**
 * Every `/api/v1` route answers inside an envelope — `{success, message, data}`
 * — and the payload is the `data` field. `/health` and anything outside the
 * prefix is bare, hence the check rather than an unconditional reach.
 */
function unwrap<T>(payload: unknown): T {
  if (payload !== null && typeof payload === "object" && "success" in payload) {
    return (payload as unknown as { data: T }).data
  }
  return payload as T
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * The server wraps errors in an envelope; a proxy in front of it may not. Both
 * shapes reach here, and "[object Object]" is not a message anybody can act on.
 */
function messageOf(body: unknown): string | null {
  if (typeof body === "string") return body || null
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const error = record.error
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message
    if (typeof message === "string") return message
  }
  for (const key of ["message", "detail"]) {
    const value = record[key]
    if (typeof value === "string") return value
  }
  return null
}
