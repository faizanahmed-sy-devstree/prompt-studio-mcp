// Vendored from Prompt Studio (features/data/data/field-types.ts). Do not edit here — run `pnpm sync`.
/**
 * The column types offered in the picker.
 *
 * Stored on the field as a plain string, because a project may target Postgres,
 * MySQL or Mongo and each spells its types differently — this catalogue is what
 * turns the portable word into the right thing for the database the project
 * actually chose, in the generated prompt.
 */
export type FieldType = {
  id: string
  label: string
  hint: string
  postgres: string
  mysql: string
  mongo: string
  ts: string
}

export const fieldTypes: FieldType[] = [
  {
    id: "uuid",
    label: "UUID",
    hint: "Primary keys and foreign keys",
    postgres: "uuid",
    mysql: "char(36)",
    mongo: "ObjectId",
    ts: "string",
  },
  {
    id: "text",
    label: "Text",
    hint: "Unbounded text — descriptions, notes",
    postgres: "text",
    mysql: "text",
    mongo: "String",
    ts: "string",
  },
  {
    id: "string",
    label: "Short text",
    hint: "Names, emails, slugs — indexable",
    postgres: "varchar(255)",
    mysql: "varchar(255)",
    mongo: "String",
    ts: "string",
  },
  {
    id: "integer",
    label: "Integer",
    hint: "Counts, quantities",
    postgres: "integer",
    mysql: "int",
    mongo: "Number",
    ts: "number",
  },
  {
    id: "bigint",
    label: "Big integer",
    hint: "Ids and counters that outgrow 32 bits",
    postgres: "bigint",
    mysql: "bigint",
    mongo: "Number",
    ts: "number",
  },
  {
    id: "decimal",
    label: "Decimal",
    hint: "Money and anything that must not round",
    postgres: "numeric(12,2)",
    mysql: "decimal(12,2)",
    mongo: "Decimal128",
    ts: "string",
  },
  {
    id: "boolean",
    label: "Boolean",
    hint: "Flags",
    postgres: "boolean",
    mysql: "tinyint(1)",
    mongo: "Boolean",
    ts: "boolean",
  },
  {
    id: "timestamp",
    label: "Timestamp",
    hint: "Created / updated, always with a time zone",
    postgres: "timestamptz",
    mysql: "datetime",
    mongo: "Date",
    ts: "string",
  },
  {
    id: "date",
    label: "Date",
    hint: "A day with no time — birthdays, due dates",
    postgres: "date",
    mysql: "date",
    mongo: "Date",
    ts: "string",
  },
  {
    id: "time",
    label: "Time",
    hint: "A time with no day — opening hours",
    postgres: "time",
    mysql: "time",
    mongo: "String",
    ts: "string",
  },
  {
    id: "json",
    label: "JSON",
    hint: "Structured blobs — settings, payloads",
    postgres: "jsonb",
    mysql: "json",
    mongo: "Object",
    ts: "Record<string, unknown>",
  },
  {
    id: "enum",
    label: "Enum",
    hint: "A fixed set of values — status, role",
    postgres: "text",
    mysql: "enum",
    mongo: "String",
    ts: "union",
  },
  {
    id: "array",
    label: "Array",
    hint: "A list of scalars — tags",
    postgres: "text[]",
    mysql: "json",
    mongo: "Array",
    ts: "string[]",
  },
  {
    id: "binary",
    label: "Binary",
    hint: "Bytes — avoid; store files in object storage",
    postgres: "bytea",
    mysql: "blob",
    mongo: "Binary",
    ts: "Buffer",
  },
]

export const fieldTypeMap = new Map(fieldTypes.map((type) => [type.id, type]))

/** The type as the chosen database spells it — falls back to what was typed. */
export function sqlType(type: string, database: string) {
  const known = fieldTypeMap.get(type)
  if (!known) return type
  if (database.includes("mysql") || database.includes("maria")) return known.mysql
  if (database.includes("mongo")) return known.mongo
  return known.postgres
}

export function tsType(type: string, options: string[] = []) {
  const known = fieldTypeMap.get(type)
  if (!known) return "string"
  if (known.ts === "union") {
    return options.length
      ? options.map((option) => `"${option}"`).join(" | ")
      : "string"
  }
  return known.ts
}
