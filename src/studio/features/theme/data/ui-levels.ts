// Vendored from Prompt Studio (features/theme/data/ui-levels.ts). Do not edit here — run `pnpm sync`.
/**
 * How much visual and interaction ambition the build should carry.
 *
 * Replaces the old 0–10 "creative latitude". Ten points was a slider nobody
 * could aim: the difference between 6 and 7 meant nothing, and the number went
 * into the prompt as a number, which an agent cannot act on. Five named levels
 * each carry a paragraph describing what to actually build.
 *
 * The important part is the preamble below rather than the levels themselves.
 * A level is a ceiling, not a quota — an internal admin table at level 4 does
 * not want a parallax hero, and saying so is what stops the dial being read as
 * "add this much decoration".
 */

export type UiLevel = {
  level: 1 | 2 | 3 | 4 | 5
  /** shown on the control */
  name: string
  /** one line under the control */
  hint: string
  /** the paragraph injected into the Design block */
  promptDetails: string
}

/**
 * Prefixes the level paragraph in every prompt.
 *
 * Stated first because the judgement has to happen before the level is
 * applied: the same level means something different for a field engineer's
 * phone in the rain and a marketing page whose job is to impress.
 */
export const UI_LEVEL_PREAMBLE = [
  "**Decide how much interface this product actually needs before you build any of it.** Read the journeys and the user stories above and ask, for each screen: who is on it, what are they trying to finish, how often are they here, and what is the cost of getting in their way?",
  "A screen someone uses forty times a day wants speed, density and keyboard reach — animation there is a tax. A screen someone sees once, or that has to persuade them, can afford atmosphere. A tool used one-handed in the field needs targets and contrast before it needs polish. Say in your final report where you spent the effort and where you deliberately did not.",
].join("\n\n")

export const uiLevels: UiLevel[] = [
  {
    level: 1,
    name: "Literal",
    hint: "Build exactly what is described. No additions.",
    promptDetails:
      "Build exactly the layouts described and nothing beyond them. No sections, decoration, illustration or animation that is not specified. Transitions are instant. This is the right level when the diagram is the specification and someone else owns the visual design — your job is structural fidelity, not taste.",
  },
  {
    level: 2,
    name: "Clean",
    hint: "Functional and tidy. Correct states, no flourish.",
    promptDetails:
      "Stay close to the specification and make it tidy rather than expressive. Consistent spacing and type, real hover/focus/disabled/loading/empty/error states, and nothing decorative on top. Motion is limited to what communicates a state change — a spinner, a disclosure opening. This is the right level for internal tools and admin surfaces, where being predictable beats being memorable.",
  },
  {
    level: 3,
    name: "Considered",
    hint: "Product-grade polish. The sensible default.",
    promptDetails:
      "Build it to the standard of a product someone pays for. The described structure stays intact; within it, make real design decisions — a deliberate type scale, chosen neutrals, considered empty states, transitions in the 120–200ms range on things that actually move. Interactive elements look interactive. Nothing is added for its own sake, and nothing looks unfinished.",
  },
  {
    level: 4,
    name: "Expressive",
    hint: "Interactive and animated where it earns its place.",
    promptDetails:
      "Interpret the specification confidently and make the interface a reason to use the product. Motion, depth and micro-interactions are welcome where they aid comprehension or reward attention: staged reveals on first paint, meaningful transitions between states, hover states that respond, charts that animate in once. Every described screen and transition still exists. Each effect must survive one question — what does the person understand better because of it? If the answer is nothing, cut it, and honour `prefers-reduced-motion` throughout.",
  },
  {
    level: 5,
    name: "Signature",
    hint: "A showpiece. Take a real aesthetic risk.",
    promptDetails:
      "Treat the specification as direction rather than constraint and build something with a point of view. Take one real aesthetic risk and commit to it — a distinctive type pairing, an orchestrated load sequence, an ambient or generative background, a signature interaction the product becomes known for. Push the visual design hard, but keep every described screen and transition, keep the flows working, and keep the boldness concentrated in one place with everything around it quiet. Ambition is not the same as noise: the result still has to be legible, accessible, fast on a mid-range phone, and usable with reduced motion.",
  },
]

export const DEFAULT_UI_LEVEL = 3

export const uiLevelMap = Object.fromEntries(
  uiLevels.map((entry) => [entry.level, entry])
) as Record<number, UiLevel>

export function describeUiLevel(level: number): UiLevel {
  return uiLevelMap[level] ?? uiLevelMap[DEFAULT_UI_LEVEL]
}

/**
 * Old 0–10 `creativity` values, mapped onto the five levels.
 *
 * The buckets are the ones the old UI already showed as words (Literal /
 * Close to spec / Balanced / Expressive / Bold), so a project keeps the
 * setting its owner actually chose rather than being reset to the default.
 */
export function uiLevelFromLegacyCreativity(creativity: number): number {
  if (!Number.isFinite(creativity)) return DEFAULT_UI_LEVEL
  const value = Math.round(creativity)
  if (value <= 2) return 1
  if (value <= 4) return 2
  if (value <= 6) return 3
  if (value <= 8) return 4
  return 5
}

/**
 * The level for one document.
 *
 * The single reader of `uiLevel` / `creativity`. A document written before the
 * five-level scale existed has `uiLevel: null`, and its old 0–10 value is
 * mapped here — so the setting survives the upgrade whichever way the document
 * arrived: localStorage, the server, a `.json` import or a share link.
 */
export function uiLevelOf(doc: { uiLevel?: number | null; creativity?: number }): number {
  if (typeof doc.uiLevel === "number") return doc.uiLevel
  if (typeof doc.creativity === "number") return uiLevelFromLegacyCreativity(doc.creativity)
  return DEFAULT_UI_LEVEL
}
