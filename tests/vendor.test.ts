import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { buildAuthoringPrompt } from "../src/studio/features/flow-lang/authoring-prompt"
import { applyFlow, checkFlow, newDoc, promptFor, readDoc, toFlow } from "../src/flow"

/**
 * The drift check the sync script has always claimed exists.
 *
 * `src/studio/` is a copy of the app, and a copy drifts. This one drifted a
 * whole sprint: the vendored schema stopped at `colorScheme`, so every write
 * from Claude Code — `write_flow`, `push_flow`, `create_project` — parsed the
 * project through a schema that had never heard of `preset`, `shape`,
 * `palette`, `fonts` or `priority`, and zod dropped all of them. The document
 * went back to the server stripped, stamped with a schema version the backend
 * had no reason to question, and someone's design silently reverted for the
 * whole team.
 *
 * Every assertion here is about a field surviving the trip rather than about
 * the schema's shape, because a schema test passes against a schema that is
 * simply out of date.
 */
const blank = newDoc("Designed", 'screen Home { layout auth-center }')
if (!blank.ok) throw new Error(blank.issues.join("; "))

// A real starter document with the design fields set on top, so the surfaces,
// stack and layouts are the ones the app actually produces.
const DESIGNED = {
  ...blank.doc,
  name: "Designed",
  theme: {
    ...blank.doc.theme,
    // "basic" is the language that tells the agent not to design, and it emits
    // no stylesheet by design — so the fixture picks one that does.
    designLanguage: "modern-soft",
    preset: "telegraph",
    shape: { control: 2, card: 4, overlay: 24, pill: true },
    palette: { light: { primary: "oklch(0.55 0.12 250)" }, dark: {} },
    fonts: { display: "Fraunces", body: "Karla", mono: "Fira Code" },
    scaleRatio: 1.414,
    vividness: 42,
    neutralHue: 85,
    elevationStrategy: "hairline",
    motionModel: "none",
    inputStyle: "underline",
    density: "compact",
  },
  priority: "ui-first",
}

describe("the vendored copy still speaks the app's document format", () => {
  const doc = readDoc(DESIGNED)

  it("keeps every design field the editor writes", () => {
    expect(doc.theme.preset).toBe("telegraph")
    expect(doc.theme.shape).toEqual({ control: 2, card: 4, overlay: 24, pill: true })
    expect(doc.theme.palette.light.primary).toBe("oklch(0.55 0.12 250)")
    expect(doc.theme.fonts.display).toBe("Fraunces")
    expect(doc.theme.scaleRatio).toBe(1.414)
    expect(doc.theme.vividness).toBe(42)
    expect(doc.theme.neutralHue).toBe(85)
    expect(doc.theme.elevationStrategy).toBe("hairline")
    expect(doc.theme.motionModel).toBe("none")
    expect(doc.theme.inputStyle).toBe("underline")
    expect(doc.priority).toBe("ui-first")
  })

  it("writes them to .flow and reads them back", () => {
    const flow = toFlow(doc)
    expect(flow).toContain("preset telegraph")
    const back = checkFlow(flow)
    expect(back.errors, JSON.stringify(back.errors)).toHaveLength(0)
    // A warning here means the grammar moved and this copy did not: the
    // serializer wrote a line its own parser does not understand.
    expect(back.warnings, JSON.stringify(back.warnings)).toHaveLength(0)
  })

  it("builds the prompt the app builds, stylesheet included", () => {
    const prompt = promptFor(doc, "web")
    // The stylesheet itself, not a heading: the point of the block is that it
    // ships a file rather than a description of one.
    expect(prompt).toContain("--background")
    expect(prompt).toContain("--primary")
    // And the craft rules that came with it.
    expect(prompt).toContain("Do not ship any of these")
    // The contradiction the app fixed: legacy defaults asserted beside a
    // preset that says otherwise.
    expect(prompt).not.toContain("Corners: fully rounded")
  })

  it("still teaches the grammar it now writes", () => {
    const guide = promptFor(doc, "web")
    expect(guide.length).toBeGreaterThan(1000)
  })
})

describe("the guide it hands Claude asks for a design", () => {
  it("lists the presets by id", () => {
    const guide = buildAuthoringPrompt()
    for (const id of ["atrium", "telegraph", "azure", "scalpel"]) {
      expect(guide, `${id} missing`).toContain(`\`${id}\``)
    }
  })

  it("asks for the reason as well as the choice", () => {
    expect(buildAuthoringPrompt()).toContain("note")
  })
})

/**
 * The schema block weaver emits, against the parser this server vendors.
 *
 * `weave/schema.flow` is a `data { … }` block and nothing else, and it reaches
 * the Data canvas through `applyFlow` in merge mode. Two copies of a grammar
 * with a file passed between them is exactly where drift shows up as "the
 * tables did not appear and nothing said why" — so the fixture is not written
 * by hand here. It is the literal output of weaver's `emitFlowData` on
 * `weaver/test/fixtures/crm.weave`, committed as a file: a hand-written sample
 * only proves this parser agrees with whoever wrote the sample.
 *
 * Regenerate with, from the weaver checkout:
 *   pnpm exec tsx -e "import{readFileSync,writeFileSync}from'node:fs';\
 *     import{parse}from'./src/parse.ts';import{emitFlowData}from'./src/emit-flow.ts';\
 *     writeFileSync('<mcp>/tests/fixtures/crm.schema.flow',\
 *       emitFlowData(parse(readFileSync('test/fixtures/crm.weave','utf8'))))"
 */
const SCHEMA_FLOW = readFileSync(
  new URL("./fixtures/crm.schema.flow", import.meta.url),
  "utf8"
)
const SCHEMA_TABLES = SCHEMA_FLOW.match(/^\s*table /gm)?.length ?? 0

describe("the data block weaver writes into weave/schema.flow", () => {
  it("parses with no errors and no warnings", () => {
    expect(SCHEMA_TABLES).toBeGreaterThan(0)
    const result = checkFlow(SCHEMA_FLOW)
    expect(result.errors, JSON.stringify(result.errors)).toHaveLength(0)
    expect(result.warnings, JSON.stringify(result.warnings)).toHaveLength(0)
    expect(result.summary).toContain(`${SCHEMA_TABLES} tables`)
  })

  it("merges onto an existing project without taking its screens away", () => {
    const applied = applyFlow(blank.doc, SCHEMA_FLOW, "merge")
    if (!applied.ok) throw new Error(applied.issues.join("; "))
    expect(applied.doc.entities.length).toBeGreaterThanOrEqual(SCHEMA_TABLES)
    // Every relation weaver emitted survived the merge.
    expect(applied.doc.relations.length).toBeGreaterThanOrEqual(
      SCHEMA_FLOW.match(/^\s*rel /gm)?.length ?? 0
    )
    // The screen the starter had is still there: merge, not replace.
    expect(applied.doc.screens.map((screen) => screen.title)).toContain("Home")
    expect(applied.summary).toContain(`${SCHEMA_TABLES} tables`)
  })
})
