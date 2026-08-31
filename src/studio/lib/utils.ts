// Vendored from Prompt Studio (lib/utils.ts). Do not edit here — run `pnpm sync`.
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let counter = 0

/** Collision-safe enough for a single browser tab, and SSR-stable per call. */
export function uid(prefix = "id") {
  counter += 1
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${counter.toString(36)}`
}

/** "Client List" -> "client_list" — the identifier used in `.flow` source. */
export function slugify(input: string, fallback = "screen") {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return slug || fallback
}

export function uniqueKey(base: string, taken: Iterable<string>) {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(ts)
}

/** Rough GPT-ish token estimate. Good enough for a budget meter, not billing. */
export function estimateTokens(text: string) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function countWords(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}
