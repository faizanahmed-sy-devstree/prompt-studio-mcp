import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { DiscoveryAnswer } from "../src/api"
import {
  collectWeaveArtifacts,
  countPending,
  progressSummary,
  rootsOf,
  sha256,
  writeBackDecisions,
} from "../src/discovery"

/**
 * The local half of a discovery run.
 *
 * Two things can go quietly wrong here and both cost a person an afternoon:
 * pushing files that were never artifacts (the raw notes, the questions file
 * itself), and writing a decision into the wrong block — every block in
 * issues.md carries the same `decision: PENDING` line, so an unanchored
 * replace answers all 138 of them with the first answer that arrived.
 */

let root: string

const write = (path: string, body: string): void => {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ps-discovery-"))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe("collecting the weave folder", () => {
  it("finds nothing when there is no weave folder", () => {
    expect(collectWeaveArtifacts(root)).toEqual([])
  })

  it("names each file by its path inside weave/, with a kind per extension", () => {
    write("weave/schema.dbml", "Table users {}")
    write("weave/schema.flow", "data { }")
    write("weave/project.weave", "app Thing")
    write("weave/flow-book-deal.mmd", "graph TD")
    write("weave/docs.json", "{}")
    write("weave/discovery/issues.md", "# issues")
    const found = collectWeaveArtifacts(root)
    expect(found.map((a) => [a.name, a.kind])).toEqual([
      ["discovery/issues.md", "md"],
      ["docs.json", "json"],
      ["flow-book-deal.mmd", "mermaid"],
      ["project.weave", "weave"],
      ["schema.dbml", "dbml"],
      ["schema.flow", "flow"],
    ])
  })

  it("skips the working state — raw notes, the questions file, the run id", () => {
    write("weave/discovery/kb.md", "# kb")
    write("weave/discovery/raw/js-a.md", "notes")
    write("weave/discovery/raw/seed.md", "notes")
    write("weave/discovery/questions.json", "{}")
    write("weave/discovery/.run-id", "run-1")
    expect(collectWeaveArtifacts(root).map((a) => a.name)).toEqual(["discovery/kb.md"])
  })

  it("skips anything that is not an artifact kind", () => {
    // `.studio/inbox.jsonl` is weaver's own scratch log; pushing it would put
    // junk in front of whoever opens the Discovery tab.
    write("weave/.studio/inbox.jsonl", "{}")
    write("weave/screenshot.png", "not really a png")
    write("weave/kb.md", "# kb")
    expect(collectWeaveArtifacts(root).map((a) => a.name)).toEqual(["kb.md"])
  })

  it("hashes a body the way the API does, so an unchanged file can be skipped", () => {
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
  })
})

// The shape weaver actually writes: a header with two spaces after the key, an
// evidence line, options, and a decision line that is identical in every block.
const ISSUES = `# issues.md

## Counts

| kind | high |
|---|---|
| conflict | 25 |

---

## I-001  conflict  severity: high
what: \`EV_STATUS\` has 5 values; REG has 4.
options: a) UI wins  b) match REG
decision: PENDING

## I-002  conflict  severity: high
what: \`PROP_STATUS\` has 10 values; REG declares 6.
options: a) enum gets 10  b) collapse two
decision: PENDING

## I-003  ambiguous  severity: low
what: naming.
decision: PENDING
`

const FEATURES = `# features.md

| id | view | title | entities | evidence | decision |
|---|---|---|---|---|---|
| M-001 | — | **Authentication** | User, Session | js-a L9238 | PENDING |
| M-002 | users | **Password reset** | User | js-h L22834 | PENDING |
`

const answer = (over: Partial<DiscoveryAnswer>): DiscoveryAnswer => ({
  key: "I-001",
  family: "ISSUE",
  decision: "resolve: a",
  choice_key: "a",
  note: null,
  ...over,
})

describe("writing decisions back into weave/", () => {
  beforeEach(() => {
    write("weave/discovery/issues.md", ISSUES)
    write("weave/discovery/features.md", FEATURES)
  })

  const read = (name: string): string => readFileSync(join(root, "weave/discovery", name), "utf8")

  it("answers only the block it was asked about", () => {
    const report = writeBackDecisions(root, [answer({ key: "I-002", decision: "resolve: b" })])
    expect(report.issues).toBe(1)
    const text = read("issues.md")
    expect(text).toContain("## I-002  conflict  severity: high\nwhat")
    expect(text.match(/decision: PENDING/g)).toHaveLength(2)
    expect(text).toContain("decision: resolve: b")
    // The first block is untouched — an unanchored replace would have taken it.
    expect(text.split("## I-001")[1].split("## I-002")[0]).toContain("decision: PENDING")
  })

  it("answers an M row in the features table", () => {
    writeBackDecisions(root, [
      answer({ key: "M-001", family: "M", decision: "confirm", choice_key: null }),
    ])
    const row = read("features.md")
      .split("\n")
      .find((line) => line.startsWith("| M-001 |"))
    expect(row?.endsWith("| confirm |")).toBe(true)
    expect(read("features.md")).toContain("| M-002 |")
    expect(read("features.md").match(/\| PENDING \|/g)).toHaveLength(1)
  })

  it("keeps a pipe in a decision from breaking the table", () => {
    writeBackDecisions(root, [
      answer({ key: "M-002", family: "M", decision: "resolve: a | with a note" }),
    ])
    const row = read("features.md")
      .split("\n")
      .find((line) => line.startsWith("| M-002 |"))
    expect(row).toContain("| resolve: a ¦ with a note |")
    expect(row?.split("|")).toHaveLength(FEATURES.split("\n")[4].split("|").length)
  })

  it("flattens a multi-line decision onto one line", () => {
    writeBackDecisions(root, [answer({ decision: "resolve: a\nand also   b" })])
    expect(read("issues.md")).toContain("decision: resolve: a and also b")
  })

  it("gets every PENDING to zero when every question is answered", () => {
    const report = writeBackDecisions(root, [
      answer({ key: "I-001" }),
      answer({ key: "I-002", decision: "waive: cosmetic" }),
      answer({ key: "I-003", decision: "drop" }),
      answer({ key: "M-001", family: "M", decision: "confirm" }),
      answer({ key: "M-002", family: "M", decision: "confirm" }),
    ])
    expect(report).toMatchObject({ issues: 3, implied: 2, unmatched: [], remainingPending: 0 })
    expect(report.changed).toEqual(["discovery/issues.md", "discovery/features.md"])
    // The same grep the gate runs.
    expect(countPending(read("issues.md")) + countPending(read("features.md"))).toBe(0)
  })

  it("reports a key that matches neither file rather than silently dropping it", () => {
    const report = writeBackDecisions(root, [answer({ key: "I-999" })])
    expect(report.unmatched).toEqual(["I-999"])
    expect(report.remainingPending).toBe(5)
  })

  it("does not confuse I-001 with I-0010", () => {
    write(
      "weave/discovery/issues.md",
      `## I-0010  conflict  severity: high\ndecision: PENDING\n\n## I-001  conflict  severity: low\ndecision: PENDING\n`
    )
    writeBackDecisions(root, [answer({ key: "I-001", decision: "drop" })])
    const text = read("issues.md")
    expect(text.split("## I-0010")[1].split("## I-001 ")[0]).toContain("decision: PENDING")
    expect(text).toContain("## I-001  conflict  severity: low\ndecision: drop")
  })
})

describe("the progress summary", () => {
  const run = {
    id: "run-1",
    label: "CRM discovery",
    source: "weaver",
    done: false,
    created_at: "2026-09-05T00:00:00Z",
    progress: {
      total: 178,
      answered: 40,
      needs_user: 12,
      needs_user_answered: 3,
      modules: { "Deals/Pipeline": { total: 20, answered: 20 }, Finance: { total: 30, answered: 4 } },
    },
  }

  it("says where the run is and which modules still need work", () => {
    const text = progressSummary(run)
    expect(text).toContain("40/178 answered")
    expect(text).toContain("3/12 of the ones that need a person")
    expect(text).toContain("not done")
    expect(text).toMatch(/Finance\s+4\/30\s+←/)
    // A finished module gets no arrow, so the arrows are the to-do list.
    expect(text).toMatch(/Deals\/Pipeline\s+20\/20\n/)
  })

  it("lists the open roots when it is given them", () => {
    const items = [
      { id: "1", key: "Q1", title: "Tenancy", family: "QUESTION", depends_on: [] },
      { id: "2", key: "Q2", title: "Deposits", family: "QUESTION", depends_on: ["Q1"] },
      { id: "3", key: "R1", title: "Standing rule", family: "RULE", depends_on: [] },
    ] as never
    const roots = rootsOf(items)
    expect(roots.map((item) => item.key)).toEqual(["Q1"])
    expect(progressSummary(run, roots)).toContain("Q1  Tenancy")
  })
})
