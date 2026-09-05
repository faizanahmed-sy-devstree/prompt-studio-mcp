/**
 * The local half of a discovery run: the `weave/` folder on disk.
 *
 * Weaver writes a knowledge base into `weave/` — the inventory, the issues, the
 * feature table, the schema, the journey diagrams — and the studio is where
 * those get read and decided on. So two directions live here, both pure and
 * both testable without a network:
 *
 * - **up**: which files in `weave/` are worth pushing, and what kind each is;
 * - **down**: the decisions made in the studio written back into the markdown,
 *   because the gate that lets `weave-author` run greps those files for
 *   `PENDING` and has no idea a database exists.
 *
 * Nothing here talks to the API. `src/server.ts` does the talking.
 */

import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

import type { DiscoveryAnswer, DiscoveryItem, DiscoveryRun } from "./api"

export type WeaveArtifact = { name: string; kind: string; body: string }

/**
 * Extension to artifact kind.
 *
 * A closed map rather than a fallback: anything not listed is a file weaver did
 * not write — a `.jsonl` scratch log, a stray screenshot — and pushing it would
 * put junk in front of whoever opens the Discovery tab.
 */
const KINDS: Record<string, string> = {
  md: "md",
  dbml: "dbml",
  mmd: "mermaid",
  weave: "weave",
  json: "json",
  flow: "flow",
}

/** Paths under `weave/` that are working state, not artifacts. */
function skipped(name: string): boolean {
  return (
    name.startsWith("discovery/raw/") ||
    name === "discovery/questions.json" ||
    name.endsWith(".run-id")
  )
}

export function sha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex")
}

/**
 * Every artifact under `<dir>/weave`, named by its path inside that folder.
 *
 * The name keeps its folder (`discovery/issues.md`) because that is what the
 * studio shows and what `weaver push` sends — one name for one file, wherever
 * it is read from.
 */
export function collectWeaveArtifacts(dir: string): WeaveArtifact[] {
  const root = join(dir, "weave")
  if (!existsSync(root)) return []
  const found: WeaveArtifact[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile()) continue
      const name = relative(root, path).split(sep).join("/")
      const kind = KINDS[name.split(".").pop()?.toLowerCase() ?? ""]
      if (!kind || skipped(name)) continue
      found.push({ name, kind, body: readFileSync(path, "utf8") })
    }
  }
  walk(root)
  return found
}

export type WriteBackReport = {
  /** `decision:` lines rewritten in `discovery/issues.md`. */
  issues: number
  /** Table cells rewritten in `discovery/features.md`. */
  implied: number
  /** Answers whose key matched neither file. */
  unmatched: string[]
  /** `decision: PENDING` lines plus `| PENDING |` cells still left. Must be 0. */
  remainingPending: number
  /** Files actually rewritten, for the caller to re-push. */
  changed: string[]
}

const ISSUES = "discovery/issues.md"
const FEATURES = "discovery/features.md"

/**
 * Fold the studio's decisions back into the markdown.
 *
 * The gate is a grep — `decision: PENDING` in issues.md, a `PENDING` cell in
 * the features table — so a decision that lives only in the database is a
 * decision `weave-author` will refuse to start on. Writing back is what closes
 * that, and the report exists so the caller can say "0 pending" and mean it.
 *
 * Which file an answer belongs to is decided by where its key is found rather
 * than by its family: the files are the authority on what they contain, and a
 * family name that drifts should not silently write nothing.
 */
export function writeBackDecisions(dir: string, answers: DiscoveryAnswer[]): WriteBackReport {
  const root = join(dir, "weave")
  const read = (name: string): string | null => {
    const path = join(root, name)
    return existsSync(path) ? readFileSync(path, "utf8") : null
  }

  let issuesText = read(ISSUES)
  let featuresText = read(FEATURES)
  const report: WriteBackReport = {
    issues: 0,
    implied: 0,
    unmatched: [],
    remainingPending: 0,
    changed: [],
  }

  for (const answer of answers) {
    const decision = flatten(answer.decision)
    if (!answer.key || !decision) continue
    if (issuesText !== null) {
      const next = setIssueDecision(issuesText, answer.key, decision)
      if (next !== null) {
        issuesText = next
        report.issues += 1
        continue
      }
    }
    if (featuresText !== null) {
      const next = setFeatureDecision(featuresText, answer.key, decision)
      if (next !== null) {
        featuresText = next
        report.implied += 1
        continue
      }
    }
    report.unmatched.push(answer.key)
  }

  if (report.issues && issuesText !== null) {
    writeFileSync(join(root, ISSUES), issuesText)
    report.changed.push(ISSUES)
  }
  if (report.implied && featuresText !== null) {
    writeFileSync(join(root, FEATURES), featuresText)
    report.changed.push(FEATURES)
  }
  report.remainingPending = countPending(issuesText) + countPending(featuresText)
  return report
}

/** `decision: PENDING` lines and `| PENDING |` cells — what the gate greps for. */
export function countPending(text: string | null): number {
  if (!text) return 0
  return (text.match(/decision: PENDING/g)?.length ?? 0) + (text.match(/\| *PENDING *\|/g)?.length ?? 0)
}

/**
 * The `decision:` line of one `## I-001  conflict  severity: high` block.
 *
 * Anchored to the block rather than applied globally: every block has a line
 * reading `decision: PENDING`, so a plain replace would answer all 138 of them
 * with whatever the first answer happened to be.
 */
function setIssueDecision(text: string, key: string, decision: string): string | null {
  const header = new RegExp(`^## ${escape(key)}(?=[ \\t]|$)`, "m")
  const start = text.search(header)
  if (start < 0) return null
  const rest = text.slice(start)
  const end = rest.indexOf("\n## ")
  const block = end < 0 ? rest : rest.slice(0, end)
  const replaced = block.replace(/^decision: PENDING[^\n]*$/m, `decision: ${decision}`)
  if (replaced === block) return null
  return text.slice(0, start) + replaced + (end < 0 ? "" : rest.slice(end))
}

/** The trailing `| PENDING |` cell of the `| M-001 | … |` row. */
function setFeatureDecision(text: string, key: string, decision: string): string | null {
  const row = new RegExp(`^\\| *${escape(key)} *\\|.*$`, "m")
  const match = text.match(row)
  if (!match) return null
  // `|` inside a decision would end the cell early and shift every column after
  // it, so it becomes the broken bar weaver already uses for the same reason.
  const replaced = match[0].replace(/\| *PENDING *\|(\s*)$/, `| ${decision.replace(/\|/g, "¦")} |$1`)
  if (replaced === match[0]) return null
  return text.replace(row, () => replaced)
}

/** A decision is one cell and one line: newlines and runs of space collapse. */
function flatten(decision: string): string {
  return decision.replace(/\s+/g, " ").trim()
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The progress table `discovery_status` prints, and the wait loop repeats. */
export function progressSummary(run: DiscoveryRun, unansweredRoots: DiscoveryItem[] = []): string {
  const p = run.progress
  const lines = [
    `${run.label || "(unlabelled run)"} — ${run.id}`,
    `${p.answered}/${p.total} answered · ${p.needs_user_answered}/${p.needs_user} of the ones that need a person · ${run.done ? "DONE" : "not done"}`,
    "",
  ]
  const modules = Object.entries(p.modules ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (modules.length) {
    lines.push("module                    answered")
    for (const [name, counts] of modules) {
      const flag = counts.answered >= counts.total ? "" : "  ←"
      lines.push(`${name.padEnd(24)}  ${counts.answered}/${counts.total}${flag}`)
    }
  }
  if (unansweredRoots.length) {
    lines.push("", `Root questions still open (${unansweredRoots.length}):`)
    for (const item of unansweredRoots.slice(0, 20)) {
      lines.push(`  ${item.key}  ${item.title}`)
    }
    if (unansweredRoots.length > 20) lines.push(`  … and ${unansweredRoots.length - 20} more`)
  }
  return lines.join("\n")
}

/** Roots are what the studio pins to the top: nothing depends on them first. */
export function rootsOf(items: DiscoveryItem[]): DiscoveryItem[] {
  return items.filter((item) => !(item.depends_on ?? []).length && item.family !== "RULE")
}

/**
 * The studio address, or nothing.
 *
 * The app is a separate deployment from the API and nothing on the wire says
 * where it is, so this used to derive one from the API host by string surgery
 * — which produced a confident link to a host that need not exist. A wrong URL
 * is worse than no URL: it sends somebody to a 404 and they blame their token.
 * So: the explicit setting, the local dev pair, or `null`.
 */
export function studioAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.PROMPT_STUDIO_APP_URL?.trim().replace(/\/+$/, "")
  if (configured) return configured
  try {
    const { hostname } = new URL((env.PROMPT_STUDIO_API_URL ?? "").replace(/\/+$/, ""))
    if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:3000"
  } catch {
    // no or unparseable API URL — nothing to infer from
  }
  return null
}

/** The line the discovery tools print under their progress report. */
export function studioLink(projectId: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = studioAppUrl(env)
  return base
    ? `Answer them here: ${base}/discovery?p=${encodeURIComponent(projectId)}`
    : `Project ${projectId} — set PROMPT_STUDIO_APP_URL to get a clickable studio link.`
}
