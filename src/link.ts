/**
 * The tie between a project in Prompt Studio and a `.flow` file in a repo.
 *
 * The point of this server is that the diagram stops being something you keep
 * in sync by hand. For that, a working copy needs to know which project it
 * belongs to — otherwise every tool call needs a project id pasted into it,
 * and the id is the one thing nobody remembers.
 *
 * So a repository gets a `.prompt-studio.json` at its root, holding the
 * mapping and the last version this checkout saw. That last part is what makes
 * a stale write detectable: if the project moved on since the file was pulled,
 * pushing it would land on top of somebody else's change, and the server
 * refuses instead.
 *
 * The file is small, readable and meant to be committed — it says which
 * project this repository describes, which is exactly the sort of thing a
 * README would otherwise say badly.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

export const LINK_FILE = ".prompt-studio.json"

export type ProjectLink = {
  projectId: string
  projectName: string
  /** Repo-relative path of the `.flow` file this project is written to. */
  flowFile: string
  /** `doc_version` at the last successful pull or push. */
  lastSyncedVersion: number
  lastSyncedAt: string
  apiUrl: string
}

export type LinkFile = {
  /** Keyed by project id, so one repository can describe several builds. */
  projects: Record<string, ProjectLink>
}

/**
 * Walk up from `start` looking for the link file.
 *
 * Upwards because Claude Code may be working in a subdirectory, and requiring
 * the tool to be called from the exact root would be a footgun with no upside.
 */
export function findLinkFile(start: string = process.cwd()): string | null {
  let dir = resolve(start)
  for (;;) {
    const candidate = join(dir, LINK_FILE)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function readLinks(start: string = process.cwd()): {
  path: string
  root: string
  links: LinkFile
} | null {
  const path = findLinkFile(start)
  if (!path) return null
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LinkFile>
    return {
      path,
      root: dirname(path),
      links: { projects: parsed.projects ?? {} },
    }
  } catch {
    // Hand-edited into invalid JSON. Treat it as absent rather than refusing
    // every tool call — `link_project` rewrites it.
    return { path, root: dirname(path), links: { projects: {} } }
  }
}

export function writeLinks(root: string, links: LinkFile): string {
  const path = join(root, LINK_FILE)
  writeFileSync(path, `${JSON.stringify(links, null, 2)}\n`)
  return path
}

export function upsertLink(root: string, link: ProjectLink): string {
  const existing = readLinks(root)
  const links = existing?.links ?? { projects: {} }
  links.projects[link.projectId] = link
  return writeLinks(existing?.root ?? root, links)
}

/** The link for one project, or the only link when there is exactly one. */
export function resolveLink(
  projectId: string | undefined,
  start: string = process.cwd()
): ProjectLink | null {
  const found = readLinks(start)
  if (!found) return null
  const all = Object.values(found.links.projects)
  if (projectId) return found.links.projects[projectId] ?? null
  // Only when it is unambiguous. Guessing between three linked projects is how
  // a journey ends up written into the wrong one.
  return all.length === 1 ? all[0] : null
}

/** Absolute path of a link's `.flow` file. */
export function flowPathOf(link: ProjectLink, root: string): string {
  return isAbsolute(link.flowFile) ? link.flowFile : join(root, link.flowFile)
}
