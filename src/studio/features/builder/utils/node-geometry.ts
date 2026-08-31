// Vendored from Prompt Studio (features/builder/utils/node-geometry.ts). Do not edit here — run `pnpm sync`.
/**
 * Canvas geometry, shared by the node renderer and the auto-arrange maths.
 *
 * The screen card's height is **measured, not assumed**: it depends on the
 * rendered layout thumbnail, the title and the footer, and a hardcoded guess
 * put the module rows on top of the card. `CARD_HEIGHT_FALLBACK` is only used
 * for the first frame, before the ResizeObserver in `ScreenNode` reports the
 * real number.
 */
export const NODE_WIDTH = 224
/**
 * A mobile card is narrower so the whole node reads as a phone, not just its
 * thumbnail. Anything that measures or positions a node has to ask for the
 * width by surface rather than assuming the web one.
 */
export const MOBILE_NODE_WIDTH = 168

export function nodeWidthFor(surface: "web" | "mobile" | "backend") {
  return surface === "mobile" ? MOBILE_NODE_WIDTH : NODE_WIDTH
}

export const CARD_HEIGHT_FALLBACK = 216
export const MODULE_HEIGHT = 44
/** Room for an arrow and its label chip between two stacked modules. */
export const MODULE_GAP = 26
export const WELL_PAD = 8
/** The "Add module" / "Collapse" row at the bottom of the well. */
export const WELL_FOOTER = 24
/** Vertical breathing room between two screens in the same column. */
export const ROW_GAP = 48

/** Total node height once a screen is showing its modules. */
export function expandedHeight(cardHeight: number, moduleCount: number) {
  return (
    cardHeight +
    WELL_PAD +
    moduleCount * (MODULE_HEIGHT + MODULE_GAP) +
    WELL_FOOTER +
    WELL_PAD
  )
}

/** Where the nth module row sits, relative to the node's own origin. */
export function moduleOffsetY(cardHeight: number, index: number) {
  return cardHeight + WELL_PAD + index * (MODULE_HEIGHT + MODULE_GAP)
}
