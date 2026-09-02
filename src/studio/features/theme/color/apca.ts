// Vendored from Prompt Studio (features/theme/color/apca.ts). Do not edit here — run `pnpm sync`.
/**
 * APCA-W3 0.1.9 — the contrast model the palette engine is checked against.
 *
 * WCAG 2's 4.5:1 ratio is symmetric and APCA is not, which is the whole point:
 * dark-on-light and light-on-dark at the same "ratio" do not read the same, and
 * a palette tuned to a symmetric number produces dark modes that measure fine
 * and are unreadable. The returned Lc is signed for that reason — the sign is
 * the polarity, not a rounding artefact.
 *
 * Deliberately does not: composite alpha (a colour with an alpha channel must be
 * flattened against its real backdrop before it gets here, because APCA has no
 * opinion about what is behind it), account for font size or weight, or round to
 * conformance "levels". `LC_FLOORS` below is where size and weight are handled,
 * as thresholds the palette must clear.
 */

import { parseColor } from "./oklch"

const normBG = 0.56
const normTXT = 0.57
const revTXT = 0.62
const revBG = 0.65
const blkThrs = 0.022
// biome-ignore lint/suspicious/noApproximativeNumericConstant: APCA-W3 0.1.9 specifies 1.414, not √2 — swapping in Math.SQRT2 would stop this matching the published reference values
const blkClmp = 1.414
const scale = 1.14
const loOffset = 0.027
const deltaYmin = 0.0005
const loClip = 0.1

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Screen luminance as APCA defines it: a flat 2.4 exponent, not the sRGB
 * piecewise curve. The two disagree near black, and APCA's soft clamp below is
 * calibrated against this one.
 */
function luminance(input: string): number | null {
  const rgb = parseColor(input)
  if (!rgb) return null
  const y =
    0.2126729 * clamp01(rgb.r) ** 2.4 +
    0.7151522 * clamp01(rgb.g) ** 2.4 +
    0.072175 * clamp01(rgb.b) ** 2.4
  // Flare and the eye's floor: near-black pairs are worth less contrast than
  // the raw luminance difference claims, so the darkest end is lifted.
  return y < blkThrs ? y + (blkThrs - y) ** blkClmp : y
}

/**
 * Lightness contrast between text and its background.
 *
 * Positive is dark text on a light background, negative is light text on a dark
 * one; compare `Math.abs()` against a floor when polarity is not the question.
 * Returns 0 for an unparseable colour rather than throwing — the editor calls
 * this on every keystroke, half-typed hex included, and 0 fails every floor,
 * which is the correct answer for a colour that does not exist yet.
 */
export function lc(textColor: string, bgColor: string): number {
  const txtY = luminance(textColor)
  const bgY = luminance(bgColor)
  if (txtY === null || bgY === null) return 0

  if (Math.abs(bgY - txtY) < deltaYmin) return 0

  if (bgY > txtY) {
    const sapc = (bgY ** normBG - txtY ** normTXT) * scale
    return (sapc < loClip ? 0 : sapc - loOffset) * 100
  }

  const sapc = (bgY ** revBG - txtY ** revTXT) * scale
  return (sapc > -loClip ? 0 : sapc + loOffset) * 100
}

/**
 * What each kind of text has to clear, from the APCA readability guidance.
 *
 * These are floors, not targets: `body` is the level at which normal-weight
 * interface text at 16px is comfortable, `bodySmall` covers the 12–14px labels
 * that a real interface is mostly made of, `secondary` is for text that is
 * meant to recede but still be read, and `disabled` is the level below which a
 * control looks broken rather than unavailable.
 */
export const LC_FLOORS = {
  bodySmall: 90,
  body: 75,
  secondary: 60,
  disabled: 45,
} as const

export type LcFloor = keyof typeof LC_FLOORS

/**
 * The lightness band where a filled control cannot be labelled.
 *
 * Between roughly L 0.68 and L 0.76 a colour is too dark for black text and too
 * light for white, so neither polarity clears the body floor. Nothing catches
 * this by eye — the fill looks perfectly pleasant, and only its label is
 * unreadable — so every preset's primary and destructive are checked against it.
 */
export function inDeadZone(l: number): boolean {
  return l >= 0.68 && l <= 0.76
}
