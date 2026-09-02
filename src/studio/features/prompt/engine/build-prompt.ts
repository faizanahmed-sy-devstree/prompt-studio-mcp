// Vendored from Prompt Studio (features/prompt/engine/build-prompt.ts). Do not edit here — run `pnpm sync`.
import { analyseGraph } from "../../builder/utils/graph"
import {
  stackFor,
  structureFor,
  surfaceMeta,
} from "../../builder/utils/surfaces"
import { edgesInView, screensInView, viewNames } from "../../builder/utils/views"
import { checkDataModel } from "../../data/utils/schema"
import { describeLayout } from "../../library/data/layouts"
import { describeModuleKind } from "../../library/data/module-kinds"
import { sectionTypeMap } from "../../library/data/section-types"
import { snippetMap } from "../../library/data/snippets"
import { screenTemplateMap } from "../../library/data/templates"
import { conventionMap } from "../../stack/data/conventions"
import {
  conventionOverrides,
  platformDelivery,
  platformOf,
  platformRequirements,
  serverIrrelevantConventionIds,
  webOnlyConventionIds,
} from "../../stack/data/platforms"
import {
  findStackOption,
  stackGroups,
  stackWarnings,
} from "../../stack/data/stack-catalogue"
import { structureMap } from "../../stack/data/structures"
import { describeDesignLanguage } from "../../theme/data/design-languages"
import { presetById } from "../../theme/data/presets"
import {
  colorSchemes,
  describeOption,
  elevations,
  fontCharacterMap,
  fontCharacters,
  iconStyles,
  motions,
  typeScales,
} from "../../theme/data/typography"
import {
  describeUiLevel,
  UI_LEVEL_PREAMBLE,
  uiLevelOf,
} from "../../theme/data/ui-levels"
import { resolveTokens } from "../../theme/tokens/index"
import { type ProjectDoc, type Surface, themeSchema, type UserStory } from "../../../types/project"

import { BOILERPLATE, cloneLines, usesBoilerplate } from "./boilerplate"
import { dataModelBlock } from "./data-model"
import { deploymentBlock } from "./deployment"
import { securityConstraint, verificationNotice } from "./security"
import { type BlockId, getTarget, type ProjectBlockId } from "./targets"
import { tokensBlock } from "./tokens-block"
import { uiConventionsBlock } from "./ui-conventions"

export type PromptBlock = { id: ProjectBlockId; title: string; body: string }

export type BuiltPrompt = {
  text: string
  blocks: PromptBlock[]
  warnings: string[]
}

const radiusWords: Record<string, string> = {
  none: "square corners (0px)",
  small: "small radius (4px)",
  medium: "medium radius (8px)",
  large: "large radius (12px)",
  full: "fully rounded (pill) corners",
}

const buttonWords: Record<string, string> = {
  filled: "solid filled buttons",
  outlined: "outlined buttons with transparent fills",
  rounded: "soft, fully rounded buttons",
  sharp: "sharp-edged, high-contrast buttons",
}

const densityWords: Record<string, string> = {
  compact: "compact spacing — information dense, small paddings",
  comfortable: "comfortable spacing — the default rhythm",
  spacious: "spacious layout — generous whitespace, larger type",
}

/**
 * The creative-level paragraph.
 *
 * A named level and its instructions, not a bare number: "7/10" is not
 * something an agent can build, and the old scale put exactly that into the
 * prompt. The preamble comes first on purpose — the level is a ceiling, and
 * what the journeys actually need decides where under it to land.
 */
function uiLevelBlock(doc: ProjectDoc): string {
  const level = describeUiLevel(uiLevelOf(doc))
  return [
    UI_LEVEL_PREAMBLE,
    "",
    `**Creative level ${level.level} of 5 — ${level.name}.** ${level.promptDetails}`,
  ].join("\n")
}

export function list(lines: string[]) {
  return lines
    // An empty entry means "this one does not apply here" — rendering it as a
    // bare "- " is a bullet with nothing after it.
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      // A snippet may be a fenced code block rather than a sentence. Prefixing
      // one with "- " produces `- ```ts`, which is not a list item containing
      // code — it is broken Markdown that every renderer reads differently, and
      // ours ended up with an unterminated fence swallowing the rest of the
      // section. A block stands on its own line instead.
      if (line.trimStart().startsWith("```")) return `\n${line}\n`
      return `- ${line}`
    })
    .join("\n")
}

/**
 * Terminates a fragment so two of them can sit on one line. Module lines are
 * assembled from a catalogue sentence, a trigger and a free-text note, and
 * without this they ran together into "…survives a reload Appears/fires: …".
 */
function sentence(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return ""
  return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

// ------------------------------------------------------------------ blocks

function overviewBlock(doc: ProjectDoc): string {
  const screens = doc.screens.length
  const sections = doc.sections.length
  const parts: string[] = []
  if (screens) {
    parts.push(
      `${screens} application screen${screens === 1 ? "" : "s"} connected by ${doc.edges.length} navigation transition${doc.edges.length === 1 ? "" : "s"}`
    )
  }
  if (doc.modules.length) {
    parts.push(
      `${doc.modules.length} module${doc.modules.length === 1 ? "" : "s"} inside those screens`
    )
  }
  if (sections) {
    parts.push(`a marketing page built from ${sections} sections`)
  }
  const scope = parts.length ? parts.join(", and ") : "the screens described below"
  return `Product: **${doc.name}**\n\nScope: ${scope}.\n\nThis brief is complete: implement every screen and every transition listed. Where something is unspecified, choose the option most consistent with the conventions below rather than inventing new patterns.`
}

/**
 * A user story, rendered for a coding agent to build against.
 *
 * One sentence rather than three labelled fields, because that is how it reads
 * as a specification; the acceptance criteria stay a list, because that is how
 * they get checked off.
 */
export function storyLines(story: UserStory, indent: string): string[] {
  const role = story.role.trim()
  const want = story.want.trim()
  const soThat = story.soThat.trim()
  const criteria = story.criteria.map((c) => c.trim()).filter(Boolean)
  const lines: string[] = []

  if (role || want || soThat) {
    const parts: string[] = []
    if (role) parts.push(`as ${role}`)
    if (want) parts.push(`I want to ${want.replace(/^to\s+/i, "")}`)
    if (soThat) parts.push(`so that ${soThat}`)
    lines.push(`${indent}User story: ${sentence(parts.join(", "))}`)
  }
  if (criteria.length) {
    lines.push(`${indent}Accepted when:`)
    for (const criterion of criteria) lines.push(`${indent}- ${criterion}`)
  }
  return lines
}

/**
 * The journeys, and the standing instruction about stories.
 *
 * The instruction is emitted even for a project with no stories in it at all —
 * that is the case where it does the most work, because it turns "build a
 * screen called Clients" into "decide what someone is trying to do on Clients,
 * then build that".
 */
function flowsBlock(doc: ProjectDoc): string {
  if (!doc.screens.length) return ""
  const parts: string[] = []

  if (doc.flows.length) {
    const inFlow = (flowId: string) =>
      doc.screens.filter((s) => s.flows.includes(flowId))

    const listed = [...doc.flows]
      .sort((a, b) => a.order - b.order)
      .map((flow, index) => {
        const members = inFlow(flow.id)
        const lines = [`${index + 1}. **${flow.name}** \`${flow.key}\``]
        if (members.length) {
          lines.push(
            `   Screens, in order: ${members.map((s) => `${s.title} \`${s.key}\``).join(" → ")}`
          )
        }
        lines.push(...storyLines(flow.story, "   "))
        if (flow.note.trim()) lines.push(`   Notes: ${flow.note.trim()}`)
        return lines.join("\n")
      })

    parts.push(
      "The product is made of these journeys. A screen may belong to several — the journey is what someone is trying to get done, not a section of the app."
    )
    parts.push(listed.join("\n\n"))

    const ungrouped = doc.screens.filter((s) => !s.flows.length)
    if (ungrouped.length) {
      parts.push(
        `Not assigned to a journey: ${ungrouped.map((s) => `\`${s.key}\``).join(", ")}. Work out what each is for before building it, and say so.`
      )
    }
  }

  parts.push(
    [
      "**Build against the stories, not the screen names.**",
      "",
      "- Where a screen or a journey states a user story, that story is the specification. Implement it, and satisfy every acceptance criterion listed. Use it as written — do not reword it, narrow it, or substitute your own reading of what the screen is for.",
      "- Where a screen has **no** story, write one before you write its code: who the user is, what they are trying to do, why it matters, and 3–6 checkable acceptance criteria derived from the screen's layout, its modules and the transitions that reach it. State it, then build it.",
      "- Keep them. Write every story — the ones given here and the ones you wrote — to `docs/user-stories.md`, grouped by journey, so the next person to open this repository has the same specification you did.",
      "- A screen is not done because it renders. It is done when its acceptance criteria hold, including the failure cases.",
    ].join("\n")
  )

  return parts.join("\n\n")
}

function screensBlock(doc: ProjectDoc): string {
  if (!doc.screens.length) return ""
  const { ordered } = analyseGraph(doc.screens, doc.edges)
  return ordered
    .map((screen, index) => {
      const template = screenTemplateMap[screen.template]
      const layout = describeLayout(screen.layout)
      const lines = [
        `${index + 1}. **${screen.title}** \`${screen.key}\`${template ? ` — ${template.name}` : ""}`,
      ]
      if (template) lines.push(`   Purpose: ${template.promptDetails}.`)
      // A service area has no layout — there is nothing to lay out. Printing
      // "Layout: Advanced Data Table" under an endpoint group is the kind of
      // filler that teaches a reader these lines can be skimmed.
      if (screen.surface !== "backend") {
        lines.push(`   Layout: ${layout.name} — ${layout.promptDetails}`)
      }
      lines.push(...storyLines(screen.story, "   "))
      if (doc.flows.length) {
        const journeys = doc.flows
          .filter((flow) => screen.flows.includes(flow.id))
          .map((flow) => flow.name)
        if (journeys.length) {
          lines.push(`   Part of: ${journeys.join(", ")}.`)
        }
      }
      if (screen.note.trim()) lines.push(`   Notes: ${screen.note.trim()}`)
      if (doc.views.length) {
        const names = viewNames(doc, screen.views)
        lines.push(
          `   Visible to: ${names.length ? names.join(", ") : "every role"}.`
        )
      }
      lines.push(...modulesOfScreen(doc, screen.id))
      return lines.join("\n")
    })
    .join("\n\n")
}

/**
 * The inside of one screen. Most of a real application's behaviour lives here
 * rather than between screens, so where modules exist they carry more weight
 * than the screen line above them. Emitted only when the screen has any, which
 * is what keeps the output byte-identical for module-free projects.
 */
function modulesOfScreen(doc: ProjectDoc, screenId: string): string[] {
  const modules = doc.modules
    .filter((m) => m.screenId === screenId)
    .sort((a, b) => a.order - b.order)
  if (!modules.length) return []

  const lines = ["   Modules on this screen:"]
  for (const module of modules) {
    const kind = describeModuleKind(module.kind)
    const parts = [
      `   - **${module.name}** (${kind.name}) — ${sentence(kind.promptDetails)}`,
    ]
    if (module.trigger.trim()) {
      parts.push(sentence(`Appears/fires: ${module.trigger.trim()}`))
    }
    if (module.note.trim()) parts.push(sentence(module.note.trim()))
    lines.push(parts.join(" "))
  }

  const byId = new Map(modules.map((m) => [m.id, m]))
  const inner = doc.moduleEdges.filter(
    (e) => byId.has(e.from) && byId.has(e.to)
  )
  if (inner.length) {
    lines.push("   Inside this screen:")
    for (const edge of inner) {
      const from = byId.get(edge.from)!
      const to = byId.get(edge.to)!
      const trigger = edge.trigger.trim()
      lines.push(
        `   - **${from.name}** → **${to.name}**${trigger ? ` — ${trigger}` : ""}.`
      )
    }
  }
  return lines
}

function navigationBlock(doc: ProjectDoc): string {
  if (!doc.screens.length) return ""
  const { ordered, entries, branching } = analyseGraph(doc.screens, doc.edges)
  const byId = new Map(doc.screens.map((s) => [s.id, s]))
  const lines: string[] = []

  if (entries.length) {
    lines.push(
      `Entry point${entries.length === 1 ? "" : "s"}: ${entries.map((s) => `**${s.title}**`).join(", ")}.`
    )
  }
  if (ordered.length > 1) {
    lines.push("")
    lines.push(`Flow: ${ordered.map((s) => s.title).join(" → ")}`)
  }

  if (doc.edges.length) {
    lines.push("")
    lines.push("Transitions:")
    lines.push(
      list(
        doc.edges
          .map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return ""
            const trigger = edge.trigger.trim()
            return `From **${from.title}** to **${to.title}**${trigger ? ` — ${trigger}` : ""}.`
          })
          .filter(Boolean)
      )
    )
  }

  if (branching.length) {
    lines.push("")
    lines.push(
      `Branch points (more than one outgoing path — make the choice explicit in the UI): ${branching
        .map((s) => s.title)
        .join(", ")}.`
    )
  }

  lines.push("")
  lines.push(
    "Navigation must be real: every transition above is a working link or action, and the user can always get back."
  )
  return lines.join("\n")
}

/**
 * One app, several audiences. The build agent needs the whole picture in one
 * pass — it is implementing one route table with role gates, not N apps — so
 * every screen is described once above and this block says who reaches what.
 */
function viewsBlock(doc: ProjectDoc): string {
  if (!doc.views.length || !doc.screens.length) return ""

  const parts: string[] = [
    `This product is used by ${doc.views.length} different kinds of user. Every screen above exists once; access is what differs. Gate routes and navigation by role, and never rely on hiding a link alone — a role that cannot use a screen must not be able to reach it by typing the URL.`,
    "",
  ]

  for (const view of doc.views) {
    const screens = screensInView(doc, view.id)
    const edges = edgesInView(doc, view.id)
    const { ordered, entries } = analyseGraph(screens, edges)
    const exclusive = screens.filter((s) => s.views.includes(view.id))

    parts.push(`### ${view.name}`)
    if (view.note.trim()) parts.push(view.note.trim())
    parts.push(
      `Reaches ${screens.length} of ${doc.screens.length} screens${
        entries.length
          ? `, starting at ${entries.map((s) => `**${s.title}**`).join(" or ")}`
          : ""
      }.`
    )
    if (ordered.length > 1) {
      parts.push(`Path: ${ordered.map((s) => s.title).join(" → ")}`)
    }
    if (exclusive.length) {
      parts.push(
        `Only this role sees: ${exclusive.map((s) => `**${s.title}**`).join(", ")}.`
      )
    }
    parts.push("")
  }

  const shared = doc.screens.filter((s) => s.views.length === 0)
  if (shared.length) {
    parts.push(
      `Shared by every role: ${shared.map((s) => `**${s.title}**`).join(", ")}. Build these once and reuse them; do not fork a copy per role.`
    )
  }

  return parts.join("\n")
}

function sectionsBlock(doc: ProjectDoc): string {
  if (!doc.sections.length) return ""
  const ordered = [...doc.sections].sort((a, b) => a.order - b.order)
  const body = ordered
    .map((section, index) => {
      const type = sectionTypeMap[section.type]
      const layout = describeLayout(section.layout)
      const lines = [
        `${index + 1}. **${section.name || type?.name || section.type}**${type ? ` (${type.name})` : ""}`,
      ]
      if (type) lines.push(`   Purpose: ${type.promptDetails}.`)
      lines.push(`   Layout: ${layout.name} — ${layout.promptDetails}`)
      if (section.note.trim()) lines.push(`   Notes: ${section.note.trim()}`)
      return lines.join("\n")
    })
    .join("\n\n")
  return `${body}\n\nRender the sections in exactly this order, each as its own full-width band with consistent vertical rhythm.`
}

/** Read once: a legacy colour field still on its default was never chosen. */
const THEME_FIELD_DEFAULTS = themeSchema.parse({})

function designBlock(doc: ProjectDoc): string {
  const t = doc.theme
  const language = describeDesignLanguage(t.designLanguage)

  // "Basic" is the one language that instructs the agent *not* to design. Every
  // line below it is a design decision, so emitting them would contradict the
  // paragraph directly above — and an agent given both follows the longer list.
  if (t.designLanguage === "basic") {
    return [
      `Design language — **${language.name}**: ${language.promptDetails}`,
      "",
      list([
        "Ignore any colour, radius, elevation or font direction implied elsewhere in this brief — there is none for this build.",
        "Use one typographic decision only: a readable body size and a sensible measure. Everything else is the browser's.",
        "Leave class names and structure obvious and unstyled, so a stylesheet added later has something to hook onto.",
      ]),
      "",
      "The creative level does not apply here — the instruction above wins.",
    ].join("\n")
  }

  // Everything below is derived from the resolved theme rather than from the
  // legacy option fields it used to read.
  //
  // Those fields are still in the schema and Flow still writes them, but the
  // design editor writes a preset — so a project on Telegraph was shipping
  // "Corners: fully rounded, Headings: geometric sans" from untouched defaults
  // directly above a stylesheet with 2px radii and a slab serif. Two design
  // systems in one prompt, and the agent follows whichever it reads last.
  const preset = presetById(t.preset)
  const tokens = resolveTokens(t)
  const shape = tokens.shape
  const corners = shape.pill
    ? `${shape.control}px on controls, ${shape.card}px on cards, ${shape.overlay}px on overlays — and actions are full pills`
    : `${shape.control}px on controls, ${shape.card}px on cards, ${shape.overlay}px on overlays`

  return [
    `Design language — **${language.name}**: ${language.promptDetails}`,
    "",
    `Preset — **${preset.name}**: ${preset.character}`,
    "",
    list([
      ...preset.axes,
    ]),
    "",
    list([
      // The hex only appears when somebody actually chose it. Printing the
      // untouched default beside a preset's own primary is how the block ends
      // up naming two different colours for the same job.
      `Primary: ${
        t.primaryColor === THEME_FIELD_DEFAULTS.primaryColor
          ? ""
          : `${t.primaryColor}, resolved to `
      }\`${tokens.light.primary}\` in light and \`${tokens.dark.primary}\` in dark — primary actions, active states and focus rings, and nothing else.`,
      `Supporting colour: \`${tokens.light["chart-2"]}\` — charts and highlights. The accent token is a tint for hover and active rows, not a second brand colour.`,
      `Corners: ${corners}.`,
      `Density: ${densityWords[t.density] ?? t.density}.`,
      tokens.fonts.display
        ? `Typefaces: **${tokens.fonts.display}** for display, **${tokens.fonts.body}** for body, **${tokens.fonts.mono}** for figures and code. Load them from Google Fonts with a real fallback stack.`
        : "Typefaces: two families and a monospace, no more.",
      // Two legacy fields with no token to land on. They still reach the agent
      // when an old file set them, and stay silent otherwise rather than
      // asserting a default nobody chose.
      t.buttonStyle === THEME_FIELD_DEFAULTS.buttonStyle
        ? ""
        : `Buttons: ${buttonWords[t.buttonStyle] ?? t.buttonStyle}.`,
      t.iconStyle === THEME_FIELD_DEFAULTS.iconStyle
        ? ""
        : `Icons: ${describeOption(iconStyles, t.iconStyle).promptDetails}.`,
      `Themes: ${describeOption(colorSchemes, t.colorScheme).promptDetails}.`,
      "Define every colour, radius, shadow and font size once as CSS custom properties; components reference the tokens, never raw values. The stylesheet below is that file — use it rather than deriving your own.",
    ]),
    "",
    preset.promptDetails,
    "",
    "",
    "**Design it before you style it.** Write the token system down first — 4–6 named colours, the two typefaces and their roles, and the layout idea in a sentence — and derive every value below from that. Ground it in what this product actually is: the vocabulary, materials and instruments of its subject are where a specific design comes from. A page that could belong to any product in this category has not been designed.",
    "",
    list([
      "**Typography does the work.** Set a scale and stay on it. Running text near 65 characters. `text-wrap: balance` on headings, letter-spacing on uppercase labels, `font-variant-numeric: tabular-nums` wherever digits line up in a column. Every face gets a real fallback stack.",
      "**Choose the neutrals.** A pure mid-grey reads as unconsidered. Bias the greys slightly toward the accent's hue so the palette resolves as one set of decisions rather than an accent dropped onto a default.",
      "**Spend boldness once.** One element carries the personality; everything around it stays quiet. If the accent fights the ground, shift it toward analogous or drop saturation — do not replace it.",
      "**Layout does the spacing.** Flex or grid with `gap` between siblings, not a margin per element. Wide content — tables, code, diagrams — scrolls inside its own `overflow-x: auto` container; the page body never scrolls sideways.",
      "**Structure must mean something.** Numbered markers, eyebrows, dividers and rules encode something true about the content or they do not appear. `01 / 02 / 03` is for an actual sequence, not for three cards that happen to sit in a row.",
      "**Copy is design material.** Name things the way a user recognises them, not the way the system is built. Active voice; a control says exactly what happens, and the confirmation echoes it. Errors say what went wrong and how to fix it.",
      "**Finish the states.** Every interactive element gets hover, focus-visible, active, disabled and loading. Empty states say what goes here and how to start. Honour `prefers-reduced-motion`.",
    ]),
    "",
    "**Do not reach for the generated-design defaults.** These looks are what a model produces when it has not made a decision, and they are all disqualified here unless something above explicitly asks for one:",
    "",
    list([
      "warm cream (#F4F1EA) grounds with a serif display face and a terracotta accent",
      "near-black with a single acid-green or vermilion pop",
      "a purple-to-blue gradient hero on white",
      "Inter or Space Grotesk chosen as the safe face rather than for a reason",
      "emoji as section markers or feature-card icons",
      "everything centred, every corner the same medium radius, an accent bar on every card",
      "a full-viewport hero on a page that is not a landing page",
    ]),
    "",
    "Where this list and the settings above disagree, the settings win — they were chosen for this project, and this list is only about what to do when nothing was chosen.",
    "",
    uiLevelBlock(doc),
  ].join("\n")
}

function stackBlock(doc: ProjectDoc, detail: "full" | "condensed"): string {
  const lines: string[] = []

  // The clone's `package.json` pins the versions, so the list is only worth
  // printing for what it adds beyond it — and anything it contradicts is a
  // decision the agent has to be told to make deliberately.
  if (fromBoilerplate(doc)) {
    const extras = doc.stack.extras.map((extra) => extra.trim()).filter(Boolean)
    const head =
      "The cloned repository pins the stack in its `package.json`. Add a dependency only where this product genuinely needs one, and say why."
    return extras.length ? `${head}\n\n${list(extras)}` : head
  }
  for (const group of stackGroups) {
    const value = doc.stack[group.key]
    const option = findStackOption(group.key, value)
    if (!option) {
      if (value) lines.push(`${group.label}: ${value}`)
      continue
    }
    if (detail === "condensed" && ["tooling", "packageManager", "testing"].includes(group.key)) {
      continue
    }
    lines.push(option.promptLine)
  }
  for (const extra of doc.stack.extras) {
    if (extra.trim()) lines.push(extra.trim())
  }
  return list(lines)
}

/**
 * True when the folder tree, the conventions and the pinned dependencies are
 * already in the cloned repository, so restating them here is dead weight the
 * agent has to read past — and, worse, a second source of truth that can
 * disagree with `CLAUDE.md`.
 */
function fromBoilerplate(doc: ProjectDoc): boolean {
  return usesBoilerplate(doc)
}

function structureBlock(doc: ProjectDoc): string {
  // The tree is the clone. Printing it again invites the agent to reconcile two
  // copies of the same thing, and it is the copy in the repo that is true.
  if (fromBoilerplate(doc)) {
    const custom = doc.structure.preset === "custom" ? doc.structure.customTree.trim() : ""
    return custom
      ? `The cloned repository sets the folder structure. This product deviates from it as follows:\n\n\`\`\`\n${custom}\n\`\`\``
      : ""
  }
  const preset = structureMap[doc.structure.preset]
  const tree =
    doc.structure.preset === "custom" || !preset?.tree
      ? doc.structure.customTree.trim()
      : preset.tree
  if (!tree) return ""
  const notes = preset?.notes?.length ? `\n\n${list(preset.notes)}` : ""
  return `Use this folder structure:\n\n\`\`\`\n${tree}\n\`\`\`${notes}`
}

/**
 * Working agreements that hold for every build here, whatever the project
 * selected. They are house rules rather than preferences — a prompt that
 * silently dropped them because a starter did not tick the box would be the
 * bug, so they are appended rather than offered.
 */
const houseRuleIds = ["git-permission", "story-docs", "kt-doc", "reuse-components"]

function conventionsBlock(doc: ProjectDoc): string {
  const platform = platformOf(doc.stack)
  const ids = [
    ...doc.conventions.ids,
    ...houseRuleIds,
    // Only meaningful on Next — elsewhere it would be noise.
    ...(doc.stack.framework.startsWith("next") ? ["next-proxy"] : []),
  ]
  const overrides = conventionOverrides[platform]
  const lines = Array.from(new Set(ids))
    // A rule that cannot apply on this platform is worse than no rule: it
    // teaches the reader that these lines are boilerplate to skim.
    .filter((id) => {
      if (platform === "web") return true
      // A service keeps the web rules that are really about shared code and
      // validated boundaries — `conventionOverrides.server` restates those in
      // its own words — and drops only the two that are purely about
      // rendering.
      if (platform === "server") return !serverIrrelevantConventionIds.includes(id)
      return !webOnlyConventionIds.includes(id)
    })
    .map((id) => overrides[id] ?? conventionMap[id]?.line ?? id)
    .filter(Boolean)
  const custom = doc.conventions.custom.trim()

  // `CLAUDE.md` in the clone carries these, generated from the same catalogue,
  // so repeating them is a second source of truth that can drift. What cannot
  // be in the repo is whatever this project added by hand.
  if (fromBoilerplate(doc)) {
    const head =
      "The conventions are in `CLAUDE.md` at the root of the cloned repository. Read it before writing code; it is not repeated here."
    return custom ? `${head}\n\nThis product adds:\n\n${custom}` : head
  }

  if (!lines.length && !custom) return ""
  return [list(lines), custom ? `\n${custom}` : ""].filter(Boolean).join("\n")
}

function requirementsBlock(doc: ProjectDoc): string {
  // The baseline is chosen by platform, not appended to a web one — see
  // features/stack/data/platforms.ts.
  const lines = [...platformRequirements[platformOf(doc.stack)]]
  for (const id of doc.snippetIds) {
    const snippet = snippetMap[id]
    if (snippet) lines.push(...snippet.lines)
  }
  return list(Array.from(new Set(lines)))
}

/**
 * Start from the shared repository rather than an empty folder.
 *
 * Empty when the project has not opted in, which is what keeps every existing
 * brief generating exactly what it generated before.
 *
 * The instruction to read `CLAUDE.md` is explicit even though Claude Code picks
 * it up on its own: the prompt is also pasted into tools that do not, and a
 * brief whose conventions only apply in one client is worse than one that
 * repeats itself.
 */
function boilerplateBlock(doc: ProjectDoc): string {
  if (!usesBoilerplate(doc)) return ""
  return [
    "**Do not scaffold this project from scratch.** Clone the starting point, drop its history, and build on top of it:",
    "",
    cloneLines(doc.name),
    "",
    `Pinned to commit \`${BOILERPLATE.commit.slice(0, 12)}\` — use that commit, not \`main\`, so this brief builds the same thing whenever it is run. Source: ${BOILERPLATE.url}`,
    "",
    `That commit installs \`next@${BOILERPLATE.nextVersion}\`, which is above the patched floor for CVE-2025-66478. Do not downgrade it, and if you update it, stay on a patched release — see the version floor below.`,
    "",
    "It already provides, and none of it is to be rebuilt — `CLAUDE.md` lists every file and what it is for:",
    "",
    list([...BOILERPLATE.provides]),
    "",
    "Read `CLAUDE.md` at the repository root before writing any code — it carries the conventions this brief expects and they are not repeated below. Where it and this brief disagree, this brief wins: it was written for this product.",
    "",
    "Delete `features/example/` once a real feature follows its shape, and replace the placeholder name, metadata and navigation with this product's.",
  ].join("\n")
}

function additionalBlock(doc: ProjectDoc): string {
  return doc.requirements.trim()
}

function deliveryBlock(doc: ProjectDoc): string {
  const count = doc.screens.length
  return list(
    [
      count
        ? `Deliver all ${count} screen${count === 1 ? "" : "s"} — a screen that only renders a title is not delivered.`
        : "Deliver the full page, section by section.",
      doc.modules.length
        ? `Deliver every module listed under its screen — all ${doc.modules.length} of them — including the transitions between them. A screen missing its modules is not delivered.`
        : "",
      "No placeholder text, TODO comments or stubbed handlers.",
      ...platformDelivery[platformOf(doc.stack)],
      "State any assumption you had to make at the end of your response, in one short list.",
    ].filter(Boolean)
  )
}

/**
 * Blocks a UI-first build does not want.
 *
 * A prototype brief that still carries a database schema and a deployment
 * section is the thing people stop reading, so this drops content rather than
 * merely reordering it. It is a set rather than a filter on each block so the
 * decision is in one place and can be read at a glance.
 */
function droppedByPriority(doc: ProjectDoc): Set<BlockId> {
  if (doc.priority !== "ui-first") return new Set()
  return new Set<BlockId>(["data_model", "deployment"])
}

const titles: Record<BlockId, string> = {
  overview: "Overview",
  boilerplate: "Start From The Boilerplate",
  flows: "User Journeys & Stories",
  data_model: "Data Model",
  screens: "Screens",
  navigation: "Navigation & Flow",
  views: "Roles & Access",
  sections: "Page Sections",
  design: "Design System",
  tokens: "Design Tokens — Write These First",
  ui_conventions: "Interface Craft",
  stack: "Tech Stack",
  structure: "Project Structure",
  conventions: "Conventions",
  requirements: "Technical Requirements",
  additional: "Additional Requirements",
  security: "Dependency Versions — Non-Negotiable",
  delivery: "Definition of Done",
  deployment: "Shipping It",
}

// ------------------------------------------------------------------- build

/**
 * Builds the prompt for **one surface**. Web, mobile and backend are separate
 * builds with separate stacks and separate repos; one prompt covering all three
 * would describe an app nobody is writing.
 */
export function buildPrompt(
  doc: ProjectDoc,
  options: { surface?: Surface } = {}
): BuiltPrompt {
  const surface = options.surface ?? "web"
  const doc_ = scopeToSurface(doc, surface)
  return buildForScope(doc_, surface)
}

/**
 * Narrows the document to one surface: its screens, the transitions between
 * them, their modules, and that surface's own stack and folder structure. The
 * landing page belongs to the web build only.
 */
function scopeToSurface(doc: ProjectDoc, surface: Surface): ProjectDoc {
  const screens = doc.screens.filter((s) => s.surface === surface)
  const ids = new Set(screens.map((s) => s.id))
  const modules = doc.modules.filter((m) => ids.has(m.screenId))
  const moduleIds = new Set(modules.map((m) => m.id))
  return {
    ...doc,
    screens,
    edges: doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    modules,
    moduleEdges: doc.moduleEdges.filter(
      (e) => moduleIds.has(e.from) && moduleIds.has(e.to)
    ),
    // A journey whose every screen lives on another build is not this build's
    // journey — listing it would describe work that is not in this repo.
    flows: doc.flows.filter((flow) =>
      screens.some((screen) => screen.flows.includes(flow.id))
    ),
    sections: surface === "web" ? doc.sections : [],
    stack: stackFor(doc, surface),
    structure: structureFor(doc, surface),
  }
}

function buildForScope(doc: ProjectDoc, surface: Surface): BuiltPrompt {
  const target = getTarget(doc.target)
  const bodies: Record<BlockId, string> = {
    overview: overviewBlock(doc),
    boilerplate: boilerplateBlock(doc),
    flows: flowsBlock(doc),
    // The same tables for every build: the schema is a property of the
    // product, and three builds each given their own guess at it is three
    // databases.
    data_model: dataModelBlock(doc),
    screens: screensBlock(doc),
    navigation: navigationBlock(doc),
    views: viewsBlock(doc),
    sections: sectionsBlock(doc),
    design: designBlock(doc),
    // The design block says what the design is; these two say it in values a
    // build agent can only satisfy one way. Both stand down for the "basic"
    // language and for a backend build, by returning an empty body.
    tokens: tokensBlock(doc, surface),
    ui_conventions: uiConventionsBlock(doc, surface),
    stack: stackBlock(doc, target.stackDetail),
    structure: structureBlock(doc),
    conventions: conventionsBlock(doc),
    requirements: requirementsBlock(doc),
    additional: additionalBlock(doc),
    // Its own block rather than a paragraph inside the stack section. The v0
    // target has no "stack" in its order, so a floor that rode along with the
    // stack simply vanished for the one builder that scaffolds Next itself.
    security: securityConstraint(doc.stack.framework),
    delivery: deliveryBlock(doc),
    // Project-wide, not per-surface: the deployment answer is "where does this
    // product live", and three builds each given their own is three answers.
    deployment: deploymentBlock(doc),
  }

  const blocks: PromptBlock[] = target.order
    .filter((id) => !droppedByPriority(doc).has(id))
    .filter((id) => bodies[id].trim().length > 0)
    .map((id) => ({ id, title: titles[id], body: bodies[id].trim() }))

  const rendered = blocks
    .map((block) =>
      target.format === "xml"
        ? `<${xmlTag(block.id)}>\n${block.body}\n</${xmlTag(block.id)}>`
        : `## ${block.title}\n\n${block.body}`
    )
    .join("\n\n")

  const name =
    surface === "web" ? doc.name : `${doc.name} — ${surfaceMeta[surface].label}`
  const text = [
    target.preamble(name),
    rendered,
    target.closing,
    verificationNotice(target.format),
  ]
    .filter(Boolean)
    .join("\n\n")

  return { text, blocks, warnings: collectWarnings(doc) }
}

function xmlTag(id: ProjectBlockId) {
  return id.replace(/[^a-z]/g, "_")
}

export function collectWarnings(doc: ProjectDoc): string[] {
  const warnings: string[] = []

  // Anything in the data model that a migration could not express. Warnings
  // from that check (a table nothing joins to, a column that is not snake_case)
  // are left to the Data tab — they are style, and the checks list is for
  // things that will actually break the build.
  for (const issue of checkDataModel(doc)) {
    if (issue.level === "error") warnings.push(issue.message)
  }
  // The switch says "clone the starter", the stack says something the starter
  // is not. Silently ignoring one of the two is how a Vite brief ended up
  // telling the agent to clone a Next app.
  if (doc.startFrom === "boilerplate" && !usesBoilerplate(doc)) {
    const option = findStackOption("framework", doc.stack.framework)
    warnings.push(
      `The boilerplate is a Next.js 16 App Router app, so it does not fit ${
        option?.label ?? doc.stack.framework
      }. The prompt describes the stack, folder structure and conventions in full instead.`
    )
  }
  if (!doc.screens.length && !doc.sections.length) {
    warnings.push("Nothing to build yet — add a screen or a page section.")
  }

  const { unreachable, cycles, danglingEdges } = analyseGraph(doc.screens, doc.edges)
  for (const screen of unreachable) {
    // A service area is reached by an HTTP call, not by a transition. Flagging
    // one as unconnected reports the normal case as a problem, and a project
    // whose clients are fully wired was being told its flow was broken.
    if (screen.surface === "backend") continue
    warnings.push(`"${screen.title}" is not connected to any other screen.`)
  }
  if (doc.screens.length > 1 && !doc.edges.length) {
    warnings.push(
      "No connections yet — connect the screens so the generated prompt can describe the flow."
    )
  }
  for (const cycle of cycles) {
    const names = cycle
      .map((id) => doc.screens.find((s) => s.id === id)?.title ?? id)
      .join(" → ")
    warnings.push(`Loop detected: ${names} → …. Fine if intentional (e.g. save and return).`)
  }
  if (danglingEdges.length) {
    warnings.push(`${danglingEdges.length} connection(s) point at a deleted screen.`)
  }

  // Views only mean something if screens are actually tagged. A project with
  // roles where almost nothing is tagged looks fine on the canvas but every
  // view shows the whole app — the most likely cause is a reverse-engineered
  // file that tagged one role's screens and left the rest bare.
  if (doc.views.length && doc.screens.length) {
    const untagged = doc.screens.filter((s) => s.views.length === 0).length
    const share = untagged / doc.screens.length
    if (share > 0.6 && doc.screens.length > 4) {
      warnings.push(
        `${untagged} of ${doc.screens.length} screens have no role tag, so they appear in every view — selecting a role will show almost the whole app. Tag the screens each role can actually reach.`
      )
    }
    for (const view of doc.views) {
      if (!doc.screens.some((s) => s.views.includes(view.id))) {
        warnings.push(
          `No screen is tagged for "${view.name}" — that view shows exactly the same thing as every other.`
        )
      }
    }
  }

  const missingLayout = doc.screens.filter(
    (s) => !s.layout && s.surface !== "backend"
  ).length
  if (missingLayout) {
    warnings.push(
      `${missingLayout} screen(s) have no layout chosen — the prompt will fall back to a generic description.`
    )
  }
  const missingTemplate = doc.screens.filter((s) => !s.template).length
  if (missingTemplate) {
    warnings.push(`${missingTemplate} screen(s) have no type chosen.`)
  }
  const missingSectionLayout = doc.sections.filter((s) => !s.layout).length
  if (missingSectionLayout) {
    warnings.push(`${missingSectionLayout} section(s) have no layout chosen.`)
  }

  warnings.push(...stackWarnings(doc.stack))

  // A web-only builder cannot ship a phone app, and its preamble promises a
  // responsive web app regardless of what the screens say.
  const target = getTarget(doc.target)
  if (target.webOnly && platformOf(doc.stack) !== "web") {
    warnings.push(
      `${target.name} builds web apps — for a native build, switch the target to Claude Code.`
    )
  }

  if (doc.structure.preset === "custom" && !doc.structure.customTree.trim()) {
    warnings.push("Custom folder structure selected but no tree pasted in.")
  }
  return warnings
}
