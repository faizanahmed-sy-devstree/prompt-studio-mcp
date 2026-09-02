// Vendored from Prompt Studio (features/theme/tokens/index.ts). Do not edit here — run `pnpm sync`.
/**
 * The token layer: one module that turns a chosen theme into values, and one
 * that turns those values into the file a generated project is built from.
 *
 * Everything that needs tokens — the build prompt, the editor, the live
 * preview — comes through here, so the stylesheet a developer is handed and the
 * swatches they judged it by can never be computed two different ways.
 */

export { generateStylesheet, type Stylesheet } from "./css"
export {
  type ElevationTokens,
  type MotionTokens,
  resolveTokens,
  type TokenSet,
  type TypeStep,
  type TypeStepName,
  tokenGroups,
  tokenNames,
} from "./resolve"
