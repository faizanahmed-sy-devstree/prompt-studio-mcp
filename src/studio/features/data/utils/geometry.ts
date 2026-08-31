// Vendored from Prompt Studio (features/data/utils/geometry.ts). Do not edit here — run `pnpm sync`.
/** Canvas geometry for a table card. Shared by the node and the arrange maths. */
export const ENTITY_WIDTH = 248
/** Title + table name. */
export const ENTITY_HEADER = 44
/** One column row. */
export const ENTITY_ROW = 22
/** The "Add column" row. */
export const ENTITY_FOOTER = 30

export function entityHeight(fieldCount: number) {
  return ENTITY_HEADER + fieldCount * ENTITY_ROW + ENTITY_FOOTER
}
