// Vendored from Prompt Studio (features/library/data/layout-catalogue.ts). Do not edit here — run `pnpm sync`.
import type { LayoutOption } from "./layout-types"

/**
 * The layout catalogue, as a model should read it.
 *
 * Both prompts used to emit bare ids — twenty-eight lines of
 * `- table-master-detail` — and asked the model to choose between them from
 * their names. It did what anyone would: reached for the handful whose names
 * were self-evident (`table-advanced`, `detail-two-column`, `auth-split`) and
 * used them everywhere, leaving two thirds of the catalogue unused and screens
 * described more crudely than the app can render them.
 *
 * The fix is the sentence a person gets in the layout picker. Grouping by
 * category on top of that means the model can see the whole shape of what is
 * available — that there *is* a wizard, a kanban board, a master/detail — and
 * pick deliberately rather than defaulting.
 */
export function groupLayouts(layouts: LayoutOption[]): string {
  const byCategory = new Map<string, LayoutOption[]>()
  for (const layout of layouts) {
    const bucket = byCategory.get(layout.category)
    if (bucket) bucket.push(layout)
    else byCategory.set(layout.category, [layout])
  }

  const blocks: string[] = []
  for (const [category, options] of byCategory) {
    blocks.push(`**${category}**`)
    for (const option of options) {
      blocks.push(`- \`${option.id}\` — ${option.name}: ${option.description}`)
    }
    blocks.push("")
  }
  return blocks.join("\n").trimEnd()
}
