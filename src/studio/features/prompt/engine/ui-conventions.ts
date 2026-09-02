// Vendored from Prompt Studio (features/prompt/engine/ui-conventions.ts). Do not edit here — run `pnpm sync`.
/**
 * The craft rules: the scale, the spacing, the motion, the states, and the
 * list of things that must not appear.
 *
 * Everything here is phrased so it can be checked rather than judged. "Use
 * animation sparingly" cannot be verified by the agent that wrote the page;
 * "two durations exist, 120ms and 200ms, and nothing animates on load" can be,
 * and an instruction a model can self-check is worth several it cannot.
 *
 * The ban list is the same idea pointed at the failure mode. Generated
 * interfaces converge on a small, nameable set of signatures — the same
 * gradient, the same three-card grid, the same emoji headings — and naming
 * them individually removes them, where "avoid generic design" does not,
 * because the model has no way to tell whether it complied.
 *
 * The type scale is emitted as a table of computed values rather than a ratio,
 * because a ratio is an instruction to do arithmetic and every model that does
 * that arithmetic gets slightly different numbers.
 */

import { resolveTokens, type TypeStep } from "../../theme/tokens/index"
import type { ProjectDoc, Surface } from "../../../types/project"

/**
 * Signatures banned by name.
 *
 * Ordered by how often the failure actually occurs, because a model reading a
 * long list weights the top of it. Each line has to be answerable yes or no
 * about a finished page — that is the whole design of this list.
 */
const BANNED = [
  "Any gradient used as decoration — purple-to-blue, blue-to-violet, cyan-to-purple, pink-to-orange, mesh, aurora or blob. Solid colours from the token set. A gradient is allowed only where it encodes data, such as a chart fill.",
  "Emoji standing in for an icon, a bullet, a section marker or a heading decoration.",
  "Placeholder copy of any kind: lorem ipsum, 'Your text here', 'Feature One', 'Card Title', fake avatars, fake logos, or an unearned 'Trusted by' row.",
  "A centred hero: headline, subheading, two buttons, device mockup, all stacked on the centre line.",
  "A row of three or six identical feature cards, each an icon in a tinted rounded square above a heading and two lines of text.",
  "Everything centred. Body copy is left-aligned; centring is for an empty state and nothing else.",
  "Identical vertical padding on every section, so the page has no rhythm.",
  "A raw colour in a class attribute — `text-white`, `bg-black`, `#0f172a`, `bg-[#eee]`. Every colour is a token.",
  "An arbitrary spacing or size value — `p-[13px]`, `text-[15px]`, `gap-[7px]`. Every value comes from the scale.",
  "A radius that is not one of the three in the token set, or a fourth radius invented for one component.",
  "More than one elevation level, or a shadow on anything that is not genuinely floating above the page.",
  "Uppercase, letter-spaced eyebrow labels above headings, used as a texture rather than because the label carries information.",
  "A single word in a headline given a different colour, weight, or typeface for emphasis.",
  "Decorative status dots beside every list item, nav entry or badge.",
  "A '→' appended to link or button text.",
  "Metadata strings strung together with middle dots — 'Brand · No. 01 · 2026'.",
  "Section-number eyebrows — '01 / INDEX', '002 · Capabilities' — on content that is not an ordered sequence.",
  "A fake product UI built from styled divs — a mock terminal, a mock dashboard, a mock task list — used as hero decoration.",
  "Abstract filler shapes: gradient circles, blurred squares, floating blobs.",
  "A frosted glass panel where nothing is actually overlapping.",
  "Fade-and-slide-up entrances on every section, or a hover transition on every card.",
  "Marketing filler words: empower, unlock, seamless, elevate, supercharge, revolutionise, game-changing, next level.",
  "A light/dark toggle, unless the brief asks for one. The stylesheet already ships both; the operating system chooses.",
  "Four identical stat tiles across the top of a dashboard when the product does not have four things worth counting.",
]

/**
 * Density as two numbers rather than a word, because "comfortable" is read
 * three ways and a padding is read one way.
 */
const DENSITY: Record<ProjectDoc["theme"]["density"], string> = {
  compact:
    "Density is compact: 28–32px rows and controls, 16px panel padding, 12px between fields, 14px body. This is a surface someone keeps open all day, so vertical space is the scarce resource.",
  comfortable:
    "Density is comfortable: 36–40px rows and controls, 24px card padding, 20px between fields, 16px body. The default, and the one to keep unless a screen argues otherwise.",
  spacious:
    "Density is spacious: 44–52px rows and controls, 32px card padding, 28px between fields, 16px body at 1.65. Page sections vary between 48px and 96px of vertical padding so the page has rhythm.",
}

/** Rules about the states most generated interfaces skip entirely. */
const STATES = [
  "**Empty.** Every list, table and search result has a designed empty state: what this is, why it is empty, and the one action that fills it. Not the word 'None'.",
  "**Loading.** Skeletons that match the shape of the content they replace, with varied widths so no two rows align. Not a centred spinner over an empty page.",
  "**Error.** What failed, and what to do about it. No apology, no 'Something went wrong'.",
  "**Focus.** Every interactive element has a visible `:focus-visible` ring using the ring token. Never remove an outline without replacing it.",
  "**Disabled.** Reduced contrast, cursor not-allowed, and a reason available on hover or nearby — a control that refuses without saying why is a bug.",
]

export function uiConventionsBlock(
  doc: ProjectDoc,
  surface: Surface = "web"
): string {
  if (surface === "backend") return ""
  if (doc.theme.designLanguage === "basic") return ""

  const tokens = resolveTokens(doc.theme)
  const { scale, spacing, motion } = tokens

  const scaleRows = scale
    .map(
      (step: TypeStep) =>
        `    ${step.name.padEnd(8)} ${String(step.size).padStart(3)} / ${String(
          step.lineHeight
        ).padEnd(4)} ${step.tracking.padStart(8)}  ${step.weight}`
    )
    .join("\n")

  const motionLines =
    motion.model === "none"
      ? [
          "Nothing moves. No transitions, no animations, no hover lifts. State changes are instant.",
        ]
      : [
          motion.model === "spring"
            ? `Springs for anything a person set in motion; ${motion.stateMs}ms and ${motion.enterMs}ms as the equivalent durations elsewhere.`
            : `Two durations only: **${motion.stateMs}ms** for a state change on a control (hover, focus, press, check) and **${motion.enterMs}ms** for something entering or leaving (menu, dialog, toast).`,
          `One easing curve: \`${motion.curve}\`.`,
          motion.overshoot
            ? `One overshoot curve, \`${motion.overshoot}\`, reserved for the two or three moments that should feel playful. Using it everywhere is how it stops meaning anything.`
            : "",
          "Transform and opacity only. Nothing animates on page load. Nothing loops. Respect `prefers-reduced-motion` by disabling all of it.",
        ].filter(Boolean)

  return [
    "### Type",
    "",
    "Set this scale and stay on it. Nothing on the page is sized outside it.",
    "",
    "```",
    "    step      px / lh   tracking  weight",
    scaleRows,
    "```",
    "",
    "Running text sits near 65 characters. Digits that line up in a column get `font-variant-numeric: tabular-nums`. Headings get `text-wrap: balance`, paragraphs `text-wrap: pretty`.",
    "",
    tokens.fonts.display
      ? `The faces are **${tokens.fonts.display}** for display and **${tokens.fonts.body}** for body${
          tokens.fonts.mono ? `, **${tokens.fonts.mono}** for figures and code` : ""
        }. Load them properly and give each a real fallback stack. Do not substitute Inter, Roboto, Open Sans, Lato, Space Grotesk or a bare system stack — every generated interface reaches for those, which is exactly why this one names something else.`
      : "Two families and a monospace, no more. Give every face a real fallback stack, and do not name a face you cannot actually load.",
    "",
    "### Space",
    "",
    DENSITY[doc.theme.density],
    "",
    `Spacing steps: ${spacing.join(", ")}. Nothing between them. Gaps come from the flex or grid container, never a margin on each child — margins collapse and double, and that is where uneven spacing comes from.`,
    "",
    tokens.elevation.rule,
    "",
    "### Motion",
    "",
    ...motionLines,
    "",
    "### Forms",
    "",
    tokens.inputRule,
    "",
    "Every field in the product uses that treatment — the same one on a dialog, a settings page and a sign-up form. A form where the label sits above on one screen and inside on the next is the clearest sign nobody decided.",
    "",
    "Labels are sentence case and never uppercase. A required field is marked on the label, not by colour alone. Helper text sits under the field in `--muted-foreground` at the `small` size and stays in the layout when it turns into an error, so nothing below it moves.",
    "",
    "### States",
    "",
    ...STATES,
    "",
    "### Do not ship any of these",
    "",
    "Each line is answerable yes or no about the finished page. Check them before you report back.",
    "",
    ...BANNED.map((line) => `- ${line}`),
    "",
    "If a screen genuinely needs one of the above, say so in your summary and give the reason. Doing it silently is the failure.",
  ].join("\n")
}
