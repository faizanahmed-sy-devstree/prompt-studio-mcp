// Vendored from Prompt Studio (features/prompt/engine/tokens-block.ts). Do not edit here — run `pnpm sync`.
/**
 * The token contract: the generated stylesheet, and the rules that make an
 * agent obey it.
 *
 * This block exists because of one measured failure. The design block describes
 * a design in prose — nine sentences from the catalogues and two raw hex codes —
 * and the only instruction about custom properties in the entire build prompt
 * was a single line naming no variables and no values. An agent given that has
 * to invent the neutrals, the surfaces, the borders, the dark palette and the
 * scale, and inventing them is precisely when it reaches for the median of its
 * training data. That is where generic output comes from.
 *
 * So this block ships the file instead of describing it. A stylesheet an agent
 * can paste is unambiguous in a way no adjective is: "premium" has a thousand
 * satisfying answers, `--background: oklch(0.98 0.004 160)` has one.
 *
 * It deliberately does NOT restate the design language, the creative level or
 * the anti-defaults list — those are the design block's job, and two blocks
 * both claiming authority over the same decision is how a prompt starts
 * contradicting itself.
 */

import { stackFor } from "../../builder/utils/surfaces"
import { generateStylesheet } from "../../theme/tokens/index"
import type { ProjectDoc, Surface } from "../../../types/project"

/** How much of the viewport the signature colour is allowed to cover. */
const ACCENT_BUDGET = 10

export function tokensBlock(doc: ProjectDoc, surface: Surface = "web"): string {
  // A server has no stylesheet. Emitting an empty body is how the block
  // disappears from a backend build without a special case in the target.
  if (surface === "backend") return ""

  // "basic" is the explicit instruction not to design this. Handing it a
  // palette would be arguing with the user through the prompt.
  if (doc.theme.designLanguage === "basic") return ""

  const sheet = generateStylesheet(doc.theme, stackFor(doc, surface).styling)
  if (!sheet.source.trim()) return ""

  return [
    `Write this file first, before any component. It is the decision, not a suggestion: every colour, radius, shadow and duration on the page resolves to one of these names.`,
    "",
    // The design section describes the same design in prose, and prose and
    // values will eventually disagree — a hex quoted in a sentence, a corner
    // called "medium". Saying which one wins costs one line and removes every
    // argument the two could have.
    "Where this file and the design description differ, this file wins. The description explains the intent; these are the values.",
    "",
    `\`${sheet.path}\``,
    "",
    "```" + sheet.language,
    sheet.source.trim(),
    "```",
    "",
    "**No raw values in components.** No hex in a class attribute, no `p-[13px]`, no one-off `text-[15px]`. If you need a value that is not here, add it to this file first and say why in your summary.",
    "",
    `**Accent budget: the signature colour covers no more than ${ACCENT_BUDGET}% of any viewport.** It belongs on the primary action, the focused state, and the one live indicator that genuinely matters. It does not go on card borders, icon tiles, section headings, or a bar down the side of a panel.`,
    "",
    "**The neutrals are already biased toward the accent's hue.** Keep that bias if you extend them — a pure grey dropped in beside these reads as an accident rather than a decision.",
    "",
    "**Dark mode is a second set of values, not an inversion.** They are both in the file. Do not compute one from the other, and do not add `dark:` variants to components — every colour flows through the token blocks above.",
  ].join("\n")
}
