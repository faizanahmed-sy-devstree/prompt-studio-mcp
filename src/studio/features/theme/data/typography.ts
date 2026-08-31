// Vendored from Prompt Studio (features/theme/data/typography.ts). Do not edit here — run `pnpm sync`.
/**
 * The typographic and finish settings that sit beside the design language.
 *
 * Typefaces are named by **character**, never by name. The generated project
 * will not have your font licence, and an agent told to use a specific
 * commercial face either fails, silently substitutes something, or ships a
 * broken `@font-face`. A direction it can satisfy with whatever it has is worth
 * more than a name it cannot honour.
 */
export type ThemeOption = {
  id: string
  label: string
  /** one line under the control, so the choice can be made by looking */
  hint: string
  /** what actually reaches the agent */
  promptDetails: string
  /** the stack shown in the picker's preview */
  sample?: string
}

export const fontCharacters: ThemeOption[] = [
  {
    id: "geometric",
    label: "Geometric sans",
    hint: "Circular, even, modern — Futura, Poppins, Outfit",
    promptDetails:
      "a geometric sans — near-circular bowls, even stroke weight, generous counters (Poppins, Outfit, Futura or similar). Set headings with tight tracking, because geometric faces space loosely at display sizes",
    sample: "Poppins, Outfit, Futura",
  },
  {
    id: "grotesque",
    label: "Neo-grotesque sans",
    hint: "Neutral, tight, workhorse — Inter, Helvetica",
    promptDetails:
      "a neo-grotesque sans — neutral, tightly spaced, high legibility at small sizes (Inter, Helvetica Neue, Söhne or similar). The safe choice for interface text, and the one to fall back to",
    sample: "Inter, Helvetica Neue",
  },
  {
    id: "humanist",
    label: "Humanist sans",
    hint: "Warmer, calligraphic — Source Sans, Lato",
    promptDetails:
      "a humanist sans — calligraphic skeleton, open apertures, slightly varied stroke (Source Sans 3, Lato, Frutiger or similar). Warmer than a grotesque and easier over long paragraphs",
    sample: "Source Sans 3, Lato",
  },
  {
    id: "serif",
    label: "Serif",
    hint: "Editorial, authoritative — Source Serif, Lora",
    promptDetails:
      "a text serif — moderate contrast, sturdy bracketed serifs (Source Serif 4, Lora, Charter or similar). Reads as considered and editorial rather than software-like",
    sample: "Source Serif 4, Lora",
  },
  {
    id: "slab",
    label: "Slab serif",
    hint: "Blunt, confident — Roboto Slab, Zilla",
    promptDetails:
      "a slab serif — blunt rectangular serifs, low contrast, heavy presence (Roboto Slab, Zilla Slab, Bitter or similar). Strong for headings, and deliberate over long text",
    sample: "Roboto Slab, Zilla Slab",
  },
  {
    id: "mono",
    label: "Monospace",
    hint: "Technical, tabular — JetBrains Mono, IBM Plex Mono",
    promptDetails:
      "a monospace (JetBrains Mono, IBM Plex Mono or similar). Every figure is tabular by construction, which is why it suits dashboards; keep line length shorter than you would for a proportional face",
    sample: "JetBrains Mono, IBM Plex Mono",
  },
]

export const fontCharacterMap = Object.fromEntries(
  fontCharacters.map((f) => [f.id, f])
) as Record<string, ThemeOption>

export const typeScales: ThemeOption[] = [
  {
    id: "compact",
    label: "Compact",
    hint: "1.150 — small steps, dense screens",
    promptDetails:
      "a compact type scale (ratio ~1.150): headings sit close to body size, which keeps dense screens calm and fits more on a laptop. Rely on weight and colour for hierarchy rather than size",
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "1.250 — the default interface rhythm",
    promptDetails:
      "a balanced type scale (ratio ~1.250) — the standard interface rhythm, where each level is clearly a level without shouting",
  },
  {
    id: "expressive",
    label: "Expressive",
    hint: "1.333+ — large display headings",
    promptDetails:
      "an expressive type scale (ratio ~1.333 or wider): display headings are markedly larger than body text and carry the page. Set them with tighter tracking and shorter line height as they grow",
  },
]

export const iconStyles: ThemeOption[] = [
  {
    id: "line",
    label: "Line",
    hint: "Outlined, consistent stroke",
    promptDetails:
      "outlined icons at one consistent stroke width and one size scale (lucide-react or similar). Never mix stroke widths in a single view",
  },
  {
    id: "solid",
    label: "Solid",
    hint: "Filled, heavier presence",
    promptDetails:
      "solid filled icons (Heroicons solid, Material filled or similar) — heavier, more legible at very small sizes, and better against coloured backgrounds",
  },
  {
    id: "duotone",
    label: "Duotone",
    hint: "Two-tone, accent-aware",
    promptDetails:
      "duotone icons — a solid base at low opacity with the accent picking out the meaningful part. Use one accent, and keep the second tone derived from it rather than chosen separately",
  },
]

export const elevations: ThemeOption[] = [
  {
    id: "flat",
    label: "Flat",
    hint: "Borders only, no shadows",
    promptDetails:
      "no shadows anywhere. Separation comes from hairline borders and background steps alone; overlays are distinguished by a scrim, not by elevation",
  },
  {
    id: "subtle",
    label: "Subtle shadows",
    hint: "One soft level, borders elsewhere",
    promptDetails:
      "one soft shadow level, used only for things that genuinely float — menus, popovers, dialogs, a sticky bar. Everything resting on the page is separated by a border instead",
  },
  {
    id: "layered",
    label: "Layered",
    hint: "A real elevation scale",
    promptDetails:
      "a real elevation scale of three or four steps, defined once as tokens and applied consistently: card, raised card, popover, dialog. Larger elevation means larger blur and more vertical offset, never just a darker shadow",
  },
]

export const motions: ThemeOption[] = [
  {
    id: "none",
    label: "None",
    hint: "Instant — no transitions",
    promptDetails:
      "no animation. State changes are instant. Anything that would have been a transition is a change in the rendered state instead",
  },
  {
    id: "restrained",
    label: "Restrained",
    hint: "150–200ms, only where it explains",
    promptDetails:
      "restrained motion — 150–200ms ease-out, and only where it explains something: a menu's origin, a panel's direction, a row leaving a list. Nothing decorative, nothing that delays an interaction",
  },
  {
    id: "expressive",
    label: "Expressive",
    hint: "Staged entrances and micro-interactions",
    promptDetails:
      "expressive motion — staged entrances, shared-element transitions between related views, and micro-interactions on primary actions. Keep every duration under 400ms and make sure nothing waits on an animation to become usable",
  },
]

export const colorSchemes: ThemeOption[] = [
  {
    id: "light",
    label: "Light only",
    hint: "One theme",
    promptDetails:
      "light theme only. Do not ship a dark theme or a toggle — a half-built dark mode is worse than none",
  },
  {
    id: "both",
    label: "Light and dark",
    hint: "Follows the OS, with a toggle",
    promptDetails:
      "both light and dark themes. Every colour is a token defined in both; the theme follows the OS by default and a toggle overrides it, persisted. Dark is designed, not inverted — check contrast on both grounds",
  },
  {
    id: "dark-first",
    label: "Dark first",
    hint: "Dark is the design; light follows",
    promptDetails:
      "dark first: the dark theme is the design, and the light theme is derived from it afterwards. Avoid pure black grounds — use a dark neutral so elevation is visible — and keep the accent's saturation legible against it",
  },
]

/** Every list above, keyed by the theme field it drives. */
export const themeOptionSets = {
  headingFont: fontCharacters,
  typeScale: typeScales,
  iconStyle: iconStyles,
  elevation: elevations,
  motion: motions,
  colorScheme: colorSchemes,
} as const

export function describeOption(set: ThemeOption[], id: string): ThemeOption {
  return set.find((o) => o.id === id) ?? set[0]
}
