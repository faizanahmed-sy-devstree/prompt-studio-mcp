// Vendored from Prompt Studio (features/prompt/engine/design-brief.ts). Do not edit here — run `pnpm sync`.
/**
 * The design block for a project that has not chosen one.
 *
 * The preset path ships a stylesheet: every colour, radius and duration
 * resolved to a value, because an adjective has a thousand satisfying answers
 * and `--background: oklch(0.98 0.004 160)` has one. This is the other half of
 * that argument — the person building does not have a design in mind and would
 * rather the agent decided than pick a preset at random.
 *
 * Handing that decision over is not the same as saying nothing, but it is also
 * not an invitation to write a longer list. Three findings shaped this block:
 *
 * A list of banned signatures decays. Every practitioner list from 2025 names
 * the purple-to-blue gradient and Inter; the current default is cream-and-serif
 * with a warm clay accent — which most of those lists *recommend*. Naming the
 * looks is worth a line or two, but the durable rule is the test: would I have
 * produced this from a generic prompt for any product of this kind? That is
 * self-checkable and does not expire.
 *
 * Instruction count is a budget, not a free parameter. Compliance falls as
 * simultaneous instructions rise, and the ones in the middle are dropped first,
 * so a forty-item list evicts the rules that matter. This block keeps roughly
 * twenty checkable items, hardest first, with the restraint repeated last.
 *
 * Persona framing does not work. "You are a world-class designer" measures at
 * a negligible effect and trades clarity for jargon. Asking the agent to reason
 * about each *role's* goals is a different thing — that is decomposition over
 * content this brief already contains, and it is what stops two roles being
 * handed the same screen with fields hidden.
 *
 * It deliberately does NOT name colours, fonts or radii. The moment it does, it
 * is a preset written badly — and the person who wanted a preset can pick one
 * in two clicks.
 */

import type { ProjectDoc, Surface } from "../../../types/project"

/** Structural rules, each answerable yes or no by looking at a finished page. */
const RULES = [
  "Exactly one element on a screen is the loudest thing, and it is the answer to what that role came to do. Everything else is quieter.",
  "Structural devices carry information or they do not appear. Numbered markers only for a real sequence; dividers, eyebrows and labels only where they mark a real distinction.",
  "No row of three equal cards unless there are genuinely three peer items of equal weight.",
  "No single word in a headline accented with a different colour, weight or italic.",
  "No uppercase eyebrow label above a heading, no “→” appended to link or button text, no emoji as an icon or in a heading.",
  "Body text is left-aligned and under 80 characters a line. Centring is for an empty state.",
  "At most one orchestrated motion moment per page that the person did not trigger. Motion that answers a click is fine and should show what changed. `prefers-reduced-motion` disables all of it.",
  "Every list, table and form has a designed empty, loading and error state. Errors say what happened and what to do, and do not apologise; empty states name the one action that fills them.",
  "Buttons name their effect — “Save changes”, not “Submit” — and the same action keeps the same word through the whole flow, so a Publish button produces a Published toast.",
  "Every value on the page comes from a token you defined. No raw colour or arbitrary size in a class attribute, and no fourth radius invented for one component.",
]

/** The looks that are currently the default rather than a decision. */
const DEFAULTS = [
  "cream or warm off-white with a high-contrast serif and a terracotta or clay accent",
  "near-black with a single acid green or vermilion pop",
  "the rounded-card kit: every block on the same radius with the same soft grey shadow",
  "broadsheet hairline rules and dense columns applied to something that is not editorial",
  "a gradient wash used as decoration — purple-to-blue, mesh, aurora or blob",
  "Inter, Roboto, Open Sans or Space Grotesk picked because they are safe",
]

/**
 * One line per role, so the layout can be ranked against something.
 *
 * The roles are already in this brief; what is missing is the instruction to
 * use them before laying anything out. Two roles handed the same screen with
 * fields hidden is the failure this prevents.
 */
function rolePass(doc: ProjectDoc): string[] {
  const named = doc.views.map((view) => view.name.trim()).filter(Boolean)
  if (!named.length) return []
  return [
    "### Before any layout, one pass per role",
    "",
    `This product has ${named.length === 1 ? "one role" : `${named.length} roles`}: ${named.join(", ")}. For each, write two lines:`,
    "",
    "- The one thing this person came to do, and the one fact they need before they can do it.",
    "- What they should see first, second and third on their main screen.",
    "",
    "Then lay that screen out so visual prominence matches the ranking. If the biggest element is not the answer to the first line, the layout is wrong. Two roles whose first question differs get different first screens — not one screen with fields hidden.",
    "",
  ]
}

/**
 * `intro` is false for the design-only prompt, which supplies its own framing.
 */
export function designBriefBlock(
  doc: ProjectDoc,
  surface: Surface = "web",
  options: { intro?: boolean } = {}
): string {
  if (surface === "backend") return ""

  const note = doc.theme.designNote.trim()

  return [
    options.intro === false
      ? ""
      : "**You own the visual design of this product.** No palette, typeface or component kit has been chosen for you — choose them, and be able to defend every choice by pointing at something in this brief.",
    "",
    "Derive the design from the subject, not from what applications of this kind usually look like. Read the screens, the roles and the stories above and answer in writing: what domain is this, who uses it, under what conditions, and what is the single most characteristic object or moment in its world. The industry's own materials, vocabulary and visual conventions are where distinctive choices come from — a claims console and a children's reading tracker must not be able to swap stylesheets.",
    "",
    note ? `The person who wrote this brief added: ${note}` : "",
    note ? "" : "",
    ...rolePass(doc),
    "### Write the design plan before any code",
    "",
    "Four sections, in concrete values:",
    "",
    "- **Palette** — four to six colours, each named, each with one clause saying what in this product it came from. One accent, reserved for primary actions and focus. Bias the greys toward the accent's hue; a pure mid-grey is the colour of not having decided. Then a dark mode re-chosen for a dark ground, not inverted.",
    "- **Type** — one or two families with their roles, loadable with a real fallback stack. If two, they must be visibly different — not two sans-serifs. State the scale as sizes, line heights and weights, and stay on it.",
    "- **Layout** — the structural idea in one sentence, the alignment, and a rough wireframe of the densest screen. One shape language and one depth language: a radius set or square corners; a border, a shadow or a lighter surface — pick one, not all three.",
    "- **Principles** — three sentences on what makes this product's interface unlike a generic one.",
    "",
    "If a sentence in that plan contains *clean, modern, sleek, intuitive, seamless, elegant, polished, premium, delightful* or *beautiful*, delete it and write the measurement or the trade-off it was standing in for. Then define the plan once as CSS custom properties and reference the names everywhere.",
    "",
    "### Check the plan before you build from it",
    "",
    "For each of the four sections, ask: would I have produced this same answer from a generic prompt for any product of this kind? (Work through such a prompt and see whether you arrive somewhere similar.) If yes, that part is a default rather than a decision — revise it, and say in one line what you changed and why.",
    "",
    "Check in particular whether you have reached for a look that is currently the default rather than a choice:",
    "",
    ...DEFAULTS.map((line) => `- ${line}`),
    "",
    "Any of these is legitimate if this product argues for it. None is legitimate as a starting point.",
    "",
    "### Rules that hold whatever you chose",
    "",
    ...RULES.map((line) => `- ${line}`),
    "",
    "### The floor",
    "",
    "Responsive to 360px; a visible focus ring on every interactive element; text contrast meeting WCAG AA in both themes. These are pass or fail, not goals.",
    "",
    "Report back with the plan's five decisions — the reference you designed from, the palette, the typefaces, the shape and depth rule, and the one thing you made loudest on the main screen. Then look at the page and remove one thing that does not serve the product.",
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim()
}
