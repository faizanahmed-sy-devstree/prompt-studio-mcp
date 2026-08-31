import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  // The same alias the bundler uses: the vendored `lib/utils.ts` carries the
  // app's Tailwind class-name helper next to the id helpers this server needs,
  // and neither Tailwind package belongs in an stdio server.
  resolve: {
    alias: {
      clsx: resolve(__dirname, "src/shims/tailwind.ts"),
      "tailwind-merge": resolve(__dirname, "src/shims/tailwind.ts"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
})
