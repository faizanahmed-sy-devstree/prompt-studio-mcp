// Vendored from Prompt Studio (features/flow-lang/serializer.ts). Do not edit here — run `pnpm sync`.
import { sectionTypeMap } from "../library/data/section-types"
import { uiLevelOf } from "../theme/data/ui-levels"
import { type ProjectDoc, projectDocSchema, type UserStory } from "../../types/project"

/**
 * The schema's own defaults.
 *
 * "Same as the default" is asked of the schema rather than restated here: a
 * default that moves in `types/project.ts` would otherwise quietly start being
 * written into every file, or stop being written at all — and the second of
 * those is silent data loss, which is exactly what this file must not do.
 */
const defaults = projectDocSchema.parse({})

/**
 * Emits canonical `.flow` source for a project document.
 *
 * The parser and this serializer are a matched pair — `parseFlow(serialize(doc))`
 * must return the same document (ids and canvas coordinates aside), which is
 * what keeps the code view a real editing surface rather than a one-way export.
 */
export function serializeFlow(doc: ProjectDoc): string {
  const out: string[] = []

  out.push(`app ${quote(doc.name)} {`)
  out.push(`  target ${doc.target}`)
  // `ui_level`, not the old `creativity`: writing both would leave two dials
  // in the file that can disagree. Reading the legacy keyword still works.
  out.push(`  ui_level ${uiLevelOf(doc)}`)
  // Which builds this project ships. Written every time rather than only when
  // it is unusual: a file that says nothing about its builds is a file that
  // silently means "web", and a reader has no way to tell that from "nobody
  // has decided yet".
  out.push(`  builds ${buildWords(doc).join(", ")}`)
  // What the build is for, which decides what the generated prompt contains
  // rather than merely how it is ordered. Written only when it is not
  // "logic-first": that is what a file saying nothing means, and what every
  // project written before the field existed does, so putting the line on every
  // brief would be a line saying nothing has changed.
  if (doc.priority !== defaults.priority) out.push(`  priority ${doc.priority}`)
  // Every theme field, not the six this used to write.
  //
  // Flow is the app's own round-trip format — Copy Flow, Paste Flow, the
  // share link, the MCP server all go through it — so a field the serializer
  // omits is a field the user loses. Typography, elevation, motion and the
  // dark-mode choice silently reverted to defaults on every round trip,
  // which is the worst kind of data loss: quiet, and only noticed later.
  //
  // Split across several lines because one line of twenty-two settings is not
  // something a person can read or edit, and this file is meant to be both.
  out.push(`  theme {`, ...themeLines(doc.theme), `  }`)
  out.push("}")

  if (doc.views.length) {
    out.push("")
    out.push("views {")
    for (const view of doc.views) {
      const note = view.note.trim() ? ` ${quote(view.note.trim())}` : ""
      out.push(`  ${view.key} ${quote(view.name)}${note}`)
    }
    out.push("}")
  }

  if (doc.flows.length) {
    out.push("")
    out.push("flows {")
    for (const flow of [...doc.flows].sort((a, b) => a.order - b.order)) {
      const head = `  flow ${flow.key} ${quote(flow.name)}`
      const hasStory = storyLines(flow.story, 4).length > 0
      if (!hasStory && !flow.note.trim()) {
        out.push(`${head} {}`)
        continue
      }
      out.push(`${head} {`)
      if (flow.note.trim()) out.push(`    note ${block(flow.note.trim(), 4)}`)
      out.push(...storyLines(flow.story, 4))
      out.push("  }")
    }
    out.push("}")
  }

  const viewKeyOf = new Map(doc.views.map((v) => [v.id, v.key]))
  const viewKeys = (ids: string[]) =>
    ids.map((id) => viewKeyOf.get(id)).filter(Boolean) as string[]

  const flowKeyOf = new Map(doc.flows.map((f) => [f.id, f.key]))
  const flowKeys = (ids: string[]) =>
    ids.map((id) => flowKeyOf.get(id)).filter(Boolean) as string[]

  if (doc.screens.length) {
    out.push("")
    for (const screen of doc.screens) {
      out.push(`screen ${screen.key} ${quote(screen.title)} {`)
      if (screen.template) out.push(`  template ${screen.template}`)
      if (screen.layout) out.push(`  layout ${screen.layout}`)
      if (screen.note.trim()) {
        out.push(`  note ${block(screen.note.trim(), 2)}`)
      }
      if (screen.surface !== "web") out.push(`  surface ${screen.surface}`)
      const belongsTo = viewKeys(screen.views)
      if (belongsTo.length) out.push(`  in [${belongsTo.join(", ")}]`)
      const journeys = flowKeys(screen.flows)
      if (journeys.length) out.push(`  flows [${journeys.join(", ")}]`)
      out.push(...storyLines(screen.story, 2))

      const modules = doc.modules
        .filter((m) => m.screenId === screen.id)
        .sort((a, b) => a.order - b.order)
      for (const module of modules) {
        const head = `  module ${module.key} ${quote(module.name)}`
        const props = [`kind ${module.kind}`]
        if (module.trigger.trim()) props.push(`on ${quote(module.trigger.trim())}`)
        const note = module.note.trim()

        // A multi-line note needs a heredoc, which cannot sit inside a
        // one-line `{ … }` body — those modules get an expanded block.
        if (note.includes("\n")) {
          out.push(`${head} {`)
          for (const prop of props) out.push(`    ${prop}`)
          out.push(`    note ${block(note, 4)}`)
          out.push("  }")
        } else {
          if (note) props.push(`note ${quote(note)}`)
          out.push(`${head} { ${props.join("; ")} }`)
        }
      }

      const moduleIds = new Set(modules.map((m) => m.id))
      const byModuleId = new Map(modules.map((m) => [m.id, m]))
      const inner = doc.moduleEdges.filter(
        (e) => moduleIds.has(e.from) && moduleIds.has(e.to)
      )
      if (inner.length) {
        out.push("  inner {")
        const width = Math.max(
          ...inner.map((e) => byModuleId.get(e.from)?.key.length ?? 0)
        )
        for (const edge of inner) {
          const from = byModuleId.get(edge.from)!
          const to = byModuleId.get(edge.to)!
          const label = edge.trigger.trim() ? ` : ${quote(edge.trigger.trim())}` : ""
          out.push(`    ${from.key.padEnd(width)} -> ${to.key}${label}`)
        }
        out.push("  }")
      }

      out.push("}")
    }
  }

  const byId = new Map(doc.screens.map((s) => [s.id, s]))
  const liveEdges = doc.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
  if (liveEdges.length) {
    out.push("")
    out.push("flow {")
    const width = Math.max(
      ...liveEdges.map((e) => byId.get(e.from)?.key.length ?? 0)
    )
    for (const edge of liveEdges) {
      const from = byId.get(edge.from)!
      const to = byId.get(edge.to)!
      const label = edge.trigger.trim() ? ` : ${quote(edge.trigger.trim())}` : ""
      const tags = viewKeys(edge.views)
      const scope = tags.length ? ` ${tags.map((k) => `@${k}`).join(" ")}` : ""
      out.push(`  ${from.key.padEnd(width)} -> ${to.key}${label}${scope}`)
    }
    out.push("}")
  }

  // The data model, before the stack: what the app stores is a property of the
  // product, not of the technology chosen to store it.
  if (doc.entities.length) {
    out.push("")
    out.push("data {")
    for (const entity of doc.entities) {
      out.push(`  table ${entity.key} ${quote(entity.name)} {`)
      if (entity.note.trim()) out.push(`    note ${quote(entity.note.trim())}`)
      for (const field of entity.fields) {
        const parts = [`    ${field.name} ${field.type}`]
        if (field.options.length) parts.push(`[${field.options.join(", ")}]`)
        if (field.primary) parts.push("pk")
        // A primary key is required and unique by definition; writing it three
        // times makes the line harder to read and says nothing extra.
        if (field.required && !field.primary) parts.push("required")
        if (field.unique && !field.primary) parts.push("unique")
        if (field.indexed && !field.primary) parts.push("index")
        if (field.defaultValue.trim()) {
          parts.push(`default ${quote(field.defaultValue.trim())}`)
        }
        if (field.note.trim()) parts.push(`note ${quote(field.note.trim())}`)
        out.push(parts.join(" "))
      }
      out.push("  }")
    }

    const keyOf = new Map(doc.entities.map((entity) => [entity.id, entity.key]))
    for (const relation of doc.relations) {
      const from = keyOf.get(relation.from)
      const to = keyOf.get(relation.to)
      // A relation with a missing end is not written: the file has to parse
      // back into the same document, and a dangling name would not resolve.
      if (!from || !to) continue
      const left = relation.fromField ? `${from}.${relation.fromField}` : from
      const right = relation.toField ? `${to}.${relation.toField}` : to
      const parts = [`  rel ${left} -> ${right} : ${relation.kind}`]
      if (relation.label.trim()) parts.push(quote(relation.label.trim()))
      if (relation.through.trim()) parts.push(`through ${relation.through.trim()}`)
      if (relation.onDelete !== "restrict") {
        parts.push(`on_delete ${relation.onDelete}`)
      }
      out.push(parts.join(" "))
    }
    out.push("}")
  }

  if (doc.sections.length) {
    out.push("")
    out.push("landing {")
    for (const section of [...doc.sections].sort((a, b) => a.order - b.order)) {
      const defaultName = sectionTypeMap[section.type]?.name ?? section.type
      const parts = [`  section ${section.type}`]
      parts.push(quote(section.name || defaultName))
      if (section.layout) parts.push(`layout ${section.layout}`)
      if (section.note.trim()) parts.push(`note ${quote(section.note.trim())}`)
      out.push(parts.join(" "))
    }
    out.push("}")
  }

  out.push("")
  out.push("stack {")
  out.push(...stackLines(doc.stack))
  out.push("}")

  out.push("")
  if (doc.structure.preset === "custom") {
    out.push(`structure custom ${block(doc.structure.customTree, 0)}`)
  } else {
    out.push(`structure ${doc.structure.preset}`)
  }

  // The other builds' technology. Omitted entirely when the project does not
  // ship them — an `apps/mobile` stack in a web-only file is noise a reader
  // has to decide to ignore.
  for (const surface of ["mobile", "backend"] as const) {
    if (!doc.builds[surface]) continue
    const config = doc.surfaces[surface]
    out.push("")
    out.push(`stack ${surface} {`)
    out.push(...stackLines(config.stack))
    out.push("}")
    if (config.structure.preset === "custom") {
      out.push(`structure ${surface} custom ${block(config.structure.customTree, 0)}`)
    } else {
      out.push(`structure ${surface} ${config.structure.preset}`)
    }
  }

  if (doc.conventions.ids.length) {
    out.push(`conventions [${doc.conventions.ids.join(", ")}]`)
  }
  if (doc.snippetIds.length) {
    out.push(`snippets [${doc.snippetIds.join(", ")}]`)
  }

  if (doc.conventions.custom.trim()) {
    out.push(`conventions_note ${block(doc.conventions.custom.trim(), 0)}`)
  }

  if (doc.requirements.trim()) {
    out.push("")
    out.push(`requirements ${block(doc.requirements.trim(), 0)}`)
  }

  return `${out.join("\n")}\n`
}

/**
 * The body of the `theme { … }` block.
 *
 * The named choices come first and are always written — the preset, the
 * colours, the type, the depth. They are what the block is *for*, and a theme
 * that showed only the settings differing from a default would read as a diff
 * rather than a description of the design.
 *
 * The dials under them are written only when they differ, which is safe for one
 * specific reason: the parser starts from `projectDocSchema.parse({})`, so a
 * line that is absent comes back as exactly the value it was omitted for. That
 * is not true of a field the serializer has no line for at all — the loss this
 * block exists to prevent, and why every field in the schema has a line here.
 */
function themeLines(theme: ProjectDoc["theme"]): string[] {
  const base = defaults.theme
  const lines = [
    // The preset every value below came from. Written even when it is the
    // default one: it is the name of the design, and a file that omits it reads
    // as though nobody chose.
    `    preset ${theme.preset}`,
    // Why this design, in the words of whoever chose it. First, because it is
    // the line a person reads before the values — and omitted when empty, so a
    // project nobody wrote one for does not carry an empty quote.
    ...(theme.designNote.trim() ? [`    note ${quote(theme.designNote.trim())}`] : []),
    `    design ${theme.designLanguage}; primary ${theme.primaryColor}; secondary ${theme.secondaryColor}`,
    `    radius ${theme.borderRadius}; buttons ${theme.buttonStyle}; density ${theme.density}`,
    `    headings ${theme.headingFont}; body ${theme.bodyFont}; scale ${theme.typeScale}`,
    `    icons ${theme.iconStyle}; elevation ${theme.elevation}; motion ${theme.motion}; scheme ${theme.colorScheme}`,
  ]

  // Four radii on one line: they are read together — "square, with round cards"
  // is one decision, not three — and `pill` is a flag on the same thought.
  const { shape } = theme
  if (
    shape.control !== base.shape.control ||
    shape.card !== base.shape.card ||
    shape.overlay !== base.shape.overlay ||
    shape.pill !== base.shape.pill
  ) {
    const pill = shape.pill ? " pill" : ""
    lines.push(
      `    shape control ${shape.control} card ${shape.card} overlay ${shape.overlay}${pill}`
    )
  }

  // Real family names, quoted because they have spaces in them. An empty slot
  // means "follow the character chosen above", which is said by leaving the
  // slot out rather than by writing an empty string the parser would then have
  // to tell apart from a mistake.
  const families: string[] = []
  if (theme.fonts.display) families.push(`display ${quote(theme.fonts.display)}`)
  if (theme.fonts.body) families.push(`body ${quote(theme.fonts.body)}`)
  if (theme.fonts.mono) families.push(`mono ${quote(theme.fonts.mono)}`)
  if (families.length) lines.push(`    fonts ${families.join(" ")}`)

  const dials: string[] = []
  if (theme.scaleRatio !== base.scaleRatio) dials.push(`scale_ratio ${theme.scaleRatio}`)
  if (theme.vividness !== base.vividness) dials.push(`vividness ${theme.vividness}`)
  if (theme.neutralHue !== base.neutralHue) dials.push(`neutral_hue ${theme.neutralHue}`)
  if (dials.length) lines.push(`    ${dials.join("; ")}`)

  const depth: string[] = []
  if (theme.elevationStrategy !== base.elevationStrategy) {
    depth.push(`elevation_strategy ${theme.elevationStrategy}`)
  }
  if (theme.motionModel !== base.motionModel) depth.push(`motion_model ${theme.motionModel}`)
  if (theme.inputStyle !== base.inputStyle) depth.push(`inputs ${theme.inputStyle}`)
  if (depth.length) lines.push(`    ${depth.join("; ")}`)

  // Overrides only, one block per mode, and nothing at all when the preset was
  // left alone — which is the usual case and should cost no lines.
  for (const mode of ["light", "dark"] as const) {
    const entries = Object.entries(theme.palette[mode])
    if (!entries.length) continue
    lines.push(`    palette ${mode} {`)
    for (const [token, value] of entries) {
      lines.push(`      ${token} ${colorValue(value)}`)
    }
    lines.push(`    }`)
  }

  return lines
}

/**
 * A colour override, bare where it can be.
 *
 * `oklch(0.55 0.12 250)` reads better unquoted than in quotes, and the
 * tokenizer copes: it treats `#` as a comment only before whitespace, so a hex
 * literal survives too. Quoting is kept for the values that would not — a
 * `;` or a brace inside one would otherwise end the statement early — and for
 * an override someone has emptied, where a bare value would leave the token
 * name alone on the line with nothing to read back.
 */
function colorValue(value: string) {
  const trimmed = value.trim()
  return !trimmed || /[";{}]|\/\//.test(trimmed) ? quote(trimmed) : trimmed
}

/**
 * One stack block's lines.
 *
 * Blank values are skipped, which is what makes the same function work for a
 * service: it has no icon set and no charts, and writing `icons` with nothing
 * after it produces a line the parser then has to decide what to do with.
 */
function stackLines(stack: ProjectDoc["stack"]): string[] {
  const keys: [keyof ProjectDoc["stack"], string][] = [
    ["framework", "framework"],
    ["language", "language"],
    ["styling", "styling"],
    ["state", "state"],
    ["forms", "forms"],
    ["http", "http"],
    ["icons", "icons"],
    ["tables", "tables"],
    ["charts", "charts"],
    ["database", "database"],
    ["orm", "orm"],
    ["apiStyle", "apiStyle"],
    ["apiAuth", "apiAuth"],
    ["testing", "testing"],
    ["tooling", "tooling"],
    ["packageManager", "packageManager"],
  ]
  const width = Math.max(...keys.map(([, label]) => label.length))
  const lines: string[] = []
  for (const [key, label] of keys) {
    const value = stack[key]
    if (typeof value !== "string" || !value.trim()) continue
    lines.push(`  ${label.padEnd(width)} ${value}`)
  }
  if (stack.extras.length) {
    lines.push(`  extras ${stack.extras.map((extra) => quote(extra)).join(" ")}`)
  }
  return lines
}

/** The builds this project ships, for the `builds` line. */
function buildWords(doc: ProjectDoc): string[] {
  const words = (["web", "mobile", "backend"] as const).filter(
    (surface) => doc.builds[surface]
  )
  // A project that ships nothing is not a state the app can produce, but a
  // hand-edited file can say it — and "builds" with nothing after it does not
  // parse back.
  return words.length ? [...words] : ["web"]
}

/**
 * A `story { … }` body, or nothing at all when the story is empty.
 *
 * Emitted as a block rather than a sentence so it parses back into the same
 * three fields it came from — the round-trip is what makes the code view a
 * real editing surface rather than an export.
 */
function storyLines(story: UserStory, indent: number): string[] {
  // A story field is one sentence. Collapsing any newline that got typed into
  // one keeps `quote()` honest — it has no escape for a line break, and a raw
  // one would split the statement in half on the way back in.
  const flat = (value: string) => value.replace(/\s*\n\s*/g, " ").trim()
  const role = flat(story.role)
  const want = flat(story.want)
  const soThat = flat(story.soThat)
  const criteria = story.criteria.map(flat).filter(Boolean)
  if (!role && !want && !soThat && !criteria.length) return []

  const pad = " ".repeat(indent)
  const inner = " ".repeat(indent + 2)
  const item = " ".repeat(indent + 4)
  const lines = [`${pad}story {`]
  if (role) lines.push(`${inner}as     ${quote(role)}`)
  if (want) lines.push(`${inner}want   ${quote(want)}`)
  if (soThat) lines.push(`${inner}so     ${quote(soThat)}`)
  if (criteria.length) {
    lines.push(`${inner}accept [`)
    for (const entry of criteria) lines.push(`${item}${quote(entry)}`)
    lines.push(`${inner}]`)
  }
  lines.push(`${pad}}`)
  return lines
}

function quote(value: string) {
  return `"${value.replace(/"/g, "'")}"`
}

/** Multi-line values use a heredoc; single-line ones stay quoted. */
function block(value: string, indent: number) {
  if (!value.includes("\n")) return quote(value)
  const pad = " ".repeat(indent)
  const body = value
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n")
  return `"""\n${body}\n${pad}"""`
}
