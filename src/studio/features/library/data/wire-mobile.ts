// Vendored from Prompt Studio (features/library/data/wire-mobile.ts). Do not edit here — run `pnpm sync`.
import type { Wire } from "./wire"
import { bar, circle, col, grid, pill, row, spacer } from "./wire-helpers"

/**
 * Phone-specific wireframe pieces, composed from the same primitives the web
 * layouts use.
 *
 * A mobile thumbnail lives or dies on its chrome: a status bar, an app bar and
 * a bottom tab set are what make a picture read as "phone screen" in 160px.
 * Drawing those by hand in every layout would be forty copies of the same six
 * lines, so they live here and each layout is a short list of regions.
 */

/** Time + signal/battery. Tiny, but its absence is what makes a thumb look web. */
export const statusBar = (): Wire =>
  row([bar(14, "line"), spacer(1), bar(8, "line"), bar(5, "line")], {
    gap: 1,
    align: "between",
  })

/** Top app bar: optional back chevron, title, optional trailing action. */
export const appBar = (
  opts: { back?: boolean; action?: boolean; title?: number } = {}
): Wire =>
  row(
    [
      opts.back ? circle("sm", "line") : bar(0, "line"),
      bar(opts.title ?? 42, "strong", 2),
      spacer(1),
      opts.action ? circle("sm", "line") : bar(0, "line"),
    ],
    { gap: 1, align: "between" }
  )

/** A large collapsing title, the iOS/Material "large header" pattern. */
export const largeTitle = (w = 62): Wire => bar(w, "strong", 3)

export const searchBar = (): Wire =>
  row([circle("sm", "line"), bar(70, "line")], {
    gap: 1,
    pad: 1,
    tone: "surface",
    rounded: true,
    border: true,
  })

/** Standard bottom tab bar — icon above label, one tab active. */
export const tabBar = (count = 4, active = 0): Wire =>
  row(
    Array.from({ length: count }, (_, i) =>
      col([circle("sm", i === active ? "accent" : "line"), bar(70, i === active ? "accentLine" : "line")], {
        gap: 0,
        align: "center",
        grow: 1,
      })
    ),
    { gap: 1, pad: 1, align: "between", border: true, tone: "surface" }
  )

/** Floating pill navigation — detached from the edge, fully rounded. */
export const floatingTabBar = (count = 4, active = 0): Wire =>
  row(
    [
      spacer(1),
      row(
        Array.from({ length: count }, (_, i) =>
          circle("sm", i === active ? "accent" : "line")
        ),
        { gap: 2, pad: 1, tone: "surface", border: true, rounded: true }
      ),
      spacer(1),
    ],
    { gap: 0, align: "center" }
  )

/** Tab bar with a raised centre action — the "compose/add" pattern. */
export const tabBarWithFab = (): Wire =>
  row(
    [
      col([circle("sm", "accent"), bar(70, "accentLine")], { gap: 0, align: "center", grow: 1 }),
      col([circle("sm", "line"), bar(70, "line")], { gap: 0, align: "center", grow: 1 }),
      circle("md", "accent"),
      col([circle("sm", "line"), bar(70, "line")], { gap: 0, align: "center", grow: 1 }),
      col([circle("sm", "line"), bar(70, "line")], { gap: 0, align: "center", grow: 1 }),
    ],
    { gap: 1, pad: 1, align: "between", border: true, tone: "surface" }
  )

/** A list row: avatar, two lines of text, trailing chevron or value. */
export const listRow = (opts: { avatar?: boolean; trailing?: boolean } = {}): Wire =>
  row(
    [
      opts.avatar === false ? bar(0, "line") : circle("sm", "accentSoft"),
      col([bar(76, "strong"), bar(52, "line")], { gap: 0, grow: 1 }),
      opts.trailing === false ? bar(0, "line") : bar(6, "line"),
    ],
    { gap: 1, align: "between" }
  )

/** A settings row: label on the left, value or switch on the right. */
export const settingRow = (toggle = false): Wire =>
  row([bar(52, "line"), spacer(1), toggle ? pill(16, "accent") : bar(10, "line")], {
    gap: 1,
    align: "between",
  })

/** Horizontally scrolling filter chips. */
export const chipRow = (count = 4, active = 0): Wire =>
  row(
    Array.from({ length: count }, (_, i) =>
      pill(i === active ? 26 : 22, i === active ? "accent" : "surface", i !== active)
    ),
    { gap: 1 }
  )

/** iOS-style segmented control. */
export const segmented = (count = 3, active = 0): Wire =>
  row(
    Array.from({ length: count }, (_, i) =>
      pill(100, i === active ? "accent" : "surface", i !== active)
    ),
    { gap: 0, pad: 1, tone: "surface", rounded: true, border: true }
  )

/** A row of KPI tiles. */
export const statTiles = (count = 2): Wire =>
  grid(count, () => col([bar(46, "line"), bar(70, "strong", 2)], {
    gap: 0,
    pad: 1,
    tone: "surface",
    border: true,
    rounded: true,
  }), { gap: 1 })

/** OTP / verification code boxes. */
export const codeBoxes = (count = 4): Wire =>
  row(
    Array.from({ length: count }, () =>
      col([bar(40, "strong", 2)], {
        gap: 0,
        pad: 1,
        align: "center",
        tone: "surface",
        border: true,
        rounded: true,
        grow: 1,
      })
    ),
    { gap: 1 }
  )

/** The on-screen keyboard — what makes a form thumbnail read as a phone. */
export const keyboard = (): Wire =>
  col(
    [
      row(Array.from({ length: 5 }, () => pill(100, "surface", true)), { gap: 1 }),
      row(Array.from({ length: 5 }, () => pill(100, "surface", true)), { gap: 1 }),
      row([pill(100, "surface", true), pill(100, "surface", true), pill(100, "accent")], {
        gap: 1,
      }),
    ],
    { gap: 1, pad: 1, tone: "surface" }
  )

/** Third-party sign-in buttons. */
export const socialButtons = (count = 2): Wire =>
  col(
    Array.from({ length: count }, () => pill(100, "surface", true)),
    { gap: 1 }
  )

/** A bottom sheet raised over the screen behind it. */
export const sheet = (children: Wire[]): Wire =>
  col([row([bar(18, "line")], { align: "center" }), ...children], {
    gap: 1,
    pad: 1,
    tone: "surface",
    border: true,
    rounded: true,
  })

/** A full-bleed media or map block. */
export const media = (weight = 3): Wire =>
  col(
    Array.from({ length: weight }, () => bar(100, "accentSoft", 3)),
    { gap: 0 }
  )

/** Chat bubbles — alternating sides. */
export const bubbles = (count = 4): Wire =>
  col(
    Array.from({ length: count }, (_, i) =>
      row([i % 2 ? spacer(1) : bar(0, "line"), pill(i % 2 ? 52 : 62, i % 2 ? "accent" : "surface")], {
        gap: 0,
        align: i % 2 ? "end" : "start",
      })
    ),
    { gap: 1 }
  )

/** Message composer pinned above the keyboard. */
export const composer = (): Wire =>
  row([bar(72, "line"), spacer(1), circle("sm", "accent")], {
    gap: 1,
    pad: 1,
    align: "between",
    tone: "surface",
    border: true,
    rounded: true,
  })

/** A primary action pinned to the bottom, above the home indicator. */
export const stickyAction = (): Wire =>
  col([pill(100, "accent"), row([bar(30, "line")], { align: "center" })], {
    gap: 1,
  })

/** The home indicator bar. */
export const homeIndicator = (): Wire =>
  row([bar(34, "line")], { align: "center" })
