// Vendored from Prompt Studio (features/theme/tokens/resolve.ts). Do not edit here — run `pnpm sync`.
/**
 * Resolving a chosen theme into the values a stylesheet is written from.
 *
 * The layering is the whole point. A preset supplies every colour; the project
 * stores only what the user changed on top of it. Resolving in that order is
 * what lets a preset be improved later and reach a project that was created
 * months ago — a project that had stored its whole resolved palette would be
 * frozen at the day somebody first opened it.
 *
 * Everything that can be derived is derived here rather than stored: the type
 * scale from one ratio, the spacing steps, the single shadow the elevation
 * strategy allows, the two durations and the curve. Storing them would mean two
 * places to change and the second one is always the one that gets forgotten.
 *
 * `vividness` and `neutralHue` are deliberately not applied again here. The
 * preset's records are already at the preset's chroma, and the editor writes a
 * change to either dial through the colour module into `palette` overrides.
 * Re-deriving them at this point would apply the same dial twice and quietly
 * move colours somebody had already corrected by hand.
 */

import { LC_FLOORS, lc } from "../color/apca"
import {
  clampToGamut,
  formatOklch,
  hexToOklch,
  parseOklch,
} from "../color/oklch"
import { type Preset, presetById } from "../data/presets"
import { type FontCharacter, type Theme, themeSchema } from "../../../types/project"

/**
 * The shadcn token names, in the order a stylesheet declares them.
 *
 * Grouped rather than flat because the groups become the blank lines in the
 * generated file, and thirty-one unbroken lines of custom properties is the
 * difference between a file someone reads and one they scroll past.
 *
 * There is no `--destructive-foreground`: current shadcn does not have one, and
 * emitting it would send an agent looking for the component that consumes it.
 */
export const tokenGroups: readonly (readonly string[])[] = [
  ["background", "foreground"],
  ["card", "card-foreground", "popover", "popover-foreground"],
  ["primary", "primary-foreground", "secondary", "secondary-foreground"],
  ["muted", "muted-foreground", "accent", "accent-foreground"],
  ["destructive"],
  ["border", "input", "ring"],
  ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  [
    "sidebar",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
  ],
]

export const tokenNames: readonly string[] = tokenGroups.flatMap((group) => [...group])

export type TypeStepName = "display" | "h1" | "h2" | "h3" | "body" | "small" | "micro"

export type TypeStep = {
  name: TypeStepName
  /** whole px — half a pixel renders differently on every platform */
  size: number
  /** unitless, so it survives being inherited */
  lineHeight: number
  /** in em with its sign, ready to paste — "-0.018em" */
  tracking: string
  weight: number
}

export type MotionTokens = {
  model: Theme["motionModel"]
  /** a state change on a control: hover, focus, press, check */
  stateMs: number
  /** something entering or leaving: menu, dialog, toast */
  enterMs: number
  /** the one curve everything uses; "" when nothing moves */
  curve: string
  /** reserved for the two or three playful moments; "" unless a spring */
  overshoot: string
  /** the spring itself, for the runtimes that animate with physics */
  spring: { stiffness: number; damping: number; mass: number } | null
}

export type ElevationTokens = {
  strategy: Theme["elevationStrategy"]
  /** the ONE shadow, or "" when depth is carried some other way */
  shadow: string
  /** px of backdrop blur; 0 unless the strategy is glass */
  blur: number
  /** one sentence naming what carries depth, for the prompt and the file */
  rule: string
}

export type TokenSet = {
  light: Record<string, string>
  dark: Record<string, string>
  shape: Theme["shape"]
  /** real family names, or "" where the character has not been pinned to one */
  fonts: Theme["fonts"]
  scaleRatio: number
  scale: TypeStep[]
  /** the only spacing values anything in the generated project may use */
  spacing: number[]
  motion: MotionTokens
  elevation: ElevationTokens
  /** how a text field is drawn, and where its label sits */
  inputStyle: Theme["inputStyle"]
  /** one sentence specifying that field treatment, for the prompt */
  inputRule: string
}

/**
 * What each field treatment actually means, in values.
 *
 * Written as a spec rather than a name because "floating label" is understood
 * three different ways, and the one thing worse than no instruction is one each
 * model interprets differently. The height and padding stay the same across all
 * six so switching treatment never reflows a form.
 */
const INPUT_RULES: Record<Theme["inputStyle"], string> = {
  outlined:
    "Text fields are a 1px `--border` box on `--background`, with the label above the field. On focus the border becomes `--ring` and a 2px ring sits outside it.",
  filled:
    "Text fields are filled with `--muted` and have no border, with the label above the field. On focus the fill lightens and a 2px `--ring` ring sits outside it.",
  underline:
    "Text fields have no box — a 1px `--border` rule under the field only, with the label above it. On focus the rule becomes 2px `--ring`. Do not add a background or a box on focus.",
  floating:
    "Text fields start with the label sitting inside them at body size, in `--muted-foreground`. On focus, and whenever the field has a value, the label rises to the top edge of the field at the `micro` size and takes `--ring`. Animate that with the state duration; it is the one place a label moves.",
  inset:
    "Text fields carry the label permanently inside them, at the `micro` size in `--muted-foreground`, sitting above the value on its own line. The field is tall enough for both. The label never moves.",
  borderless:
    "Text fields have no border and no fill at rest — only the value and, above it, the label. A `--muted` fill appears on hover and a 2px `--ring` ring on focus. Use this only where the form is the page's content rather than a dialog.",
}

/** Body text is the fixed point; every other size is derived from it. */
const BODY_SIZE = 16

const SPACING = [4, 8, 12, 16, 24, 32, 48, 64]

/**
 * Weight is part of the step, not a separate decision.
 *
 * Micro is heavier than body on purpose: at eleven or twelve pixels a regular
 * weight loses more contrast than the size loses attention, and every design
 * system that skips this ends up with unreadable table labels.
 */
const WEIGHTS: Record<TypeStepName, number> = {
  display: 700,
  h1: 700,
  h2: 600,
  h3: 600,
  body: 400,
  small: 400,
  micro: 500,
}

const STEP_ORDER: readonly TypeStepName[] = [
  "display",
  "h1",
  "h2",
  "h3",
  "body",
  "small",
  "micro",
]

const round = (value: number, places: number) => Number(value.toFixed(places))

/** Big type needs less leading than small type, and never less than the cap. */
function lineHeightFor(size: number): number {
  return round(Math.min(1.7, 1.08 + 6.4 / size), 2)
}

/**
 * Tracking tightens as size grows and turns slightly positive at the smallest
 * step.
 *
 * That inverse relationship is the one typographic move a generated interface
 * never makes: display type set at its default spacing reads loose and cheap,
 * and eleven-pixel labels set at zero read cramped. The curve below is a plain
 * reciprocal, which crosses zero just under body size and settles around
 * -0.033em at poster sizes — the same shape a person would arrive at by eye.
 */
function trackingFor(size: number): string {
  return `${round(0.512 / size - 0.0327, 4)}em`
}

/**
 * The type scale.
 *
 * The ratio is a *heading* ratio. Applied downwards it collapses — 1.6 from
 * 16px reaches 6px in two steps — so the two sizes below body use a damped one.
 * Nobody sets a caption by the interval they set a hero at.
 */
function typeScale(ratio: number): TypeStep[] {
  const down = 1 + (ratio - 1) * 0.4
  const raw: Record<TypeStepName, number> = {
    display: BODY_SIZE * ratio ** 4,
    h1: BODY_SIZE * ratio ** 3,
    h2: BODY_SIZE * ratio ** 2,
    h3: BODY_SIZE * ratio,
    body: BODY_SIZE,
    small: BODY_SIZE / down,
    micro: BODY_SIZE / (down * down),
  }

  // Rounding to whole pixels collides at the shallow end of the range — a 1.05
  // ratio puts three steps on 17px. Walking outwards from body and forcing a
  // pixel of daylight is what keeps a scale a scale.
  const size = { ...raw }
  let previous = BODY_SIZE
  for (const name of ["h3", "h2", "h1", "display"] as const) {
    size[name] = Math.max(Math.round(raw[name]), previous + 1)
    previous = size[name]
  }
  previous = BODY_SIZE
  for (const name of ["small", "micro"] as const) {
    size[name] = Math.min(Math.round(raw[name]), previous - 1)
    previous = size[name]
  }
  size.body = BODY_SIZE

  return STEP_ORDER.map((name) => ({
    name,
    size: size[name],
    lineHeight: lineHeightFor(size[name]),
    tracking: trackingFor(size[name]),
    weight: WEIGHTS[name],
  }))
}

function motionTokens(model: Theme["motionModel"]): MotionTokens {
  switch (model) {
    case "none":
      return { model, stateMs: 0, enterMs: 0, curve: "", overshoot: "", spring: null }
    case "spring":
      return {
        model,
        // A spring has no duration, but half the surfaces it drives are CSS,
        // so it carries the durations that read as the same movement.
        stateMs: 140,
        enterMs: 260,
        curve: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        spring: { stiffness: 220, damping: 26, mass: 1 },
      }
    default:
      return {
        model: "duration",
        stateMs: 120,
        enterMs: 200,
        curve: "cubic-bezier(0.2, 0, 0, 1)",
        overshoot: "",
        spring: null,
      }
  }
}

/**
 * One shadow, never a five-step ramp.
 *
 * A ramp is the tell of a generated design: nothing in a real interface is at
 * elevation four, and offering five levels guarantees three of them are used
 * for decoration. Four of the seven strategies emit no shadow at all, because
 * depth carried by a surface step or a hairline is a different design, not a
 * quieter version of the same one.
 */
function elevationTokens(
  strategy: Theme["elevationStrategy"],
  brandHue: number
): ElevationTokens {
  const hue = round(brandHue, 1)
  switch (strategy) {
    case "shadow":
      return {
        strategy,
        shadow: "0 1px 2px oklch(0 0 0 / 0.05), 0 8px 24px -12px oklch(0 0 0 / 0.18)",
        blur: 0,
        rule: "Depth is one shadow, and it belongs only on something genuinely floating above the page — a menu, a dialog, a toast. Cards do not have it.",
      }
    case "ladder":
      return {
        strategy,
        shadow: "",
        blur: 0,
        rule: "Depth is a step in surface lightness — background, then card, then popover. Nothing casts a shadow; if two surfaces need separating, the one in front is lighter.",
      }
    case "hairline":
      return {
        strategy,
        shadow: "",
        blur: 0,
        rule: "Depth is a single hairline border. Nothing casts a shadow, and no border is thicker than 1px except the one carrying a selected state.",
      }
    case "grid":
      return {
        strategy,
        shadow: "",
        blur: 0,
        rule: "Depth is the rule grid: cells share their borders and the page reads as one ruled sheet. Nothing casts a shadow and nothing floats free of the grid.",
      }
    case "tinted":
      return {
        strategy,
        // Tinted toward the brand hue rather than neutral black, which is what
        // stops a shadow reading as dirt on a coloured ground.
        shadow: `0 1px 2px oklch(0.55 0.05 ${hue} / 0.1), 0 10px 30px -14px oklch(0.5 0.14 ${hue} / 0.4)`,
        blur: 0,
        rule: "Depth is one shadow tinted toward the brand hue, never neutral black. It belongs only on something genuinely floating above the page.",
      }
    case "glass":
      return {
        strategy,
        shadow: "",
        blur: 16,
        rule: "Depth is the blur behind an overlay: a translucent surface over a backdrop filter. It applies only where content genuinely passes underneath — a frosted panel with nothing behind it is decoration.",
      }
    default:
      return {
        strategy: "offset",
        // `var(--foreground)` rather than a literal so one value works in both
        // modes; the non-CSS targets resolve it per mode when they emit.
        shadow: "4px 4px 0 0 var(--foreground)",
        blur: 0,
        rule: "Depth is a hard offset with no blur, in the foreground colour. One offset distance everywhere, and it moves to 2px on press rather than fading.",
      }
  }
}

/**
 * The hue of the brand colour, for the one strategy that tints its shadow.
 *
 * A primary written in a notation the colour module does not read falls back to
 * the theme's own neutral hue, which is a defensible answer — a shadow tinted
 * toward the palette's bias is still a tinted shadow. Guessing would not be.
 */
function hueOf(color: string | undefined, fallback: number): number {
  return parseOklch(color ?? "")?.h ?? fallback
}

/**
 * Preset values first, then the project's overrides on top.
 *
 * The canonical order is re-imposed here so every generated file declares its
 * tokens in the same sequence whatever order a preset happened to list them in,
 * and anything a preset added beyond the shadcn set survives at the end rather
 * than being silently dropped.
 */
function layer(
  base: Record<string, string> | undefined,
  overrides: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...(base ?? {}), ...overrides }
  const resolved: Record<string, string> = {}
  for (const name of tokenNames) if (merged[name]) resolved[name] = merged[name]
  for (const name of Object.keys(merged).sort()) {
    if (!resolved[name] && merged[name]) resolved[name] = merged[name]
  }
  return resolved
}

/**
 * A face is named only where somebody actually pinned one.
 *
 * An empty name means "follow the character", and the character reaches the
 * agent through the prompt rather than through the stylesheet — so the token
 * gets a system stack instead of a family the project has no licence to load.
 * `bodyFont: "pair"` is the schema's way of saying body follows the heading,
 * and it is the default, which is why it is honoured here rather than left to
 * each emitter to remember.
 */
function resolveFonts(theme: Theme, preset: Preset | undefined): Theme["fonts"] {
  // A character chosen in an old file outranks the preset's families, the same
  // way a named family would: it was written on purpose.
  const byCharacter = deviates("headingFont", theme.headingFont)
    ? LEGACY_FAMILY[theme.headingFont]
    : ""
  const bodyByCharacter =
    theme.bodyFont !== "pair" && deviates("bodyFont", theme.bodyFont)
      ? LEGACY_FAMILY[theme.bodyFont as FontCharacter]
      : ""

  const display = theme.fonts.display || byCharacter || preset?.fonts.display || ""
  const mono = theme.fonts.mono || preset?.fonts.mono || ""
  const named = theme.fonts.body || bodyByCharacter || preset?.fonts.body || ""
  return { display, body: named || (theme.bodyFont === "pair" ? display : ""), mono }
}


/** A token with almost no chroma is a neutral, and neutrals take the hue dial. */
const NEUTRAL_CHROMA = 0.03

/**
 * Apply the two colour dials the editor exposes.
 *
 * Without this the sliders move a number that reaches only the tinted shadow,
 * which is worse than not offering them: a control that visibly does nothing
 * teaches people the whole editor is decorative. They are applied only when the
 * document has moved them off the preset's own value, so a preset's palette is
 * never quietly "corrected" the moment it loads.
 *
 * Chroma scales rather than being set, because the palette's internal ratios —
 * a muted surface against a primary against a chart ramp — are a design
 * decision the dial has no business flattening. Neutrals are rotated rather
 * than scaled, since their whole job is to carry a faint bias toward the hue
 * the accent sits at.
 */
function applyDials(
  tokens: Record<string, string>,
  vividnessRatio: number,
  neutralHue: number | null
): Record<string, string> {
  if (vividnessRatio === 1 && neutralHue === null) return tokens
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(tokens)) {
    const parsed = parseOklch(value)
    // Anything the palette states some other way — a hex, an alpha border —
    // is left exactly as written rather than approximated into oklch.
    if (!parsed || parsed.alpha !== 1) {
      out[name] = value
      continue
    }
    const neutral = parsed.c <= NEUTRAL_CHROMA
    const h = neutral && neutralHue !== null ? neutralHue : parsed.h
    const c = neutral ? parsed.c : parsed.c * vividnessRatio
    out[name] = formatOklch(clampToGamut({ l: parsed.l, c, h }))
  }
  return out
}

/**
 * The brand colours, applied over the preset's palette.
 *
 * `primaryColor` and `secondaryColor` predate the preset system and were, until
 * this, written to the document and read by nothing — the editor showed two
 * colour fields that moved a value the stylesheet never consulted. A control
 * that visibly does nothing is worse than an absent one: it teaches people the
 * rest of the editor is decorative too.
 *
 * Applied only when moved off the schema default, for the same reason the dials
 * are: otherwise every preset would turn indigo the moment it loaded.
 *
 * Dark mode is re-derived rather than reused. A brand colour at its own
 * lightness sits at roughly L 0.5, which against a 0.16 ground is a dark fill
 * with dark text on it — so dark mode takes the hue, moves lightness to where
 * the catalogue puts it, and brings chroma down, exactly as every preset does
 * by hand.
 */

/** White, or the darkest ink at this hue — whichever the label can actually be read on. */
function labelFor(fill: string, hue: number): string {
  const ink = formatOklch(clampToGamut({ l: 0.16, c: 0.02, h: hue }))
  const onWhite = Math.abs(lc("oklch(1 0 0)", fill))
  const onInk = Math.abs(lc(ink, fill))
  return onWhite >= onInk ? "oklch(1 0 0)" : ink
}

function shade(l: number, c: number, h: number): string {
  return formatOklch(clampToGamut({ l, c, h }))
}

/**
 * The nearest lightness to the one asked for that can actually carry a label.
 *
 * A saturated hue has no polarity that works at its own lightness — magenta at
 * L 0.63 reaches Lc 64 against white and less against black, so a button in it
 * has an unreadable label whichever way you set the text. Rather than refuse
 * the colour or silently ship it, the fill moves along its own hue until a
 * label clears the floor, taking the smallest step that does.
 */
function readableFill(l: number, c: number, h: number): string {
  let nearest = shade(l, c, h)
  let best = Math.abs(lc(labelFor(nearest, h), nearest))
  if (best >= LC_FLOORS.body) return nearest

  for (let step = 0.02; step <= 0.45; step += 0.02) {
    // Darker first: a brand colour darkened still reads as the brand, where the
    // same colour lightened toward white usually does not.
    for (const candidate of [l - step, l + step]) {
      if (candidate < 0.12 || candidate > 0.97) continue
      const fill = shade(candidate, c, h)
      const measured = Math.abs(lc(labelFor(fill, h), fill))
      if (measured >= LC_FLOORS.body) return fill
      if (measured > best) {
        best = measured
        nearest = fill
      }
    }
  }
  // Nothing cleared it — hand back the closest attempt rather than the original,
  // which was further from readable than this is.
  return nearest
}

function applyBrand(
  tokens: Record<string, string>,
  mode: "light" | "dark",
  primary: string | null,
  secondary: string | null
): Record<string, string> {
  if (!primary && !secondary) return tokens
  const out = { ...tokens }

  if (primary) {
    const brand = hexToOklch(primary)
    if (brand) {
      const { c, h } = brand
      // The dead zone (L 0.68–0.76) takes no label at all, so a brand colour
      // landing in it is pulled to the readable side rather than shipped.
      const fill =
        mode === "dark"
          ? shade(0.86, Math.min(c, 0.06), h)
          : readableFill(brand.l, c, h)
      const label = mode === "dark" ? shade(0.14, 0.015, h) : labelFor(fill, h)
      out.primary = fill
      out["primary-foreground"] = label
      out["sidebar-primary"] = fill
      out["sidebar-primary-foreground"] = label
      out.ring = shade(mode === "dark" ? 0.66 : 0.62, c * 0.6, h)
      out["chart-1"] = shade(mode === "dark" ? 0.71 : 0.62, c * 0.76, h)
    }
  }

  if (secondary) {
    const brand = hexToOklch(secondary)
    if (brand) {
      const { c, h } = brand
      out["chart-2"] = shade(mode === "dark" ? 0.71 : 0.62, c * 0.7, h)
      // Accent is a hover fill and an active row, not a brand moment: it takes
      // the hue at a fraction of the chroma, or every list in the product
      // shouts. Its label is re-derived so the pair still clears the floor.
      const tint = shade(
        mode === "dark" ? 0.32 : 0.94,
        Math.min(c * 0.25, mode === "dark" ? 0.04 : 0.05),
        h
      )
      const label = shade(mode === "dark" ? 0.9 : 0.3, 0.02, h)
      out.accent = tint
      out["accent-foreground"] = label
      out["sidebar-accent"] = tint
      out["sidebar-accent-foreground"] = label
    }
  }

  return out
}

/**
 * The schema's own defaults, read once rather than restated.
 *
 * A field still sitting on its default has not been decided by anyone, so the
 * preset gets to decide it. A field that has moved was moved deliberately and
 * survives a preset change — which is also why picking a preset in the editor
 * writes its values onto the document rather than relying on this.
 *
 * The known cost: setting a value that happens to equal the default reads as
 * "not decided". It is the same trade the serializer already makes when it
 * omits defaults from the Flow output, so at least the two agree.
 */
const THEME_DEFAULTS = themeSchema.parse({})

function deviates<K extends keyof Theme>(key: K, value: Theme[K]): boolean {
  return JSON.stringify(value) !== JSON.stringify(THEME_DEFAULTS[key])
}

/**
 * The pre-preset design fields, mapped onto the values that are read now.
 *
 * `radius`, `buttons`, `type scale`, `elevation`, `motion` and the font
 * characters are still valid Flow, still parsed, and still written by every
 * starter and by every `.flow` file anybody has saved. They stopped being read
 * when the preset system landed, which meant an old file's `radius large` was
 * silently ignored — the diagram opened looking nothing like the file said.
 *
 * So they are a fallback layer rather than dead weight: a modern field that has
 * been moved wins, then a legacy field that has been moved, then the preset,
 * then the default. Nothing here writes to the document — an old file keeps its
 * old fields, and saving it does not silently rewrite them.
 */
const LEGACY_SHAPE: Record<
  Theme["borderRadius"],
  { control: number; card: number; overlay: number; pill: boolean }
> = {
  none: { control: 0, card: 0, overlay: 2, pill: false },
  small: { control: 4, card: 6, overlay: 8, pill: false },
  medium: { control: 8, card: 12, overlay: 16, pill: false },
  large: { control: 14, card: 18, overlay: 22, pill: false },
  full: { control: 16, card: 20, overlay: 24, pill: true },
}

const LEGACY_SCALE: Record<Theme["typeScale"], number> = {
  compact: 1.15,
  balanced: 1.25,
  expressive: 1.4,
}

const LEGACY_ELEVATION: Record<Theme["elevation"], Theme["elevationStrategy"]> = {
  flat: "hairline",
  subtle: "shadow",
  layered: "ladder",
}

const LEGACY_MOTION: Record<Theme["motion"], Theme["motionModel"]> = {
  none: "none",
  restrained: "duration",
  expressive: "spring",
}

/**
 * A real family for a character, so an old file that asked for "slab" gets a
 * slab rather than the fallback stack. One family per character, deliberately:
 * the character was always a direction, and picking the same face for it every
 * time is what makes two projects that asked for the same thing look alike.
 */
const LEGACY_FAMILY: Record<FontCharacter, string> = {
  geometric: "Outfit",
  grotesque: "Inter",
  humanist: "Source Sans 3",
  serif: "Source Serif 4",
  slab: "Roboto Slab",
  mono: "IBM Plex Mono",
}

function legacyShape(theme: Theme) {
  const radius = deviates("borderRadius", theme.borderRadius)
    ? LEGACY_SHAPE[theme.borderRadius]
    : null
  const buttons = deviates("buttonStyle", theme.buttonStyle) ? theme.buttonStyle : null
  if (!radius && !buttons) return null
  const base = radius ?? LEGACY_SHAPE.medium
  // `rounded` and `sharp` are shape decisions; `filled` and `outlined` are
  // fills, and the prompt states those rather than the token set.
  if (buttons === "rounded") return { ...base, pill: true }
  if (buttons === "sharp") return { ...base, control: 0 }
  return base
}

/**
 * `preview` exists for the editor, which has to render a preset the project has
 * not switched to yet — hovering a card must not write to the document.
 */
export function resolveTokens(theme: Theme, preview?: Preset): TokenSet {
  const preset = preview ?? presetById(theme.preset)

  // A dial counts as moved when it differs from the preset it is sitting on,
  // not from the schema default — otherwise every preset whose own vividness
  // is not 60 would be re-chromatised the instant it was selected.
  // A dial still on the schema default has not been decided by anyone, so the
  // preset keeps its own value. Without that check every preset whose vividness
  // is not exactly 60 was re-chromatised on load — a project that had touched
  // nothing did not render the preset it named.
  const presetVividness = preset?.vividness ?? THEME_DEFAULTS.vividness
  const vividnessRatio =
    !deviates("vividness", theme.vividness) ||
    theme.vividness === presetVividness ||
    presetVividness === 0
      ? 1
      : theme.vividness / presetVividness
  const presetHue = preset?.neutralHue ?? THEME_DEFAULTS.neutralHue
  const hueShift =
    !deviates("neutralHue", theme.neutralHue) || theme.neutralHue === presetHue
      ? null
      : theme.neutralHue

  // Brand colours land after the dials and before the per-token overrides are
  // considered final: a hand-picked token is still the last word, because
  // somebody who typed a hex into the token list meant that exact value.
  const brandPrimary = deviates("primaryColor", theme.primaryColor)
    ? theme.primaryColor
    : null
  const brandSecondary = deviates("secondaryColor", theme.secondaryColor)
    ? theme.secondaryColor
    : null

  const light = layer(
    applyBrand(
      applyDials(layer(preset?.light, {}), vividnessRatio, hueShift),
      "light",
      brandPrimary,
      brandSecondary
    ),
    theme.palette.light
  )
  const dark = layer(
    applyBrand(
      applyDials(layer(preset?.dark, {}), vividnessRatio, hueShift),
      "dark",
      brandPrimary,
      brandSecondary
    ),
    theme.palette.dark
  )

  // Structural fields follow the preset unless the document has moved them,
  // exactly as the colours do. Without this, naming a preset in Flow — the one
  // path that sets `preset` without going through the editor — produced a
  // project wearing one design's palette and another's geometry.
  // Modern field, then the legacy field it replaced, then the preset.
  const shape = deviates("shape", theme.shape)
    ? theme.shape
    : (legacyShape(theme) ?? preset?.shape ?? theme.shape)
  const scaleRatio = deviates("scaleRatio", theme.scaleRatio)
    ? theme.scaleRatio
    : deviates("typeScale", theme.typeScale)
      ? LEGACY_SCALE[theme.typeScale]
      : (preset?.scaleRatio ?? theme.scaleRatio)
  const elevationStrategy = deviates("elevationStrategy", theme.elevationStrategy)
    ? theme.elevationStrategy
    : deviates("elevation", theme.elevation)
      ? LEGACY_ELEVATION[theme.elevation]
      : (preset?.elevationStrategy ?? theme.elevationStrategy)
  const motionModel = deviates("motionModel", theme.motionModel)
    ? theme.motionModel
    : deviates("motion", theme.motion)
      ? LEGACY_MOTION[theme.motion]
      : (preset?.motionModel ?? theme.motionModel)
  const inputStyle = deviates("inputStyle", theme.inputStyle)
    ? theme.inputStyle
    : (preset?.inputStyle ?? theme.inputStyle)
  const shadowHue = deviates("neutralHue", theme.neutralHue)
    ? theme.neutralHue
    : (preset?.neutralHue ?? theme.neutralHue)

  return {
    light,
    dark,
    shape: { ...shape },
    fonts: resolveFonts(theme, preset),
    scaleRatio,
    scale: typeScale(scaleRatio),
    spacing: [...SPACING],
    motion: motionTokens(motionModel),
    inputStyle,
    inputRule: INPUT_RULES[inputStyle],
    elevation: elevationTokens(elevationStrategy, hueOf(light.primary, shadowHue)),
  }
}
