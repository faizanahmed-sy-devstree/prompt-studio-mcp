// Vendored from Prompt Studio (features/prompt/engine/security.ts). Do not edit here — run `pnpm sync`.
/**
 * Version floors the generated prompt has to state, and the honesty clause it
 * always ends with.
 *
 * A generated brief is read by an agent that will happily run `create-next-app`
 * or copy whatever version it saw most during training. For CVE-2025-55182 —
 * the React Server Components RCE, CVSS 10.0, and its Next.js downstream
 * CVE-2025-66478 — that is a vulnerable app by default. Naming the floor in the
 * prompt is the only place we can intervene, because we never run the install.
 */

export type VersionFloor = {
  /** the lowest release of this line that carries the fix */
  min: string
  /** what is being avoided, stated in one line the agent can act on */
  reason: string
}

/**
 * Patched Next.js releases from the CVE-2025-66478 advisory (2025-12-03).
 *
 * Only lines the builder can actually pick are listed. Every 15.x and 16.x
 * release below its line's floor is vulnerable, so the floor is quoted rather
 * than a range — an agent given "15.x" picks the newest it remembers, which is
 * not necessarily patched.
 */
export const nextVersionFloors: Record<string, VersionFloor> = {
  "next-16": {
    min: "16.0.7",
    reason:
      "every Next.js 16 release before 16.0.7 is affected by CVE-2025-66478 (React Server Components remote code execution, CVSS 10.0)",
  },
  "next-15": {
    min: "15.5.7",
    reason:
      "every Next.js 15 release before 15.5.7 is affected by CVE-2025-66478 (React Server Components remote code execution, CVSS 10.0). If you must stay on an earlier minor, the patched releases are 15.0.5, 15.1.9, 15.2.6, 15.3.6, 15.4.8 and 15.5.7",
  },
  "next-pages": {
    min: "15.5.7",
    reason:
      "the Pages Router itself is not affected by CVE-2025-66478, but a Next.js 15 or 16 install below its patched release ships the vulnerable React Server Components runtime anyway",
  },
}

/**
 * The security paragraph appended to the Tech Stack block.
 *
 * Returns an empty string for stacks with nothing to pin — a FastAPI service
 * does not need to read a Next.js advisory.
 */
export function securityConstraint(frameworkId: string): string {
  const floor = nextVersionFloors[frameworkId]
  if (!floor) return ""
  return [
    `**Version floor — do not ignore.** Install \`next@^${floor.min}\` or newer. Do not scaffold with an unpinned \`create-next-app\`, and do not accept whatever version a template or your own memory suggests: ${floor.reason}.`,
    `Verify it after install — \`npm ls next\` (or the equivalent for the package manager in use) must report ${floor.min} or higher before you write any application code. Canary releases are only acceptable at 15.6.0-canary.58 / 16.1.0-canary.12 or newer.`,
    "Apply the same rule to every other dependency: if a package has a published critical advisory, install the patched release, and say so in your final report rather than pinning silently.",
  ].join("\n\n")
}

/**
 * Closes every generated prompt, after the target's own closing line.
 *
 * The wording is deliberately blunt about uncertainty. An agent that finishes a
 * multi-screen build and reports "done" with no caveats is the failure mode
 * this is aimed at — the developer then discovers the gap in production instead
 * of in the handover.
 */
export const VERIFICATION_NOTICE_BODY = [
  "PLEASE DO PROPER END TO END INTEGRATION TESTING OF THE WHOLE FLOW. Run the app, walk every journey described above from its entry screen to its final state, and confirm each screen renders its loading, empty and error states with real data moving through the API — not just that the code typechecks.",
  "AND IF YOU MISSED OUT ON ANYTHING, OR ARE CONFUSED ABOUT ANYTHING, PLEASE BE HONEST AND TELL THE DEVELOPER. Do not paper over a gap and do not claim something works when you have not seen it work. End your response with an explicit list:",
  [
    "- **Verified** — what you ran end to end yourself, and how.",
    "- **Not verified** — what you built but could not exercise, and why (no credentials, no seed data, an external service you cannot reach).",
    "- **Suspicions** — anything you are unsure about, in the form \"I have a suspicion about X, please test this manually.\"",
    "- **Assumptions** — every requirement you had to guess at, so the developer can correct it.",
  ].join("\n"),
  "A short honest report with real gaps named is worth far more than a confident one that turns out to be wrong.",
].join("\n\n")

/**
 * The notice rendered for a target, so it matches the blocks above it rather
 * than dropping a markdown heading into an otherwise XML-tagged prompt.
 */
export function verificationNotice(format: "markdown" | "xml"): string {
  return format === "xml"
    ? `<verification>\n${VERIFICATION_NOTICE_BODY}\n</verification>`
    : `## Before You Report Back\n\n${VERIFICATION_NOTICE_BODY}`
}
