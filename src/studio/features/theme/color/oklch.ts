// Vendored from Prompt Studio (features/theme/color/oklch.ts). Do not edit here — run `pnpm sync`.
/**
 * OKLCH colour maths for the theme editor's palette engine.
 *
 * Everything the engine does — rotating a hue, dialling vividness, pulling a
 * colour back inside sRGB — happens in OKLCH rather than HSL, because HSL's
 * lightness is a lie: `hsl(60 100% 50%)` and `hsl(240 100% 50%)` claim the same
 * lightness and one of them is yellow. Rotating hue in HSL therefore changes how
 * heavy a palette looks at every step, and that inconsistency is most of what
 * makes a generated theme read as generated.
 *
 * Deliberately does not: emit or judge wide-gamut colour (every value here is
 * measured against sRGB, because that is the space a generated `globals.css`
 * will be looked at in), composite alpha, or parse CSS colours beyond hex and
 * `oklch()` — those are the only two notations the editor ever writes.
 */

export type Rgb = { r: number; g: number; b: number }
export type Oklab = { l: number; a: number; b: number }
export type Oklch = { l: number; c: number; h: number }

/**
 * Slack allowed when deciding whether a colour fits in sRGB.
 *
 * Round-tripping through the matrices leaves errors near 1e-7, so this is large
 * enough that a channel landing on 1.0000001 is not called out of gamut, and
 * small enough (well under a 1/255 step) that nothing visibly clipped passes.
 */
const GAMUT_EPSILON = 1e-4

/** No sRGB colour reaches this chroma in OKLCH; the real ceiling is near 0.323. */
const CHROMA_CEILING = 0.5

/** Bisection stops here, so `maxChroma` is never more than this far inside. */
const CHROMA_PRECISION = 0.0005

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

const normalizeHue = (h: number) => {
  if (!Number.isFinite(h)) return 0
  const wrapped = h % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** Alpha is read but discarded: this module has no backdrop to composite against. */
export function hexToRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, "")
  const full =
    raw.length === 3 || raw.length === 4
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw
  if (!/^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(full)) return null
  const int = Number.parseInt(full.slice(0, 6), 16)
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (n: number) =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/**
 * The sRGB transfer functions, applied around zero rather than clipped at it.
 *
 * Out-of-gamut colours arrive here with negative channels, and clipping them
 * before the gamut test is what turns "this hue cannot hold that chroma" into
 * "this hue is fine, actually". Keeping the sign keeps the answer honest.
 */
export function srgbToLinear(channel: number): number {
  const sign = channel < 0 ? -1 : 1
  const abs = Math.abs(channel)
  return sign * (abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4)
}

export function linearToSrgb(channel: number): number {
  const sign = channel < 0 ? -1 : 1
  const abs = Math.abs(channel)
  return (
    sign * (abs <= 0.0031308 ? abs * 12.92 : 1.055 * abs ** (1 / 2.4) - 0.055)
  )
}

export function linearRgbToOklab({ r, g, b }: Rgb): Oklab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

export function oklabToLinearRgb({ l, a, b }: Oklab): Rgb {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const lc = l_ * l_ * l_
  const mc = m_ * m_ * m_
  const sc = s_ * s_ * s_

  return {
    r: 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    g: -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    b: -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  }
}

export function oklabToOklch({ l, a, b }: Oklab): Oklch {
  const c = Math.sqrt(a * a + b * b)
  return { l, c, h: normalizeHue((Math.atan2(b, a) * 180) / Math.PI) }
}

export function oklchToOklab({ l, c, h }: Oklch): Oklab {
  const rad = (normalizeHue(h) * Math.PI) / 180
  return { l, a: c * Math.cos(rad), b: c * Math.sin(rad) }
}

/** Gamma-encoded sRGB in, OKLCH out. */
export function rgbToOklch(rgb: Rgb): Oklch {
  return oklabToOklch(
    linearRgbToOklab({
      r: srgbToLinear(rgb.r),
      g: srgbToLinear(rgb.g),
      b: srgbToLinear(rgb.b),
    })
  )
}

/** Gamma-encoded sRGB out, unclamped — the caller decides what out of range means. */
export function oklchToRgb(lch: Oklch): Rgb {
  const linear = oklabToLinearRgb(oklchToOklab(lch))
  return {
    r: linearToSrgb(linear.r),
    g: linearToSrgb(linear.g),
    b: linearToSrgb(linear.b),
  }
}

export function hexToOklch(hex: string): Oklch | null {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToOklch(rgb) : null
}

export function oklchToHex(lch: Oklch): string {
  return rgbToHex(oklchToRgb(lch))
}

/** `c: 100%` means 0.4, per the CSS Color 4 definition of the oklch() percentage. */
const CHROMA_AT_FULL_PERCENT = 0.4

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/i

export function parseOklch(input: string): (Oklch & { alpha: number }) | null {
  const match = OKLCH_PATTERN.exec(input.trim())
  if (!match) return null
  const [, lRaw, lPct, cRaw, cPct, hRaw, aRaw, aPct] = match
  const l = Number(lRaw) / (lPct ? 100 : 1)
  const c = Number(cRaw) * (cPct ? CHROMA_AT_FULL_PERCENT / 100 : 1)
  const h = normalizeHue(Number(hRaw))
  const alpha = aRaw === undefined ? 1 : Number(aRaw) / (aPct ? 100 : 1)
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(alpha))
    return null
  return { l, c, h, alpha }
}

/**
 * Three decimals, trailing zeros trimmed — byte-identical to what shadcn ships.
 *
 * The trimming is not cosmetic. These strings land in someone's `globals.css`
 * next to hand-written ones, and `oklch(1.000 0.000 0.000)` beside
 * `oklch(1 0 0)` is the tell that a machine wrote half the file. A hue on an
 * achromatic colour is noise for the same reason, so it prints as zero.
 */
export function formatOklch({ l, c, h }: Oklch): string {
  const trim = (n: number) => n.toFixed(3).replace(/\.?0+$/, "")
  const lightness = trim(clamp01(Number.isFinite(l) ? l : 0))
  const chroma = trim(Math.max(0, Number.isFinite(c) ? c : 0))
  const hue = chroma === "0" ? "0" : trim(normalizeHue(h))
  return `oklch(${lightness} ${chroma} ${hue})`
}

/** Hex or `oklch()` to gamma-encoded sRGB; anything else is null rather than a guess. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim()
  if (value.startsWith("#")) return hexToRgb(value)
  const lch = parseOklch(value)
  return lch ? oklchToRgb(lch) : null
}

export function inGamut(lch: Oklch): boolean {
  const { r, g, b } = oklchToRgb(lch)
  const within = (n: number) => n >= -GAMUT_EPSILON && n <= 1 + GAMUT_EPSILON
  return within(r) && within(g) && within(b)
}

/**
 * The most chroma this lightness and hue can hold in sRGB.
 *
 * Bisection rather than an analytic solve: the sRGB gamut boundary in OKLCH has
 * no closed form worth carrying, and twelve iterations of a cheap matrix is
 * faster than the approximations that get it slightly wrong near the cusp.
 * The result is always inside the boundary, never on the far side of it.
 */
export function maxChroma(l: number, h: number): number {
  if (!inGamut({ l, c: 0, h })) return 0
  let lo = 0
  let hi = CHROMA_CEILING
  while (hi - lo > CHROMA_PRECISION) {
    const mid = (lo + hi) / 2
    if (inGamut({ l, c: mid, h })) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Chroma as a percentage of what this lightness and hue can actually reach.
 *
 * This is the function that makes hue rotation safe, and it is the mechanical
 * difference between a palette that looks designed and one that looks
 * generated. A fixed chroma of 0.15 is a rich blue, a slightly muddy red and an
 * impossible yellow; asking for 60% of the ceiling gives all three the same
 * saturation *relative to what they can be*, which is what the eye reads as one
 * family.
 */
export function withVividness(l: number, h: number, pct: number): number {
  const ratio = Math.max(0, Math.min(100, pct)) / 100
  return ratio * maxChroma(l, h)
}

/** Lightness and hue are the design decision; chroma is what gives way. */
export function clampToGamut({ l, c, h }: Oklch): Oklch {
  if (inGamut({ l, c, h })) return { l, c, h }
  return { l, c: Math.min(c, maxChroma(l, h)), h }
}
