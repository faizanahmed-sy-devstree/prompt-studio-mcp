/**
 * Stand-ins for `clsx` and `tailwind-merge`.
 *
 * The vendored `lib/utils.ts` carries the app's `cn()` class-name helper
 * alongside `uid` and `slugify`, which the server does need. Rather than
 * install two Tailwind packages into an stdio server that renders nothing —
 * or edit the vendored file and guarantee it drifts on the next sync — the
 * build aliases both to this.
 *
 * They are never called on any path this server takes. The implementations are
 * honest anyway, so a future caller gets joined class names rather than a
 * crash or, worse, silence.
 */

export type ClassValue = string | number | null | false | undefined | ClassValue[]

export function clsx(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (value: ClassValue) => {
    if (!value && value !== 0) return
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry)
      return
    }
    out.push(String(value))
  }
  for (const input of inputs) walk(input)
  return out.join(" ")
}

/** No conflict resolution — there is no Tailwind here to have conflicts with. */
export function twMerge(...inputs: string[]): string {
  return inputs.filter(Boolean).join(" ")
}

export default clsx
