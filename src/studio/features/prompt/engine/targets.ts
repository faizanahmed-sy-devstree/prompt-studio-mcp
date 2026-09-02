// Vendored from Prompt Studio (features/prompt/engine/targets.ts). Do not edit here — run `pnpm sync`.
/**
 * Blocks a single build's prompt is made of.
 *
 * `ProjectBlockId` below adds the ones that only exist when a project ships
 * more than one build — they are never in a target's `order`, because a target
 * describes how to lay out one app, and composing several is a different job.
 */
export type BlockId =
  | "overview"
  | "boilerplate"
  | "flows"
  | "data_model"
  | "screens"
  | "navigation"
  | "views"
  | "sections"
  | "design"
  | "tokens"
  | "ui_conventions"
  | "stack"
  | "structure"
  | "conventions"
  | "requirements"
  | "additional"
  | "security"
  | "delivery"
  | "deployment"

/** Blocks that only a multi-build project has. */
export type ProjectBlockId =
  | BlockId
  | "repository"
  | "integration"
  | "integration_tests"
  | "build_web"
  | "build_mobile"
  | "build_backend"

export type PromptTarget = {
  id: string
  name: string
  description: string
  /** how block titles are rendered */
  format: "markdown" | "xml"
  order: BlockId[]
  /** opening line, before the first block */
  preamble: (projectName: string) => string
  /** closing line, after the last block */
  closing: string
  /** v0 ships its own stack, so the stack block is trimmed there */
  stackDetail: "full" | "condensed"
  /**
   * Builders that only produce web apps. Choosing one for a mobile or backend
   * build is a mistake worth naming — their preambles literally promise a
   * responsive web app.
   */
  webOnly?: boolean
  fileExtension: string
}

export const promptTargets: PromptTarget[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Agentic build in an existing repo. Rules first, verbose.",
    format: "xml",
    order: [
      "overview",
      "boilerplate",
      "stack",
      "structure",
      "conventions",
      "flows",
      "data_model",
      "screens",
      "navigation",
      "views",
      "sections",
      "design",
      "tokens",
      "ui_conventions",
      "requirements",
      "additional",
      "security",
      "delivery",
      "deployment",
    ],
    preamble: (name) =>
      `You are building the frontend for **${name}**. Read every section below before writing code, then implement the whole thing — all screens, wired together, no placeholders and no TODOs.`,
    closing:
      "Work screen by screen in the navigation order given. After each screen, verify it typechecks and renders its loading, empty and error states before moving on.",
    stackDetail: "full",
    fileExtension: "md",
  },
  {
    id: "v0",
    name: "v0.dev",
    description: "Generative UI. Opinionated stack, visual detail wins.",
    format: "markdown",
    order: [
      "overview",
      "boilerplate",
      "flows",
      "data_model",
      "screens",
      "navigation",
      "views",
      "sections",
      "design",
      "tokens",
      "ui_conventions",
      "requirements",
      "structure",
      "additional",
      "security",
      "delivery",
      "deployment",
    ],
    preamble: (name) =>
      `Create ${name} — a modern, fully responsive web app using shadcn/ui and Tailwind CSS.`,
    closing:
      "Keep navigation, spacing and typography consistent across every screen so the result reads as one product.",
    stackDetail: "condensed",
    webOnly: true,
    fileExtension: "md",
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "In-editor agent. Structure and conventions up front.",
    format: "markdown",
    order: [
      "overview",
      "boilerplate",
      "stack",
      "structure",
      "conventions",
      "flows",
      "data_model",
      "screens",
      "navigation",
      "views",
      "sections",
      "design",
      "tokens",
      "ui_conventions",
      "requirements",
      "additional",
      "security",
      "delivery",
      "deployment",
    ],
    preamble: (name) =>
      `Implement the frontend for ${name} in this workspace, following the existing project conventions where they already exist.`,
    closing:
      "Create each file in the structure described above. Do not restructure existing folders.",
    stackDetail: "full",
    fileExtension: "md",
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "Full-app generation from a product brief.",
    format: "markdown",
    order: [
      "overview",
      "boilerplate",
      "flows",
      "data_model",
      "screens",
      "navigation",
      "views",
      "sections",
      "design",
      "tokens",
      "ui_conventions",
      "stack",
      "requirements",
      "additional",
      "security",
      "delivery",
      "deployment",
    ],
    preamble: (name) =>
      `Build ${name}: a complete, responsive web application described screen by screen below.`,
    closing:
      "Every screen listed must exist and be reachable through the navigation described.",
    stackDetail: "condensed",
    webOnly: true,
    fileExtension: "md",
  },
  {
    id: "generic",
    name: "Generic / any LLM",
    description: "Plain markdown brief with no tool-specific wording.",
    format: "markdown",
    order: [
      "overview",
      "boilerplate",
      "stack",
      "structure",
      "conventions",
      "flows",
      "data_model",
      "screens",
      "navigation",
      "views",
      "sections",
      "design",
      "tokens",
      "ui_conventions",
      "requirements",
      "additional",
      "security",
      "delivery",
      "deployment",
    ],
    preamble: (name) => `Frontend build brief — ${name}.`,
    closing: "Ask before inventing requirements that are not stated above.",
    stackDetail: "full",
    fileExtension: "md",
  },
]

export const targetMap = Object.fromEntries(
  promptTargets.map((t) => [t.id, t])
) as Record<string, PromptTarget>

export function getTarget(id: string): PromptTarget {
  return targetMap[id] ?? targetMap["claude-code"]
}
