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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { Api, ApiError, type ProjectDetail } from "./api"
import { NOT_SIGNED_IN, resolveAuth } from "./auth"
import { applyFlow, checkFlow, newDoc, promptFor, readDoc, toFlow } from "./flow"
import { flowPathOf, readLinks, resolveLink, upsertLink } from "./link"
import { buildAuthoringPrompt } from "./studio/features/flow-lang/authoring-prompt"
import { SCHEMA_VERSION, surfaceValues } from "./studio/types/project"

const auth = resolveAuth()
const api = new Api(auth)

/** Kept in step with package.json by hand; it is two digits and it is shown to
 *  the user in `claude mcp list`. */
const VERSION = "1.0.0"

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

await server.connect(new StdioServerTransport())
