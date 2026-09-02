// Vendored from Prompt Studio (features/flow-lang/parser.ts). Do not edit here — run `pnpm sync`.
import { autoLayout } from "../builder/utils/graph"
import {
  CARD_HEIGHT_FALLBACK,
  nodeWidthFor,
} from "../builder/utils/node-geometry"
import { ENTITY_WIDTH, entityHeight } from "../data/utils/geometry"
import { allLayouts } from "../library/data/layouts"
import { moduleKinds } from "../library/data/module-kinds"
import { sectionTypes } from "../library/data/section-types"
import { snippets } from "../library/data/snippets"
import { screenTemplates } from "../library/data/templates"
import { promptTargets } from "../prompt/engine/targets"
import { conventions } from "../stack/data/conventions"
import { stackGroups } from "../stack/data/stack-catalogue"
import { structurePresets } from "../stack/data/structures"
import { designLanguages } from "../theme/data/design-languages"
import { presetById, presets } from "../theme/data/presets"
import { uiLevelFromLegacyCreativity } from "../theme/data/ui-levels"
import { slugify, uid, uniqueKey } from "../../lib/utils"
import {
  bodyFontValues,
  colorSchemeValues,
  type Entity,
  type EntityField,
  elevationStrategyValues,
  elevationValues,
  type FlowEdge,
  type FlowGroup,
  type FlowView,
  fieldKindValues,
  fontCharacterValues,
  iconStyleValues,
  inputStyleValues,
  type ModuleEdge,
  motionModelValues,
  motionValues,
  type ProjectDoc,
  priorityValues,
  projectDocSchema,
  type Relation,
  type RelationKind,
  relationKindValues,
  type Screen,
  type ScreenModule,
  type Section,
  type Surface,
  surfaceValues,
  typeScaleValues,
  type UserStory,
} from "../../types/project"

import {
  closestMatch,
  readQuoted,
  resolveHeredoc,
  tokenize,
} from "./tokenize"

export type ParseIssue = { line: number; message: string }

export type ParseResult = {
  doc: ProjectDoc
  /** a `profile "..."` statement — the caller expands it */
  profile?: string
  warnings: ParseIssue[]
  errors: ParseIssue[]
  /**
   * The theme fields this file actually stated.
   *
   * Empty for a file with no theme block, which is the difference between "no
   * opinion about the design" and "the default design" — a distinction a
   * parsed document cannot express on its own, because every absent line comes
   * back as its default.
   */
  themeStated: (keyof ProjectDoc["theme"])[]
}

const layoutIds = allLayouts.map((l) => l.id)
const templateIds = screenTemplates.map((t) => t.id)
const sectionTypeIds = sectionTypes.map((s) => s.id)
const conventionIds = conventions.map((c) => c.id)
const snippetIds = snippets.map((s) => s.id)
const structureIds = structurePresets.map((s) => s.id)
const targetIds = promptTargets.map((t) => t.id)
const moduleKindIds = moduleKinds.map((k) => k.id)

const radiusAliases: Record<string, string> = {
  none: "none",
  "0": "none",
  square: "none",
  sm: "small",
  small: "small",
  md: "medium",
  medium: "medium",
  lg: "large",
  large: "large",
  xl: "large",
  full: "full",
  pill: "full",
  rounded: "full",
}

const buttonAliases: Record<string, string> = {
  filled: "filled",
  solid: "filled",
  outlined: "outlined",
  outline: "outlined",
  ghost: "outlined",
  rounded: "rounded",
  pill: "rounded",
  sharp: "sharp",
  square: "sharp",
}

const densityAliases: Record<string, string> = {
  compact: "compact",
  dense: "compact",
  comfortable: "comfortable",
  normal: "comfortable",
  default: "comfortable",
  spacious: "spacious",
  roomy: "spacious",
}

/** Which radius a word in a `shape` line is setting. */
const shapeAliases: Record<string, "control" | "card" | "overlay"> = {
  control: "control",
  controls: "control",
  button: "control",
  buttons: "control",
  input: "control",
  inputs: "control",
  card: "card",
  cards: "card",
  panel: "card",
  panels: "card",
  surface: "card",
  overlay: "overlay",
  overlays: "overlay",
  dialog: "overlay",
  modal: "overlay",
  sheet: "overlay",
}

/** Which family a word in a `fonts` line is naming. */
const fontSlotAliases: Record<string, "display" | "body" | "mono"> = {
  display: "display",
  heading: "display",
  headings: "display",
  title: "display",
  body: "body",
  text: "body",
  paragraph: "body",
  mono: "mono",
  code: "mono",
  monospace: "mono",
}

/**
 * `pill` on a shape line is a flag, not a value — the word alone means true.
 * The negatives are here so a hand-edited file can turn it back off with a
 * word rather than by deleting the line and hoping the default is right.
 */
const PILL_WORDS = /\b(pill|no_pill|nopill|not_pill|square|squared)\b/gi

const priorityAliases: Record<string, (typeof priorityValues)[number]> = {
  "logic-first": "logic-first",
  logic_first: "logic-first",
  logicfirst: "logic-first",
  logic: "logic-first",
  system: "logic-first",
  full: "logic-first",
  "ui-first": "ui-first",
  ui_first: "ui-first",
  uifirst: "ui-first",
  ui: "ui-first",
  design: "ui-first",
  prototype: "ui-first",
}

type Ctx =
  | { kind: "root" }
  | { kind: "app" }
  | { kind: "theme" }
  /**
   * A `palette light { … }` body — the colour overrides for one mode. It holds
   * the mode rather than an id because there are only ever two of them, and
   * both hang off the one theme.
   */
  | { kind: "palette"; mode: "light" | "dark" }
  | { kind: "screen"; id: string }
  | { kind: "module"; id: string; screenId: string }
  | { kind: "inner"; screenId: string }
  | { kind: "flow" }
  | { kind: "views" }
  | { kind: "flows" }
  | { kind: "flowGroup"; id: string }
  /**
   * A `story { … }` body. It holds the story object itself rather than an id
   * because a story hangs off either a screen or a flow, and threading "which
   * kind of parent" through would buy nothing. `collecting` is true while a
   * multi-line `accept [ … ]` list is still open.
   */
  | { kind: "story"; story: UserStory; collecting: boolean }
  | { kind: "landing" }
  | { kind: "data" }
  | { kind: "table"; id: string }
  | { kind: "stack"; surface: Surface }
  | { kind: "unknown" }

/**
 * Parses `.flow` source into a project document.
 *
 * Tolerance is the whole point: braces, semicolons and quotes are optional,
 * `->` `→` `=>` all connect, unknown ids are fuzzy-matched and warned about
 * rather than dropped, and screens referenced but never declared are created.
 */
export function parseFlow(source: string): ParseResult {
  const { lines, heredocs } = tokenize(source)
  const warnings: ParseIssue[] = []
  /** Filled as theme lines are applied; see the diff at the call site. */
  const themeStated = new Set<keyof ProjectDoc["theme"]>()
  const errors: ParseIssue[] = []

  const doc: ProjectDoc = projectDocSchema.parse({})
  const screens: Screen[] = []
  const edges: FlowEdge[] = []
  const modules: ScreenModule[] = []
  const moduleEdges: ModuleEdge[] = []
  const sections: Section[] = []
  const views: FlowView[] = []
  const flows: FlowGroup[] = []
  const entities: Entity[] = []
  /**
   * Relations are collected as written and resolved once every table is known:
   * a file may join `orders` to `users` before `users` is declared, and
   * refusing that would make the format order-dependent for no reason.
   */
  const relationDrafts: RelationDraft[] = []
  const byKey = new Map<string, Screen>()
  let profile: string | undefined

  const stack: Ctx[] = [{ kind: "root" }]
  let pending: Ctx | null = null
  const ctx = () => stack[stack.length - 1]

  const ensureScreen = (rawKey: string, _line: number, title?: string) => {
    const key = slugify(rawKey)
    const existing = byKey.get(key)
    if (existing) {
      if (title) existing.title = title
      return existing
    }
    const screen: Screen = {
      id: uid("scr"),
      key: uniqueKey(key, byKey.keys()),
      title: title || titleFromKey(key),
      template: "",
      layout: "",
      note: "",
      surface: "web",
      views: [],
      flows: [],
      story: emptyStory(),
      x: 0,
      y: 0,
    }
    screens.push(screen)
    byKey.set(screen.key, screen)
    return screen
  }

  /**
   * Module keys are unique per screen, not per project — two screens may each
   * own a plain `table`. Referencing a module that was never declared creates
   * it, the same tolerance `flow` blocks get for screens.
   */
  const ensureModule = (screenId: string, rawKey: string, name?: string) => {
    const key = slugify(rawKey)
    const siblings = modules.filter((m) => m.screenId === screenId)
    const existing = siblings.find((m) => m.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const module: ScreenModule = {
      id: uid("mod"),
      screenId,
      key: uniqueKey(
        key,
        siblings.map((m) => m.key)
      ),
      name: name || titleFromKey(key),
      kind: "panel",
      trigger: "",
      note: "",
      order: siblings.length,
    }
    modules.push(module)
    return module
  }

  /**
   * Views are declared in a `views { … }` block, but a screen may also name one
   * that was never declared — creating it is the same tolerance screens get
   * inside a `flow` block, and losing a role tag silently would be worse.
   */
  const ensureView = (rawKey: string, name?: string) => {
    const key = slugify(rawKey)
    if (!key) return null
    const existing = views.find((v) => v.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const view: FlowView = {
      id: uid("vw"),
      key,
      name: name || titleFromKey(key),
      note: "",
    }
    views.push(view)
    return view
  }

  /**
   * Flow groups, like views, may be named before they are declared — a screen
   * tagged `flows [auth]` in a file whose `flows { … }` block the model forgot
   * should still be grouped, not silently ungrouped.
   */
  const ensureFlow = (rawKey: string, name?: string) => {
    const key = slugify(rawKey)
    if (!key) return null
    const existing = flows.find((f) => f.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const flow: FlowGroup = {
      id: uid("flw"),
      key,
      name: name || titleFromKey(key),
      story: emptyStory(),
      note: "",
      order: flows.length,
    }
    flows.push(flow)
    return flow
  }

  /**
   * Tables, like screens, may be referenced before they are declared — a
   * relation naming `users` in a file whose `table users` block comes later,
   * or never. Creating it is the same tolerance the rest of the format has.
   */
  const ensureEntity = (rawKey: string, name?: string) => {
    const key = slugify(rawKey).replace(/-/g, "_")
    if (!key) return null
    const existing = entities.find((entity) => entity.key === key)
    if (existing) {
      if (name) existing.name = name
      return existing
    }
    const entity: Entity = {
      id: uid("ent"),
      key,
      name: name || titleFromKey(key),
      note: "",
      fields: [],
      x: 0,
      y: 0,
    }
    entities.push(entity)
    return entity
  }

  /** `@super_admin @admin` anywhere on a line — the view tags for a transition. */
  const readViewTags = (text: string) => {
    const ids: string[] = []
    for (const match of text.matchAll(/@([a-z0-9_-]+)/gi)) {
      const view = ensureView(match[1])
      if (view && !ids.includes(view.id)) ids.push(view.id)
    }
    return ids
  }

  const matchId = (
    value: string,
    candidates: string[],
    label: string,
    line: number
  ) => {
    const normalised = value.trim()
    if (!normalised) return ""
    if (candidates.includes(normalised)) return normalised
    const suggestion = closestMatch(normalised, candidates)
    if (suggestion) {
      warnings.push({
        line,
        message: `Unknown ${label} "${normalised}" — using "${suggestion}".`,
      })
      return suggestion
    }
    warnings.push({
      line,
      message: `Unknown ${label} "${normalised}" — kept as-is; the prompt will describe it literally.`,
    })
    return normalised
  }

  for (const entry of lines) {
    const { line } = entry
    const raw = entry.text.trim()
    if (!raw) continue

    if (raw === "{") {
      stack.push(pending ?? { kind: "unknown" })
      pending = null
      continue
    }
    if (raw === "}") {
      if (stack.length > 1) stack.pop()
      else errors.push({ line, message: "Unmatched `}`." })
      pending = null
      continue
    }

    // A header that did not open a block applies immediately; drop it.
    pending = null

    const { rest, quoted } = readQuoted(raw)
    const words = rest.split(/[\s,]+/).filter(Boolean)
    const keyword = (words[0] ?? "").toLowerCase()
    const current = ctx()

    // ------------------------------------------------- inner (module) flow
    // Checked before the screen-level flow block, otherwise the arrow test
    // below would claim these lines and wire module keys into screens.
    if (current.kind === "inner") {
      const trigger = quoted[0] ?? ""
      const chain = rest
        .split(/->|=>|→/)
        .map((part) => part.replace(/:.*$/, "").trim())
        .filter(Boolean)
      if (chain.length === 1) {
        ensureModule(current.screenId, chain[0])
        continue
      }
      if (chain.length < 2) {
        errors.push({ line, message: `Could not read inner connection: "${raw}".` })
        continue
      }
      for (let i = 0; i < chain.length - 1; i += 1) {
        const from = ensureModule(current.screenId, chain[i])
        const to = ensureModule(current.screenId, chain[i + 1])
        if (from.id === to.id) {
          warnings.push({ line, message: `"${from.name}" cannot connect to itself.` })
          continue
        }
        if (moduleEdges.some((e) => e.from === from.id && e.to === to.id)) {
          warnings.push({
            line,
            message: `Duplicate inner connection ${from.key} → ${to.key} ignored.`,
          })
          continue
        }
        moduleEdges.push({
          id: uid("med"),
          from: from.id,
          to: to.id,
          trigger: i === 0 ? trigger : "",
        })
      }
      continue
    }

    // ----------------------------------------------------------- data block
    // Ahead of the arrow test below, which would otherwise read `rel
    // orders.user_id -> users.id` as a screen transition and invent two
    // screens named after columns.
    if (current.kind === "data" || current.kind === "table") {
      // A relation line, wherever it appears in the block.
      if (
        keyword === "rel" ||
        keyword === "relation" ||
        keyword === "ref" ||
        keyword === "references" ||
        (current.kind === "data" && /(->|<->|=>|→|↔)/.test(rest))
      ) {
        const draft = readRelation(rest, quoted, line, warnings)
        if (draft) relationDrafts.push(draft)
        else errors.push({ line, message: `Could not read relation: "${raw}".` })
        continue
      }

      if (current.kind === "data") {
        const declares =
          keyword === "table" || keyword === "entity" || keyword === "model"
        const key = declares ? (words[1] ?? "") : (words[0] ?? "")
        const entity = ensureEntity(key, quoted[0])
        if (!entity) {
          errors.push({ line, message: `Could not read table: "${raw}".` })
          continue
        }
        if (quoted[1]) entity.note = quoted[1]
        pending = { kind: "table", id: entity.id }
        continue
      }

      // Inside a table: a property, or a column.
      const entity = entities.find((e) => e.id === current.id)
      if (!entity) continue
      // `note` and `name` are also perfectly ordinary column names, so they
      // are a property of the table only when written as one: the keyword
      // alone, followed by a quoted value. `name text` is a column.
      const isProperty = words.length === 1 && quoted.length > 0
      if (isProperty && (keyword === "note" || keyword === "description")) {
        entity.note = resolveHeredoc(quoted[0] ?? "", heredocs).trim()
        continue
      }
      if (isProperty && (keyword === "name" || keyword === "title")) {
        const value = (quoted[0] ?? "").trim()
        if (value) entity.name = value
        continue
      }

      const column = readColumn(rest, quoted, line, warnings)
      if (!column) {
        errors.push({ line, message: `Could not read column: "${raw}".` })
        continue
      }
      const duplicate = entity.fields.find((f) => f.name === column.field.name)
      if (duplicate) {
        warnings.push({
          line,
          message: `\`${entity.key}.${column.field.name}\` is declared twice — the second one wins.`,
        })
        Object.assign(duplicate, column.field, { id: duplicate.id })
      } else {
        entity.fields.push(column.field)
      }
      // `user_id uuid ref users.id` — the join written on the column itself.
      if (column.ref) {
        relationDrafts.push({
          from: entity.key,
          fromField: column.field.name,
          to: column.ref.table,
          toField: column.ref.field,
          kind: column.field.unique ? "one-to-one" : "many-to-one",
          label: "",
          onDelete: column.ref.onDelete ?? "restrict",
          through: "",
          line,
        })
      }
      continue
    }

    // ---------------------------------------------------------- module block
    if (current.kind === "module") {
      const module = modules.find((m) => m.id === current.id)
      if (!module) continue
      const value = words.slice(1).join(" ").trim()
      switch (keyword) {
        case "kind":
        case "type":
          module.kind = matchId(
            value || quoted[0] || "",
            moduleKindIds,
            "module kind",
            line
          )
          break
        case "on":
        case "trigger":
        case "when":
          module.trigger = quoted[0] ?? value
          break
        case "name":
        case "title":
          module.name = quoted[0] || value
          break
        case "note":
        case "notes":
        case "description":
          module.note = resolveHeredoc(quoted[0] ?? value, heredocs)
          break
        default:
          warnings.push({
            line,
            message: `Unknown module property "${keyword}" — ignored.`,
          })
      }
      continue
    }

    // ----------------------------------------------------------- story block
    // Before the arrow test below, deliberately: an acceptance criterion may
    // legitimately read "login -> dashboard", and that must not be mistaken
    // for a transition.
    if (current.kind === "story") {
      const story = current.story

      if (current.collecting) {
        pushCriteria(story, raw, heredocs)
        if (raw.includes("]")) current.collecting = false
        continue
      }

      const inline = (quoted[0] ?? words.slice(1).join(" ")).trim()
      const value = resolveHeredoc(inline, heredocs).trim()
      switch (keyword) {
        case "as":
        case "as_a":
        case "role":
        case "persona":
        case "who":
          story.role = stripLead(value, /^as\s+(a|an|the)\s+/i)
          break
        case "want":
        case "wants":
        case "i_want":
        case "iwant":
        case "goal":
        case "need":
          story.want = stripLead(value, /^i\s+want\s+(to\s+)?/i)
          break
        case "so":
        case "so_that":
        case "sothat":
        case "benefit":
        case "value":
        case "why":
          story.soThat = stripLead(value, /^so\s+that\s+/i)
          break
        case "accept":
        case "acceptance":
        case "acceptance_criteria":
        case "criteria":
        case "ac":
        case "given": {
          const items = quoted.length ? quoted : bracketList(rest)
          const heredoc = rest.match(/«H\d+»/)
          if (heredoc) {
            for (const line of resolveHeredoc(heredoc[0], heredocs).split("\n")) {
              const text = line.replace(/^\s*[-*•]\s*/, "").trim()
              if (text) story.criteria.push(text)
            }
          } else {
            for (const item of items) {
              const text = item.trim()
              if (text) story.criteria.push(text)
            }
          }
          // `accept [` on its own opens a list that runs over several lines.
          if (raw.includes("[") && !raw.includes("]")) current.collecting = true
          break
        }
        default:
          warnings.push({
            line,
            message: `Unknown story property "${keyword}" — ignored.`,
          })
      }
      continue
    }

    // --------------------------------------------------- palette (in a theme)
    // Up here rather than beside the theme block below, and deliberately: a
    // colour override is arbitrary CSS. `oklch(0.7 0.1 250)` has spaces in it
    // and a gradient can contain an arrow, and the transition test further down
    // would read either as a connection and invent screens named after them.
    if (current.kind === "palette") {
      const token = words[0] ?? ""
      if (!token) continue
      // The value is taken off the raw line rather than out of `words`, which
      // has already split `oklch(0.55 0.12 250)` into three of them.
      const bare = raw.slice(raw.indexOf(token) + token.length).trim()
      const value = quoted.length ? quoted[0] : bare
      if (!quoted.length && !bare) {
        warnings.push({
          line,
          message: `\`${token}\` has no colour after it — ignored.`,
        })
        continue
      }
      // Written as the shadcn token name, with or without the `--` a
      // stylesheet would put in front of it.
      const name = token.replace(/^--/, "").replace(/:$/, "").toLowerCase()
      doc.theme.palette[current.mode][name] = value
      continue
    }

    // ----------------------------------------------------------- flows block
    if (current.kind === "flows") {
      const declares =
        keyword === "flow" || keyword === "journey" || keyword === "group"
      const key = declares
        ? (words[1] ?? slugify(quoted[0] ?? ""))
        : (words[0] ?? slugify(quoted[0] ?? ""))
      const flow = ensureFlow(key, quoted[0])
      if (!flow) {
        errors.push({ line, message: `Could not read flow: "${raw}".` })
        continue
      }
      if (quoted[1]) flow.note = quoted[1]
      pending = { kind: "flowGroup", id: flow.id }
      continue
    }

    if (current.kind === "flowGroup") {
      const flow = flows.find((f) => f.id === current.id)
      if (!flow) continue
      const inline = (quoted[0] ?? words.slice(1).join(" ")).trim()
      switch (keyword) {
        case "name":
        case "title":
          if (inline) flow.name = inline
          continue
        case "note":
        case "notes":
        case "description":
          flow.note = resolveHeredoc(inline, heredocs).trim()
          continue
        case "story":
        case "user_story":
        case "userstory": {
          if (quoted[0]) applyStorySentence(flow.story, quoted[0])
          pending = { kind: "story", story: flow.story, collecting: false }
          continue
        }
        case "screens":
        case "screen": {
          // Membership really lives on the screen. A model that lists screens
          // here anyway is understood rather than corrected — losing the
          // grouping over a matter of style would be the worse outcome.
          for (const item of bracketList(rest).concat(quoted)) {
            const screen = ensureScreen(item, line)
            if (!screen.flows.includes(flow.id)) screen.flows.push(flow.id)
          }
          continue
        }
        default:
          warnings.push({
            line,
            message: `Unknown flow property "${keyword}" — ignored.`,
          })
          continue
      }
    }

    // ------------------------------------------------------------ flow block
    if (current.kind === "flow" || /(->|=>|→)/.test(raw)) {
      const trigger = quoted[0] ?? ""
      const edgeViews = readViewTags(rest)
      const chain = rest
        .replace(/@[a-z0-9_-]+/gi, " ")
        .split(/->|=>|→/)
        .map((part) => part.replace(/:.*$/, "").trim())
        .filter(Boolean)
      if (chain.length >= 2) {
        for (let i = 0; i < chain.length - 1; i += 1) {
          const from = ensureScreen(chain[i], line)
          const to = ensureScreen(chain[i + 1], line)
          if (from.id === to.id) {
            warnings.push({ line, message: `"${from.title}" cannot connect to itself.` })
            continue
          }
          if (edges.some((e) => e.from === from.id && e.to === to.id)) {
            warnings.push({
              line,
              message: `Duplicate connection ${from.key} → ${to.key} ignored.`,
            })
            continue
          }
          edges.push({
            id: uid("edg"),
            from: from.id,
            to: to.id,
            // A chain shares one label only between its first pair.
            trigger: i === 0 ? trigger : "",
            views: edgeViews,
          })
        }
        continue
      }
      if (current.kind === "flow") {
        if (chain.length === 1) {
          ensureScreen(chain[0], line)
          continue
        }
        errors.push({ line, message: `Could not read connection: "${raw}".` })
        continue
      }
    }

    // ------------------------------------------------------------ views block
    if (current.kind === "views") {
      // `super_admin "Super Admin"` — or just a bare key.
      const view = ensureView(words[0] ?? slugify(quoted[0] ?? ""), quoted[0])
      if (!view) {
        errors.push({ line, message: `Could not read view: "${raw}".` })
      } else if (quoted[1]) {
        view.note = quoted[1]
      }
      continue
    }

    // ----------------------------------------------------------- theme block
    if (current.kind === "theme") {
      const value = words.slice(1).join(" ").trim() || quoted[0] || ""
      // `shape`, `fonts` and `palette` carry several values on one line, and
      // `value` has lost the quoting that says where one family name ends, so
      // the statement itself is passed alongside it.
      const args = raw.replace(/^\S+\s*/, "")
      // Which theme fields this file actually spoke about, taken by diffing
      // rather than bookkept per case.
      //
      // Merging needs it: every absent line comes back as its default, so
      // without knowing what was *stated* a merge either drops the design the
      // file carried or overwrites tuning the file never mentioned. Diffing the
      // object around the call gets it exactly right and cannot drift out of
      // step with the switch below, which is thirty cases long.
      const before = JSON.stringify(doc.theme)
      const opens = applyThemeProp(doc, keyword, value, line, warnings, args)
      if (before !== JSON.stringify(doc.theme)) {
        for (const field of Object.keys(doc.theme) as (keyof ProjectDoc["theme"])[]) {
          if (JSON.stringify(doc.theme[field]) !== JSON.stringify(JSON.parse(before)[field])) {
            themeStated.add(field)
          }
        }
      }
      if (opens) pending = { kind: "palette", mode: opens }
      continue
    }

    // ----------------------------------------------------------- stack block
    if (current.kind === "stack") {
      // `surfaces` holds only the two non-web builds; web's stack is the
      // top-level one, which is what every file written before surfaces
      // existed still means.
      const target =
        current.surface === "web" ? doc.stack : doc.surfaces[current.surface].stack
      if (keyword === "extras" || keyword === "extra") {
        const extras = [
          ...words.slice(1),
          ...quoted,
        ]
          .map((v) => v.trim())
          .filter(Boolean)
        target.extras = [...target.extras, ...extras]
        continue
      }
      const group = stackGroups.find(
        (g) => g.key.toLowerCase() === keyword || g.label.toLowerCase() === keyword
      )
      const value = words[1] ?? quoted[0] ?? ""
      if (group) {
        const ids = group.options.map((o) => o.id)
        target[group.key] = matchId(value, ids, `${group.label} option`, line)
      } else if (value) {
        target.extras.push(`${keyword}: ${value}`)
        warnings.push({
          line,
          message: `Unknown stack key "${keyword}" — added to extras.`,
        })
      }
      continue
    }

    // --------------------------------------------------------- landing block
    if (current.kind === "landing" || keyword === "section") {
      if (keyword !== "section") {
        errors.push({ line, message: `Expected a \`section\` statement, got "${raw}".` })
        continue
      }
      const type = matchId(words[1] ?? "", sectionTypeIds, "section type", line)
      const layoutWord = words.indexOf("layout")
      const layoutValue = layoutWord !== -1 ? (words[layoutWord + 1] ?? "") : ""
      const sectionLayouts = allLayouts
        .filter((l) => l.scope === "section")
        .map((l) => l.id)
      const meta = sectionTypes.find((s) => s.id === type)
      sections.push({
        id: uid("sec"),
        type,
        name: quoted[0] || meta?.name || type,
        layout: layoutValue
          ? matchId(layoutValue, sectionLayouts, "layout", line)
          : (meta?.defaultLayout ?? ""),
        note: quoted[1] ?? "",
        order: sections.length,
      })
      continue
    }

    // ---------------------------------------------------------- screen block
    if (current.kind === "screen") {
      const screen = screens.find((s) => s.id === current.id)
      if (!screen) continue
      const value = words.slice(1).join(" ").trim()
      switch (keyword) {
        case "module":
        case "part":
        case "component": {
          const module = ensureModule(
            screen.id,
            words[1] ?? slugify(quoted[0] ?? "module"),
            quoted[0]
          )
          // `module table "Client table" kind table on "click row"` — the
          // compact one-line form, where a `{ … }` body never opens.
          const kindWord = words.indexOf("kind")
          if (kindWord !== -1 && words[kindWord + 1]) {
            module.kind = matchId(
              words[kindWord + 1],
              moduleKindIds,
              "module kind",
              line
            )
          }
          if (quoted[1]) module.trigger = quoted[1]
          pending = { kind: "module", id: module.id, screenId: screen.id }
          continue
        }
        case "surface":
        case "build":
        case "platform": {
          const value = (words[1] ?? quoted[0] ?? "").toLowerCase()
          const match = surfaceValues.find((v) => v === value)
          if (match) {
            screen.surface = match
          } else {
            warnings.push({
              line,
              message: `Unknown surface "${value}" — kept on web. Use one of ${surfaceValues.join(", ")}.`,
            })
          }
          continue
        }
        case "in":
        case "views":
        case "roles": {
          const items = bracketList(rest).concat(quoted)
          screen.views = items
            .map((item) => ensureView(item)?.id)
            .filter((id): id is string => Boolean(id))
          continue
        }
        case "inner":
        case "internal":
        case "module_flow": {
          pending = { kind: "inner", screenId: screen.id }
          continue
        }
        case "template":
        case "type":
          screen.template = matchId(value || quoted[0] || "", templateIds, "screen type", line)
          if (!screen.layout) {
            const template = screenTemplates.find((t) => t.id === screen.template)
            if (template) screen.layout = template.defaultLayout
          }
          break
        case "layout":
          screen.layout = matchId(value || quoted[0] || "", layoutIds, "layout", line)
          break
        case "title":
          screen.title = quoted[0] || value
          break
        case "note":
        case "notes":
        case "description":
          screen.note = resolveHeredoc(quoted[0] ?? value, heredocs)
          break
        case "story":
        case "user_story":
        case "userstory": {
          // Both forms are accepted: a `story { … }` body, and the one-line
          // `story "As a … I want … so that …"` a model writes when it is
          // being terse.
          if (quoted[0]) {
            applyStorySentence(screen.story, resolveHeredoc(quoted[0], heredocs))
          }
          pending = { kind: "story", story: screen.story, collecting: false }
          break
        }
        case "flows":
        case "flow":
        case "journeys":
        case "journey": {
          for (const item of bracketList(rest).concat(quoted)) {
            const flow = ensureFlow(item)
            if (flow && !screen.flows.includes(flow.id)) screen.flows.push(flow.id)
          }
          break
        }
        default:
          warnings.push({
            line,
            message: `Unknown screen property "${keyword}" — ignored.`,
          })
      }
      continue
    }

    // ------------------------------------------------------------ app / root
    switch (keyword) {
      case "app":
      case "project": {
        doc.name = quoted[0] || words.slice(1).join(" ") || doc.name
        pending = { kind: "app" }
        continue
      }
      case "screen":
      case "page": {
        const key = words[1] ?? slugify(quoted[0] ?? "screen")
        const screen = ensureScreen(key, line, quoted[0])
        pending = { kind: "screen", id: screen.id }
        continue
      }
      case "flow":
      case "navigation": {
        pending = { kind: "flow" }
        continue
      }
      case "views":
      case "roles":
      case "personas": {
        pending = { kind: "views" }
        continue
      }
      case "flows":
      case "journeys": {
        pending = { kind: "flows" }
        continue
      }
      case "landing":
      case "page_sections":
      case "sections": {
        pending = { kind: "landing" }
        continue
      }
      case "data":
      case "schema":
      case "tables":
      case "database":
      case "model": {
        // The data model: what every build reads and writes. Declared once,
        // rather than three times in three prompts that then disagree.
        pending = { kind: "data" }
        continue
      }
      case "stack": {
        // `stack mobile { … }` and `stack backend { … }`. Without these the
        // format could not express a phone app's or a service's technology at
        // all — the worked examples used to say "set it on the Mobile tab
        // after importing", which is an admission that a round trip loses it.
        pending = { kind: "stack", surface: surfaceWord(words[1], line, warnings) }
        continue
      }
      case "theme": {
        pending = { kind: "theme" }
        continue
      }
      case "builds":
      case "build": {
        // What the project ships. Stated rather than inferred from which
        // screens happen to exist: a product meant to have an API should say
        // so before anybody has drawn one.
        const named = [...words.slice(1), ...quoted]
          .flatMap((word) => word.split(/[,;]/))
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean)
        if (!named.length) continue
        doc.builds = { web: false, mobile: false, backend: false }
        for (const word of named) {
          const surface = surfaceWord(word, line, warnings)
          doc.builds[surface] = true
        }
        continue
      }
      // What the build is for. A sibling of `builds` and `target` because it is
      // the same kind of fact — one of the few decisions that changes what the
      // generated prompt contains rather than what it says.
      case "priority":
      case "focus": {
        const word = (words[1] ?? quoted[0] ?? "").toLowerCase().trim()
        const match = priorityAliases[word]
        if (match) {
          doc.priority = match
        } else {
          warnings.push({
            line,
            message: `"${word}" is not a priority — keeping ${doc.priority}. One of: ${priorityValues.join(", ")}.`,
          })
        }
        continue
      }
      case "target": {
        doc.target = matchId(words[1] ?? quoted[0] ?? "", targetIds, "target", line)
        continue
      }
      case "ui_level": {
        const level = Number(words[1])
        if (Number.isFinite(level)) {
          doc.uiLevel = Math.max(1, Math.min(5, Math.round(level)))
        } else {
          warnings.push({ line, message: `ui_level must be 1–5, got "${words[1]}".` })
        }
        continue
      }
      // The old 0–10 dial. Still read so a `.flow` file written before the
      // five-level scale keeps the setting its author chose, and mapped
      // immediately rather than kept as a second source of truth.
      case "creativity": {
        const level = Number(words[1])
        if (Number.isFinite(level)) {
          const clamped = Math.max(0, Math.min(10, Math.round(level)))
          doc.creativity = clamped
          if (doc.uiLevel === null) doc.uiLevel = uiLevelFromLegacyCreativity(clamped)
        } else {
          warnings.push({ line, message: `Creativity must be 0–10, got "${words[1]}".` })
        }
        continue
      }
      case "name": {
        doc.name = quoted[0] || words.slice(1).join(" ") || doc.name
        continue
      }
      case "structure": {
        // `structure mobile expo-feature-based` — a build names its own tree,
        // the same way it now names its own stack. A bare `structure x` is the
        // web build's, unchanged.
        const first = (words[1] ?? "").toLowerCase()
        const named = surfaceValues.some((value) => value === first)
        const surface: Surface = named ? (first as Surface) : "web"
        const rest_ = named ? words.slice(2) : words.slice(1)
        const target =
          surface === "web" ? doc.structure : doc.surfaces[surface].structure
        const value = rest_[0] ?? ""
        if (value.toLowerCase() === "custom") {
          target.preset = "custom"
          target.customTree = resolveHeredoc(
            rest_.slice(1).join(" ") || quoted[0] || "",
            heredocs
          )
        } else {
          target.preset = matchId(value, structureIds, "folder structure", line)
        }
        continue
      }
      case "conventions": {
        const items = bracketList(rest).concat(quoted)
        doc.conventions.ids = items
          .map((item) => matchId(item, conventionIds, "convention", line))
          .filter(Boolean)
        continue
      }
      case "snippets": {
        const items = bracketList(rest).concat(quoted)
        doc.snippetIds = items
          .map((item) => matchId(item, snippetIds, "snippet", line))
          .filter(Boolean)
        continue
      }
      case "conventions_note":
      case "house_rules": {
        doc.conventions.custom = resolveHeredoc(
          words.slice(1).join(" ") || quoted[0] || "",
          heredocs
        ).trim()
        continue
      }
      case "profile": {
        profile = quoted[0] ?? words.slice(1).join(" ")
        continue
      }
      case "requirements":
      case "notes": {
        doc.requirements = resolveHeredoc(
          words.slice(1).join(" ") || quoted[0] || "",
          heredocs
        ).trim()
        continue
      }
      default: {
        if (current.kind === "app") {
          warnings.push({ line, message: `Unknown app property "${keyword}" — ignored.` })
        } else {
          warnings.push({ line, message: `Could not understand "${raw}" — ignored.` })
        }
      }
    }
  }

  if (stack.length > 1) {
    warnings.push({
      line: lines.at(-1)?.line ?? 1,
      message: `${stack.length - 1} block(s) left unclosed — assumed closed at the end.`,
    })
  }

  // Fill in sensible defaults for screens declared without a layout.
  for (const screen of screens) {
    if (!screen.layout && screen.template) {
      const template = screenTemplates.find((t) => t.id === screen.template)
      if (template) screen.layout = template.defaultLayout
    }
  }

  doc.views = views
  const viewIds = new Set(views.map((v) => v.id))
  for (const screen of screens) {
    screen.views = screen.views.filter((id) => viewIds.has(id))
  }

  flows.forEach((flow, index) => {
    flow.order = index
  })
  doc.flows = flows
  const flowIds = new Set(flows.map((f) => f.id))
  for (const screen of screens) {
    // A tag naming a flow that never materialised would render as a group
    // nothing can select, so it is dropped rather than kept as a ghost.
    screen.flows = [...new Set(screen.flows.filter((id) => flowIds.has(id)))]
  }
  for (const edge of edges) {
    edge.views = edge.views.filter((id) => viewIds.has(id))
  }

  // ------------------------------------------------------------ data model
  const entityByKey = new Map(entities.map((entity) => [entity.key, entity]))
  const relations: Relation[] = []
  for (const draft of relationDrafts) {
    const from = entityByKey.get(slugify(draft.from).replace(/-/g, "_"))
    const to = entityByKey.get(slugify(draft.to).replace(/-/g, "_"))
    if (!from || !to) {
      // Tolerant like everything else: name a table that was never declared
      // and it is created, so the relation survives rather than vanishing.
      const madeFrom = from ?? ensureEntity(draft.from)
      const madeTo = to ?? ensureEntity(draft.to)
      if (!madeFrom || !madeTo) {
        warnings.push({
          line: draft.line,
          message: `Relation skipped — could not read the tables it joins.`,
        })
        continue
      }
      entityByKey.set(madeFrom.key, madeFrom)
      entityByKey.set(madeTo.key, madeTo)
      warnings.push({
        line: draft.line,
        message: `Relation joins ${madeFrom.key} → ${madeTo.key}, which were not declared as tables — created empty.`,
      })
      relations.push(buildRelation(madeFrom, madeTo, draft))
      continue
    }
    relations.push(buildRelation(from, to, draft))
  }

  // A column named in a relation but never declared is created, so the
  // migration the prompt describes can actually run.
  for (const relation of relations) {
    if (relation.kind === "many-to-many") continue
    const from = entities.find((e) => e.id === relation.from)
    const to = entities.find((e) => e.id === relation.to)
    if (from && relation.fromField && !from.fields.some((f) => f.name === relation.fromField)) {
      const target = to?.fields.find((f) => f.name === relation.toField)
      from.fields.push({
        id: uid("fld"),
        name: relation.fromField,
        type: target?.type ?? "uuid",
        primary: false,
        required: relation.kind !== "one-to-one",
        unique: relation.kind === "one-to-one",
        indexed: true,
        defaultValue: "",
        options: [],
        note: "",
      })
    }
  }

  doc.entities = autoLayout(
    entities,
    relations.map((relation) => ({
      id: relation.id,
      from: relation.from,
      to: relation.to,
    })),
    {
      heights: Object.fromEntries(
        entities.map((entity) => [entity.id, entityHeight(entity.fields.length)])
      ),
      nodeWidth: ENTITY_WIDTH,
      colGap: 110,
      rowGap: 44,
    }
  )
  doc.relations = relations

  // Laid out for the size a card really is — the default row pitch is smaller
  // than a rendered screen card, so a freshly pasted file opened with rows
  // overlapping until somebody pressed Auto-arrange.
  doc.screens = autoLayout(screens, edges, {
    heights: Object.fromEntries(
      screens.map((screen) => [screen.id, CARD_HEIGHT_FALLBACK])
    ),
    widths: Object.fromEntries(
      screens.map((screen) => [screen.id, nodeWidthFor(screen.surface)])
    ),
  })
  doc.edges = edges
  doc.sections = sections
  // Modules of a deleted-or-never-declared screen would be unreachable data.
  const screenIds = new Set(screens.map((s) => s.id))
  doc.modules = modules.filter((m) => screenIds.has(m.screenId))
  const moduleIds = new Set(doc.modules.map((m) => m.id))
  doc.moduleEdges = moduleEdges.filter(
    (e) => moduleIds.has(e.from) && moduleIds.has(e.to)
  )

  if (!screens.length && !sections.length && !entities.length) {
    errors.push({
      line: 1,
      message: "No screens, sections or tables found — is this Flow source?",
    })
  }

  return { doc, profile, warnings, errors, themeStated: [...themeStated] }
}

function emptyStory(): UserStory {
  return { role: "", want: "", soThat: "", criteria: [] }
}

/**
 * Models restate the scaffolding they were given — `as "As a signed-in admin"`,
 * `want "I want to see every client"`. Storing that means rendering "As a As a
 * signed-in admin" in the prompt, so the lead-in comes off here, once, rather
 * than being worked around at every place a story is displayed.
 */
function stripLead(value: string, lead: RegExp) {
  return value.replace(lead, "").replace(/^[,\s]+/, "").replace(/[,.\s]+$/, "").trim()
}

/** The one-line form: `story "As a … I want … so that …"`. */
function applyStorySentence(story: UserStory, sentence: string) {
  const text = sentence.trim()
  if (!text) return
  const match = text.match(
    /^as\s+(?:an?|the)?\s*(.+?)[,\s]+i\s+want\s+(?:to\s+)?(.+?)(?:[,\s]+so\s+that\s+(.+))?$/i
  )
  if (!match) {
    // Not the canonical shape — keep it whole rather than throwing it away.
    if (!story.want) story.want = text
    return
  }
  if (!story.role) story.role = match[1].trim()
  if (!story.want) story.want = match[2].trim().replace(/[.,]$/, "")
  if (!story.soThat && match[3]) story.soThat = match[3].trim().replace(/[.]$/, "")
}

/** One line of a multi-line `accept [ … ]` list. */
function pushCriteria(story: UserStory, raw: string, heredocs: string[]) {
  const body = raw.replace(/[[\]]/g, " ")
  const { rest, quoted } = readQuoted(body)
  if (quoted.length) {
    for (const item of quoted) {
      const text = item.trim()
      if (text) story.criteria.push(text)
    }
    return
  }
  const text = resolveHeredoc(rest, heredocs)
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/,\s*$/, "")
    .trim()
  if (text) story.criteria.push(text)
}

function titleFromKey(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function bracketList(text: string) {
  const match = text.match(/\[([^\]]*)\]/)
  const body = match ? match[1] : text.replace(/^\s*\w+/, "")
  return body
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter((v) => v && v !== "[" && v !== "]")
}

/**
 * One `theme { … }` statement.
 *
 * Returns the mode of a `palette light { … }` header, so the caller can open
 * the block — every other key applies here and returns nothing.
 */
function applyThemeProp(
  doc: ProjectDoc,
  key: string,
  value: string,
  line: number,
  warnings: ParseIssue[],
  /** the statement with its keyword removed and its quotes still in place */
  args = ""
): "light" | "dark" | undefined {
  const normalised = value.trim().toLowerCase()
  switch (key) {
    case "design":
    case "designlanguage":
    case "style": {
      const ids = designLanguages.map((d) => d.id)
      if (ids.includes(normalised)) {
        doc.theme.designLanguage = normalised
        return
      }
      const suggestion = closestMatch(normalised, ids)
      if (suggestion) {
        doc.theme.designLanguage = suggestion
        warnings.push({
          line,
          message: `Unknown design language "${value.trim()}" — using "${suggestion}".`,
        })
      } else {
        warnings.push({
          line,
          message: `Unknown design language "${value.trim()}" — keeping ${doc.theme.designLanguage}.`,
        })
      }
      return
    }
    case "primary":
    case "primarycolor":
      doc.theme.primaryColor = normaliseColor(value, doc.theme.primaryColor, line, warnings)
      return
    case "secondary":
    case "secondarycolor":
    case "accent":
      doc.theme.secondaryColor = normaliseColor(value, doc.theme.secondaryColor, line, warnings)
      return
    case "radius":
    case "borderradius":
      doc.theme.borderRadius = (radiusAliases[normalised] ??
        doc.theme.borderRadius) as ProjectDoc["theme"]["borderRadius"]
      return
    case "buttons":
    case "buttonstyle":
      doc.theme.buttonStyle = (buttonAliases[normalised] ??
        doc.theme.buttonStyle) as ProjectDoc["theme"]["buttonStyle"]
      return
    case "density":
    case "spacing":
      doc.theme.density = (densityAliases[normalised] ??
        doc.theme.density) as ProjectDoc["theme"]["density"]
      return
    // The seven settings added with stories and journeys. Without these the
    // parser dropped them on the floor with an "unknown theme property"
    // warning, so anything the serializer wrote came back as defaults.
    //
    // Each one is checked against its own list of allowed values rather than
    // assigned blind: a typo should keep the current setting and say so, not
    // put a word the renderer has never heard of into the document.
    case "headings":
    case "headingfont":
      doc.theme.headingFont = pickThemeValue(
        normalised,
        fontCharacterValues,
        doc.theme.headingFont,
        key,
        line,
        warnings
      )
      return
    case "body":
    case "bodyfont":
      doc.theme.bodyFont = pickThemeValue(
        normalised,
        bodyFontValues,
        doc.theme.bodyFont,
        key,
        line,
        warnings
      )
      return
    case "scale":
    case "typescale":
      doc.theme.typeScale = pickThemeValue(
        normalised,
        typeScaleValues,
        doc.theme.typeScale,
        key,
        line,
        warnings
      )
      return
    case "icons":
    case "iconstyle":
      doc.theme.iconStyle = pickThemeValue(
        normalised,
        iconStyleValues,
        doc.theme.iconStyle,
        key,
        line,
        warnings
      )
      return
    case "elevation":
    case "shadow":
      doc.theme.elevation = pickThemeValue(
        normalised,
        elevationValues,
        doc.theme.elevation,
        key,
        line,
        warnings
      )
      return
    case "motion":
    case "animation":
      doc.theme.motion = pickThemeValue(
        normalised,
        motionValues,
        doc.theme.motion,
        key,
        line,
        warnings
      )
      return
    case "scheme":
    case "colorscheme":
    case "colourscheme":
      doc.theme.colorScheme = pickThemeValue(
        normalised,
        colorSchemeValues,
        doc.theme.colorScheme,
        key,
        line,
        warnings
      )
      return

    // The nine settings the presets brought with them. Same rule as the block
    // above — an unrecognised value keeps the current one and says which word
    // was not understood, so a typo costs a line rather than the file — and the
    // same reason for being here at all: what the serializer writes, the parser
    // has to read, or a round trip resets the design to the defaults.
    case "preset":
    case "theme_preset": {
      if (!normalised) {
        warnings.push({
          line,
          message: `\`preset\` needs a name — keeping ${doc.theme.preset}.`,
        })
        return
      }
      // Kept whatever it says, even when this build has never heard of it:
      // presets are data that grows between releases, and correcting a file
      // into a design its author did not choose is worse than carrying a name
      // forward. But a name nobody recognises is nearly always a model
      // inventing one, and silently rendering the default is how that goes
      // unnoticed — so it is said out loud, with the real names to hand.
      // `presetById` falls back to the default rather than answering "no", so
      // the id list is what says whether this one is real.
      if (!presets.some((preset) => preset.id === normalised)) {
        warnings.push({
          line,
          message:
            `Unknown preset "${normalised}" — kept as written, but the design falls back to ` +
            `${presetById(normalised).name}. The presets are: ` +
            `${presets.map((preset) => preset.id).join(", ")}.`,
        })
      }
      doc.theme.preset = normalised
      return
    }
    // One line on why this design, written by whoever chose it. Free text, so
    // it takes the raw value rather than the normalised one — lowercasing
    // somebody's sentence is not this parser's business.
    case "note":
    case "design_note":
    case "designnote": {
      const written = (args || value).trim()
      doc.theme.designNote = written.replace(/^["']|["']$/g, "")
      return
    }
    case "shape":
    case "radii":
    case "corners": {
      const text = args || value
      if (/\bpill\b/i.test(text)) doc.theme.shape.pill = true
      if (/\b(no_pill|nopill|not_pill|square|squared)\b/i.test(text)) {
        doc.theme.shape.pill = false
      }
      for (const [name, radius] of readPairs(text.replace(PILL_WORDS, " "))) {
        const slot = shapeAliases[name]
        if (!slot) {
          warnings.push({
            line,
            message: `"${name}" is not a shape — keeping the current radii. One of: control, card, overlay, pill.`,
          })
          continue
        }
        doc.theme.shape[slot] = clampNumber(
          radius,
          0,
          64,
          doc.theme.shape[slot],
          `shape ${slot}`,
          line,
          warnings
        )
      }
      return
    }
    case "pill":
      // The flag on its own line. No word after it means the flag is being set,
      // which is the only reason anyone writes it alone.
      doc.theme.shape.pill = !/^(false|no|off|0)$/i.test(normalised)
      return
    case "fonts":
    case "font":
    case "typefaces": {
      for (const [name, family] of readPairs(args)) {
        const slot = fontSlotAliases[name]
        if (!slot) {
          warnings.push({
            line,
            message: `"${name}" is not a font slot — ignored. One of: display, body, mono.`,
          })
          continue
        }
        // Kept exactly as written, licence and all: this is the family the
        // editor renders and the generated stylesheet loads, and correcting it
        // to something the app has heard of would be inventing a typeface.
        doc.theme.fonts[slot] = family
      }
      return
    }
    case "scale_ratio":
    case "scaleratio":
    case "ratio":
      doc.theme.scaleRatio = clampNumber(
        value,
        1.05,
        1.7,
        doc.theme.scaleRatio,
        key,
        line,
        warnings
      )
      return
    case "vividness":
    case "chroma":
    case "saturation":
      doc.theme.vividness = clampNumber(
        value,
        0,
        100,
        doc.theme.vividness,
        key,
        line,
        warnings
      )
      return
    case "neutral_hue":
    case "neutralhue":
    case "neutral":
    case "grey_hue":
    case "gray_hue":
      doc.theme.neutralHue = clampNumber(
        value,
        0,
        360,
        doc.theme.neutralHue,
        key,
        line,
        warnings
      )
      return
    case "elevation_strategy":
    case "elevationstrategy":
    case "depth":
      doc.theme.elevationStrategy = pickThemeValue(
        normalised,
        elevationStrategyValues,
        doc.theme.elevationStrategy,
        key,
        line,
        warnings
      )
      return
    case "motion_model":
    case "motionmodel":
    case "motion_style":
      doc.theme.motionModel = pickThemeValue(
        normalised,
        motionModelValues,
        doc.theme.motionModel,
        key,
        line,
        warnings
      )
      return
    case "inputs":
    case "inputstyle":
    case "input_style":
    case "fields":
      doc.theme.inputStyle = pickThemeValue(
        normalised,
        inputStyleValues,
        doc.theme.inputStyle,
        key,
        line,
        warnings
      )
      return
    case "palette":
    case "colors":
    case "colours": {
      const head = args.trim().split(/\s+/)[0] ?? ""
      const mode = paletteMode(head)
      if (!mode) {
        warnings.push({
          line,
          message: `"${head}" is not a palette mode — expected \`palette light\` or \`palette dark\`.`,
        })
        return
      }
      // `palette light primary #2563eb` — the one-line form, where no block
      // opens. A `palette light {` header has nothing after the mode, and is
      // what the caller turns into a block.
      const pairs = readPairs(args.trim().slice(head.length))
      for (const [token, color] of pairs) {
        doc.theme.palette[mode][token.replace(/^--/, "")] = color
      }
      return pairs.length ? undefined : mode
    }
    default:
      warnings.push({ line, message: `Unknown theme property "${key}" — ignored.` })
  }
}

/** `light` / `dark`, however it was spelled. */
function paletteMode(word: string): "light" | "dark" | null {
  const normalised = word.toLowerCase().replace(/[^a-z]/g, "")
  if (normalised === "light" || normalised === "day") return "light"
  if (normalised === "dark" || normalised === "night") return "dark"
  return null
}

/**
 * `display "Bricolage Grotesque" body "Public Sans"` → the pairs.
 *
 * Read off the statement rather than out of the parser's `words`, which has
 * already split a family name in two and thrown away the quotes that said where
 * it ended. A bare value is taken up to the next space, which is what makes
 * `control 8 card 12` work in the same function.
 */
function readPairs(text: string): [string, string][] {
  const pairs: [string, string][] = []
  for (const match of text.matchAll(/([a-z_][a-z0-9_-]*)\s+(?:"([^"]*)"|([^\s"]+))/gi)) {
    pairs.push([match[1].toLowerCase(), (match[2] ?? match[3] ?? "").trim()])
  }
  return pairs
}

/**
 * A numeric theme setting, clamped rather than rejected.
 *
 * `ui_level` already works this way and for the same reason: a file that says
 * `vividness 140` meant "as vivid as it goes", and refusing it would lose every
 * other thing the file said. A value that is not a number at all is a different
 * matter — that is a typo, and the current setting is kept.
 */
function clampNumber(
  value: string,
  min: number,
  max: number,
  fallback: number,
  key: string,
  line: number,
  warnings: ParseIssue[]
): number {
  const written = value.trim()
  const parsed = Number.parseFloat(written)
  if (!Number.isFinite(parsed)) {
    warnings.push({
      line,
      message: `\`${key}\` must be a number between ${min} and ${max} — "${written}" is not one, keeping ${fallback}.`,
    })
    return fallback
  }
  const clamped = Math.min(max, Math.max(min, parsed))
  if (clamped !== parsed) {
    warnings.push({
      line,
      message: `\`${key}\` must be between ${min} and ${max} — "${written}" clamped to ${clamped}.`,
    })
  }
  return clamped
}

/**
 * Which build a `stack` or `structure` line is talking about.
 *
 * No word means the web build, which is what every file written before there
 * were other builds meant.
 */
function surfaceWord(word: string | undefined, line: number, warnings: ParseIssue[]): Surface {
  if (!word) return "web"
  const normalised = word.toLowerCase().replace(/[^a-z]/g, "")
  const known = surfaceValues.find((value) => value === normalised)
  if (known) return known
  if (normalised === "api" || normalised === "server" || normalised === "service") {
    return "backend"
  }
  if (normalised === "app" || normalised === "phone" || normalised === "native") {
    return "mobile"
  }
  warnings.push({
    line,
    message: `"${word}" is not a build — expected one of ${surfaceValues.join(", ")}. Read as web.`,
  })
  return "web"
}

/**
 * One theme word, checked against the values that word is allowed to take.
 *
 * A warning rather than an error, like every other unrecognised value in this
 * parser: an unknown font keeps the current font and produces a diagram, which
 * is far more useful than refusing the whole file over one line.
 */
function pickThemeValue<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
  key: string,
  line: number,
  warnings: ParseIssue[]
): T {
  const match = allowed.find((option) => option === value)
  if (match) return match
  warnings.push({
    line,
    message: `"${value}" is not a valid ${key} — keeping ${fallback}. One of: ${allowed.join(", ")}.`,
  })
  return fallback
}

function normaliseColor(
  value: string,
  fallback: string,
  line: number,
  warnings: ParseIssue[]
) {
  const trimmed = value.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed
  if (/^([0-9a-f]{6})$/i.test(trimmed)) return `#${trimmed}`
  warnings.push({
    line,
    message: `"${trimmed}" is not a hex colour — keeping ${fallback}.`,
  })
  return fallback
}

type RelationDraft = {
  from: string
  fromField: string
  to: string
  toField: string
  kind: RelationKind
  label: string
  onDelete: "cascade" | "restrict" | "set-null"
  through: string
  line: number
}

function buildRelation(
  from: Entity,
  to: Entity,
  draft: RelationDraft
): Relation {
  const key = to.fields.find((f) => f.primary)?.name ?? "id"
  return {
    id: uid("rel"),
    from: from.id,
    fromField:
      draft.fromField ||
      (draft.kind === "many-to-many" ? "" : `${singularKey(to.key)}_id`),
    to: to.id,
    toField: draft.toField || key,
    kind: draft.kind,
    label: draft.label,
    onDelete: draft.onDelete,
    through: draft.through,
  }
}

/** `orders` → `order`, kept in step with the data feature's own singular(). */
function singularKey(key: string) {
  if (/(ss|us|is)$/i.test(key)) return key
  if (/ies$/i.test(key)) return `${key.slice(0, -3)}y`
  if (/(ches|shes|xes|ses)$/i.test(key)) return key.slice(0, -2)
  if (/s$/i.test(key)) return key.slice(0, -1)
  return key
}

const relationAliases: Record<string, RelationKind> = {
  "many-to-one": "many-to-one",
  manytoone: "many-to-one",
  "n:1": "many-to-one",
  "n-1": "many-to-one",
  belongs_to: "many-to-one",
  "one-to-many": "one-to-many",
  onetomany: "one-to-many",
  "1:n": "one-to-many",
  "1-n": "one-to-many",
  has_many: "one-to-many",
  "one-to-one": "one-to-one",
  onetoone: "one-to-one",
  "1:1": "one-to-one",
  "1-1": "one-to-one",
  has_one: "one-to-one",
  "many-to-many": "many-to-many",
  manytomany: "many-to-many",
  "n:n": "many-to-many",
  "n-n": "many-to-many",
  "m:n": "many-to-many",
  m2m: "many-to-many",
}

const deleteAliases: Record<string, "cascade" | "restrict" | "set-null"> = {
  cascade: "cascade",
  delete: "cascade",
  restrict: "restrict",
  block: "restrict",
  noaction: "restrict",
  "no-action": "restrict",
  "set-null": "set-null",
  setnull: "set-null",
  set_null: "set-null",
  null: "set-null",
}

/**
 * `rel orders.user_id -> users.id : many-to-one "belongs to" on_delete cascade`
 *
 * The kind may also be written as `n:1`, `1:n`, `1:1`, `n:n`, or left out —
 * `->` means many-to-one, `<->` means many-to-many, which is what those arrows
 * mean everywhere else they are drawn.
 */
function readRelation(
  rest: string,
  quoted: string[],
  line: number,
  warnings: ParseIssue[]
): RelationDraft | null {
  const body = rest
    .replace(/^\s*(rel|relation|ref|references)\b/i, "")
    .trim()
  const symmetric = /<->|↔/.test(body)
  const [leftRaw, rightRaw] = body
    .split(/<->|↔|->|=>|→/)
    .map((part) => part.trim())
  if (!leftRaw || !rightRaw) return null

  const left = readSide(leftRaw)
  // The other side is the first token after the arrow; everything past it is
  // options. Split on whitespace and commas only — `1:1` and `n:1` are single
  // words, and splitting them on the colon read every cardinality as the
  // default.
  const trimmedRight = rightRaw.trim()
  const firstToken = trimmedRight.split(/[\s,:]/)[0] ?? ""
  const right = readSide(firstToken)
  if (!left.table || !right.table) return null

  const words = trimmedRight
    .slice(firstToken.length)
    .replace(/^\s*:\s*/, "")
    .split(/[\s,]+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

  let kind: RelationKind = symmetric ? "many-to-many" : "many-to-one"
  let onDelete: "cascade" | "restrict" | "set-null" = "restrict"
  let through = ""

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    const known = relationAliases[word]
    if (known) {
      kind = known
      continue
    }
    if (relationKindValues.includes(word as RelationKind)) {
      kind = word as RelationKind
      continue
    }
    if (word === "through" || word === "via" || word === "join") {
      through = words[index + 1] ?? ""
      index += 1
      continue
    }
    if (word === "on_delete" || word === "ondelete") {
      const next = words[index + 1] ?? ""
      onDelete = deleteAliases[next] ?? "restrict"
      index += 1
      continue
    }
    if (deleteAliases[word] && word !== "null") {
      onDelete = deleteAliases[word]
      continue
    }
    warnings.push({
      line,
      message: `Unknown relation option "${word}" — ignored.`,
    })
  }

  return {
    from: left.table,
    fromField: left.field,
    to: right.table,
    toField: right.field,
    kind,
    label: quoted[0] ?? "",
    onDelete,
    through,
    line,
  }
}

function readSide(value: string) {
  const cleaned = value.replace(/[^a-z0-9_.]/gi, "")
  const [table, field = ""] = cleaned.split(".")
  return { table: table ?? "", field }
}

/**
 * One column: `email string unique required default "" note "…"`.
 *
 * Everything after the name and the type is a flag, in any order — LLM output
 * puts them in whatever order it likes, and rejecting a line over word order
 * would lose a column.
 */
function readColumn(
  rest: string,
  quoted: string[],
  line: number,
  warnings: ParseIssue[]
): { field: EntityField; ref?: { table: string; field: string; onDelete?: "cascade" | "restrict" | "set-null" } } | null {
  const options: string[] = []
  const withoutList = rest.replace(/\[([^\]]*)\]/g, (_, body: string) => {
    for (const item of String(body).split(/[,;]/)) {
      const value = item.trim()
      if (value) options.push(value)
    }
    return " "
  })

  const words = withoutList.split(/[\s,]+/).filter(Boolean)
  const name = slugify(words[0] ?? "").replace(/-/g, "_")
  if (!name) return null

  const field: EntityField = {
    id: uid("fld"),
    name,
    type: "text",
    primary: false,
    required: false,
    unique: false,
    indexed: false,
    defaultValue: "",
    options,
    note: "",
  }

  let ref: { table: string; field: string; onDelete?: "cascade" | "restrict" | "set-null" } | undefined
  let quotedAt = 0
  const nextQuoted = () => quoted[quotedAt++] ?? ""

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index].toLowerCase()
    if (index === 1 && !FLAG_WORDS.has(word)) {
      // The type. Unknown ones are kept rather than corrected: a project on a
      // database this app has never heard of still has to round trip.
      const known = fieldKindValues.find((value) => value === word)
      if (!known) {
        warnings.push({
          line,
          message: `"${words[index]}" is not a known column type — kept as written.`,
        })
      }
      field.type = known ?? words[index]
      continue
    }
    switch (word) {
      case "pk":
      case "primary":
      case "primary_key":
      case "id":
        field.primary = true
        field.required = true
        break
      case "required":
      case "not_null":
      case "notnull":
      case "!":
        field.required = true
        break
      case "optional":
      case "nullable":
      case "null":
        field.required = false
        break
      case "unique":
        field.unique = true
        break
      case "index":
      case "indexed":
        field.indexed = true
        break
      case "default": {
        const value = nextQuoted() || words[index + 1] || ""
        if (!quoted.length) index += 1
        field.defaultValue = value
        break
      }
      case "note":
      case "comment":
        field.note = nextQuoted()
        break
      case "ref":
      case "references":
      case "->": {
        const side = readSide(words[index + 1] ?? "")
        if (side.table) ref = { table: side.table, field: side.field || "id" }
        index += 1
        break
      }
      case "cascade":
        if (ref) ref.onDelete = "cascade"
        break
      default:
        warnings.push({
          line,
          message: `Unknown column option "${words[index]}" — ignored.`,
        })
    }
  }

  if (!field.note && quoted[quotedAt]) field.note = quoted[quotedAt]
  return { field, ref }
}

const FLAG_WORDS = new Set([
  "pk",
  "primary",
  "primary_key",
  "required",
  "not_null",
  "notnull",
  "optional",
  "nullable",
  "null",
  "unique",
  "index",
  "indexed",
  "default",
  "note",
  "comment",
  "ref",
  "references",
  "cascade",
])
