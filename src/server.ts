/**
 * Prompt Studio, as an MCP server.
 *
 * The studio's whole point is that a diagram and a prompt are two views of one
 * document, and that the document has a text form — Flow — that a model can
 * read and write. That text form is the API this server exposes: Claude reads
 * the grammar, writes Flow, checks it, and folds it into a real project that
 * everyone else sees on the canvas a moment later.
 *
 * Four decisions worth stating, because all four are load-bearing:
 *
 * - **`check_flow` before `write_flow`.** Getting a grammar right costs
 *   iterations, and an iteration should not cost a write. The check needs no
 *   project and touches nothing.
 * - **Merge is the default.** A model asked to add a billing journey writes
 *   the billing journey, not the other eleven — so a write that replaced the
 *   document would delete the rest of the project every single time.
 * - **Every write snapshots first.** The version is taken before the change,
 *   labelled with what the change was about, so the history is a list of
 *   states you can actually return to rather than a list of times something
 *   happened.
 * - **Stale writes are refused, not merged.** The write sends the version it
 *   read as its base; if somebody saved in between it comes back as a conflict
 *   and says to read again. It never lands on top of their work.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { Api, ApiError } from "./api"
import { DEFAULT_API_URL, NOT_SIGNED_IN, resolveAuth } from "./auth"
import {
  collectWeaveArtifacts,
  progressSummary,
  rootsOf,
  sha256,
  writeBackDecisions,
} from "./discovery"
import { applyFlow, checkFlow, newDoc, promptFor, readDoc, toFlow } from "./flow"
import { flowPathOf, readLinks, resolveLink, upsertLink } from "./link"
import { buildAuthoringPrompt } from "./studio/features/flow-lang/authoring-prompt"
import { SCHEMA_VERSION, surfaceValues } from "./studio/types/project"

const auth = resolveAuth()
const api = new Api(auth)

/** Kept in step with package.json by hand; it is two digits and it is shown to
 *  the user in `claude mcp list`. */
const VERSION = "1.2.0"

const server = new McpServer({ name: "prompt-studio", version: VERSION })

/** Every tool answers in this shape; MCP has no error channel worth using. */
function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] }
}

/**
 * Turns a thrown error into something a model can act on.
 *
 * A 409 in particular is not a failure to report but an instruction to follow:
 * read the project again and reapply. Saying so is the difference between
 * Claude retrying correctly and Claude giving up.
 */
function failure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return NOT_SIGNED_IN
    if (error.status === 409) {
      return `${error.message}\n\nSomebody saved this project after you read it. Call read_project again, reapply your change to what comes back, and write once more.`
    }
    if (error.status === 403) {
      return `${error.message}\n\nYou have read access to this project but not write access. Ask an owner for editor access.`
    }
    if (error.status === 404) {
      return `${error.message}\n\nEither the project does not exist or your account was never added to it.`
    }
    return `${error.message} (HTTP ${error.status})`
  }
  return error instanceof Error ? error.message : String(error)
}

async function guard(run: () => Promise<string>): Promise<ReturnType<typeof text>> {
  try {
    return text(await run())
  } catch (error) {
    return text(failure(error))
  }
}

// ── the grammar ──────────────────────────────────────────────────────────────

server.registerTool(
  "flow_language_guide",
  {
    title: "Flow language guide",
    description:
      "The complete Flow grammar with worked examples. Read this before writing Flow for the first time in a session.",
    inputSchema: {},
  },
  async () => text(buildAuthoringPrompt())
)

// ── reading ──────────────────────────────────────────────────────────────────

server.registerTool(
  "list_projects",
  {
    title: "List projects",
    description: "Every Prompt Studio project this account can open.",
    inputSchema: {},
  },
  async () =>
    guard(async () => {
      const page = await api.listProjects()
      if (!page.items.length) {
        return "No projects yet. Use create_project to start one."
      }
      const rows = page.items.map(
        (p) =>
          `${p.id}  ${p.name}  (v${p.doc_version}, ${p.screen_count} screens, ${p.my_role ?? "member"})`
      )
      return `${page.items.length} project(s), as ${api.identity}:\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "read_project",
  {
    title: "Read a project as Flow",
    description:
      "The project's document as Flow source, plus the version number you must pass back when writing.",
    inputSchema: { project_id: z.string().describe("Project id from list_projects") },
  },
  async ({ project_id }) =>
    guard(async () => {
      const project = await api.getProject(project_id)
      return [
        `# ${project.name}`,
        `# version ${project.doc_version} — pass this as base_version when you write.`,
        "",
        toFlow(project.doc),
      ].join("\n")
    })
)

server.registerTool(
  "build_prompt",
  {
    title: "Build the prompt",
    description: "The build prompt this project generates, for one surface.",
    inputSchema: {
      project_id: z.string(),
      surface: z.enum(surfaceValues).default("web"),
    },
  },
  async ({ project_id, surface }) =>
    guard(async () => {
      const project = await api.getProject(project_id)
      return promptFor(project.doc, surface)
    })
)

// ── writing ──────────────────────────────────────────────────────────────────

server.registerTool(
  "check_flow",
  {
    title: "Check Flow source",
    description:
      "Parse Flow without touching a project. Free, and the right way to iterate on the grammar.",
    inputSchema: { source: z.string().describe("Flow source to parse") },
  },
  async ({ source }) => {
    const result = checkFlow(source)
    const lines = [result.ok ? `Parsed cleanly. ${result.summary}` : "Did not parse."]
    if (result.errors.length) lines.push("", "Errors:", ...result.errors.map((e) => `  ${e}`))
    if (result.warnings.length) {
      lines.push("", "Warnings (not failures):", ...result.warnings.map((w) => `  ${w}`))
    }
    return text(lines.join("\n"))
  }
)

server.registerTool(
  "write_flow",
  {
    title: "Write Flow into a project",
    description:
      "Fold Flow source into a project. Merges by default, snapshots a version first, and refuses rather than overwriting if somebody saved in between.",
    inputSchema: {
      project_id: z.string(),
      source: z.string().describe("Flow source to apply"),
      mode: z
        .enum(["merge", "replace"])
        .default("merge")
        .describe(
          "merge resolves by key and leaves untouched anything the source did not mention. replace makes the source the whole project."
        ),
      label: z
        .string()
        .default("")
        .describe("What this change is about. Becomes the label on the snapshot taken first."),
    },
  },
  async ({ project_id, source, mode, label }) =>
    guard(async () => {
      const project = await api.getProject(project_id)
      const current = readDoc(project.doc)
      const applied = applyFlow(current, source, mode)
      if (!applied.ok) {
        return `Refused — the source does not parse:\n\n${applied.issues.map((i) => `  ${i}`).join("\n")}`
      }

      // Before the write, never after: a snapshot taken afterwards records the
      // state you already have and loses the one you wanted back.
      const snapshotLabel = label.trim() || `Before ${mode} from Claude`
      let snapshot = ""
      try {
        const version = await api.saveVersion(project_id, snapshotLabel)
        snapshot = `Snapshot saved as "${version.label}" (v${version.doc_version}).`
      } catch (error) {
        // A history that could not be written is worth saying out loud, but it
        // is not a reason to refuse the edit the person asked for.
        snapshot = `Could not snapshot first (${failure(error)}). Writing anyway.`
      }

      const saved = await api.saveDocument(project_id, {
        doc: applied.doc,
        base_version: project.doc_version,
        schema_version: SCHEMA_VERSION,
      })
      syncLinkedFile(project_id, applied.doc, saved.doc_version)
      return [
        snapshot,
        `${applied.summary}`,
        `Saved as version ${saved.doc_version}. Anyone with the project open is seeing it now.`,
      ].join("\n")
    })
)

server.registerTool(
  "create_project",
  {
    title: "Create a project",
    description: "A new Prompt Studio project, optionally written from Flow source in one go.",
    inputSchema: {
      name: z.string(),
      description: z.string().default(""),
      source: z.string().default("").describe("Optional Flow source for the new project"),
    },
  },
  async ({ name, description, source }) =>
    guard(async () => {
      const built = newDoc(name, source || null)
      if (!built.ok) {
        return `Refused — the source does not parse:\n\n${built.issues.map((i) => `  ${i}`).join("\n")}`
      }
      const created = await api.createProject({
        name,
        description,
        doc: built.doc,
        schema_version: SCHEMA_VERSION,
      })
      return `Created "${created.name}" (${created.id}). ${built.summary}`
    })
)

// ── version history ──────────────────────────────────────────────────────────

server.registerTool(
  "list_versions",
  {
    title: "List version history",
    description: "Saved versions of a project, newest first.",
    inputSchema: { project_id: z.string() },
  },
  async ({ project_id }) =>
    guard(async () => {
      const page = await api.listVersions(project_id)
      if (!page.items.length) return "No versions saved yet."
      const rows = page.items.map(
        (v) =>
          `${v.id}  v${v.doc_version}  ${v.is_auto ? "[auto]" : "[manual]"}  ${v.created_at}  ${v.label || "(no label)"}`
      )
      return `${page.items.length} version(s):\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "save_version",
  {
    title: "Save a version",
    description: "Snapshot the project as it stands now, with a label.",
    inputSchema: {
      project_id: z.string(),
      label: z.string().describe("What this state is — 'before the billing rework', not 'v3'"),
    },
  },
  async ({ project_id, label }) =>
    guard(async () => {
      const version = await api.saveVersion(project_id, label)
      return `Saved "${version.label}" at document version ${version.doc_version}.`
    })
)

server.registerTool(
  "read_version",
  {
    title: "Read a past version as Flow",
    description:
      "One saved version's document as Flow source, so you can compare it with the project as it stands.",
    inputSchema: { project_id: z.string(), version_id: z.string() },
  },
  async ({ project_id, version_id }) =>
    guard(async () => {
      const version = await api.getVersion(project_id, version_id)
      return [
        `# ${version.label || "(no label)"} — document version ${version.doc_version}`,
        `# saved ${version.created_at}`,
        "",
        toFlow(version.doc),
      ].join("\n")
    })
)

server.registerTool(
  "restore_version",
  {
    title: "Restore a version",
    description:
      "Put the project back to a saved version. Snapshots the current state first, so the restore is itself undoable.",
    inputSchema: { project_id: z.string(), version_id: z.string() },
  },
  async ({ project_id, version_id }) =>
    guard(async () => {
      let snapshot = ""
      try {
        const before = await api.saveVersion(project_id, "Before restoring an earlier version")
        snapshot = `Current state saved as v${before.doc_version} first.`
      } catch (error) {
        snapshot = `Could not snapshot the current state (${failure(error)}). Restoring anyway.`
      }
      const restored = await api.restoreVersion(project_id, version_id)
      const project = await api.getProject(project_id)
      syncLinkedFile(project_id, readDoc(project.doc), restored.doc_version)
      return `${snapshot}\nRestored. The project is now at document version ${restored.doc_version}.`
    })
)

// ── the local .flow file ─────────────────────────────────────────────────────

server.registerTool(
  "link_project",
  {
    title: "Link a project to a .flow file",
    description:
      "Tie this repository to a Prompt Studio project and a .flow file inside it, so the file can be kept in step with the project. Writes .prompt-studio.json.",
    inputSchema: {
      project_id: z.string(),
      flow_file: z
        .string()
        .default("prompt-studio.flow")
        .describe("Path for the .flow file, relative to this repository"),
    },
  },
  async ({ project_id, flow_file }) =>
    guard(async () => {
      const project = await api.getProject(project_id)
      const existing = readLinks()
      const root = existing?.root ?? process.cwd()
      const source = toFlow(project.doc)
      const target = resolve(root, flow_file)
      // The path comes from a model, and `resolve` happily walks out of the
      // repository: `../../../escape.flow` wrote three levels up and then
      // persisted that path, so every later pull overwrote the same file again.
      const inside = target === root || target.startsWith(`${root}${sep}`)
      if (!inside) {
        return `The flow file has to live inside this repository. "${flow_file}" resolves to ${target}.`
      }
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, `${source}\n`)
      const path = upsertLink(root, {
        projectId: project.id,
        projectName: project.name,
        flowFile: relative(root, target) || flow_file,
        lastSyncedVersion: project.doc_version,
        lastSyncedAt: new Date().toISOString(),
        apiUrl: process.env.PROMPT_STUDIO_API_URL ?? "",
      })
      return [
        `Linked "${project.name}" to ${relative(root, target)}.`,
        `Wrote the current document (version ${project.doc_version}) to that file, and recorded the link in ${relative(root, path)}.`,
        "Commit both — the .flow file is the diagram in a form your repository can review.",
      ].join("\n")
    })
)

server.registerTool(
  "pull_flow",
  {
    title: "Pull the project into the linked file",
    description:
      "Overwrite the linked .flow file with the project as it stands in Prompt Studio.",
    inputSchema: {
      project_id: z.string().default("").describe("Omit when the repository links one project"),
    },
  },
  async ({ project_id }) =>
    guard(async () => {
      const link = resolveLink(project_id || undefined)
      if (!link) return NO_LINK
      const found = readLinks()
      const root = found?.root ?? process.cwd()
      const project = await api.getProject(link.projectId)
      const path = flowPathOf(link, root)
      writeFileSync(path, `${toFlow(project.doc)}\n`)
      upsertLink(root, {
        ...link,
        lastSyncedVersion: project.doc_version,
        lastSyncedAt: new Date().toISOString(),
      })
      return `Pulled "${project.name}" (version ${project.doc_version}) into ${relative(root, path)}.`
    })
)

server.registerTool(
  "push_flow",
  {
    title: "Push the linked file into the project",
    description:
      "Send the linked .flow file to Prompt Studio. Snapshots first, and refuses if the project moved on since the file was pulled.",
    inputSchema: {
      project_id: z.string().default("").describe("Omit when the repository links one project"),
      // `merge` for the same reason `write_flow` uses it: `replace` rebuilds the
      // document from the file, which mints new ids for every screen, module
      // and edge. Comments are anchored to those ids, so one push that changed
      // nothing orphaned every pinned comment on the project.
      mode: z.enum(["merge", "replace"]).default("merge"),
      label: z.string().default(""),
    },
  },
  async ({ project_id, mode, label }) =>
    guard(async () => {
      const link = resolveLink(project_id || undefined)
      if (!link) return NO_LINK
      const found = readLinks()
      const root = found?.root ?? process.cwd()
      const path = flowPathOf(link, root)
      const source = readFileSync(path, "utf8")

      const project = await api.getProject(link.projectId)
      if (project.doc_version !== link.lastSyncedVersion) {
        return [
          `Refused. ${relative(root, path)} was pulled at version ${link.lastSyncedVersion}, and the project is now at version ${project.doc_version}.`,
          "",
          "Somebody changed it in the studio since. Run pull_flow to bring the file up to date — commit or stash your edits first — then reapply and push.",
        ].join("\n")
      }

      const applied = applyFlow(readDoc(project.doc), source, mode)
      if (!applied.ok) {
        return `Refused — ${relative(root, path)} does not parse:\n\n${applied.issues.map((i) => `  ${i}`).join("\n")}`
      }
      let snapshot = ""
      try {
        const version = await api.saveVersion(
          link.projectId,
          label.trim() || `Before pushing ${relative(root, path)}`
        )
        snapshot = `Snapshot saved as "${version.label}".`
      } catch (error) {
        snapshot = `Could not snapshot first (${failure(error)}). Pushing anyway.`
      }
      const saved = await api.saveDocument(link.projectId, {
        doc: applied.doc,
        base_version: project.doc_version,
        schema_version: SCHEMA_VERSION,
      })
      upsertLink(root, {
        ...link,
        lastSyncedVersion: saved.doc_version,
        lastSyncedAt: new Date().toISOString(),
      })
      return [snapshot, applied.summary, `Pushed. Project is now at version ${saved.doc_version}.`].join("\n")
    })
)

server.registerTool(
  "sync_status",
  {
    title: "Sync status",
    description:
      "Whether the linked .flow file matches the project, and which way it has drifted.",
    inputSchema: {
      project_id: z.string().default(""),
    },
  },
  async ({ project_id }) =>
    guard(async () => {
      const found = readLinks()
      if (!found || !Object.keys(found.links.projects).length) return NO_LINK
      const links = project_id
        ? [found.links.projects[project_id]].filter(Boolean)
        : Object.values(found.links.projects)
      const lines: string[] = []
      for (const link of links) {
        const project = await api.getProject(link.projectId)
        const path = flowPathOf(link, found.root)
        let fileMatches = false
        try {
          fileMatches = readFileSync(path, "utf8").trim() === toFlow(project.doc).trim()
        } catch {
          lines.push(`${link.projectName}: ${relative(found.root, path)} is missing. Run pull_flow.`)
          continue
        }
        const behind = project.doc_version !== link.lastSyncedVersion
        lines.push(
          fileMatches && !behind
            ? `${link.projectName}: in sync at version ${project.doc_version}.`
            : behind
              ? `${link.projectName}: the studio moved on (file pulled at v${link.lastSyncedVersion}, project at v${project.doc_version}). Run pull_flow.`
              : `${link.projectName}: the file has local edits not yet pushed. Run push_flow.`
        )
      }
      return lines.join("\n")
    })
)

const NO_LINK = [
  "This repository is not linked to a Prompt Studio project.",
  "",
  "Call link_project with a project id from list_projects. It writes .prompt-studio.json",
  "and drops the project's Flow source into a file you can commit.",
].join("\n")

/**
 * Keep the linked file honest after a write that went through a tool other
 * than `push_flow`.
 *
 * Without this the file on disk silently becomes the stale copy the moment
 * Claude uses `write_flow`, which is the failure this whole feature exists to
 * prevent.
 */
function syncLinkedFile(projectId: string, doc: unknown, version: number): void {
  try {
    const found = readLinks()
    if (!found) return
    const link = found.links.projects[projectId]
    if (!link) return
    const path = flowPathOf(link, found.root)
    writeFileSync(path, `${toFlow(doc)}\n`)
    upsertLink(found.root, {
      ...link,
      lastSyncedVersion: version,
      lastSyncedAt: new Date().toISOString(),
    })
  } catch {
    // A read-only checkout, or no link at all. The write to the studio already
    // succeeded and that is the thing that mattered.
  }
}

// ── discovery: the studio as the place decisions get made ────────────────────

/**
 * Which project a discovery tool is about.
 *
 * Same order as everywhere else — what the call said, then what the repository
 * says, then an error that names the fix rather than the failure.
 */
function projectFor(explicit: string): string {
  const given = explicit.trim()
  if (given) return given
  const link = resolveLink(undefined)
  if (link) return link.projectId
  throw new Error(NO_LINK)
}

/** The repository root, or the working directory when nothing is linked. */
function repoRoot(dir: string): string {
  if (dir.trim()) return resolve(dir.trim())
  return readLinks()?.root ?? process.cwd()
}

const RUN_ID_FILE = "weave/discovery/.run-id"

function runIdFor(explicit: string, root: string): string {
  const given = explicit.trim()
  if (given) return given
  const path = join(root, RUN_ID_FILE)
  const stored = existsSync(path) ? readFileSync(path, "utf8").trim() : ""
  if (stored) return stored
  throw new Error(
    `No run id. Pass run_id, or run discovery_push_run first — it writes ${RUN_ID_FILE}.`
  )
}

/**
 * Where a person goes to answer the questions.
 *
 * The studio is a separate deployment from the API, and only the API URL is
 * configured — so the app URL is guessed from it (the backend host without its
 * `-backend`) and `PROMPT_STUDIO_APP_URL` overrides the guess.
 */
function studioUrl(projectId: string): string {
  const configured = process.env.PROMPT_STUDIO_APP_URL?.replace(/\/+$/, "")
  const base = configured || guessAppUrl()
  return `${base}/discovery?p=${encodeURIComponent(projectId)}`
}

function guessAppUrl(): string {
  const api = (process.env.PROMPT_STUDIO_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "")
  try {
    const url = new URL(api)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "http://localhost:3000"
    url.hostname = url.hostname.replace("-backend.", ".")
    url.port = ""
    return url.origin
  } catch {
    return api
  }
}

server.registerTool(
  "discovery_push_run",
  {
    title: "Push a discovery run",
    description:
      "Send weave/discovery/questions.json to Prompt Studio as a run of questions, and record the run id in weave/discovery/.run-id. Returns the URL a person answers them at.",
    inputSchema: {
      questions_path: z
        .string()
        .default("weave/discovery/questions.json")
        .describe("Path to the questions file, relative to the repository root"),
      project_id: z.string().default("").describe("Omit when the repository links one project"),
      dir: z.string().default("").describe("Repository root. Omit for the linked one."),
    },
  },
  async ({ questions_path, project_id, dir }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const root = repoRoot(dir)
      const path = resolve(root, questions_path)
      if (!existsSync(path)) return `No questions file at ${path}.`
      let parsed: { label?: string; source?: string; items?: unknown[] }
      try {
        parsed = JSON.parse(readFileSync(path, "utf8"))
      } catch (error) {
        // Weaver writes this file; a broken one is a weaver bug, and the
        // message has to say which file so it can be looked at.
        return `${relative(root, path)} is not valid JSON: ${(error as Error).message}`
      }
      const items = parsed.items ?? []
      if (!items.length) return `${relative(root, path)} carries no items.`
      const run = await api.createRun(project, {
        label: parsed.label ?? "discovery",
        source: parsed.source ?? "weaver",
        items: items as never,
      })
      const idFile = join(root, RUN_ID_FILE)
      mkdirSync(dirname(idFile), { recursive: true })
      writeFileSync(idFile, `${run.id}\n`)
      return [
        `Pushed ${items.length} question(s) as run ${run.id}.`,
        `Recorded in ${RUN_ID_FILE}.`,
        "",
        `Answer them here: ${studioUrl(project)}`,
      ].join("\n")
    })
)

server.registerTool(
  "discovery_push_docs",
  {
    title: "Push the weave folder",
    description:
      "Upload every artifact under weave/ to the project — the knowledge base, issues, features, schema and journey diagrams — skipping any file the studio already has unchanged. If weave/schema.flow exists it is also merged into the project document, so the schema appears on the Data canvas.",
    inputSchema: {
      dir: z.string().default("").describe("Repository root. Omit for the linked one."),
      project_id: z.string().default(""),
    },
  },
  async ({ dir, project_id }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const root = repoRoot(dir)
      const artifacts = collectWeaveArtifacts(root)
      if (!artifacts.length) return `Nothing to push — no artifacts under ${join(root, "weave")}.`

      // The list route carries a sha and no bodies, which is the whole reason
      // to ask for it: a re-push of 40 unchanged files is 40 writes, 40 audit
      // rows and 40 "artifact saved" events nobody wanted.
      const known = new Map<string, string>()
      try {
        for (const summary of await api.listArtifacts(project)) {
          if (summary.sha) known.set(summary.name, summary.sha)
        }
      } catch {
        // A project with no artifacts yet, or an older backend. Push everything.
      }

      const pushed: string[] = []
      let unchanged = 0
      for (const artifact of artifacts) {
        if (known.get(artifact.name) === sha256(artifact.body)) {
          unchanged += 1
          continue
        }
        await api.putArtifact(project, artifact.name, {
          kind: artifact.kind,
          body: artifact.body,
        })
        pushed.push(artifact.name)
      }

      const lines = [
        pushed.length
          ? `Pushed ${pushed.length} artifact(s): ${pushed.join(", ")}.`
          : "Every artifact was already up to date.",
      ]
      if (unchanged) lines.push(`${unchanged} unchanged.`)

      const schemaPath = join(root, "weave", "schema.flow")
      if (existsSync(schemaPath)) {
        lines.push("", await mergeSchemaFlow(project, readFileSync(schemaPath, "utf8")))
      }
      return lines.join("\n")
    })
)

/**
 * Fold `weave/schema.flow` into the project document.
 *
 * The point of the whole exercise: the tables weaver derived have to reach the
 * Data canvas, and the canvas reads `entities`/`relations` on the document, not
 * an artifact. Merge, never replace — the schema is one block of a document
 * that also holds screens, journeys and a design.
 */
async function mergeSchemaFlow(project: string, source: string): Promise<string> {
  const detail = await api.getProject(project)
  const current = readDoc(detail.doc)
  const applied = applyFlow(current, source, "merge")
  if (!applied.ok) {
    return `weave/schema.flow did not parse, so the schema was not merged:\n${applied.issues
      .map((issue) => `  ${issue}`)
      .join("\n")}`
  }
  // A push that changes nothing must not write: this tool is called after
  // every weaver step, and a save each time would bury the real history under
  // a stack of identical "weaver apply" snapshots.
  if (JSON.stringify(applied.doc) === JSON.stringify(current)) {
    return "weave/schema.flow is already on the Data canvas, unchanged."
  }
  let snapshot = ""
  try {
    const version = await api.saveVersion(project, "weaver apply")
    snapshot = `Snapshot saved as "${version.label}". `
  } catch (error) {
    snapshot = `Could not snapshot first (${failure(error)}). Merging anyway. `
  }
  const saved = await api.saveDocument(project, {
    doc: applied.doc,
    base_version: detail.doc_version,
    schema_version: SCHEMA_VERSION,
  })
  syncLinkedFile(project, applied.doc, saved.doc_version)
  return `${snapshot}Merged weave/schema.flow: ${applied.summary} Project is now at version ${saved.doc_version}.`
}

server.registerTool(
  "discovery_status",
  {
    title: "Discovery progress",
    description:
      "How far through the questions the run is — answered per module, which root questions are still open, and whether it is done.",
    inputSchema: {
      run_id: z.string().default("").describe("Omit to use weave/discovery/.run-id"),
      project_id: z.string().default(""),
      dir: z.string().default(""),
    },
  },
  async ({ run_id, project_id, dir }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const runId = runIdFor(run_id, repoRoot(dir))
      const run = await api.getRun(project, runId)
      const open = rootsOf(await api.listItems(project, runId, { unanswered: true }))
      return `${progressSummary(run, open)}\n\n${studioUrl(project)}`
    })
)

server.registerTool(
  "discovery_wait",
  {
    title: "Wait for the questions to be answered",
    description:
      "Poll the run every 15 seconds until it is done or the timeout runs out, then report where it got to. Call it again to keep waiting — a person answering 40 questions takes longer than one call.",
    inputSchema: {
      run_id: z.string().default(""),
      project_id: z.string().default(""),
      dir: z.string().default(""),
      timeout_seconds: z
        .number()
        .int()
        .min(15)
        .max(300)
        .default(300)
        .describe("At most 300 — a longer wait belongs in a second call"),
    },
  },
  async ({ run_id, project_id, dir, timeout_seconds }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const runId = runIdFor(run_id, repoRoot(dir))
      const deadline = Date.now() + Math.min(timeout_seconds, 300) * 1000
      for (;;) {
        const run = await api.getRun(project, runId)
        if (run.done) {
          return `Done.\n\n${progressSummary(run)}\n\nRun discovery_writeback next.`
        }
        if (Date.now() >= deadline) {
          const open = rootsOf(await api.listItems(project, runId, { unanswered: true }))
          return [
            "Still going.",
            "",
            progressSummary(run, open),
            "",
            `Answer them here: ${studioUrl(project)}`,
            "Call discovery_wait again to keep waiting.",
          ].join("\n")
        }
        await new Promise((done) => setTimeout(done, 15_000))
      }
    })
)

server.registerTool(
  "discovery_list_items",
  {
    title: "List discovery questions",
    description: "The questions in a run, with whatever has been answered so far.",
    inputSchema: {
      run_id: z.string().default(""),
      project_id: z.string().default(""),
      dir: z.string().default(""),
      module: z.string().default("").describe("Only this module"),
      family: z.string().default("").describe("RULE, QUESTION, ISSUE, …"),
      needs_user: z.boolean().optional().describe("Only the ones a person has to decide"),
      unanswered: z.boolean().optional(),
    },
  },
  async ({ run_id, project_id, dir, module, family, needs_user, unanswered }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const runId = runIdFor(run_id, repoRoot(dir))
      const items = await api.listItems(project, runId, {
        module: module || undefined,
        family: family || undefined,
        needs_user,
        unanswered,
      })
      if (!items.length) return "No questions match."
      const rows = items.map((item) => {
        const answered = item.answer ? `→ ${item.answer.decision}` : "PENDING"
        const tags = (item.modules ?? []).join("/") || "—"
        return `${item.key}  [${item.family}${item.needs_user ? " needs-user" : ""}]  ${tags}  ${item.title}\n    ${answered}`
      })
      return `${items.length} question(s):\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "discovery_answer",
  {
    title: "Answer one question",
    description:
      "Record a decision against one question, by its key — for a decision you proposed and the user approved, or one they dictated.",
    inputSchema: {
      key: z.string().describe("The question's key, e.g. I-014 or Q3"),
      decision: z.string().describe("The decision in gate grammar — resolve: …, waive: …, confirm, drop"),
      choice_key: z.string().default("").describe("The option key this decision came from, if any"),
      note: z.string().default(""),
      run_id: z.string().default(""),
      project_id: z.string().default(""),
      dir: z.string().default(""),
    },
  },
  async ({ key, decision, choice_key, note, run_id, project_id, dir }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const runId = runIdFor(run_id, repoRoot(dir))
      const item = (await api.listItems(project, runId)).find((candidate) => candidate.key === key)
      if (!item) return `No question keyed ${key} in run ${runId}.`
      await api.answerItem(project, runId, item.id, {
        decision,
        choice_key: choice_key || undefined,
        note: note || undefined,
      })
      return `${key} answered: ${decision}`
    })
)

server.registerTool(
  "discovery_accept_defaults",
  {
    title: "Accept proposed answers",
    description:
      "Accept the proposed decision on many questions at once — named keys, one module, or every standing rule.",
    inputSchema: {
      keys: z.array(z.string()).default([]),
      module: z.string().default(""),
      all_rules: z.boolean().default(false).describe("Every RULE-family item"),
      run_id: z.string().default(""),
      project_id: z.string().default(""),
      dir: z.string().default(""),
    },
  },
  async ({ keys, module, all_rules, run_id, project_id, dir }) =>
    guard(async () => {
      if (!keys.length && !module && !all_rules) {
        return "Say which ones: keys, module, or all_rules."
      }
      const project = projectFor(project_id)
      const runId = runIdFor(run_id, repoRoot(dir))
      const all = await api.listItems(project, runId)
      const wanted = new Set(keys)
      const chosen = all.filter(
        (item) =>
          !item.answer &&
          (wanted.has(item.key) ||
            (module && (item.modules ?? []).includes(module)) ||
            (all_rules && item.family === "RULE"))
      )
      if (!chosen.length) return "Nothing to accept — those are answered already, or match nothing."
      const result = await api.acceptDefaults(
        project,
        runId,
        chosen.map((item) => item.id)
      )
      const skipped = result.skipped?.length
        ? ` ${result.skipped.length} skipped (no proposed answer to accept).`
        : ""
      return `Accepted ${result.accepted} proposed answer(s).${skipped}`
    })
)

server.registerTool(
  "discovery_answers",
  {
    title: "Read the decisions",
    description: "Every decision recorded against a run.",
    inputSchema: {
      run_id: z.string().default(""),
      project_id: z.string().default(""),
      dir: z.string().default(""),
    },
  },
  async ({ run_id, project_id, dir }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const runId = runIdFor(run_id, repoRoot(dir))
      const answers = await api.listAnswers(project, runId)
      if (!answers.length) return "Nothing answered yet."
      const rows = answers.map(
        (answer) =>
          `${answer.key}  [${answer.family}]  ${answer.decision}${answer.note ? `\n    note: ${answer.note}` : ""}`
      )
      return `${answers.length} decision(s):\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "discovery_writeback",
  {
    title: "Write the decisions back into weave/",
    description:
      "Fold every recorded decision into weave/discovery/issues.md and features.md, push the rewritten files back, and report how many PENDING rows are left. The gate before weave-author needs that to be zero.",
    inputSchema: {
      run_id: z.string().default(""),
      project_id: z.string().default(""),
      dir: z.string().default("").describe("Repository root. Omit for the linked one."),
    },
  },
  async ({ run_id, project_id, dir }) =>
    guard(async () => {
      const project = projectFor(project_id)
      const root = repoRoot(dir)
      const runId = runIdFor(run_id, root)
      const answers = await api.listAnswers(project, runId)
      if (!answers.length) return "Nothing to write back — no decisions recorded yet."
      const report = writeBackDecisions(root, answers)

      for (const name of report.changed) {
        const body = readFileSync(join(root, "weave", name), "utf8")
        await api.putArtifact(project, name, { kind: "md", body })
      }

      const lines = [
        `Wrote back ${report.issues} issue decision(s) and ${report.implied} feature decision(s).`,
        report.changed.length
          ? `Re-pushed ${report.changed.join(", ")}.`
          : "Nothing on disk needed changing.",
      ]
      if (report.unmatched.length) {
        lines.push(
          `${report.unmatched.length} decision(s) matched no row in either file: ${report.unmatched.join(", ")}.`
        )
      }
      lines.push(
        report.remainingPending === 0
          ? "0 PENDING left. The gate is clear — commit weave/ and run weave-author."
          : `${report.remainingPending} PENDING still left. Answer those before weave-author runs.`
      )
      return lines.join("\n")
    })
)

// ── artifacts ────────────────────────────────────────────────────────────────

server.registerTool(
  "artifact_list",
  {
    title: "List studio artifacts",
    description: "Every file the project holds — names, kinds and sizes, no bodies.",
    inputSchema: { project_id: z.string().default("") },
  },
  async ({ project_id }) =>
    guard(async () => {
      const artifacts = await api.listArtifacts(projectFor(project_id))
      if (!artifacts.length) return "No artifacts yet. Run discovery_push_docs."
      const rows = artifacts.map(
        (artifact) => `${artifact.name}  [${artifact.kind}]  ${artifact.updated_at}`
      )
      return `${artifacts.length} artifact(s):\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "artifact_read",
  {
    title: "Read a studio artifact",
    description: "One artifact's body, by name — 'discovery/issues.md', 'schema.dbml'.",
    inputSchema: {
      name: z.string().describe("Artifact name including its folder"),
      project_id: z.string().default(""),
    },
  },
  async ({ name, project_id }) =>
    guard(async () => {
      const artifact = await api.getArtifact(projectFor(project_id), name)
      return `# ${artifact.name} [${artifact.kind}]\n\n${artifact.body}`
    })
)

server.registerTool(
  "artifact_write",
  {
    title: "Write a studio artifact",
    description: "Upsert one artifact by name. Use discovery_push_docs for the whole weave/ folder.",
    inputSchema: {
      name: z.string(),
      kind: z
        .enum(["md", "dbml", "mermaid", "weave", "json", "flow"])
        .default("md"),
      body: z.string(),
      project_id: z.string().default(""),
    },
  },
  async ({ name, kind, body, project_id }) =>
    guard(async () => {
      const saved = await api.putArtifact(projectFor(project_id), name, { kind, body })
      return `Saved ${saved.name} (${body.length} bytes).`
    })
)

// ── people, notes, history ───────────────────────────────────────────────────

server.registerTool(
  "list_members",
  {
    title: "List project members",
    description: "Who can open this project, and with what standing.",
    inputSchema: { project_id: z.string().default("") },
  },
  async ({ project_id }) =>
    guard(async () => {
      const members = await api.listMembers(projectFor(project_id))
      const rows = members.map(
        (member) => `${member.email}  ${member.role}  ${member.status}  ${member.id}`
      )
      return rows.length ? `${members.length} member(s):\n\n${rows.join("\n")}` : "No members."
    })
)

server.registerTool(
  "add_member",
  {
    title: "Share the project",
    description:
      "Invite one email address onto the project. The address does not need an account yet — the invitation waits for it.",
    inputSchema: {
      email: z.string(),
      role: z.enum(["OWNER", "EDITOR", "COMMENTER", "VIEWER"]).default("EDITOR"),
      project_id: z.string().default(""),
    },
  },
  async ({ email, role, project_id }) =>
    guard(async () => {
      const member = await api.addMember(projectFor(project_id), { email, role })
      return `Invited ${member.email} as ${member.role} (${member.status}).`
    })
)

server.registerTool(
  "list_comments",
  {
    title: "List comments",
    description: "Review notes left on the project.",
    inputSchema: {
      project_id: z.string().default(""),
      include_resolved: z.boolean().default(false),
    },
  },
  async ({ project_id, include_resolved }) =>
    guard(async () => {
      const comments = await api.listComments(projectFor(project_id), include_resolved)
      if (!comments.length) return "No comments."
      const rows = comments.map(
        (comment) =>
          `${comment.id}  ${comment.target_kind}${comment.target_key ? `:${comment.target_key}` : ""}  ${comment.author_email}${comment.resolved_at ? "  [resolved]" : ""}\n    ${comment.body}`
      )
      return `${comments.length} comment(s):\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "add_comment",
  {
    title: "Leave a comment",
    description: "Pin a review note to the canvas, a screen, a module or an edge.",
    inputSchema: {
      body: z.string(),
      target_kind: z.enum(["canvas", "screen", "module", "edge"]).default("canvas"),
      target_key: z.string().default(""),
      project_id: z.string().default(""),
    },
  },
  async ({ body, target_kind, target_key, project_id }) =>
    guard(async () => {
      const comment = await api.addComment(projectFor(project_id), {
        body,
        target_kind,
        target_key,
      })
      return `Left a comment on ${comment.target_kind}${comment.target_key ? `:${comment.target_key}` : ""} (${comment.id}).`
    })
)

server.registerTool(
  "resolve_comment",
  {
    title: "Resolve a comment",
    description: "Mark one comment thread resolved.",
    inputSchema: { comment_id: z.string(), project_id: z.string().default("") },
  },
  async ({ comment_id, project_id }) =>
    guard(async () => {
      const comment = await api.resolveComment(projectFor(project_id), comment_id)
      return `Resolved ${comment.id}.`
    })
)

server.registerTool(
  "list_activity",
  {
    title: "Project activity",
    description: "What changed on this project, newest first.",
    inputSchema: { project_id: z.string().default("") },
  },
  async ({ project_id }) =>
    guard(async () => {
      const page = await api.listActivity(projectFor(project_id))
      if (!page.items.length) return "Nothing has happened yet."
      const rows = page.items.map(
        (entry) => `${entry.created_at}  ${entry.actor_email || "—"}  ${entry.summary}`
      )
      return `${page.items.length} of ${page.total} event(s):\n\n${rows.join("\n")}`
    })
)

// ── personal access tokens ───────────────────────────────────────────────────

server.registerTool(
  "create_api_token",
  {
    title: "Create an API token",
    description:
      "Mint a personal API token for CI or `weaver push` — set it as STUDIO_TOKEN. Shown once and never again.",
    inputSchema: { name: z.string().describe("What it is for — 'weaver push on CI'") },
  },
  async ({ name }) =>
    guard(async () => {
      const token = await api.createApiToken(name)
      return [
        `Created "${token.name}" (${token.id}).`,
        "",
        token.token ?? "(the API returned no token value)",
        "",
        "Copy it now — it is not stored in a form anybody can read back.",
        "Use it as STUDIO_TOKEN, or as a bearer token against /api/v1.",
      ].join("\n")
    })
)

server.registerTool(
  "list_api_tokens",
  {
    title: "List API tokens",
    description: "The personal API tokens on this account.",
    inputSchema: {},
  },
  async () =>
    guard(async () => {
      const tokens = await api.listApiTokens()
      if (!tokens.length) return "No API tokens."
      const rows = tokens.map(
        (token) =>
          `${token.id}  ${token.name}  created ${token.created_at}${token.revoked_at ? "  [revoked]" : ""}`
      )
      return `${tokens.length} token(s):\n\n${rows.join("\n")}`
    })
)

server.registerTool(
  "revoke_api_token",
  {
    title: "Revoke an API token",
    description: "Retire one token. Anything using it stops working immediately.",
    inputSchema: { token_id: z.string() },
  },
  async ({ token_id }) =>
    guard(async () => {
      await api.revokeApiToken(token_id)
      return `Revoked ${token_id}. Anything using it has stopped working.`
    })
)

await server.connect(new StdioServerTransport())
