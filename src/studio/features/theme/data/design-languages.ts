// Vendored from Prompt Studio (features/theme/data/design-languages.ts). Do not edit here — run `pnpm sync`.
/**
 * Design languages — the overall visual character of the app being described.
 *
 * `preview` drives a small live mock in the picker (a header, a card, a button,
 * an input, a chip rendered with these values) so the choice is made by looking,
 * not by reading adjectives. `promptDetails` is what actually reaches the agent.
 */
export type DesignLanguage = {
  id: string
  name: string
  tagline: string
  /** short list shown under the mock */
  traits: string[]
  promptDetails: string
  preview: {
    /** corner radius in px at preview scale */
    radius: number
    shadow: "none" | "sm" | "md" | "lg"
    border: number
    /** how much the surface is tinted with the accent, 0–1 */
    tint: number
    headingWeight: number
    headingTracking: string
    fontFamily: "sans" | "serif" | "mono"
    /** vertical rhythm multiplier */
    density: number
    buttonRadius: "sm" | "md" | "full"
    /** solid accent vs outline-led chrome */
    accent: "solid" | "soft" | "outline"
    uppercase?: boolean
    gradient?: boolean
    blur?: boolean
  }
}

export const designLanguages: DesignLanguage[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "No design at all — structure only",
    traits: ["No colour", "Browser defaults", "Spacing only"],
    promptDetails:
      "**Do not design this.** Produce unstyled, semantically correct HTML and nothing more: real headings in order, labelled form controls, `<table>` for tabular data, `<button>` for actions, `<a>` for navigation. No colour palette, no brand colour, no background fills, no gradients, no shadows, no border radius, no icon set, no custom fonts — the browser's defaults, left alone. The only styling permitted is whatever spacing and max-width is needed to keep the page readable, and the visible focus outline, which must not be removed. Every interactive state (hover, focus, disabled, loading, error) must still be distinguishable without colour. This is the right starting point when the visual design is arriving separately — a stylesheet dropped in later should be able to style this markup without any of it being fought first.",
    preview: {
      radius: 2,
      shadow: "none",
      border: 1,
      tint: 0,
      headingWeight: 700,
      headingTracking: "0",
      fontFamily: "sans",
      density: 1,
      buttonRadius: "sm",
      accent: "outline",
    },
  },
  {
    id: "modern-soft",
    name: "Modern & friendly",
    tagline: "Rounded, soft shadows, generous space",
    traits: ["Large radii", "Soft elevation", "Airy spacing"],
    promptDetails:
      "Modern, friendly and clean — the consumer-app look. Large corner radii (12–20px), soft diffuse shadows instead of hard borders, generous whitespace and padding, cards as the primary container, a single saturated accent used sparingly for primary actions, medium-weight headings with tight tracking, and subtle 150–200ms ease-out transitions on hover and mount. Surfaces are light and layered; dividers are hairlines rather than heavy rules.",
    preview: {
      radius: 12,
      shadow: "md",
      border: 0,
      tint: 0.06,
      headingWeight: 600,
      headingTracking: "-0.01em",
      fontFamily: "sans",
      density: 1.15,
      buttonRadius: "md",
      accent: "solid",
    },
  },
  {
    id: "corporate",
    name: "Corporate & precise",
    tagline: "Hairline borders, tight grid, restrained colour",
    traits: ["Small radii", "Borders over shadows", "Dense"],
    promptDetails:
      "Corporate and precise — built for people who read numbers all day. Small corner radii (4–6px), hairline borders rather than shadows, a tight 8px spacing grid, restrained palette with the accent reserved for primary actions and active states only, tabular numerals in every figure, dense table rows, clear section dividers, and minimal motion. Nothing decorative; information density is the point.",
    preview: {
      radius: 4,
      shadow: "none",
      border: 1,
      tint: 0.03,
      headingWeight: 600,
      headingTracking: "0",
      fontFamily: "sans",
      density: 0.85,
      buttonRadius: "sm",
      accent: "outline",
    },
  },
  {
    id: "minimal-mono",
    name: "Minimal monochrome",
    tagline: "Near-zero chrome, one accent, lots of air",
    traits: ["Almost no borders", "Type-led", "Huge whitespace"],
    promptDetails:
      "Minimal and monochrome — the interface recedes so the content leads. Almost no borders or shadows; separation comes from whitespace and type scale alone. One accent colour, used once per screen at most. Large type scale contrast between headings and body, generous line height, wide margins, flat surfaces, and no decorative colour. Buttons are text-led or a single filled primary.",
    preview: {
      radius: 6,
      shadow: "none",
      border: 0,
      tint: 0,
      headingWeight: 500,
      headingTracking: "-0.02em",
      fontFamily: "sans",
      density: 1.35,
      buttonRadius: "sm",
      accent: "outline",
    },
  },
  {
    id: "bold-graphic",
    name: "Bold & graphic",
    tagline: "Hard edges, thick rules, oversized type",
    traits: ["Square corners", "Heavy borders", "Loud type"],
    promptDetails:
      "Bold and graphic — confident, high-contrast, deliberately un-soft. Square or near-square corners, thick 2px borders in the foreground colour, no shadows (offset solid blocks instead if depth is needed), oversized extra-bold headings with tight tracking, large flat colour fields, and blunt full-width buttons. Colour is used in big areas rather than small accents.",
    preview: {
      radius: 2,
      shadow: "none",
      border: 2,
      tint: 0.12,
      headingWeight: 800,
      headingTracking: "-0.03em",
      fontFamily: "sans",
      density: 1,
      buttonRadius: "sm",
      accent: "solid",
      uppercase: true,
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Serif headings, long-form rhythm",
    traits: ["Serif display", "Wide measure", "Quiet chrome"],
    promptDetails:
      "Editorial — a publication, not a dashboard. Serif display headings paired with a clean sans body, a comfortable reading measure (65–75 characters), generous line height, quiet chrome with hairline rules, and images that run to the edge of the column. Accent colour appears mainly in links and small marks. Pacing and typography carry the hierarchy.",
    preview: {
      radius: 6,
      shadow: "none",
      border: 1,
      tint: 0.02,
      headingWeight: 600,
      headingTracking: "-0.01em",
      fontFamily: "serif",
      density: 1.3,
      buttonRadius: "sm",
      accent: "outline",
    },
  },
  {
    id: "glass-depth",
    name: "Glass & depth",
    tagline: "Translucent layers, blur, gradient glow",
    traits: ["Frosted surfaces", "Gradients", "Glow"],
    promptDetails:
      "Glass and depth — layered, atmospheric, dark-first. Translucent surfaces with backdrop blur, subtle gradient washes behind the content, soft coloured glows around focal elements, 1px light borders to define edges of glass panels, and depth communicated by stacking and blur rather than drop shadows. Use restraint: one glass layer at a time, and keep text on solid enough backing to stay legible.",
    preview: {
      radius: 14,
      shadow: "lg",
      border: 1,
      tint: 0.14,
      headingWeight: 600,
      headingTracking: "-0.01em",
      fontFamily: "sans",
      density: 1.15,
      buttonRadius: "full",
      accent: "soft",
      gradient: true,
      blur: true,
    },
  },
  {
    id: "playful",
    name: "Playful",
    tagline: "Pill shapes, bright accents, springy motion",
    traits: ["Pill buttons", "Bright colour", "Bouncy"],
    promptDetails:
      "Playful and approachable — for consumer products that should feel light. Pill-shaped buttons and inputs, fully rounded cards, bright multi-hue accents (a categorical palette rather than one brand colour), friendly medium-weight type, illustration or emoji-scale iconography, and springy micro-interactions on press and mount. Keep contrast high so the brightness never costs legibility.",
    preview: {
      radius: 18,
      shadow: "md",
      border: 0,
      tint: 0.1,
      headingWeight: 700,
      headingTracking: "-0.01em",
      fontFamily: "sans",
      density: 1.2,
      buttonRadius: "full",
      accent: "solid",
    },
  },
  {
    id: "dense-data",
    name: "Dense data",
    tagline: "Compact rows, tabular figures, terminal calm",
    traits: ["Compact", "Monospaced figures", "Grid-led"],
    promptDetails:
      "Dense data — maximum information per screen without becoming unreadable. Compact 28–32px table rows, monospaced tabular figures for every number, 4px spacing grid, small radii, hairline grid lines, sticky headers and frozen first columns, inline editing where possible, and colour used only to encode state (positive/negative/warning). Chrome is minimal so the data dominates.",
    preview: {
      radius: 3,
      shadow: "none",
      border: 1,
      tint: 0.02,
      headingWeight: 600,
      headingTracking: "0",
      fontFamily: "mono",
      density: 0.75,
      buttonRadius: "sm",
      accent: "outline",
    },
  },
]

export const designLanguageMap = Object.fromEntries(
  designLanguages.map((d) => [d.id, d])
) as Record<string, DesignLanguage>

export function describeDesignLanguage(id: string) {
  return designLanguageMap[id] ?? designLanguageMap["modern-soft"]
}
