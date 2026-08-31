/**
 * Copies the slice of Prompt Studio this server needs into `src/studio/`.
 *
 * The alternative was for the package to import the studio repo directly,
 * which would mean nobody could install this without checking out the app —
 * and the whole point is that it installs with `npx`. So the parser, the
 * serializer, the merge rules and the prompt engine are vendored, and this
 * script is how they are kept honest: it walks the real import graph from the
 * entry points below, copies exactly what is reachable, and rewrites the app's
 * `@/` alias into relative paths.
 *
 * It is a copy, so it can drift. `pnpm sync && git diff` is the check, and
 * `tests/vendor.test.ts` asserts the vendored tree still parses and serializes
 * the grammar this server documents.
 *
 *   node scripts/sync-studio.mjs ../prompt-studio
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** What the server actually reaches for. Everything else is pulled in behind these. */
const ENTRIES = [
  "features/flow-lang/parser.ts",
  "features/flow-lang/serializer.ts",
  "features/flow-lang/merge.ts",
  "features/flow-lang/authoring-prompt.ts",
  "features/library/data/starters.ts",
  "features/prompt/engine/build-prompt.ts",
  "types/project.ts",
]

const studioRoot = resolve(process.argv[2] ?? "../prompt-studio")
// `fileURLToPath`, not `new URL(...).pathname`: a checkout under a directory
// with a space in its name comes back percent-encoded otherwise, and the files
// land somewhere nobody asked for.
const here = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outRoot = join(here, "src/studio")

if (!existsSync(join(studioRoot, "types/project.ts"))) {
  console.error(
    `Not a Prompt Studio checkout: ${studioRoot}\n` +
      `Usage: node scripts/sync-studio.mjs <path-to-prompt-studio>`
  )
  process.exit(1)
}

const IMPORT = /(\bfrom\s+")([^"]+)(")/g

/** Resolve a specifier the way the app's tsconfig paths do. */
function resolveSpecifier(spec, fromFile) {
  let base
  if (spec.startsWith("@/")) base = join(studioRoot, spec.slice(2))
  else if (spec.startsWith(".")) base = resolve(join(studioRoot, dirname(fromFile)), spec)
  else return null
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext)) return relative(studioRoot, base + ext)
  }
  return null
}

const collected = new Set()
const queue = [...ENTRIES]
while (queue.length) {
  const file = queue.pop()
  if (collected.has(file)) continue
  collected.add(file)
  const source = readFileSync(join(studioRoot, file), "utf8")
  for (const match of source.matchAll(IMPORT)) {
    const resolved = resolveSpecifier(match[2], file)
    if (resolved && !collected.has(resolved)) queue.push(resolved)
  }
}

const files = [...collected].sort()
const reactish = files.filter((f) => f.endsWith(".tsx"))
if (reactish.length) {
  // A component in here means a barrel is being imported somewhere it should
  // not be. Vendoring React into an stdio server is never the intent.
  console.error(`Refusing to vendor React components:\n  ${reactish.join("\n  ")}`)
  process.exit(1)
}

rmSync(outRoot, { recursive: true, force: true })
for (const file of files) {
  const target = join(outRoot, file)
  mkdirSync(dirname(target), { recursive: true })
  const source = readFileSync(join(studioRoot, file), "utf8")
  const rewritten = source.replace(IMPORT, (whole, head, spec, tail) => {
    if (!spec.startsWith("@/")) return whole
    const resolved = resolveSpecifier(spec, file)
    if (!resolved) return whole
    let rel = relative(dirname(file), resolved).replace(/\.tsx?$/, "")
    if (!rel.startsWith(".")) rel = `./${rel}`
    return `${head}${rel}${tail}`
  })
  writeFileSync(
    target,
    `// Vendored from Prompt Studio (${file}). Do not edit here — run \`pnpm sync\`.\n${rewritten}`
  )
}

writeFileSync(
  join(outRoot, "MANIFEST.txt"),
  `${files.length} files vendored from Prompt Studio.\n\n${files.join("\n")}\n`
)
console.log(`Vendored ${files.length} files into src/studio/`)
