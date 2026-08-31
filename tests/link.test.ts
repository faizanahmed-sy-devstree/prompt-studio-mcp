import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  findLinkFile,
  flowPathOf,
  LINK_FILE,
  type ProjectLink,
  readLinks,
  resolveLink,
  upsertLink,
  writeLinks,
} from "../src/link"

/**
 * The tie between a repository and a project. Getting this wrong means writing
 * a journey into somebody else's diagram, so the interesting cases are all
 * about refusing to guess.
 */

let root: string

const link = (over: Partial<ProjectLink> = {}): ProjectLink => ({
  projectId: "proj-1",
  projectName: "Test",
  flowFile: "prompt-studio.flow",
  lastSyncedVersion: 3,
  lastSyncedAt: "2026-08-27T00:00:00.000Z",
  apiUrl: "",
  ...over,
})

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ps-link-"))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe("finding the link file", () => {
  it("finds nothing in an unlinked directory", () => {
    expect(findLinkFile(root)).toBeNull()
    expect(readLinks(root)).toBeNull()
    expect(resolveLink(undefined, root)).toBeNull()
  })

  it("finds it from a subdirectory", () => {
    // Claude may be working three folders down; requiring the repo root would
    // be a footgun with no upside.
    writeLinks(root, { projects: { "proj-1": link() } })
    const nested = join(root, "apps", "web", "src")
    mkdirSync(nested, { recursive: true })
    expect(findLinkFile(nested)).toBe(join(root, LINK_FILE))
    expect(resolveLink(undefined, nested)?.projectId).toBe("proj-1")
  })

  it("survives a hand-edited file that is no longer valid JSON", () => {
    writeFileSync(join(root, LINK_FILE), "{ oops")
    const found = readLinks(root)
    expect(found).not.toBeNull()
    expect(found?.links.projects).toEqual({})
  })
})

describe("resolving which project is meant", () => {
  it("uses the only link when a repository has one", () => {
    writeLinks(root, { projects: { "proj-1": link() } })
    expect(resolveLink(undefined, root)?.projectName).toBe("Test")
  })

  it("refuses to guess between several", () => {
    // Guessing here writes a billing journey into the mobile project.
    writeLinks(root, {
      projects: {
        "proj-1": link(),
        "proj-2": link({ projectId: "proj-2", projectName: "Other" }),
      },
    })
    expect(resolveLink(undefined, root)).toBeNull()
  })

  it("takes an explicit id even when several are linked", () => {
    writeLinks(root, {
      projects: {
        "proj-1": link(),
        "proj-2": link({ projectId: "proj-2", projectName: "Other" }),
      },
    })
    expect(resolveLink("proj-2", root)?.projectName).toBe("Other")
  })

  it("returns nothing for an id this repository does not link", () => {
    writeLinks(root, { projects: { "proj-1": link() } })
    expect(resolveLink("proj-9", root)).toBeNull()
  })
})

describe("keeping the link up to date", () => {
  it("adds a project without dropping the others", () => {
    upsertLink(root, link())
    upsertLink(root, link({ projectId: "proj-2", projectName: "Second" }))
    const found = readLinks(root)
    expect(Object.keys(found?.links.projects ?? {})).toEqual(["proj-1", "proj-2"])
  })

  it("updates the synced version in place rather than appending", () => {
    upsertLink(root, link())
    upsertLink(root, link({ lastSyncedVersion: 9 }))
    const found = readLinks(root)
    expect(Object.keys(found?.links.projects ?? {})).toHaveLength(1)
    expect(found?.links.projects["proj-1"].lastSyncedVersion).toBe(9)
  })

  it("writes something a person can read and commit", () => {
    upsertLink(root, link())
    const raw = readFileSync(join(root, LINK_FILE), "utf8")
    expect(raw).toContain("\n  ")
    expect(raw.endsWith("\n")).toBe(true)
    expect(JSON.parse(raw).projects["proj-1"].projectName).toBe("Test")
  })
})

describe("locating the flow file", () => {
  it("resolves a relative path against the repository root", () => {
    expect(flowPathOf(link(), root)).toBe(join(root, "prompt-studio.flow"))
  })

  it("leaves an absolute path alone", () => {
    const absolute = join(root, "elsewhere.flow")
    expect(flowPathOf(link({ flowFile: absolute }), root)).toBe(absolute)
  })

  it("handles a path in a subdirectory", () => {
    expect(flowPathOf(link({ flowFile: "docs/app.flow" }), root)).toBe(
      join(root, "docs/app.flow")
    )
  })
})
