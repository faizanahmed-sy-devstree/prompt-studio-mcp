// Vendored from Prompt Studio (features/theme/tokens/css.ts). Do not edit here — run `pnpm sync`.
/**
 * The file a generated project is actually built from.
 *
 * Describing a design in prose and hoping an agent lands on the same values is
 * the failure this replaces: "premium and confident" has a thousand satisfying
 * answers, `--background: oklch(0.98 0.004 160)` has one. So the theme is
 * compiled into a real stylesheet, complete, at the path the chosen stack
 * expects, and the prompt ships the file rather than a description of it.
 *
 * Which file that is depends entirely on the styling choice, and the mapping is
 * the same one `features/theme/figma-prompt.ts` already states in prose — same
 * paths, same block shapes, same wiring. The two are read by the same person on
 * the same day; if they disagreed about where `globals.css` lives, one of them
 * would be silently wrong.
 *
 * Two rules run through every emitter here. The radii come from the four shape
 * tokens rather than one scalar with fixed multipliers, because a single
 * `--radius` cannot express a design that is square everywhere with one pill in
 * it. And a stack that cannot evaluate a colour function gets a converted
 * literal — React Native has no `oklch()` and no `color-mix()`, and a stylesheet
 * it cannot parse is worse than no stylesheet at all.
 */

import { parseColor, parseOklch, rgbToHex } from "../color/oklch"
import type { Preset } from "../data/presets"
import type { Theme } from "../../../types/project"

import { resolveTokens, type TokenSet, tokenGroups, tokenNames } from "./resolve"

export type Stylesheet = {
  /** where the file belongs in the generated project */
  path: string
  /** what the file is, and the fence it is quoted in */
  language: "css" | "ts"
  source: string
}

/**
 * `preview` is forwarded to `resolveTokens` for the editor, which renders a
 * preset the project has not switched to yet.
 */
export function generateStylesheet(
  theme: Theme,
  styling: string,
  preview?: Preset
): Stylesheet {
  const tokens = resolveTokens(theme, preview)

  switch (styling) {
    case "tailwind4-shadcn":
      return { path: "app/globals.css", language: "css", source: tailwind4(theme, tokens) }
    case "tailwind3-shadcn":
      return { path: "app/globals.css", language: "css", source: tailwind3(theme, tokens) }
    case "tailwind":
      return { path: "app/globals.css", language: "css", source: tailwindOnly(theme, tokens) }
    case "nativewind":
      return { path: "global.css", language: "css", source: nativewind(theme, tokens) }
    case "css-modules":
      return { path: "styles/tokens.css", language: "css", source: cssModules(theme, tokens) }
    case "styled":
      return { path: "styles/theme.ts", language: "ts", source: styledTheme(theme, tokens) }
    case "mui":
      return { path: "styles/theme.ts", language: "ts", source: muiTheme(theme, tokens) }
    case "rn-stylesheet":
      return { path: "theme/tokens.ts", language: "ts", source: nativeTheme(theme, tokens) }
    case "":
      // A service has no stylesheet. An empty source is how the whole block
      // disappears from a backend build without a special case at the caller.
      return { path: "", language: "css", source: "" }
    default:
      return { path: "styles/tokens.css", language: "css", source: plainTokens(theme, tokens) }
  }
}

/* ---------------------------------------------------------------- colour -- */

const round = (value: number, places: number) => Number(value.toFixed(places))

/**
 * Alpha, which the colour module's `parseColor` deliberately drops.
 *
 * It has no backdrop to composite against, so discarding alpha is right there
 * and wrong here: the one place a token carries transparency is the shadow,
 * and a shadow flattened to opaque black is a black box on the screen.
 */
function alphaOf(value: string): number {
  const lch = parseOklch(value)
  if (lch) return lch.alpha
  const hex = value.trim()
  if (hex.startsWith("#") && hex.length === 9) return Number.parseInt(hex.slice(7), 16) / 255
  if (hex.startsWith("#") && hex.length === 5) {
    return Number.parseInt(hex.slice(4) + hex.slice(4), 16) / 255
  }
  return 1
}

/** An unreadable value is passed through untouched: better wrong than empty. */
function toHex(value: string): string {
  const rgb = parseColor(value)
  if (!rgb) return value
  const alpha = alphaOf(value)
  if (alpha >= 1) return rgbToHex(rgb)
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${rgbToHex(rgb)}${byte}`
}

/**
 * The bare triplet Tailwind v3 wants, so `hsl(var(--x))` can add the alpha.
 *
 * HSL is a worse space than the one the palette was designed in, and this is
 * the only place it appears: v3's opacity modifiers cannot read an `oklch()`
 * token, so the choice is a converted triplet or no opacity utilities at all.
 */
function toHslTriplet(value: string): string {
  const rgb = parseColor(value)
  if (!rgb) return value
  const max = Math.max(rgb.r, rgb.g, rgb.b)
  const min = Math.min(rgb.r, rgb.g, rgb.b)
  const lightness = (max + min) / 2
  const chroma = max - min
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (chroma !== 0) {
    if (max === rgb.r) hue = ((rgb.g - rgb.b) / chroma) % 6
    else if (max === rgb.g) hue = (rgb.b - rgb.r) / chroma + 2
    else hue = (rgb.r - rgb.g) / chroma + 4
    hue = (hue * 60 + 360) % 360
  }
  return `${round(hue, 1)} ${round(saturation * 100, 1)}% ${round(lightness * 100, 1)}%`
}

/** Every colour function inside a compound value — a shadow, usually. */
const hexify = (value: string) => value.replace(/oklch\([^)]*\)/gi, (match) => toHex(match))

/**
 * The offset strategy's shadow is written as `var(--foreground)` so one value
 * serves both modes. The targets with no custom properties resolve it here,
 * against the palette they are currently emitting.
 */
function literalShadow(
  shadow: string,
  palette: Record<string, string>,
  format: (value: string) => string
): string {
  return shadow.replace(/var\(--([a-z0-9-]+)\)/gi, (_, name: string) =>
    format(palette[name] ?? "#000000")
  )
}

/* ------------------------------------------------------------- CSS parts -- */

function rule(selector: string, body: string[]): string {
  const lines = body.flatMap((entry) => entry.split("\n"))
  return [`${selector} {`, ...lines.map((line) => (line ? `  ${line}` : "")), "}"].join("\n")
}

function colorLines(
  values: Record<string, string>,
  format: (value: string) => string = (value) => value
): string[] {
  const lines: string[] = []
  const emitted = new Set<string>()
  for (const group of tokenGroups) {
    const present = group.filter((name) => values[name])
    if (!present.length) continue
    if (lines.length) lines.push("")
    for (const name of present) {
      lines.push(`--${name}: ${format(values[name])};`)
      emitted.add(name)
    }
  }
  // A preset is allowed tokens of its own beyond the shadcn set.
  const extra = Object.keys(values).filter((name) => !emitted.has(name))
  if (extra.length) {
    lines.push("")
    for (const name of extra) lines.push(`--${name}: ${format(values[name])};`)
  }
  return lines
}

/** Role names for the stacks that never spoke shadcn's vocabulary. */
const ROLE_NAMES: readonly (readonly [string, string])[] = [
  ["background", "background"],
  ["foreground", "foreground"],
  ["surface", "card"],
  ["surface-raised", "popover"],
  ["muted", "muted"],
  ["muted-foreground", "muted-foreground"],
  ["accent", "primary"],
  ["accent-foreground", "primary-foreground"],
  ["danger", "destructive"],
  ["border", "border"],
  ["input", "input"],
  ["ring", "ring"],
  ["chart-1", "chart-1"],
  ["chart-2", "chart-2"],
  ["chart-3", "chart-3"],
  ["chart-4", "chart-4"],
  ["chart-5", "chart-5"],
]

/** The same roles under the names `figma-prompt.ts` gives a CSS Modules build. */
const MODULE_NAMES: readonly (readonly [string, string])[] = [
  ["color-bg", "background"],
  ["color-fg", "foreground"],
  ["color-surface", "card"],
  ["color-surface-raised", "popover"],
  ["color-muted", "muted"],
  ["color-fg-muted", "muted-foreground"],
  ["color-accent", "primary"],
  ["color-accent-fg", "primary-foreground"],
  ["color-danger", "destructive"],
  ["color-border", "border"],
  ["color-input", "input"],
  ["color-ring", "ring"],
  ["color-chart-1", "chart-1"],
  ["color-chart-2", "chart-2"],
  ["color-chart-3", "chart-3"],
  ["color-chart-4", "chart-4"],
  ["color-chart-5", "chart-5"],
]

function mappedLines(
  names: readonly (readonly [string, string])[],
  values: Record<string, string>,
  format: (value: string) => string = (value) => value
): string[] {
  return names
    .filter(([, token]) => values[token])
    .map(([name, token]) => `--${name}: ${format(values[token])};`)
}

function radiusLines(shape: TokenSet["shape"]): string[] {
  return [
    "/* Four radii, not one scalar with multipliers: a design can be square",
    "   everywhere and still have one pill in it. */",
    `--radius-control: ${shape.control}px;`,
    `--radius-card: ${shape.card}px;`,
    `--radius-overlay: ${shape.overlay}px;`,
    `--radius-action: ${shape.pill ? 9999 : shape.control}px;`,
    "--radius: var(--radius-control);",
  ]
}

function familyStack(name: string, character: string): string {
  const generic =
    character === "mono"
      ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
      : character === "serif" || character === "slab"
        ? 'ui-serif, Georgia, "Times New Roman", serif'
        : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
  return name ? `"${name}", ${generic}` : generic
}

function stacks(theme: Theme, tokens: TokenSet) {
  const bodyCharacter = theme.bodyFont === "pair" ? theme.headingFont : theme.bodyFont
  return {
    display: familyStack(tokens.fonts.display, theme.headingFont),
    body: familyStack(tokens.fonts.body, bodyCharacter),
    mono: familyStack(tokens.fonts.mono, "mono"),
  }
}

function fontLines(theme: Theme, tokens: TokenSet): string[] {
  const set = stacks(theme, tokens)
  return [
    `--font-family-display: ${set.display};`,
    `--font-family-body: ${set.body};`,
    `--font-family-mono: ${set.mono};`,
  ]
}

/**
 * The font request has to precede every rule in the file — an `@import` after
 * one is invalid and dropped without an error, which is how a design ships in
 * the fallback face and nobody notices for a week.
 */
function googleFontImport(fonts: TokenSet["fonts"]): string {
  const families = [...new Set([fonts.display, fonts.body, fonts.mono].filter(Boolean))]
  if (!families.length) return ""
  const query = families
    .map((family) => `family=${family.trim().replace(/\s+/g, "+")}:wght@400;500;600;700`)
    .join("&")
  return `@import url("https://fonts.googleapis.com/css2?${query}&display=swap");`
}

function typeLines(tokens: TokenSet): string[] {
  return tokens.scale.flatMap((step) => [
    `--text-${step.name}: ${step.size}px;`,
    `--leading-${step.name}: ${step.lineHeight};`,
    `--tracking-${step.name}: ${step.tracking};`,
    `--weight-${step.name}: ${step.weight};`,
  ])
}

function spacingLines(tokens: TokenSet): string[] {
  return [
    `/* The whole spacing scale: ${tokens.spacing.join(", ")}. Nothing between them. */`,
    ...tokens.spacing.map((value, index) => `--space-${index + 1}: ${value}px;`),
  ]
}

function motionLines(tokens: TokenSet): string[] {
  const { motion } = tokens
  if (!motion.curve) {
    return ["/* Nothing moves in this design, so there is no curve to declare. */"]
  }
  return [
    `--motion-state: ${motion.stateMs}ms;`,
    `--motion-enter: ${motion.enterMs}ms;`,
    `--motion-curve: ${motion.curve};`,
    ...(motion.overshoot
      ? [
          "/* Reserved for the two or three moments meant to feel playful. */",
          `--motion-overshoot: ${motion.overshoot};`,
        ]
      : []),
  ]
}

function elevationLines(tokens: TokenSet, format: (value: string) => string = (v) => v): string[] {
  const { elevation } = tokens
  const lines = [`/* ${elevation.rule} */`]
  if (elevation.shadow) lines.push(`--elevation: ${format(elevation.shadow)};`)
  if (elevation.blur) lines.push(`--glass-blur: ${elevation.blur}px;`)
  return lines
}

/**
 * The one motion concession that is not a design decision. Emitted only where
 * something moves in the first place.
 */
const REDUCED_MOTION = `@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}`

/* ------------------------------------------------------------- Tailwind 4 -- */

function tailwind4(theme: Theme, tokens: TokenSet): string {
  const fontImport = googleFontImport(tokens.fonts)
  const chunks: string[] = []
  if (fontImport) chunks.push(fontImport)
  chunks.push('@import "tailwindcss";')
  chunks.push("@custom-variant dark (&:is(.dark *));")
  chunks.push(
    rule(":root", [
      ...radiusLines(tokens.shape),
      "",
      ...fontLines(theme, tokens),
      "",
      ...motionLines(tokens),
      "",
      ...elevationLines(tokens),
      "",
      ...colorLines(tokens.light),
    ])
  )
  chunks.push(rule(".dark", colorLines(tokens.dark)))
  chunks.push(rule("@theme inline", themeInline(tokens)))
  chunks.push(baseLayer(tokens))
  if (tokens.motion.curve) chunks.push(REDUCED_MOTION)
  return `${chunks.join("\n\n")}\n`
}

/** `--color-x: var(--x)` for every token that exists, in declaration order. */
function themeColorLines(values: Record<string, string>): string[] {
  const lines: string[] = []
  for (const group of tokenGroups) {
    const present = group.filter((name) => values[name])
    if (!present.length) continue
    if (lines.length) lines.push("")
    for (const name of present) lines.push(`--color-${name}: var(--${name});`)
  }
  const extra = Object.keys(values).filter((name) => !tokenNames.includes(name))
  if (extra.length) {
    lines.push("")
    for (const name of extra) lines.push(`--color-${name}: var(--${name});`)
  }
  return lines
}

function themeInline(tokens: TokenSet): string[] {
  const { motion, elevation } = tokens

  return [
    ...themeColorLines(tokens.light),
    "",
    "--font-display: var(--font-family-display);",
    "--font-sans: var(--font-family-body);",
    "--font-mono: var(--font-family-mono);",
    "",
    "/* shadcn's primitives reach for rounded-md on controls, rounded-lg on",
    "   overlays and rounded-xl on cards. Mapping Tailwind's scale onto the",
    "   four shape tokens is what makes those components take this shape. */",
    "--radius-sm: max(0px, calc(var(--radius-control) - 2px));",
    "--radius-md: var(--radius-action);",
    "--radius-lg: var(--radius-overlay);",
    "--radius-xl: var(--radius-card);",
    "",
    ...tokens.scale.flatMap((step) => [
      `--text-${step.name}: ${step.size}px;`,
      `--text-${step.name}--line-height: ${step.lineHeight};`,
      `--text-${step.name}--letter-spacing: ${step.tracking};`,
      `--text-${step.name}--font-weight: ${step.weight};`,
    ]),
    "",
    `/* Spacing is the 4px step: ${tokens.spacing.join(", ")} and nothing between. */`,
    "--spacing: 4px;",
    ...(elevation.shadow ? ["", "--shadow-elevated: var(--elevation);"] : []),
    ...(elevation.blur ? ["", "--blur-glass: var(--glass-blur);"] : []),
    ...(motion.curve
      ? [
          "",
          "--default-transition-duration: var(--motion-state);",
          "--default-transition-timing-function: var(--motion-curve);",
          "--ease-standard: var(--motion-curve);",
          ...(motion.overshoot ? ["--ease-overshoot: var(--motion-overshoot);"] : []),
        ]
      : []),
  ]
}

function baseLayer(tokens: TokenSet): string {
  const headings = tokens.fonts.display ? "\n\n  h1,\n  h2,\n  h3,\n  h4 {\n    @apply font-display;\n  }" : ""
  return `@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }${headings}
}`
}

/* ------------------------------------------------------------- Tailwind 3 -- */

function tailwind3(theme: Theme, tokens: TokenSet): string {
  const fontImport = googleFontImport(tokens.fonts)
  const chunks: string[] = []
  if (fontImport) chunks.push(fontImport)
  chunks.push("@tailwind base;\n@tailwind components;\n@tailwind utilities;")
  chunks.push(
    rule("@layer base", [
      rule(":root", [
        ...radiusLines(tokens.shape),
        "",
        ...fontLines(theme, tokens),
        "",
        ...motionLines(tokens),
        "",
        ...elevationLines(tokens, hexify),
        "",
        "/* Bare triplets, no hsl() wrapper: that is the form the config",
        "   consumes as hsl(var(--x)), and it is what lets a utility add an",
        "   opacity to a token colour. */",
        ...colorLines(tokens.light, toHslTriplet),
      ]),
      "",
      rule(".dark", colorLines(tokens.dark, toHslTriplet)),
      "",
      rule("*", ["@apply border-border;"]),
      "",
      rule("body", ["@apply bg-background text-foreground;"]),
    ])
  )
  chunks.push(tailwind3Config(theme, tokens))
  return `${chunks.join("\n\n")}\n`
}

/**
 * Tailwind v3 keeps half its theme outside CSS, and this generator writes one
 * file. Shipping the config as a comment beside the tokens it references is the
 * honest version of that: the developer moves it, and nothing has been left for
 * them to derive.
 */
function tailwind3Config(theme: Theme, tokens: TokenSet): string {
  const set = stacks(theme, tokens)
  const family = (stack: string) =>
    JSON.stringify(stack.split(", ").map((part) => part.replace(/^"|"$/g, "")))
  const colors = tokenNames
    .filter((name) => tokens.light[name])
    .map((name) => `           "${name}": "hsl(var(--${name}))",`)
    .join("\n")
  const sizes = tokens.scale
    .map(
      (step) =>
        `           ${step.name}: ["${step.size}px", { lineHeight: "${step.lineHeight}", letterSpacing: "${step.tracking}" }],`
    )
    .join("\n")
  const motion = tokens.motion.curve
    ? `
        transitionDuration: {
          state: "var(--motion-state)",
          enter: "var(--motion-enter)",
        },
        transitionTimingFunction: {
          standard: "var(--motion-curve)",${
            tokens.motion.overshoot ? '\n          overshoot: "var(--motion-overshoot)",' : ""
          }
        },`
    : ""

  // The content globs are left out on purpose: the project already has them,
  // and a glob cannot be written inside a CSS comment — it closes it.
  return `/* ------------------------------------------------------------------
   tailwind.config.ts — the half of the theme v3 cannot keep in CSS.
   Merge this into the existing config; leave its content globs alone.
   Flat colour keys are deliberate: they generate the same class names
   as the nested form and survive a token being added by hand.

   import type { Config } from "tailwindcss"

   export default {
     darkMode: ["class"],
     theme: {
       extend: {
         colors: {
${colors}
         },
         borderRadius: {
           sm: "calc(var(--radius-control) - 2px)",
           md: "var(--radius-action)",
           lg: "var(--radius-overlay)",
           xl: "var(--radius-card)",
         },
         fontFamily: {
           sans: ${family(set.body)},
           display: ${family(set.display)},
           mono: ${family(set.mono)},
         },
         fontSize: {
${sizes}
         },${tokens.elevation.shadow ? '\n         boxShadow: { elevated: "var(--elevation)" },' : ""}${motion}
       },
     },
   } satisfies Config
   ------------------------------------------------------------------ */`
}

/* ------------------------------------------------------------ Tailwind only */

function tailwindOnly(theme: Theme, tokens: TokenSet): string {
  const fontImport = googleFontImport(tokens.fonts)
  const chunks: string[] = []
  if (fontImport) chunks.push(fontImport)
  chunks.push('@import "tailwindcss";')
  chunks.push("@custom-variant dark (&:is(.dark *));")
  chunks.push(
    rule(":root", [
      "/* Named by role, never by colour — the value behind --accent can",
      "   change without a rename, and nothing in a component reads a hue. */",
      "",
      ...radiusLines(tokens.shape),
      "",
      ...fontLines(theme, tokens),
      "",
      ...typeLines(tokens),
      "",
      ...spacingLines(tokens),
      "",
      ...motionLines(tokens),
      "",
      ...elevationLines(tokens),
      "",
      ...mappedLines(ROLE_NAMES, tokens.light),
    ])
  )
  chunks.push(rule(".dark", mappedLines(ROLE_NAMES, tokens.dark)))
  chunks.push(
    rule("@theme inline", [
      "/* Tailwind v4 reads its theme from here. On v3, delete this block and",
      "   mirror the same names under theme.extend in tailwind.config.ts. */",
      ...ROLE_NAMES.filter(([, token]) => tokens.light[token]).map(
        ([role]) => `--color-${role}: var(--${role});`
      ),
      "",
      "--font-sans: var(--font-family-body);",
      "--font-display: var(--font-family-display);",
      "--font-mono: var(--font-family-mono);",
      "",
      "--radius-sm: max(0px, calc(var(--radius-control) - 2px));",
      "--radius-md: var(--radius-action);",
      "--radius-lg: var(--radius-overlay);",
      "--radius-xl: var(--radius-card);",
      "",
      "--spacing: 4px;",
      ...(tokens.elevation.shadow ? ["--shadow-elevated: var(--elevation);"] : []),
      ...(tokens.motion.curve
        ? [
            "--default-transition-duration: var(--motion-state);",
            "--default-transition-timing-function: var(--motion-curve);",
          ]
        : []),
    ])
  )
  chunks.push(`@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }
}`)
  if (tokens.motion.curve) chunks.push(REDUCED_MOTION)
  return `${chunks.join("\n\n")}\n`
}

/* -------------------------------------------------------------- NativeWind -- */

/**
 * React Native evaluates none of the colour syntax the web has: no `oklch()`,
 * no `color-mix()`, no relative colours, and no `calc()` inside a style value.
 * Everything here is a literal, and the shadow is left out entirely — native
 * depth is `elevation` and `shadowOpacity` on a view, not a CSS shadow string,
 * so emitting one would produce a rule that silently does nothing.
 */
function nativewind(theme: Theme, tokens: TokenSet): string {
  const fontImport = googleFontImport(tokens.fonts)
  const chunks: string[] = []
  if (fontImport) chunks.push(fontImport)
  chunks.push("@tailwind base;\n@tailwind components;\n@tailwind utilities;")
  chunks.push(
    rule(":root", [
      "/* Plain literals only: React Native cannot evaluate a colour function,",
      "   and a value it cannot parse is dropped without an error. */",
      `--radius-control: ${tokens.shape.control}px;`,
      `--radius-card: ${tokens.shape.card}px;`,
      `--radius-overlay: ${tokens.shape.overlay}px;`,
      `--radius-action: ${tokens.shape.pill ? 9999 : tokens.shape.control}px;`,
      "",
      ...fontLines(theme, tokens),
      "",
      ...colorLines(tokens.light, toHex),
    ])
  )
  chunks.push(rule(".dark", colorLines(tokens.dark, toHex)))
  chunks.push(nativewindConfig(theme, tokens))
  return `${chunks.join("\n\n")}\n`
}

function nativewindConfig(theme: Theme, tokens: TokenSet): string {
  const set = stacks(theme, tokens)
  const family = (stack: string) =>
    JSON.stringify(stack.split(", ").map((part) => part.replace(/^"|"$/g, "")))
  const colors = tokenNames
    .filter((name) => tokens.light[name])
    .map((name) => `           "${name}": "var(--${name})",`)
    .join("\n")
  const sizes = tokens.scale
    .map((step) => `           ${step.name}: ["${step.size}px", { lineHeight: "${step.lineHeight}" }],`)
    .join("\n")

  // No content globs here either — one would close the comment around it.
  return `/* ------------------------------------------------------------------
   tailwind.config.js — NativeWind reads the variables above through it.
   Merge this into the existing config and leave its content globs alone.

   module.exports = {
     presets: [require("nativewind/preset")],
     darkMode: "class",
     theme: {
       extend: {
         colors: {
${colors}
         },
         borderRadius: {
           sm: "${Math.max(0, tokens.shape.control - 2)}px",
           md: "${tokens.shape.pill ? 9999 : tokens.shape.control}px",
           lg: "${tokens.shape.overlay}px",
           xl: "${tokens.shape.card}px",
         },
         fontFamily: {
           sans: ${family(set.body)},
           display: ${family(set.display)},
           mono: ${family(set.mono)},
         },
         fontSize: {
${sizes}
         },
       },
     },
   }
   ------------------------------------------------------------------ */`
}

/* ------------------------------------------------------------- CSS Modules -- */

function cssModules(theme: Theme, tokens: TokenSet): string {
  const fontImport = googleFontImport(tokens.fonts)
  const chunks: string[] = []
  if (fontImport) chunks.push(fontImport)
  chunks.push(
    rule(":root", [
      "/* Imported once at the application root, before any module. Modules",
      "   reference var(--x) and never a literal. */",
      "",
      ...radiusLines(tokens.shape),
      "",
      ...fontLines(theme, tokens),
      "",
      ...typeLines(tokens),
      "",
      ...spacingLines(tokens),
      "",
      ...motionLines(tokens),
      "",
      ...elevationLines(tokens),
      "",
      ...mappedLines(MODULE_NAMES, tokens.light),
    ])
  )
  chunks.push(rule('[data-theme="dark"]', mappedLines(MODULE_NAMES, tokens.dark)))
  return `${chunks.join("\n\n")}\n`
}

/* ----------------------------------------------------------------- default -- */

function plainTokens(theme: Theme, tokens: TokenSet): string {
  const fontImport = googleFontImport(tokens.fonts)
  const chunks: string[] = []
  if (fontImport) chunks.push(fontImport)
  chunks.push(
    rule(":root", [
      "/* The design, as values. Where the platform does not read CSS, this",
      "   is still the list the platform's own theme is transcribed from —",
      "   one file to change when a colour is wrong. */",
      "",
      ...radiusLines(tokens.shape),
      "",
      ...fontLines(theme, tokens),
      "",
      ...typeLines(tokens),
      "",
      ...spacingLines(tokens),
      "",
      ...motionLines(tokens),
      "",
      ...elevationLines(tokens),
      "",
      ...mappedLines(ROLE_NAMES, tokens.light),
    ])
  )
  chunks.push(rule(".dark", mappedLines(ROLE_NAMES, tokens.dark)))
  return `${chunks.join("\n\n")}\n`
}

/* ------------------------------------------------------------- TS objects -- */

const OBJECT_COLORS: readonly (readonly [string, string])[] = [
  ["background", "background"],
  ["foreground", "foreground"],
  ["surface", "card"],
  ["surfaceRaised", "popover"],
  ["muted", "muted"],
  ["mutedForeground", "muted-foreground"],
  ["primary", "primary"],
  ["primaryForeground", "primary-foreground"],
  ["secondary", "secondary"],
  ["secondaryForeground", "secondary-foreground"],
  ["accent", "accent"],
  ["accentForeground", "accent-foreground"],
  ["destructive", "destructive"],
  ["border", "border"],
  ["input", "input"],
  ["ring", "ring"],
  ["chart1", "chart-1"],
  ["chart2", "chart-2"],
  ["chart3", "chart-3"],
  ["chart4", "chart-4"],
  ["chart5", "chart-5"],
]

function objectColors(
  values: Record<string, string>,
  format: (value: string) => string,
  indent: string
): string {
  return OBJECT_COLORS.filter(([, token]) => values[token])
    .map(([key, token]) => `${indent}${key}: "${format(values[token])}",`)
    .join("\n")
}

/**
 * `tracking` is an em string on the web and a number of points on native:
 * React Native's `letterSpacing` takes points and silently ignores anything
 * else, so the one place the unit can be resolved is here, against the size.
 */
function typeObject(tokens: TokenSet, indent: string, unit: "em" | "points" = "em"): string {
  return tokens.scale
    .map((step) => {
      const tracking =
        unit === "em"
          ? `"${step.tracking}"`
          : `${round(step.size * Number.parseFloat(step.tracking), 2)}`
      return `${indent}${step.name}: { size: ${step.size}, lineHeight: ${step.lineHeight}, tracking: ${tracking}, weight: ${step.weight} },`
    })
    .join("\n")
}

function radiiObject(shape: TokenSet["shape"]): string {
  return `{ control: ${shape.control}, card: ${shape.card}, overlay: ${shape.overlay}, action: ${
    shape.pill ? 9999 : shape.control
  } }`
}

/**
 * styled-components runs in a browser, so the colour values stay in the form
 * the preset chose rather than being flattened to hex — nothing is gained by
 * throwing away the precision, and a developer editing this file should see
 * the same notation the rest of the system uses.
 */
function styledTheme(theme: Theme, tokens: TokenSet): string {
  const set = stacks(theme, tokens)
  const motion = tokens.motion.curve
    ? `
  motion: {
    state: "${tokens.motion.stateMs}ms",
    enter: "${tokens.motion.enterMs}ms",
    curve: "${tokens.motion.curve}",${
      tokens.motion.overshoot ? `\n    overshoot: "${tokens.motion.overshoot}",` : ""
    }
  },`
    : ""

  return `/**
 * The ${theme.preset} theme, shaped for ThemeProvider.
 *
 * Both themes are passed to the provider already mounted at the root; every
 * component reads these values and never a literal. ${tokens.elevation.rule}
 */

export const lightTheme = {
  colors: {
${objectColors(tokens.light, (value) => value, "    ")}
  },
  radii: ${radiiObject(tokens.shape)},
  space: [${tokens.spacing.join(", ")}],
  fonts: {
    display: '${set.display}',
    body: '${set.body}',
    mono: '${set.mono}',
  },
  type: {
${typeObject(tokens, "    ")}
  },${motion}
  shadow: "${literalShadow(tokens.elevation.shadow, tokens.light, (value) => value)}",
}

export type AppTheme = typeof lightTheme

export const darkTheme: AppTheme = {
  ...lightTheme,
  colors: {
${objectColors(tokens.dark, (value) => value, "    ")}
  },
  shadow: "${literalShadow(tokens.elevation.shadow, tokens.dark, (value) => value)}",
}
`
}

/**
 * MUI ships a 25-step shadow ramp and a full transition system of its own.
 * A theme that leaves either at its defaults is a theme that only changed the
 * colours, which is why both are overridden here rather than extended.
 */
function muiTheme(theme: Theme, tokens: TokenSet): string {
  const set = stacks(theme, tokens)
  const shape = tokens.shape
  const action = shape.pill ? 9999 : shape.control
  const hex = (values: Record<string, string>, name: string, fallback: string) =>
    values[name] ? toHex(values[name]) : fallback

  const palette = (values: Record<string, string>, mode: "light" | "dark") => `    mode: "${mode}",
    primary: { main: "${hex(values, "primary", "#000000")}", contrastText: "${hex(values, "primary-foreground", "#ffffff")}" },
    secondary: { main: "${hex(values, "secondary", "#000000")}", contrastText: "${hex(values, "secondary-foreground", "#ffffff")}" },
    error: { main: "${hex(values, "destructive", "#b3261e")}" },
    background: { default: "${hex(values, "background", "#ffffff")}", paper: "${hex(values, "card", "#ffffff")}" },
    text: { primary: "${hex(values, "foreground", "#000000")}", secondary: "${hex(values, "muted-foreground", "#666666")}" },
    divider: "${hex(values, "border", "#e5e5e5")}",`

  const step = (name: string) => tokens.scale.find((entry) => entry.name === name) ?? tokens.scale[0]
  const heading = (key: string, name: string) => {
    const entry = step(name)
    return `    ${key}: { fontFamily: '${set.display}', fontSize: "${entry.size}px", lineHeight: ${entry.lineHeight}, letterSpacing: "${entry.tracking}", fontWeight: ${entry.weight} },`
  }
  const text = (key: string, name: string) => {
    const entry = step(name)
    return `    ${key}: { fontSize: "${entry.size}px", lineHeight: ${entry.lineHeight}, letterSpacing: "${entry.tracking}" },`
  }

  const transitions = tokens.motion.curve
    ? `  transitions: {
    duration: { shortest: ${tokens.motion.stateMs}, shorter: ${tokens.motion.stateMs}, short: ${tokens.motion.stateMs}, standard: ${tokens.motion.enterMs}, complex: ${tokens.motion.enterMs}, enteringScreen: ${tokens.motion.enterMs}, leavingScreen: ${tokens.motion.enterMs} },
    easing: { easeInOut: "${tokens.motion.curve}", easeOut: "${tokens.motion.curve}", easeIn: "${tokens.motion.curve}", sharp: "${tokens.motion.curve}" },
  },`
    : `  // Nothing moves in this design, and MUI moves by default unless told.
  transitions: { create: () => "none" },`

  const shadows = (values: Record<string, string>) => {
    const shadow = literalShadow(tokens.elevation.shadow, values, toHex)
    return shadow
      ? `  shadows: Array.from({ length: 25 }, (_, level) => (level === 0 ? "none" : "${hexify(shadow)}")) as ThemeOptions["shadows"],`
      : `  // ${tokens.elevation.rule}
  shadows: Array.from({ length: 25 }, () => "none") as ThemeOptions["shadows"],`
  }

  const common = `  shape: { borderRadius: ${shape.control} },
  typography: {
    fontFamily: '${set.body}',
${heading("h1", "display")}
${heading("h2", "h1")}
${heading("h3", "h2")}
${heading("h4", "h3")}
${text("body1", "body")}
${text("body2", "small")}
${text("caption", "micro")}
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: ${action} } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: ${shape.card} } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: ${shape.overlay} } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: ${action} } } },
  },
${transitions}`

  return `/**
 * The ${theme.preset} theme, for the ThemeProvider already at the root.
 *
 * CssBaseline stays where it is. ${tokens.elevation.rule}
 */

import { createTheme, type ThemeOptions } from "@mui/material/styles"

export const lightTheme = createTheme({
  palette: {
${palette(tokens.light, "light")}
  },
${common}
${shadows(tokens.light)}
})

export const darkTheme = createTheme({
  palette: {
${palette(tokens.dark, "dark")}
  },
${common}
${shadows(tokens.dark)}
})
`
}

/**
 * A React Native theme object.
 *
 * Colours are hex because that is all the platform reads, sizes are numbers
 * because `StyleSheet` takes no units, and depth is expressed as the shadow
 * props a view actually has rather than a CSS string that would be ignored.
 */
function nativeTheme(theme: Theme, tokens: TokenSet): string {
  const set = stacks(theme, tokens)
  const shadow = nativeShadow(tokens)
  // The same curve the CSS targets get, as the control points Reanimated and
  // the Easing helpers actually take.
  const points = tokens.motion.curve.match(/-?[\d.]+/g)?.join(", ") ?? "0.2, 0, 0, 1"
  const motion = tokens.motion.curve
    ? `
  motion: {
    state: ${tokens.motion.stateMs},
    enter: ${tokens.motion.enterMs},
    curve: [${points}] as const,${
      tokens.motion.spring
        ? `\n    spring: { stiffness: ${tokens.motion.spring.stiffness}, damping: ${tokens.motion.spring.damping}, mass: ${tokens.motion.spring.mass} },`
        : ""
    }
  },`
    : ""

  return `/**
 * The ${theme.preset} theme.
 *
 * One object, imported by every StyleSheet.create in the app. No inline style
 * objects in render — they defeat the style registry and re-allocate every
 * frame. ${tokens.elevation.rule}
 */

export const lightColors = {
${objectColors(tokens.light, toHex, "  ")}
}

export const darkColors: typeof lightColors = {
${objectColors(tokens.dark, toHex, "  ")}
}

export const theme = {
  radii: ${radiiObject(tokens.shape)},
  space: [${tokens.spacing.join(", ")}],
  fonts: {
    display: '${set.display.split(",")[0].replace(/"/g, "")}',
    body: '${set.body.split(",")[0].replace(/"/g, "")}',
    mono: '${set.mono.split(",")[0].replace(/"/g, "")}',
  },
  type: {
${typeObject(tokens, "    ", "points")}
  },${motion}
  elevation: ${shadow},
}
`
}

/** The shadow props a native view has, per strategy. */
function nativeShadow(tokens: TokenSet): string {
  const { elevation } = tokens
  if (!elevation.shadow) return "null"
  const color = toHex(
    elevation.strategy === "offset"
      ? (tokens.light.foreground ?? "#000000")
      : elevation.strategy === "tinted"
        ? (tokens.light.primary ?? "#000000")
        : "#000000"
  )
  if (elevation.strategy === "offset") {
    return `{ shadowColor: "${color}", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 }`
  }
  return `{ shadowColor: "${color}", shadowOffset: { width: 0, height: 8 }, shadowOpacity: ${
    elevation.strategy === "tinted" ? 0.28 : 0.18
  }, shadowRadius: 24, elevation: 6 }`
}
