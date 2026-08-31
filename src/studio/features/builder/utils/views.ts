// Vendored from Prompt Studio (features/builder/utils/views.ts). Do not edit here — run `pnpm sync`.
import type { FlowEdge, ProjectDoc, Screen } from "../../../types/project"

/**
 * Which screens and transitions a given view can see.
 *
 * The rule everywhere: **an empty tag list means every view**. A screen like
 * Sign In or the 404 really is shared, and requiring it to name all five roles
 * would be noise that goes stale the moment a sixth appears. Tagging is how you
 * say "only these roles".
 *
 * `strict` drops the shared screens and shows only what carries this role's own
 * tag. It is the audit view: what does this role uniquely own, and — more
 * usefully — is the tagging right at all? If strict "Admin" shows two screens
 * in a fifty-screen app, the import under-tagged and every view is showing
 * nearly everything.
 */
export function inView(
  tagged: { views: string[] },
  viewId: string | null,
  strict = false
) {
  if (!viewId) return true
  if (strict) return tagged.views.includes(viewId)
  return tagged.views.length === 0 || tagged.views.includes(viewId)
}

export function screensInView(
  doc: ProjectDoc,
  viewId: string | null,
  strict = false
): Screen[] {
  return doc.screens.filter((screen) => inView(screen, viewId, strict))
}

export function edgesInView(
  doc: ProjectDoc,
  viewId: string | null,
  strict = false
): FlowEdge[] {
  if (!viewId) return doc.edges
  const visible = new Set(screensInView(doc, viewId, strict).map((s) => s.id))
  // A transition needs its own tag AND both endpoints present — a connection
  // into a screen this role cannot reach is not part of this role's flow.
  return doc.edges.filter(
    (edge) =>
      inView(edge, viewId, strict) && visible.has(edge.from) && visible.has(edge.to)
  )
}

/** Human list of the views a screen belongs to, for the prompt and inspector. */
export function viewNames(doc: ProjectDoc, ids: string[]): string[] {
  return ids
    .map((id) => doc.views.find((v) => v.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}
