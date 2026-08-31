// Vendored from Prompt Studio (features/prompt/engine/data-model.ts). Do not edit here — run `pnpm sync`.
import { sqlType, tsType } from "../../data/data/field-types"
import {
  joinTableName,
  primaryKeyOf,
  relationWording,
  singular,
} from "../../data/utils/schema"
import { findStackOption } from "../../stack/data/stack-catalogue"
import type { Entity, ProjectDoc, Relation } from "../../../types/project"

/**
 * The schema, written out for the model.
 *
 * Until this existed the prompt described screens and endpoints and left the
 * tables underneath them to be invented — separately, by each build, which is
 * how a web app, a phone app and a service end up disagreeing about what a
 * `user` is. What is drawn on the Data tab is what gets migrated.
 */
export function dataModelBlock(doc: ProjectDoc): string {
  if (!doc.entities.length) return ""

  const database = doc.builds.backend
    ? doc.surfaces.backend.stack.database
    : doc.stack.database
  const databaseName =
    findStackOption("database", database)?.label ?? database ?? "the database"
  const orm = doc.builds.backend ? doc.surfaces.backend.stack.orm : doc.stack.orm
  const ormName = findStackOption("orm", orm)?.label ?? ""
  const documentStore = (database ?? "").includes("mongo")

  const lines: string[] = [
    `${doc.entities.length} ${doc.entities.length === 1 ? "table" : "tables"} on **${databaseName}**${
      ormName ? `, through ${ormName}` : ""
    }. This is the whole data model — do not invent tables or columns that are not here, and do not drop any that are.`,
    "",
  ]

  for (const entity of doc.entities) {
    lines.push(`### \`${entity.key}\` — ${entity.name}`)
    if (entity.note.trim()) {
      lines.push("")
      lines.push(entity.note.trim())
    }
    lines.push("")
    lines.push("| Column | Type | Rules | Notes |")
    lines.push("| --- | --- | --- | --- |")
    for (const field of entity.fields) {
      const rules: string[] = []
      if (field.primary) rules.push("primary key")
      if (field.required && !field.primary) rules.push("not null")
      if (field.unique && !field.primary) rules.push("unique")
      if (field.indexed && !field.primary) rules.push("indexed")
      if (field.defaultValue.trim()) rules.push(`default \`${field.defaultValue.trim()}\``)
      if (field.type === "enum" && field.options.length) {
        rules.push(`one of ${field.options.map((o) => `\`${o}\``).join(", ")}`)
      }
      const foreign = foreignKeyFor(doc, entity, field.name)
      if (foreign) rules.push(`references \`${foreign}\``)
      lines.push(
        `| \`${field.name}\` | \`${sqlType(field.type, database ?? "")}\` | ${
          rules.join(", ") || "—"
        } | ${field.note.trim() || "—"} |`
      )
    }
    lines.push("")
  }

  if (doc.relations.length) {
    lines.push("### Relations")
    lines.push("")
    for (const relation of doc.relations) {
      lines.push(`- ${describeForPrompt(doc, relation)}`)
    }
    lines.push("")
  }

  lines.push("### Rules for the schema")
  lines.push("")
  const rules: string[] = []
  if (documentStore) {
    rules.push(
      "Collections, not tables: the same shapes, with references stored as ids. Enforce the required fields and the unique indexes in the schema definition, not only in application code."
    )
  } else {
    rules.push(
      "Every relation above is a real foreign key constraint in the migration, with the delete behaviour stated. Referential integrity belongs in the database, not in a service method that remembers to check."
    )
    rules.push(
      "Index every foreign key. A join on an unindexed column is the first thing that breaks under real data."
    )
  }
  rules.push(
    "One migration per change, checked in, and it must run forwards on an empty database and against one that already holds rows."
  )
  rules.push(
    "A seed script that produces a usable dataset: enough rows in each table to exercise every list, filter and empty state described in this brief."
  )
  rules.push(
    "The types the API returns come from this model — generate or hand-write them once in the shared package and import them; no build re-declares a payload."
  )
  if (doc.entities.some((entity) => !primaryKeyOf(entity))) {
    rules.push(
      "Any table above with no primary key marked gets a `uuid` primary key called `id`."
    )
  }
  for (const rule of rules) lines.push(`- ${rule}`)

  const shapes = typeShapes(doc)
  if (shapes) {
    lines.push("")
    lines.push("### The shapes, in TypeScript")
    lines.push("")
    lines.push("```ts")
    lines.push(shapes)
    lines.push("```")
    lines.push("")
    lines.push(
      "These live in `packages/shared` and every build imports them. They are the contract between the service and its clients."
    )
  }

  return lines.join("\n")
}

/** The `table.column` a column points at, if a relation says so. */
function foreignKeyFor(doc: ProjectDoc, entity: Entity, column: string) {
  const relation = doc.relations.find(
    (r) => r.from === entity.id && r.fromField === column && r.kind !== "many-to-many"
  )
  if (!relation) return ""
  const target = doc.entities.find((e) => e.id === relation.to)
  if (!target) return ""
  return `${target.key}.${relation.toField || "id"}`
}

function describeForPrompt(doc: ProjectDoc, relation: Relation) {
  const from = doc.entities.find((e) => e.id === relation.from)
  const to = doc.entities.find((e) => e.id === relation.to)
  if (!from || !to) return ""

  if (relation.kind === "many-to-many") {
    const through = joinTableName(doc, relation)
    return `**${from.name} ↔ ${to.name}** — many to many, through a join table \`${through}\` holding \`${singular(from.key)}_id\` and \`${singular(to.key)}_id\` with a unique constraint on the pair.${
      relation.label.trim() ? ` ${relation.label.trim()}.` : ""
    }`
  }

  const deleteWords: Record<Relation["onDelete"], string> = {
    cascade: "deleting the parent deletes these rows",
    restrict: "deleting the parent is blocked while these rows exist",
    "set-null": "deleting the parent leaves these rows with a null reference",
  }

  return `**\`${from.key}.${relation.fromField}\` → \`${to.key}.${relation.toField}\`** — ${
    relationWording[relation.kind]
  }; on delete, ${deleteWords[relation.onDelete]}.${
    relation.label.trim() ? ` ${relation.label.trim()}.` : ""
  }`
}

/** One interface per table — what the API hands back. */
function typeShapes(doc: ProjectDoc) {
  const out: string[] = []
  for (const entity of doc.entities) {
    if (!entity.fields.length) continue
    out.push(`export type ${pascal(singular(entity.key))} = {`)
    for (const field of entity.fields) {
      const optional = field.required || field.primary ? "" : "?"
      out.push(`  ${field.name}${optional}: ${tsType(field.type, field.options)}`)
    }
    out.push("}")
    out.push("")
  }
  return out.join("\n").trim()
}

function pascal(value: string) {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")
}
