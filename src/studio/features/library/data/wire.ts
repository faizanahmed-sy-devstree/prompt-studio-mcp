// Vendored from Prompt Studio (features/library/data/wire.ts). Do not edit here — run `pnpm sync`.
/**
 * A tiny declarative wireframe language used to draw the layout thumbnails.
 *
 * Forty-odd layouts share ~12 primitives instead of forty bespoke SVGs, so a
 * new layout is a few lines of data and every thumbnail keeps the same visual
 * rhythm (line weights, tones, proportions) automatically.
 *
 * Types live here, builders in `wire-helpers.ts`, rendering in
 * `components/layout-thumb.tsx`.
 */

export type WireTone =
  | "line" // body copy
  | "strong" // headings
  | "surface" // panels / cards
  | "accent" // solid primary — CTAs
  | "accentSoft" // tinted primary zone — "this is the point of the layout"
  | "accentLine" // primary text/icon weight

export type WireGap = 0 | 1 | 2 | 3
export type WireAlign = "start" | "center" | "end" | "between"

export type Wire =
  /** Outer device frame. `browser` adds a title bar, `phone` a notch. */
  | { k: "frame"; variant?: "browser" | "phone" | "plain"; child: Wire }
  | {
      k: "stack"
      dir?: "row" | "col"
      gap?: WireGap
      pad?: WireGap
      grow?: number
      /** height as a percentage of the parent */
      h?: number
      /** width as a percentage of the parent */
      w?: number
      align?: WireAlign
      tone?: WireTone
      border?: boolean
      rounded?: boolean
      children: Wire[]
    }
  /** A text line. `w` is a percentage of the parent width. */
  | { k: "bar"; w: number; h?: 1 | 2 | 3; tone?: WireTone }
  /** A button. */
  | { k: "pill"; w: number; tone?: WireTone; outline?: boolean }
  | { k: "circle"; size?: "sm" | "md" | "lg"; tone?: WireTone }
  | {
      k: "grid"
      cols: number
      rows?: number
      gap?: WireGap
      grow?: number
      h?: number
      /** cell(index) lets one cell differ — e.g. the highlighted pricing tier */
      cell: Wire | ((index: number) => Wire)
    }
  | { k: "chart"; variant: "bars" | "line" | "donut"; grow?: number; h?: number }
  | { k: "table"; cols?: number; rows?: number; grow?: number; header?: boolean }
  | { k: "field"; label?: boolean; w?: number }
  | { k: "avatarRow"; w?: number }
  | { k: "spacer"; grow?: number; h?: number }

export type StackOpts = Omit<Extract<Wire, { k: "stack" }>, "k" | "children" | "dir">
