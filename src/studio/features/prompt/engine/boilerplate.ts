// Vendored from Prompt Studio (features/prompt/engine/boilerplate.ts). Do not edit here — run `pnpm sync`.
/**
 * The repository a brief starts from, instead of describing.
 *
 * Roughly 60% of a generated prompt used to be the same stack, folder tree and
 * convention list for every product — text a coding agent has to read and
 * re-derive on every run. All of that is files, so it lives in a repository
 * now, and the prompt spends its length on the part that is actually about the
 * product: screens, journeys, stories and design direction.
 *
 * The commit is pinned deliberately. A branch moves, and a brief written today
 * has to build the same thing next month; `main` in the clone line would make
 * every generated prompt quietly time-dependent.
 */
export const BOILERPLATE = {
  url: "https://github.com/faizanahmed-sy-devstree/prompt-studio-boilerplate",
  /** Update together with `url` — and only to a commit that builds. */
  commit: "2945abd6868ab29e212a08866c35429c52902181",
  /**
   * What the repo already provides, in the words the prompt uses.
   *
   * Written out rather than derived from the catalogues: this is a claim about
   * a specific commit of another repository, and generating it from local data
   * would let it drift into describing files that commit does not contain.
   */
  /**
   * What the repo provides, in four lines rather than a manifest.
   *
   * `CLAUDE.md` in the clone lists every file and what it is for, so an
   * inventory here is the same content twice — and it was costing more than
   * the structure and convention blocks it replaced. This is the short form:
   * enough that an agent which never cloned still knows what it is missing.
   */
  /**
   * The Next.js version the pinned commit installs.
   *
   * Checked against the CVE-2025-66478 floor in `security.ts` — a boilerplate
   * that ships a vulnerable release would hand every generated project the
   * vulnerability, and it is the one dependency here nobody re-picks.
   */
  nextVersion: "16.2.6",
  /**
   * Framework choices this repository actually is.
   *
   * Anything else and the clone is wrong: the repo is a Next 16 App Router app
   * with `proxy.ts`, so telling a Vite or Remix build to start from it produces
   * a brief that contradicts itself. The prompt falls back to describing the
   * stack and folder structure in full instead — see `usesBoilerplate`.
   */
  frameworks: ["next-16"] as readonly string[],
  provides: [
    "The folder structure, TypeScript strict, Tailwind v4 with the design tokens already defined, Biome and Vitest — a clean clone typechecks, lints, tests and builds.",
    "The plumbing: validated environment, the endpoint catalogue, one axios instance with the auth header and error normalisation, the query client, and Next 16's `proxy.ts` with the auth redirect wired.",
    "The primitives worth sharing: a `Button` that shows the token pattern, `Skeleton` / `EmptyState` / `ErrorState`, and the app shell.",
    "`features/example/` — the shape every feature copies. Delete it once a real one follows it.",
  ],
} as const

/** The clone, pinned, with the history dropped so it becomes their project. */
export function cloneLines(projectName: string): string {
  const folder = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app"
  return [
    "```bash",
    `git clone --no-checkout ${BOILERPLATE.url}.git ${folder}`,
    `cd ${folder}`,
    `git checkout ${BOILERPLATE.commit}`,
    "rm -rf .git && git init",
    "pnpm install",
    "cp .env.example .env.local",
    "```",
  ].join("\n")
}

/**
 * Whether this build genuinely starts from the clone.
 *
 * The switch in the Brief panel is the user's intent; this is whether that
 * intent is coherent with the stack they picked. Answering "no" here is what
 * makes the rest of the prompt fall back to describing the folder structure,
 * conventions and dependencies in full — which is exactly what someone who
 * chose Vite or Expo needs, and exactly what someone on the default Next 16
 * stack does not.
 */
export function usesBoilerplate(doc: {
  startFrom: string
  stack: { framework: string }
}): boolean {
  return (
    doc.startFrom === "boilerplate" && BOILERPLATE.frameworks.includes(doc.stack.framework)
  )
}
