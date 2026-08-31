// Vendored from Prompt Studio (types/project.ts). Do not edit here — run `pnpm sync`.
import { z } from "zod"

/**
 * The project document is the single source of truth for everything the app
 * generates: the flow graph, the landing stack, the design system, the target
 * stack/structure/conventions and the free-text requirements.
 *
 * The zod schemas here are also the import boundary — anything arriving from a
 * `.json` file, a share link or a `.flow` paste is parsed through them before
 * it is allowed anywhere near the store.
 */

export const SCHEMA_VERSION = 11

export const borderRadiusValues = [
  "none",
  "small",
  "medium",
  "large",
  "full",
] as const
export const buttonStyleValues = [
  "filled",
  "outlined",
  "rounded",
  "sharp",
] as const

/**
 * Typefaces are chosen by **character**, not by name.
 *
 * The generated project will not have your font licence, and an agent told to
 * use a specific commercial face either fails or silently substitutes one. A
 * direction it can satisfy with whatever it has is worth more than a name it
 * cannot honour.
 */
export const fontCharacterValues = [
  "geometric",
  "grotesque",
  "humanist",
  "serif",
  "slab",
  "mono",
] as const
export type FontCharacter = (typeof fontCharacterValues)[number]

/** Body text may simply follow the heading — the default, and usually right. */
export const bodyFontValues = ["pair", ...fontCharacterValues] as const

export const typeScaleValues = ["compact", "balanced", "expressive"] as const
export const iconStyleValues = ["line", "solid", "duotone"] as const
export const elevationValues = ["flat", "subtle", "layered"] as const
export const motionValues = ["none", "restrained", "expressive"] as const
export const colorSchemeValues = ["light", "both", "dark-first"] as const

export const themeSchema = z.object({
  /** id from features/theme/data/design-languages.ts */
  designLanguage: z.string().default("modern-soft"),
  primaryColor: z.string().default("#4f46e5"),
  secondaryColor: z.string().default("#0ea5e9"),
  borderRadius: z.enum(borderRadiusValues).default("medium"),
  buttonStyle: z.enum(buttonStyleValues).default("filled"),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  headingFont: z.enum(fontCharacterValues).default("grotesque"),
  bodyFont: z.enum(bodyFontValues).default("pair"),
  /** how far apart the heading sizes sit */
  typeScale: z.enum(typeScaleValues).default("balanced"),
  iconStyle: z.enum(iconStyleValues).default("line"),
  elevation: z.enum(elevationValues).default("subtle"),
  motion: z.enum(motionValues).default("restrained"),
  colorScheme: z.enum(colorSchemeValues).default("both"),
})

/**
 * A user story — why a screen or a journey exists, in the form a product person
 * would recognise, plus the criteria that say when it is actually done.
 *
 * It is three fields rather than one sentence because the model writes it and
 * the app has to render it: parsing "As a … I want … so that …" back out of
 * free text works right up until a model phrases it differently, and then it
 * fails silently. Three keys in the grammar, three fields in the panel.
 *
 * Every part is optional. A screen with an empty story behaves exactly as a
 * screen written before stories existed.
 */
export const userStorySchema = z.object({
  /** "an operations admin" */
  role: z.string().default(""),
  /** "see every client in one filterable table" */
  want: z.string().default(""),
  /** "I can reach the right record without hunting through pages" */
  soThat: z.string().default(""),
  /** checkable acceptance criteria, in the client's language */
  criteria: z.array(z.string()).default([]),
})

/**
 * A named user journey — "Authentication", "Invite a user", "Checkout".
 *
 * Flows are a **second axis, independent of views**. A view answers *who can
 * reach this screen*; a flow answers *what journey is it part of*. A screen has
 * one role set and belongs to several flows at once — Sign In starts
 * authentication and is also the first step of onboarding — so the two can
 * never share one control without fighting.
 *
 * Membership is a tag on the screen (`screen.flows`), not a list of screens
 * here. One fact in one place: with a list on both sides they eventually
 * disagree and nothing can say which was meant.
 */
export const flowSchema = z.object({
  id: z.string(),
  /** stable slug used by the `.flow` language — unique per project */
  key: z.string(),
  name: z.string(),
  story: userStorySchema.default({}),
  note: z.string().default(""),
  order: z.number().default(0),
})

/**
 * A perspective on the same application — "Super Admin", "Admin", "Field Rep".
 *
 * Views are not separate diagrams. One real app has one set of screens, and a
 * role changes which of them you can reach; duplicating Sign In per role would
 * mean editing it per role and letting the copies drift.
 */
export const viewSchema = z.object({
  id: z.string(),
  /** stable slug used by the `.flow` language — unique per project */
  key: z.string(),
  name: z.string(),
  note: z.string().default(""),
})

/**
 * Which build a screen belongs to. One product often ships as a web app, a
 * phone app and the service behind them; they share a brand, a brief and a set
 * of roles, but they are separate builds with separate stacks — so the surface
 * lives on the screen and the canvas shows one at a time.
 */
export const surfaceValues = ["web", "mobile", "backend"] as const
export type Surface = (typeof surfaceValues)[number]

export const screenSchema = z.object({
  id: z.string(),
  /** stable slug used by the `.flow` language — unique per project */
  key: z.string(),
  title: z.string(),
  template: z.string().default(""),
  layout: z.string().default(""),
  note: z.string().default(""),
  /** which build this screen is part of */
  surface: z.enum(surfaceValues).default("web"),
  /**
   * View ids this screen belongs to. **Empty means every view** — shared
   * surfaces are the common case, and it keeps projects written before views
   * existed behaving exactly as they did.
   */
  views: z.array(z.string()).default([]),
  /**
   * Flow ids this screen is part of. Normally written by the model as it
   * generates the file and corrected from the inspector — never derived from
   * the graph, so a tag never re-computes itself behind you. Empty means
   * ungrouped, which is a state the flow picker shows rather than hides.
   */
  flows: z.array(z.string()).default([]),
  /** why this screen exists, and when it is done */
  story: userStorySchema.default({}),
  x: z.number().default(0),
  y: z.number().default(0),
})

/**
 * A module is a piece of a screen — a table, a filter bar, a modal, a row menu.
 * Big existing applications carry most of their behaviour inside a screen, not
 * between screens, and a diagram that stops at screen level cannot describe
 * them. Modules are optional: a project with none behaves exactly as before.
 *
 * They are stored flat rather than nested inside the screen so undo, merge and
 * the schema-revalidating rehydrate keep working unchanged.
 */
export const moduleSchema = z.object({
  id: z.string(),
  /** owning screen id */
  screenId: z.string(),
  /** unique within the owning screen — how `.flow` refers to it */
  key: z.string(),
  name: z.string(),
  /** id from features/library/data/module-kinds.ts */
  kind: z.string().default("panel"),
  /** what opens or fires it — "click Add Client", "on page load" */
  trigger: z.string().default(""),
  note: z.string().default(""),
  order: z.number().default(0),
})

/** A transition between two modules of the same screen. */
export const moduleEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  trigger: z.string().default(""),
})

export const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  /** what causes the transition — "on submit", "click Add Client" */
  trigger: z.string().default(""),
  /** view ids this transition exists in; empty means every view */
  views: z.array(z.string()).default([]),
})

export const sectionSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  layout: z.string().default(""),
  note: z.string().default(""),
  order: z.number(),
})

/**
 * The data model — the tables behind the app, and how they relate.
 *
 * Kept in the project rather than left to the model to invent, because every
 * build was otherwise given screens and endpoints and asked to guess the
 * schema underneath them: three builds guessing separately is three different
 * databases. One declared model is what makes the web app, the phone app and
 * the service agree on what a `user` is.
 */
export const fieldKindValues = [
  "uuid",
  "text",
  "string",
  "integer",
  "bigint",
  "decimal",
  "boolean",
  "timestamp",
  "date",
  "time",
  "json",
  "enum",
  "array",
  "binary",
] as const

export const entityFieldSchema = z.object({
  id: z.string(),
  /** column name, as it will exist in the database */
  name: z.string(),
  /** free text rather than an enum: every database spells its types its own way */
  type: z.string().default("text"),
  primary: z.boolean().default(false),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  indexed: z.boolean().default(false),
  /** literal default, written into the migration — "now()", "0", "'draft'" */
  defaultValue: z.string().default(""),
  /** allowed values for an enum column */
  options: z.array(z.string()).default([]),
  note: z.string().default(""),
})

export const entitySchema = z.object({
  id: z.string(),
  /** table name — snake_case, unique in the project */
  key: z.string(),
  /** what a person calls it — "Orders" */
  name: z.string(),
  note: z.string().default(""),
  fields: z.array(entityFieldSchema).default([]),
  x: z.number().default(0),
  y: z.number().default(0),
})

export const relationKindValues = [
  "one-to-many",
  "many-to-one",
  "one-to-one",
  "many-to-many",
] as const

export const relationSchema = z.object({
  id: z.string(),
  /** entity id holding the foreign key (for many-to-many, either side) */
  from: z.string(),
  /** the column that holds it — "user_id" */
  fromField: z.string().default(""),
  /** entity id being pointed at */
  to: z.string(),
  /** the column being pointed at — normally the primary key */
  toField: z.string().default("id"),
  kind: z.enum(relationKindValues).default("many-to-one"),
  /** "an order belongs to a customer" */
  label: z.string().default(""),
  onDelete: z.enum(["cascade", "restrict", "set-null"]).default("restrict"),
  /** join table name, many-to-many only */
  through: z.string().default(""),
})

export const stackSchema = z.object({
  framework: z.string().default("next-16"),
  language: z.string().default("ts-strict"),
  styling: z.string().default("tailwind4-shadcn"),
  state: z.string().default("tanstack-zustand"),
  forms: z.string().default("rhf-zod"),
  http: z.string().default("axios-instance"),
  icons: z.string().default("lucide"),
  tables: z.string().default("tanstack-table"),
  charts: z.string().default("recharts"),
  testing: z.string().default("vitest"),
  tooling: z.string().default("biome-prettier"),
  packageManager: z.string().default("pnpm"),
  /**
   * The service half of the stack.
   *
   * Blank on a UI surface rather than absent: a screen has no database, and
   * defaulting these to Postgres would put a database into every web-only
   * brief that never asked for one. They are filled in only on the backend
   * surface, where the picker shows them.
   */
  database: z.string().default(""),
  orm: z.string().default(""),
  apiStyle: z.string().default(""),
  apiAuth: z.string().default(""),
  /** free-text additions the catalogue does not know about */
  extras: z.array(z.string()).default([]),
})

export const structureSchema = z.object({
  preset: z.string().default("feature-based"),
  customTree: z.string().default(""),
})

export const conventionsSchema = z.object({
  ids: z.array(z.string()).default([]),
  custom: z.string().default(""),
})

/** The stack and folder structure for one non-web surface. */
export const surfaceConfigSchema = z.object({
  stack: stackSchema.default({}),
  structure: structureSchema.default({}),
})

/**
 * A surface arrives pre-configured. Switching to Mobile and finding Next.js 16
 * and shadcn selected would mean correcting six dropdowns before the tab is
 * usable, and anyone who skipped that would generate a React Native prompt full
 * of web libraries.
 */
const mobileSurfaceDefaults = {
  stack: {
    framework: "expo-router",
    styling: "nativewind",
    state: "rn-query-zustand",
    icons: "rn-vector-icons",
    tables: "rn-flashlist",
    charts: "victory-native",
    testing: "rn-testing-library",
  },
  structure: { preset: "expo-feature-based" },
}

const backendSurfaceDefaults = {
  stack: {
    // A service has no UI, so the presentation choices are deliberately blank
    // rather than a web default nobody meant to pick.
    framework: "fastapi",
    language: "python",
    styling: "",
    forms: "",
    icons: "",
    tables: "",
    charts: "",
    state: "none-state-server",
    http: "none-http-server",
    testing: "pytest",
    tooling: "ruff-mypy",
    packageManager: "uv",
    // The service half, which the Backend tab had no way to express at all
    // until now: it blanked the presentation fields and offered nothing in
    // their place, so a backend brief named no server technology.
    database: "postgres",
    orm: "sqlalchemy",
    apiStyle: "rest-openapi",
    apiAuth: "jwt-refresh",
  },
  structure: { preset: "src-layered" },
}

/**
 * Where this project is deployed, and by what.
 *
 * `mcps` are servers the agent is expected to *use* during the build — it
 * provisions and deploys and reports URLs back. `iac` is the opposite: nothing
 * is provisioned, infrastructure is written down for the developer to run.
 * Both are meaningful together, so they are separate fields rather than one
 * choice.
 */
export const deploymentSchema = z.object({
  /** ids from features/deploy/data/targets.ts */
  mcps: z.array(z.string()).default([]),
  iac: z.string().default("none"),
  /** free text appended to the deployment block — domains, regions, accounts */
  notes: z.string().default(""),
})

export const projectDocSchema = z.object({
  name: z.string().default("Untitled project"),
  /**
   * Which builds this project ships.
   *
   * Named `builds` rather than `surfaces` because `surfaces` already means
   * something here — the per-surface stack and folder configuration below.
   * This is the shorter question: which of them are we shipping at all.
   *
   * Until now this was inferred from which screens happened to exist, which
   * cannot express "there is a backend" before anybody has drawn a service, and
   * cannot express intent at all: a project meant to ship a phone app looked
   * identical to one where somebody had tagged a screen `surface mobile` by
   * accident. Stated up front, it drives what the generated prompt asks for and
   * what the requirements prompt tells a model to write.
   *
   * Web defaults on because every existing project is a web project.
   */
  builds: z
    .object({
      web: z.boolean().default(true),
      mobile: z.boolean().default(false),
      backend: z.boolean().default(false),
    })
    .default({}),
  /**
   * Whether the build starts from the shared boilerplate repository or from an
   * empty folder.
   *
   * Defaults to "scratch" so no existing project changes shape underneath
   * anyone: a brief that has been handed to a developer must keep generating
   * what it generated yesterday.
   */
  startFrom: z.enum(["scratch", "boilerplate"]).default("boilerplate"),
  target: z.string().default("claude-code"),
  deployment: deploymentSchema.default({}),
  /**
   * Legacy 0–10 creative latitude. No longer written by the UI; kept so an
   * existing project can be migrated to `uiLevel` rather than silently reset
   * to the default. See `uiLevelOf`.
   */
  creativity: z.number().min(0).max(10).default(5),
  /**
   * How much visual and interaction ambition to build — 1 (literal) to 5
   * (signature). `null` means "never set on this document", which is how a
   * project written before this field existed is recognised and migrated from
   * `creativity`. Read it through `uiLevelOf`, never directly.
   */
  uiLevel: z.number().int().min(1).max(5).nullable().default(null),
  views: z.array(viewSchema).default([]),
  flows: z.array(flowSchema).default([]),
  screens: z.array(screenSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  modules: z.array(moduleSchema).default([]),
  moduleEdges: z.array(moduleEdgeSchema).default([]),
  sections: z.array(sectionSchema).default([]),
  /** the tables behind every build, and how they relate */
  entities: z.array(entitySchema).default([]),
  relations: z.array(relationSchema).default([]),
  theme: themeSchema.default({}),
  /**
   * `stack` and `structure` are the **web** surface's, kept at the top level so
   * every project written before surfaces existed still means what it said.
   * Mobile and backend carry their own under `surfaces`.
   */
  stack: stackSchema.default({}),
  structure: structureSchema.default({}),
  surfaces: z
    .object({
      mobile: surfaceConfigSchema.default(() =>
        surfaceConfigSchema.parse(mobileSurfaceDefaults)
      ),
      backend: surfaceConfigSchema.default(() =>
        surfaceConfigSchema.parse(backendSurfaceDefaults)
      ),
    })
    .default({}),
  conventions: conventionsSchema.default({}),
  requirements: z.string().default(""),
  snippetIds: z.array(z.string()).default([]),
})

export const snapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number(),
  doc: projectDocSchema,
  /**
   * Who saved it, by display name.
   *
   * Stored rather than looked up: a version outlives the session that made it,
   * and on a shared project the useful question months later is "who took this
   * snapshot", which no amount of current state can answer. Blank for versions
   * saved before this existed, and for anyone working signed out.
   */
  by: z.string().default(""),
  /**
   * What caused it. Every version used to be labelled "Generated for Claude
   * Code", so a list of them was twenty identical rows and choosing between
   * them meant opening each one.
   */
  kind: z.enum(["generated", "manual", "auto"]).default("manual"),
})

export const projectSchema = projectDocSchema.extend({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.number().default(SCHEMA_VERSION),
  versions: z.array(snapshotSchema).default([]),
})

/** what an exported `.json` file / share link carries */
export const projectFileSchema = z.object({
  kind: z.literal("prompt-studio/project"),
  schemaVersion: z.number(),
  exportedAt: z.number().optional(),
  project: projectSchema,
})

export type Theme = z.infer<typeof themeSchema>
export type Screen = z.infer<typeof screenSchema>
export type UserStory = z.infer<typeof userStorySchema>
export type FlowGroup = z.infer<typeof flowSchema>
export type FlowView = z.infer<typeof viewSchema>
export type FlowEdge = z.infer<typeof edgeSchema>
export type Entity = z.infer<typeof entitySchema>
export type EntityField = z.infer<typeof entityFieldSchema>
export type Relation = z.infer<typeof relationSchema>
export type RelationKind = (typeof relationKindValues)[number]
export type ScreenModule = z.infer<typeof moduleSchema>
export type ModuleEdge = z.infer<typeof moduleEdgeSchema>
export type Section = z.infer<typeof sectionSchema>
export type Stack = z.infer<typeof stackSchema>
export type Structure = z.infer<typeof structureSchema>
export type SurfaceConfig = z.infer<typeof surfaceConfigSchema>
export type Conventions = z.infer<typeof conventionsSchema>
export type ProjectDoc = z.infer<typeof projectDocSchema>
export type Snapshot = z.infer<typeof snapshotSchema>
export type Deployment = z.infer<typeof deploymentSchema>
export type Project = z.infer<typeof projectSchema>
export type ProjectFile = z.infer<typeof projectFileSchema>

export type StackProfile = {
  id: string
  name: string
  stack: Stack
  structure: Structure
  conventions: Conventions
}
