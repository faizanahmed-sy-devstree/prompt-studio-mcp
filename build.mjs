/**
 * Bundles the CLI and the server into `dist/`.
 *
 * A bundle rather than plain `tsc` output because the vendored studio modules
 * are imported without file extensions, the way the app writes them — Node
 * cannot resolve those at runtime, and rewriting several thousand lines of
 * vendored source to add `.js` everywhere would guarantee the copy drifts from
 * the original on the very first sync.
 *
 * The MCP SDK and zod are bundled too, so `npx prompt-studio-mcp` needs no
 * install step and no network beyond fetching the package itself.
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const here = dirname(fileURLToPath(import.meta.url))

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "info",
  banner: { js: "#!/usr/bin/env node" },
  // The vendored `lib/utils.ts` carries the app's Tailwind class-name helper
  // next to the id and slug helpers this server actually uses. Aliasing is how
  // that stays out of the bundle without editing vendored source.
  alias: {
    clsx: resolve(here, "src/shims/tailwind.ts"),
    "tailwind-merge": resolve(here, "src/shims/tailwind.ts"),
  },
}

await build({
  ...shared,
  entryPoints: [resolve(here, "src/cli.ts")],
  outfile: resolve(here, "dist/cli.mjs"),
})

// Also emitted on its own, so an existing `claude mcp add ... server.mjs`
// registration keeps working and nobody has to re-register to upgrade.
await build({
  ...shared,
  entryPoints: [resolve(here, "src/server.ts")],
  outfile: resolve(here, "dist/server.mjs"),
})
