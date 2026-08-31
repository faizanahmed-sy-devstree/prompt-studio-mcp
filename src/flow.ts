/**
 * What the tools actually do, with no transport and no network in sight.
 *
 * Everything here is a pure function from a document (and maybe some Flow
 * source) to a document, a string, or a list of complaints — which is what
 * makes it testable without standing a server up.
 */

import { describeMerge, mergeDoc } from "./studio/features/flow-lang/merge"
import { parseFlow } from "./studio/features/flow-lang/parser"
import { serializeFlow } from "./studio/features/flow-lang/serializer"
import { starterDoc } from "./studio/features/library/data/starters"
import { buildPrompt } from "./studio/features/prompt/engine/build-prompt"
import { type ProjectDoc, projectDocSchema, type Surface } from "./studio/types/project"

export type ApplyResult =
  | { ok: false; issues: string[] }
  | { ok: true; doc: ProjectDoc; summary: string }

/**
 * A stored document, checked.
 *
 * `projectDocSchema` fills every missing field with a default, which is what
 * makes an older stored document safe to read here without a migration step.
 * A payload it cannot parse at all is a real problem and says so.
 */
export function readDoc(payload: unknown): ProjectDoc {
  const parsed = projectDocSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(
      `This project's document could not be read: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`
    )
  }
  return parsed.data
}

/** The document as Flow source — the form Claude is expected to read and write. */
export function toFlow(payload: unknown): string {
  return serializeFlow(readDoc(payload))
}

/**
 * Parse Flow source without touching a project.
 *
 * The point of a separate check is iteration: getting the grammar right should
 * not cost a write, and a write that is going to fail should fail before it
 * has moved anybody's diagram.
 */
export function checkFlow(source: string): {
  ok: boolean
  errors: string[]
  warnings: string[]
  summary: string
} {
  const result = parseFlow(source)
  return {
    ok: result.errors.length === 0,
    errors: result.errors.map(render),
    // Warnings are not failures and must not read as ones: an unknown layout id
    // still produces a screen, and refusing the write over it would make the
    // grammar feel far more brittle than it is.
    warnings: result.warnings.map(render),
    summary: describe(result.doc),
  }
}

function render(issue: { line: number; message: string }): string {
  return `line ${issue.line}: ${issue.message}`
}

/**
 * Fold Flow source into a document.
 *
 * `merge` is the default and the safe one: it resolves screens and flows by
 * key, fills blanks rather than overwriting, and leaves anything the source did
 * not mention alone — so Claude adding one journey does not silently delete the
 * eleven it was not told about. `replace` is the honest name for the other
 * thing, and is never what you want by accident.
 */
export function applyFlow(
  current: ProjectDoc,
  source: string,
  mode: "merge" | "replace"
): ApplyResult {
  const parsed = parseFlow(source)
  if (parsed.errors.length > 0) {
    return { ok: false, issues: parsed.errors.map(render) }
  }
  if (mode === "replace") {
    return { ok: true, doc: parsed.doc, summary: `Replaced. ${describe(parsed.doc)}` }
  }
  // `mergeDoc` writes into the document it is given. Cloning first keeps a
  // failed save from leaving the caller holding a half-merged document it
  // believes is still the server's.
  const target: ProjectDoc = structuredClone(current)
  const report = mergeDoc(target, parsed.doc)
  return { ok: true, doc: target, summary: `${describeMerge(report)}. ${describe(target)}` }
}

/** A document from Flow source alone, for a project that does not exist yet. */
export function newDoc(name: string, source: string | null): ApplyResult {
  const blank = starterDoc("blank") ?? starterDoc("saas-dashboard")
  if (!blank) return { ok: false, issues: ["No starter document is available."] }
  const base: ProjectDoc = { ...blank, name }
  if (!source?.trim()) return { ok: true, doc: base, summary: "An empty project." }
  const applied = applyFlow(base, source, "merge")
  if (!applied.ok) return applied
  // The name in the tool call wins over any name in the source: the caller
  // asked for a project by that name, and finding a differently-named one in
  // the list afterwards is a small mystery nobody needs.
  return { ...applied, doc: { ...applied.doc, name } }
}

export function promptFor(payload: unknown, surface: Surface): string {
  const doc = readDoc(payload)
  return buildPrompt(doc, { surface }).text
}

function describe(doc: ProjectDoc): string {
  const parts = [
    `${doc.screens.length} screens`,
    `${doc.flows.length} journeys`,
    `${doc.edges.length} connections`,
  ]
  // Only when there is one: a report of "0 tables" on a project that stores
  // nothing is noise, and on one that does, the count is the thing to check.
  if (doc.entities.length) {
    parts.push(`${doc.entities.length} tables`, `${doc.relations.length} relations`)
  }
  return `${parts.join(", ")}.`
}
