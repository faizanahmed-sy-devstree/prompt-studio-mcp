// Vendored from Prompt Studio (features/flow-lang/tokenize.ts). Do not edit here — run `pnpm sync`.
export type SourceLine = {
  /** 1-based line number in the original source */
  line: number
  text: string
}

/**
 * Pre-pass over `.flow` source:
 *  - lifts triple-quoted blocks out so they survive line splitting
 *  - strips `//` and `# ` comments outside strings
 *  - splits `;` separated statements onto their own lines
 *  - keeps `{` / `}` as their own statements so the parser stays line-based
 *
 * Everything is tolerant: LLM output arrives with inconsistent spacing,
 * trailing commas and unicode arrows, and none of that should be fatal.
 */

const HEREDOC_OPEN = "«H"
const HEREDOC_CLOSE = "»"

export type Tokenized = {
  lines: SourceLine[]
  heredocs: string[]
}

export function tokenize(source: string): Tokenized {
  const heredocs: string[] = []
  const withPlaceholders = source.replace(
    /"""([\s\S]*?)"""/g,
    (_, body: string) => {
      heredocs.push(dedent(String(body)))
      return ` ${HEREDOC_OPEN}${heredocs.length - 1}${HEREDOC_CLOSE} `
    }
  )

  const lines: SourceLine[] = []
  const rawLines = withPlaceholders.split(/\r?\n/)

  rawLines.forEach((raw, index) => {
    const cleaned = stripComments(raw)
    for (const piece of splitStatements(cleaned)) {
      const text = piece.trim()
      if (text) lines.push({ line: index + 1, text })
    }
  })

  return { lines, heredocs }
}

export function resolveHeredoc(value: string, heredocs: string[]) {
  const match = value.trim().match(/^«H(\d+)»$/)
  if (!match) return value
  return heredocs[Number(match[1])] ?? ""
}

export function isHeredoc(value: string) {
  return /^«H\d+»$/.test(value.trim())
}

function stripComments(input: string) {
  let out = ""
  let inString = false
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]
    if (char === '"') {
      inString = !inString
      out += char
      continue
    }
    if (!inString) {
      if (char === "/" && next === "/") break
      // `#` starts a comment only when followed by whitespace or end of line,
      // so `#2563eb` colour literals survive.
      if (char === "#" && (next === " " || next === "\t" || next === undefined)) {
        break
      }
    }
    out += char
  }
  return out
}

function splitStatements(input: string) {
  const pieces: string[] = []
  let current = ""
  let inString = false
  for (const char of input) {
    if (char === '"') inString = !inString
    if (!inString && (char === ";" || char === "{" || char === "}")) {
      if (current.trim()) pieces.push(current)
      if (char !== ";") pieces.push(char)
      current = ""
      continue
    }
    current += char
  }
  if (current.trim()) pieces.push(current)
  return pieces
}

function dedent(block: string) {
  const lines = block.replace(/^\n/, "").replace(/\s+$/, "").split("\n")
  const indents = lines
    .filter((l) => l.trim())
    .map((l) => l.match(/^\s*/)?.[0].length ?? 0)
  const min = indents.length ? Math.min(...indents) : 0
  return lines.map((l) => l.slice(min)).join("\n")
}

/** Pull the quoted strings out of a statement, in order. */
export function readQuoted(text: string): { rest: string; quoted: string[] } {
  const quoted: string[] = []
  const rest = text.replace(/"([^"]*)"/g, (_, value: string) => {
    quoted.push(value)
    return " "
  })
  return { rest, quoted }
}

/** Distance used to suggest the nearest valid id for a typo. */
export function editDistance(a: string, b: string) {
  if (a === b) return 0
  const cols = b.length + 1
  let prev = new Array<number>(cols)
  let curr = new Array<number>(cols)
  for (let j = 0; j < cols; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j < cols; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[cols - 1]
}

export function closestMatch(value: string, candidates: string[]) {
  let best: { id: string; distance: number } | null = null
  for (const candidate of candidates) {
    const distance = editDistance(value.toLowerCase(), candidate.toLowerCase())
    if (!best || distance < best.distance) best = { id: candidate, distance }
  }
  if (!best) return null
  const tolerance = Math.max(2, Math.floor(value.length / 3))
  return best.distance <= tolerance ? best.id : null
}
