// Vendored from Prompt Studio (features/flow-lang/merge.ts). Do not edit here — run `pnpm sync`.
import { uid } from "../../lib/utils"
import type { ProjectDoc, UserStory } from "../../types/project"

export type MergeReport = {
  newFlows: number
  newTables: number
  updatedTables: number
  newColumns: number
  newRelations: number
  newScreens: number
  updatedScreens: number
  newModules: number
  newEdges: number
  newInnerEdges: number
  newSections: number
  /** theme fields the incoming file stated and this merge applied */
  themeFields: number
  /** the preset it named, when it named one */
  preset: string
}

/**
 * Grafts a parsed fragment onto an existing document, matching screens by key.
 *
 * Blind concatenation — the previous behaviour — cannot work for fragments: a
 * fragment that adds a modal to `clients` would produce a second `clients`
 * screen, and its `flow` edges reference the incoming screen's ids, so they
 * would point at the copy rather than the real one. Matching by key and
 * remapping every incoming id onto the resolved screen is what makes "give me
 * a chunk I can paste into the diagram I already have" work at all.
 *
 * Existing fields are never overwritten. A fragment declares `screen clients {`
 * with only the new modules inside it; anything it leaves out is deliberately
 * absent, not deliberately blank, so absent means "leave alone".
 */
export function mergeDoc(
  doc: ProjectDoc,
  incoming: ProjectDoc,
  /**
   * The theme fields the incoming file actually stated, from the parser.
   *
   * Merging used to skip the theme entirely, so a file carrying a design — the
   * whole point of asking a model to choose one — landed its screens and left
   * the design behind unless you replaced the project outright. Copying the
   * whole theme instead is no better: every line the file omitted comes back
   * as a default, which would quietly undo tuning it never mentioned. So only
   * what was stated is applied.
   */
  themeStated: (keyof ProjectDoc["theme"])[] = []
): MergeReport {
  const report: MergeReport = {
    newFlows: 0,
    newTables: 0,
    updatedTables: 0,
    newColumns: 0,
    newRelations: 0,
    newScreens: 0,
    updatedScreens: 0,
    newModules: 0,
    newEdges: 0,
    newInnerEdges: 0,
    newSections: 0,
    themeFields: 0,
    preset: "",
  }

  // ---------------------------------------------------------------- theme
  for (const field of themeStated) {
    const value = incoming.theme[field]
    if (JSON.stringify(doc.theme[field]) === JSON.stringify(value)) continue
    // `structuredClone` because shape, fonts and palette are objects, and
    // sharing them would let a later edit reach back into the parsed document.
    Object.assign(doc.theme, { [field]: structuredClone(value) })
    report.themeFields += 1
    if (field === "preset") report.preset = String(value)
  }

  // --------------------------------------------------------------- flows
  // Resolved before screens, because a screen's flow tags are ids and have to
  // be remapped onto this document's flows as the screen lands.
  const flowByKey = new Map(doc.flows.map((f) => [f.key, f]))
  /** incoming flow id → id in `doc` */
  const flowIds = new Map<string, string>()

  for (const incomingFlow of [...incoming.flows].sort((a, b) => a.order - b.order)) {
    const existing = flowByKey.get(incomingFlow.key)
    if (existing) {
      flowIds.set(incomingFlow.id, existing.id)
      fillStory(existing.story, incomingFlow.story)
      if (!existing.note.trim() && incomingFlow.note.trim()) {
        existing.note = incomingFlow.note
      }
      continue
    }
    const flow = {
      ...incomingFlow,
      id: uid("flw"),
      order: doc.flows.length,
    }
    flowIds.set(incomingFlow.id, flow.id)
    flowByKey.set(flow.key, flow)
    doc.flows.push(flow)
    report.newFlows += 1
  }

  /** incoming tag ids → this document's, dropping any that did not resolve */
  const mapFlowTags = (ids: string[]) =>
    ids.map((id) => flowIds.get(id)).filter((id): id is string => Boolean(id))

  const byKey = new Map(doc.screens.map((s) => [s.key, s]))
  /** incoming screen id → id in `doc` */
  const screenIds = new Map<string, string>()

  for (const incomingScreen of incoming.screens) {
    const existing = byKey.get(incomingScreen.key)
    if (existing) {
      screenIds.set(incomingScreen.id, existing.id)
      // Only fill blanks. A fragment that omits `layout` is not asking for the
      // layout to be cleared.
      let touched = false
      if (!existing.template && incomingScreen.template) {
        existing.template = incomingScreen.template
        touched = true
      }
      if (!existing.layout && incomingScreen.layout) {
        existing.layout = incomingScreen.layout
        touched = true
      }
      if (!existing.note.trim() && incomingScreen.note.trim()) {
        existing.note = incomingScreen.note
        touched = true
      }
      if (fillStory(existing.story, incomingScreen.story)) touched = true
      // Flow tags are added, never replaced: a fragment about billing knows
      // this screen is part of billing, and knows nothing about the two other
      // journeys it was already in.
      for (const flowId of mapFlowTags(incomingScreen.flows)) {
        if (!existing.flows.includes(flowId)) {
          existing.flows.push(flowId)
          touched = true
        }
      }
      if (touched) report.updatedScreens += 1
      continue
    }

    // New screen. Its incoming coordinates come from the fragment's own
    // auto-layout, which knows nothing about this canvas, so drop it below
    // everything that already exists rather than on top of it.
    const below = doc.screens.length
      ? Math.max(...doc.screens.map((s) => s.y)) + 260
      : 80
    const screen = {
      ...incomingScreen,
      id: uid("scr"),
      flows: mapFlowTags(incomingScreen.flows),
      y: below + incomingScreen.y,
    }
    screenIds.set(incomingScreen.id, screen.id)
    byKey.set(screen.key, screen)
    doc.screens.push(screen)
    report.newScreens += 1
  }

  // ------------------------------------------------------------- modules
  /** incoming module id → id in `doc` */
  const moduleIds = new Map<string, string>()

  for (const incomingModule of [...incoming.modules].sort(
    (a, b) => a.order - b.order
  )) {
    const screenId = screenIds.get(incomingModule.screenId)
    if (!screenId) continue
    const siblings = doc.modules.filter((m) => m.screenId === screenId)
    const existing = siblings.find((m) => m.key === incomingModule.key)
    if (existing) {
      moduleIds.set(incomingModule.id, existing.id)
      continue
    }
    const module = {
      ...incomingModule,
      id: uid("mod"),
      screenId,
      order: siblings.length,
    }
    moduleIds.set(incomingModule.id, module.id)
    doc.modules.push(module)
    report.newModules += 1
  }

  // --------------------------------------------------------------- edges
  for (const edge of incoming.edges) {
    const from = screenIds.get(edge.from)
    const to = screenIds.get(edge.to)
    if (!from || !to || from === to) continue
    if (doc.edges.some((e) => e.from === from && e.to === to)) continue
    doc.edges.push({
      id: uid("edg"),
      from,
      to,
      trigger: edge.trigger,
      views: edge.views,
    })
    report.newEdges += 1
  }

  for (const edge of incoming.moduleEdges) {
    const from = moduleIds.get(edge.from)
    const to = moduleIds.get(edge.to)
    if (!from || !to || from === to) continue
    if (doc.moduleEdges.some((e) => e.from === from && e.to === to)) continue
    doc.moduleEdges.push({ id: uid("med"), from, to, trigger: edge.trigger })
    report.newInnerEdges += 1
  }

  // ---------------------------------------------------------- data model
  // Tables match by key and columns by name, the same rule screens and modules
  // follow: a fragment that adds `status` to `orders` must land on the orders
  // table, not create a second one. Nothing is overwritten — a fragment
  // restating a column it did not change must not quietly relax a constraint.
  const entityByKey = new Map(doc.entities.map((entity) => [entity.key, entity]))
  /** incoming entity id → id in `doc` */
  const entityIds = new Map<string, string>()

  for (const incomingEntity of incoming.entities) {
    const existing = entityByKey.get(incomingEntity.key)
    if (existing) {
      entityIds.set(incomingEntity.id, existing.id)
      let touched = false
      if (!existing.note.trim() && incomingEntity.note.trim()) {
        existing.note = incomingEntity.note
        touched = true
      }
      for (const field of incomingEntity.fields) {
        if (existing.fields.some((f) => f.name === field.name)) continue
        existing.fields.push({ ...field, id: uid("fld") })
        report.newColumns += 1
        touched = true
      }
      if (touched) report.updatedTables += 1
      continue
    }

    const below = doc.entities.length
      ? Math.max(...doc.entities.map((e) => e.y)) + 320
      : 0
    const entity = {
      ...incomingEntity,
      id: uid("ent"),
      fields: incomingEntity.fields.map((field) => ({ ...field, id: uid("fld") })),
      y: below + incomingEntity.y,
    }
    entityIds.set(incomingEntity.id, entity.id)
    entityByKey.set(entity.key, entity)
    doc.entities.push(entity)
    report.newTables += 1
    report.newColumns += entity.fields.length
  }

  for (const relation of incoming.relations) {
    const from = entityIds.get(relation.from)
    const to = entityIds.get(relation.to)
    if (!from || !to) continue
    const already = doc.relations.some(
      (existing) =>
        existing.from === from &&
        existing.to === to &&
        existing.fromField === relation.fromField
    )
    if (already) continue
    doc.relations.push({ ...relation, id: uid("rel"), from, to })
    report.newRelations += 1
  }

  // ------------------------------------------------------------ sections
  for (const section of incoming.sections) {
    if (doc.sections.some((s) => s.type === section.type && s.name === section.name)) {
      continue
    }
    doc.sections.push({
      ...section,
      id: uid("sec"),
      order: doc.sections.length,
    })
    report.newSections += 1
  }

  return report
}

export function describeMerge(report: MergeReport): string {
  const parts = [
    report.newFlows && `${report.newFlows} new flow${plural(report.newFlows)}`,
    report.newScreens && `${report.newScreens} new screen${plural(report.newScreens)}`,
    report.updatedScreens && `${report.updatedScreens} updated`,
    report.newModules && `${report.newModules} module${plural(report.newModules)}`,
    report.newEdges && `${report.newEdges} connection${plural(report.newEdges)}`,
    report.newInnerEdges &&
      `${report.newInnerEdges} inner connection${plural(report.newInnerEdges)}`,
    report.newSections && `${report.newSections} section${plural(report.newSections)}`,
    report.newTables && `${report.newTables} table${plural(report.newTables)}`,
    report.updatedTables && `${report.updatedTables} table${plural(report.updatedTables)} updated`,
    report.newColumns && `${report.newColumns} column${plural(report.newColumns)}`,
    report.newRelations &&
      `${report.newRelations} relation${plural(report.newRelations)}`,
    // Last, and phrased as the design rather than as a field count, because
    // that is the part somebody wants to look at before anything else.
    report.themeFields &&
      (report.preset
        ? `design: ${report.preset}${
            report.themeFields > 1 ? ` +${report.themeFields - 1} override${plural(report.themeFields - 1)}` : ""
          }`
        : `${report.themeFields} design setting${plural(report.themeFields)}`),
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "Nothing new — the project already had all of it"
}

/**
 * Fills only the blanks of a story, the same rule the rest of the merge follows.
 *
 * A fragment that mentions a screen in passing writes a thinner story than the
 * one already on it; letting that overwrite would mean pasting a small fragment
 * quietly destroys work. Criteria are appended rather than replaced, so two
 * fragments can each contribute what they know.
 */
function fillStory(existing: UserStory, incoming: UserStory): boolean {
  let touched = false
  for (const field of ["role", "want", "soThat"] as const) {
    if (!existing[field].trim() && incoming[field].trim()) {
      existing[field] = incoming[field]
      touched = true
    }
  }
  for (const criterion of incoming.criteria) {
    const text = criterion.trim()
    if (text && !existing.criteria.some((c) => c.trim() === text)) {
      existing.criteria.push(text)
      touched = true
    }
  }
  return touched
}

function plural(count: number) {
  return count === 1 ? "" : "s"
}
