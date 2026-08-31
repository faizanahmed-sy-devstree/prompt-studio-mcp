import { describe, expect, it } from "vitest"

import { applyFlow, checkFlow, newDoc, promptFor, readDoc, toFlow } from "../src/flow"

/**
 * The behaviour a model depends on. All of it is pure — no transport, no
 * network — which is the reason it can be asserted directly.
 */

const SOURCE = `app "Test" {
  builds web
}

flow signup "Signing up" {
  as a visitor
  I want to create an account
  so that I can save my work
}

screen login "Sign in" {
  flows signup
}
screen home "Home"

flow { login -> home : "on success" }
`

describe("reading a document", () => {
  it("turns a stored document into Flow", () => {
    const doc = newDoc("Test", SOURCE)
    expect(doc.ok).toBe(true)
    if (!doc.ok) return
    const source = toFlow(doc.doc)
    expect(source).toContain('screen login "Sign in"')
    expect(source).toContain("home")
  })

  it("fills defaults rather than refusing an older document", () => {
    // The whole point: a project stored before a field existed must still open.
    const doc = readDoc({ name: "Old", screens: [{ id: "s1", key: "a", title: "A" }] })
    expect(doc.name).toBe("Old")
    expect(doc.screens).toHaveLength(1)
    expect(doc.entities).toEqual([])
  })

  it("says so, rather than throwing something unreadable, on a document it cannot parse", () => {
    expect(() => readDoc({ screens: "not an array" })).toThrow(/could not be read/i)
  })
})

describe("checking Flow before writing it", () => {
  it("accepts valid source and describes what it found", () => {
    const result = checkFlow(SOURCE)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.summary).toContain("screens")
  })

  it("reports an error with its line number", () => {
    const result = checkFlow(`app "Broken" {\n  builds nonsense\n}`)
    expect(result.errors.concat(result.warnings).join(" ")).toMatch(/line \d+/)
  })

  it("treats an unknown layout as a warning, not a failure", () => {
    // A warning must not read as a refusal: the screen is still produced.
    const result = checkFlow(`screen a "A" {\n  layout not_a_real_layout\n}`)
    expect(result.ok).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("touches nothing — the same source checks the same way twice", () => {
    expect(checkFlow(SOURCE)).toEqual(checkFlow(SOURCE))
  })
})

describe("folding Flow into a project", () => {
  const base = () => {
    const made = newDoc("Base", SOURCE)
    if (!made.ok) throw new Error("fixture did not parse")
    return made.doc
  }

  it("merges by default, keeping what the source did not mention", () => {
    const result = applyFlow(base(), `screen billing "Billing"`, "merge")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const keys = result.doc.screens.map((s) => s.key)
    // The one added, and the two it was never told about.
    expect(keys).toContain("billing")
    expect(keys).toContain("login")
    expect(keys).toContain("home")
  })

  it("replaces only when replace is asked for by name", () => {
    const result = applyFlow(base(), `screen billing "Billing"`, "replace")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.screens.map((s) => s.key)).toEqual(["billing"])
  })

  it("does not mutate the document it was given", () => {
    // A failed save must not leave the caller holding a half-merged document
    // it believes is still the server's.
    const current = base()
    const before = JSON.stringify(current)
    applyFlow(current, `screen billing "Billing"`, "merge")
    expect(JSON.stringify(current)).toBe(before)
  })

  it("refuses source that yields no diagram at all, and says why", () => {
    // The grammar is deliberately tolerant — an unclosed brace is a warning,
    // not a refusal. What it will not accept is source that describes nothing.
    const result = applyFlow(base(), `app "Nothing" {\n  builds web\n}`, "merge")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.join(" ")).toMatch(/No screens, sections or tables/i)
  })

  it("recovers from an unclosed block rather than throwing the source away", () => {
    const result = applyFlow(base(), `screen billing "Billing" {`, "merge")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.screens.map((s) => s.key)).toContain("billing")
  })

  it("resolves a screen by key rather than duplicating it", () => {
    const result = applyFlow(base(), `screen login "Sign in, renamed"`, "merge")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.screens.filter((s) => s.key === "login")).toHaveLength(1)
  })
})

describe("starting a project from Flow alone", () => {
  it("builds one from source", () => {
    const result = newDoc("Fresh", SOURCE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.name).toBe("Fresh")
    expect(result.doc.screens.length).toBeGreaterThan(0)
  })

  it("lets the requested name win over a name in the source", () => {
    // Otherwise the project appears in the list under a name nobody asked for.
    const result = newDoc(
      "Requested",
      `app "Something Else" {\n  builds web\n}\n\nscreen home "Home"`
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.name).toBe("Requested")
  })

  it("makes an empty project when given no source", () => {
    const result = newDoc("Empty", null)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.screens).toEqual([])
  })
})

describe("the prompt the project generates", () => {
  it("builds one per surface", () => {
    const made = newDoc("Prompted", SOURCE)
    if (!made.ok) throw new Error("fixture did not parse")
    const web = promptFor(made.doc, "web")
    expect(web).toContain("Prompted")
    expect(web.length).toBeGreaterThan(500)
  })

  it("carries the version floor, so the MCP path cannot ship a vulnerable Next", () => {
    const made = newDoc("Prompted", SOURCE)
    if (!made.ok) throw new Error("fixture did not parse")
    expect(promptFor(made.doc, "web")).toContain("CVE-2025-66478")
  })

  it("ends with the honesty clause the studio adds", () => {
    const made = newDoc("Prompted", SOURCE)
    if (!made.ok) throw new Error("fixture did not parse")
    expect(promptFor(made.doc, "web")).toContain("END TO END INTEGRATION TESTING")
  })
})

describe("the round trip", () => {
  it("survives serialize then parse", () => {
    const made = newDoc("Round", SOURCE)
    if (!made.ok) throw new Error("fixture did not parse")
    const once = toFlow(made.doc)
    const again = applyFlow(made.doc, once, "replace")
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(toFlow(again.doc)).toBe(once)
  })
})
