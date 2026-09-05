import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Api } from "../src/api"

/**
 * The routes, as URLs and bodies.
 *
 * Nothing clever is being tested here — it is a client, and the only way it
 * fails is by sending the wrong shape to the wrong path, which typechecks
 * perfectly and only shows up against a real server. So every call records the
 * request it made and the assertions read like the route table.
 */

const BASE = "https://api.example.test"

type Call = { url: string; method: string; body: unknown }
let calls: Call[]
let reply: unknown

function api(): Api {
  return new Api({
    kind: "stored",
    credentials: {
      baseUrl: BASE,
      email: "dev@example.test",
      accessToken: "acc",
      refreshToken: "ref",
      savedAt: "",
    },
  })
}

beforeEach(() => {
  calls = []
  reply = {}
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    })
    // Everything under /api/v1 answers inside the envelope; `request` unwraps it.
    return new Response(JSON.stringify({ success: true, message: "ok", data: reply }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  })
})
afterEach(() => vi.unstubAllGlobals())

const only = (): Call => {
  expect(calls).toHaveLength(1)
  return calls[0]
}

describe("discovery routes", () => {
  it("creates a run under the project's discovery prefix", async () => {
    reply = { id: "run-1" }
    const run = await api().createRun("p1", { label: "CRM", source: "weaver", items: [] })
    expect(only()).toMatchObject({
      url: `${BASE}/api/v1/projects/p1/discovery/runs`,
      method: "POST",
      body: { label: "CRM", source: "weaver", items: [] },
    })
    expect(run.id).toBe("run-1")
  })

  it("reads a run and its items", async () => {
    reply = []
    await api().getRun("p1", "run-1")
    await api().listItems("p1", "run-1")
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/api/v1/projects/p1/discovery/runs/run-1`,
      `${BASE}/api/v1/projects/p1/discovery/runs/run-1/items`,
    ])
  })

  it("passes only the filters it was given", async () => {
    reply = []
    await api().listItems("p1", "run-1", { module: "Finance", unanswered: true })
    expect(only().url).toBe(
      `${BASE}/api/v1/projects/p1/discovery/runs/run-1/items?module=Finance&unanswered=true`
    )
  })

  it("answers one item by its id", async () => {
    await api().answerItem("p1", "run-1", "item-9", { decision: "resolve: a", choice_key: "a" })
    expect(only()).toMatchObject({
      url: `${BASE}/api/v1/projects/p1/discovery/runs/run-1/items/item-9/answer`,
      method: "POST",
      body: { decision: "resolve: a", choice_key: "a" },
    })
  })

  it("accepts defaults in one call rather than one per item", async () => {
    reply = { accepted: 3, skipped: [] }
    await api().acceptDefaults("p1", "run-1", ["a", "b", "c"])
    expect(only()).toMatchObject({
      url: `${BASE}/api/v1/projects/p1/discovery/runs/run-1/answers/bulk`,
      method: "POST",
      body: { item_ids: ["a", "b", "c"] },
    })
  })
})

describe("artifacts", () => {
  it("keeps the folder in the name — the route is a path", async () => {
    // `encodeURIComponent` on the whole name would send `discovery%2Fissues.md`
    // and land on nothing.
    await api().putArtifact("p1", "discovery/issues.md", { kind: "md", body: "# issues" })
    expect(only()).toMatchObject({
      url: `${BASE}/api/v1/projects/p1/discovery/artifacts/discovery/issues.md`,
      method: "PUT",
      body: { kind: "md", body: "# issues" },
    })
  })

  it("still escapes what has to be escaped inside a segment", async () => {
    await api().getArtifact("p1", "discovery/a b.md")
    expect(only().url).toBe(`${BASE}/api/v1/projects/p1/discovery/artifacts/discovery/a%20b.md`)
  })
})

describe("members, comments, activity", () => {
  it("invites onto the project, not the discovery run", async () => {
    reply = { email: "x@example.test", role: "EDITOR", status: "INVITED" }
    await api().addMember("p1", { email: "x@example.test", role: "EDITOR" })
    expect(only()).toMatchObject({
      url: `${BASE}/api/v1/projects/p1/members`,
      method: "POST",
      body: { email: "x@example.test", role: "EDITOR" },
    })
  })

  it("resolves a comment by patching it", async () => {
    await api().resolveComment("p1", "c1")
    expect(only()).toMatchObject({
      url: `${BASE}/api/v1/projects/p1/comments/c1`,
      method: "PATCH",
      body: { resolved: true },
    })
  })

  it("hides resolved comments unless asked", async () => {
    reply = []
    await api().listComments("p1")
    expect(only().url).toBe(`${BASE}/api/v1/projects/p1/comments?include_resolved=false`)
  })

  it("asks for a page of activity rather than all of it", async () => {
    reply = { items: [], total: 0, has_next: false }
    await api().listActivity("p1")
    expect(only().url).toBe(`${BASE}/api/v1/projects/p1/activity?size=30`)
  })
})

describe("personal access tokens", () => {
  it("mints, lists and revokes against the account, not a project", async () => {
    reply = { id: "t1", name: "CI", token: "pst_abc" }
    const created = await api().createApiToken("CI")
    expect(created.token).toBe("pst_abc")
    await api().listApiTokens()
    await api().revokeApiToken("t1")
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${BASE}/api/v1/users/me/tokens`,
      `GET ${BASE}/api/v1/users/me/tokens`,
      `DELETE ${BASE}/api/v1/users/me/tokens/t1`,
    ])
  })
})
