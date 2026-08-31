// Vendored from Prompt Studio (features/library/data/wire-helpers.ts). Do not edit here — run `pnpm sync`.
import type { StackOpts, Wire, WireGap, WireTone } from "./wire"

export const col = (children: Wire[], opts: StackOpts = {}): Wire => ({
  k: "stack",
  dir: "col",
  ...opts,
  children,
})

export const row = (children: Wire[], opts: StackOpts = {}): Wire => ({
  k: "stack",
  dir: "row",
  ...opts,
  children,
})

export const bar = (
  w: number,
  tone: WireTone = "line",
  h: 1 | 2 | 3 = 1
): Wire => ({ k: "bar", w, tone, h })

export const heading = (w = 62): Wire => bar(w, "strong", 2)
export const sub = (w = 44): Wire => bar(w, "line", 1)

export const pill = (
  w = 24,
  tone: WireTone = "accent",
  outline = false
): Wire => ({ k: "pill", w, tone, outline })

export const circle = (
  size: "sm" | "md" | "lg" = "md",
  tone: WireTone = "accentLine"
): Wire => ({ k: "circle", size, tone })

export const grid = (
  cols: number,
  cell: Wire | ((index: number) => Wire),
  opts: { cols?: number; rows?: number; gap?: WireGap; grow?: number; h?: number } = {}
): Wire => ({ k: "grid", ...opts, cols: opts.cols ?? cols, cell })

export const chart = (
  variant: "bars" | "line" | "donut",
  opts: { grow?: number; h?: number } = {}
): Wire => ({ k: "chart", variant, ...opts })

export const table = (
  opts: { cols?: number; rows?: number; grow?: number; header?: boolean } = {}
): Wire => ({ k: "table", ...opts })

export const field = (label = true, w = 100): Wire => ({ k: "field", label, w })

export const avatarRow = (w = 100): Wire => ({ k: "avatarRow", w })

export const spacer = (grow = 1): Wire => ({ k: "spacer", grow })

export const frame = (
  child: Wire,
  variant: "browser" | "phone" | "plain" = "plain"
): Wire => ({ k: "frame", variant, child })

/** A generic content card: bordered surface with a heading and two lines. */
export const card = (children?: Wire[]): Wire =>
  col(children ?? [bar(70, "strong"), bar(90), bar(55)], {
    gap: 1,
    pad: 1,
    tone: "surface",
    border: true,
    rounded: true,
    grow: 1,
  })
