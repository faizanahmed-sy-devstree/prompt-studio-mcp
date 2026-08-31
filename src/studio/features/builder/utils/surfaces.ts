// Vendored from Prompt Studio (features/builder/utils/surfaces.ts). Do not edit here — run `pnpm sync`.
import type {
  ProjectDoc,
  Stack,
  Structure,
  Surface,
} from "../../../types/project"

/**
 * A surface is one build of the product: the web app, the phone app, the
 * service behind them.
 *
 * They share what is genuinely shared — the brand, the brief, the roles — and
 * split on what is genuinely different: the stack, the folder structure and the
 * generated prompt. Keeping them in one project is what lets a mobile screen
 * sit next to the backend endpoint it calls; keeping the stacks apart is what
 * stops a React Native build being told to use shadcn.
 */
export const surfaceMeta: Record<
  Surface,
  { label: string; icon: string; hint: string }
> = {
  web: {
    label: "Web",
    icon: "globe",
    hint: "Browser app — routes, pages, responsive layouts",
  },
  mobile: {
    label: "Mobile",
    icon: "smartphone",
    hint: "Phone app — React Native or native iOS",
  },
  backend: {
    label: "Backend",
    icon: "layers",
    hint: "Services, endpoints and jobs",
  },
}

/** The web surface keeps the top-level fields — see the schema comment. */
export function stackFor(doc: ProjectDoc, surface: Surface): Stack {
  return surface === "web" ? doc.stack : doc.surfaces[surface].stack
}

export function structureFor(doc: ProjectDoc, surface: Surface): Structure {
  return surface === "web" ? doc.structure : doc.surfaces[surface].structure
}

export function countsBySurface(doc: ProjectDoc): Record<Surface, number> {
  const counts: Record<Surface, number> = { web: 0, mobile: 0, backend: 0 }
  for (const screen of doc.screens) counts[screen.surface] += 1
  return counts
}
