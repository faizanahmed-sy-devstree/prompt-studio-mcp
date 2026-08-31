// Vendored from Prompt Studio (features/data/utils/schema.ts). Do not edit here — run `pnpm sync`.
import type {
  Entity,
  EntityField,
  ProjectDoc,
  Relation,
  RelationKind,
} from "../../../types/project"

/** A table's primary key, or null if nobody marked one. */
export function primaryKeyOf(entity: Entity): EntityField | null {
  return entity.fields.find((field) => field.primary) ?? null
}

export function fieldByName(entity: Entity, name: string): EntityField | null {
  const wanted = name.trim().toLowerCase()
  return entity.fields.find((field) => field.name.toLowerCase() === wanted) ?? null
}

export function entityByKey(doc: ProjectDoc, key: string): Entity | null {
  const wanted = key.trim().toLowerCase()
  return doc.entities.find((entity) => entity.key.toLowerCase() === wanted) ?? null
}

export function relationsOf(doc: ProjectDoc, entityId: string): Relation[] {
  return doc.relations.filter(
    (relation) => relation.from === entityId || relation.to === entityId
  )
}

/** Crude but predictable singular — `orders` → `order`, `people` stays. */
export function singular(key: string) {
  if (/(ss|us|is)$/i.test(key)) return key
  if (/ies$/i.test(key)) return `${key.slice(0, -3)}y`
  if (/(ches|shes|xes|ses)$/i.test(key)) return key.slice(0, -2)
  if (/s$/i.test(key)) return key.slice(0, -1)
  return key
}

/** What the foreign key pointing at this table should be called. */
export function foreignKeyName(target: Entity) {
  return `${singular(target.key)}_id`
}

/** `orders.user_id → users.id` */
export function describeRelation(doc: ProjectDoc, relation: Relation) {
  const from = doc.entities.find((e) => e.id === relation.from)
  const to = doc.entities.find((e) => e.id === relation.to)
  const fromSide = `${from?.key ?? "?"}${relation.fromField ? `.${relation.fromField}` : ""}`
  const toSide = `${to?.key ?? "?"}${relation.toField ? `.${relation.toField}` : ""}`
  return `${fromSide} → ${toSide}`
}

export const relationWording: Record<RelationKind, string> = {
  "many-to-one": "many rows point at one",
  "one-to-many": "one row owns many",
  "one-to-one": "exactly one each way",
  "many-to-many": "many on both sides, through a join table",
}

/** The join table for a many-to-many, named if nobody named it. */
export function joinTableName(doc: ProjectDoc, relation: Relation) {
  if (relation.through) return relation.through
  const from = doc.entities.find((e) => e.id === relation.from)
  const to = doc.entities.find((e) => e.id === relation.to)
  return [singular(from?.key ?? "a"), singular(to?.key ?? "b")].sort().join("_")
}

export type ModelIssue = {
  level: "error" | "warning"
  message: string
  /** what to select when the issue is clicked */
  entityId?: string
}

/**
 * Everything that would make this model fail to build, or build into something
 * nobody wants.
 *
 * Errors are things a migration cannot express (a relation pointing at a table
 * that is not there); warnings are things it can express but shouldn't (a table
 * nothing joins to). The same list feeds the Checks panel and the generated
 * prompt, so the model is told about the same problems the person sees.
 */
export function checkDataModel(doc: ProjectDoc): ModelIssue[] {
  const issues: ModelIssue[] = []
  const byId = new Map(doc.entities.map((entity) => [entity.id, entity]))

  const keys = new Map<string, number>()
  for (const entity of doc.entities) {
    keys.set(entity.key, (keys.get(entity.key) ?? 0) + 1)
  }
  for (const [key, count] of keys) {
    if (count > 1) {
      issues.push({
        level: "error",
        message: `Two tables are both called \`${key}\` — rename one.`,
      })
    }
  }

  for (const entity of doc.entities) {
    if (!entity.fields.length) {
      issues.push({
        level: "error",
        message: `\`${entity.key}\` has no columns.`,
        entityId: entity.id,
      })
      continue
    }

    if (!primaryKeyOf(entity)) {
      issues.push({
        level: "error",
        message: `\`${entity.key}\` has no primary key — mark one column as the key.`,
        entityId: entity.id,
      })
    }
    if (entity.fields.filter((field) => field.primary).length > 1) {
      issues.push({
        level: "warning",
        message: `\`${entity.key}\` marks more than one primary key — that is a composite key; say so in the note if it is deliberate.`,
        entityId: entity.id,
      })
    }

    const seen = new Set<string>()
    for (const field of entity.fields) {
      const name = field.name.trim().toLowerCase()
      if (!name) {
        issues.push({
          level: "error",
          message: `\`${entity.key}\` has a column with no name.`,
          entityId: entity.id,
        })
        continue
      }
      if (seen.has(name)) {
        issues.push({
          level: "error",
          message: `\`${entity.key}.${field.name}\` is declared twice.`,
          entityId: entity.id,
        })
      }
      seen.add(name)

      if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
        issues.push({
          level: "warning",
          message: `\`${entity.key}.${field.name}\` is not snake_case — every other column is, and the generated code will follow the majority.`,
          entityId: entity.id,
        })
      }
      if (field.type === "enum" && !field.options.length) {
        issues.push({
          level: "warning",
          message: `\`${entity.key}.${field.name}\` is an enum with no values listed.`,
          entityId: entity.id,
        })
      }
    }

    // A `*_id` column with nothing joining it is either a missing relation or a
    // column that will silently hold ids nobody checks.
    for (const field of entity.fields) {
      if (!/_id$/.test(field.name) || field.primary) continue
      const joined = doc.relations.some(
        (relation) =>
          (relation.from === entity.id && relation.fromField === field.name) ||
          (relation.to === entity.id && relation.toField === field.name)
      )
      if (!joined) {
        issues.push({
          level: "warning",
          message: `\`${entity.key}.${field.name}\` looks like a foreign key but joins nothing — draw the relation.`,
          entityId: entity.id,
        })
      }
    }

    if (doc.entities.length > 1 && !relationsOf(doc, entity.id).length) {
      issues.push({
        level: "warning",
        message: `\`${entity.key}\` relates to nothing else.`,
        entityId: entity.id,
      })
    }
  }

  for (const relation of doc.relations) {
    const from = byId.get(relation.from)
    const to = byId.get(relation.to)
    if (!from || !to) {
      issues.push({
        level: "error",
        message: `A relation points at a table that no longer exists — delete it or repoint it.`,
      })
      continue
    }
    if (relation.kind === "many-to-many") {
      if (!relation.through) {
        issues.push({
          level: "warning",
          message: `\`${from.key}\` ↔ \`${to.key}\` is many-to-many with no join table named — one will be called \`${joinTableName(doc, relation)}\`.`,
          entityId: from.id,
        })
      }
      continue
    }
    if (relation.fromField && !fieldByName(from, relation.fromField)) {
      issues.push({
        level: "error",
        message: `\`${from.key}.${relation.fromField}\` does not exist, but a relation uses it.`,
        entityId: from.id,
      })
    }
    if (relation.toField && !fieldByName(to, relation.toField)) {
      issues.push({
        level: "error",
        message: `\`${to.key}.${relation.toField}\` does not exist, but a relation points at it.`,
        entityId: to.id,
      })
    }
  }

  return issues
}
