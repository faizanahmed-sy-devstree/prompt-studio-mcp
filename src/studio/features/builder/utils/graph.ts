// Vendored from Prompt Studio (features/builder/utils/graph.ts). Do not edit here — run `pnpm sync`.
import type { FlowEdge, Screen } from "../../../types/project"

/**
 * The layout and classification maths reads ids and positions, nothing else.
 * Typing it that way rather than against `Screen` is what lets the data-model
 * canvas — tables and their relations — use the same engine as the flow
 * canvas, instead of growing a second one that drifts.
 */
export type GraphNode = { id: string }
export type GraphLink = { id: string; from: string; to: string }
export type PositionedNode = GraphNode & { x: number; y: number }

export type GraphAnalysis = {
  /** screens with no incoming edge — where the user starts */
  entries: Screen[]
  /** flow order: breadth-first from every entry, then anything left over */
  ordered: Screen[]
  /** screens no edge points at and that are not entries of a used graph */
  unreachable: Screen[]
  /** screens with more than one outgoing edge */
  branching: Screen[]
  /** screen ids that take part in a cycle */
  cycles: string[][]
  /** edges pointing at a screen that no longer exists */
  danglingEdges: FlowEdge[]
}

export function analyseGraph(
  screens: Screen[],
  edges: FlowEdge[]
): GraphAnalysis {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const danglingEdges = edges.filter((e) => !byId.has(e.from) || !byId.has(e.to))
  const live = edges.filter((e) => byId.has(e.from) && byId.has(e.to))

  const outgoing = new Map<string, FlowEdge[]>()
  const incoming = new Map<string, FlowEdge[]>()
  for (const screen of screens) {
    outgoing.set(screen.id, [])
    incoming.set(screen.id, [])
  }
  for (const edge of live) {
    outgoing.get(edge.from)?.push(edge)
    incoming.get(edge.to)?.push(edge)
  }

  const entries = screens.filter((s) => (incoming.get(s.id) ?? []).length === 0)

  // Breadth-first from each entry keeps the natural "first screen first" read.
  const seen = new Set<string>()
  const ordered: Screen[] = []
  const queue: string[] = entries.map((s) => s.id)
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const screen = byId.get(id)
    if (screen) ordered.push(screen)
    for (const edge of outgoing.get(id) ?? []) {
      if (!seen.has(edge.to)) queue.push(edge.to)
    }
  }
  // Anything only reachable inside a cycle, or fully disconnected.
  for (const screen of screens) {
    if (!seen.has(screen.id)) ordered.push(screen)
  }

  const unreachable =
    live.length === 0
      ? []
      : screens.filter(
          (s) =>
            (incoming.get(s.id) ?? []).length === 0 &&
            (outgoing.get(s.id) ?? []).length === 0
        )

  const branching = screens.filter((s) => (outgoing.get(s.id) ?? []).length > 1)

  return {
    entries,
    ordered,
    unreachable,
    branching,
    cycles: findCycles(screens, outgoing),
    danglingEdges,
  }
}

function findCycles(
  screens: Screen[],
  outgoing: Map<string, FlowEdge[]>
): string[][] {
  const cycles: string[][] = []
  const state = new Map<string, "visiting" | "done">()
  const stack: string[] = []

  const walk = (id: string) => {
    const current = state.get(id)
    if (current === "done") return
    if (current === "visiting") {
      const start = stack.indexOf(id)
      if (start !== -1) cycles.push(stack.slice(start))
      return
    }
    state.set(id, "visiting")
    stack.push(id)
    for (const edge of outgoing.get(id) ?? []) walk(edge.to)
    stack.pop()
    state.set(id, "done")
  }

  for (const screen of screens) walk(screen.id)
  return cycles
}

export function outgoingEdges(edges: FlowEdge[], screenId: string) {
  return edges.filter((e) => e.from === screenId)
}

export function edgeExists(edges: FlowEdge[], from: string, to: string) {
  return edges.some((e) => e.from === from && e.to === to)
}


/** Nodes nothing points at — where a graph starts being read. */
function entryNodes<T extends GraphNode>(nodes: T[], edges: GraphLink[]): T[] {
  const byId = new Set(nodes.map((n) => n.id))
  const targeted = new Set(
    edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => e.to)
  )
  return nodes.filter((n) => !targeted.has(n.id))
}

/** Discovery order from every entry — the natural "first thing first" read. */
function breadthFirstOrder(nodes: GraphNode[], edges: GraphLink[]): string[] {
  const byId = new Set(nodes.map((n) => n.id))
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) outgoing.set(node.id, [])
  for (const edge of edges) {
    if (byId.has(edge.from) && byId.has(edge.to)) {
      outgoing.get(edge.from)?.push(edge.to)
    }
  }
  const seen = new Set<string>()
  const order: string[] = []
  const queue = entryNodes(nodes, edges).map((n) => n.id)
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
    for (const next of outgoing.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next)
    }
  }
  for (const node of nodes) if (!seen.has(node.id)) order.push(node.id)
  return order
}

/** How a screen relates to the one it points at. Drives colour on the canvas. */
export type EdgeKind = "next" | "branch" | "back" | "jump"

export type Layering = {
  /** column index per screen id — 0 is where the user starts */
  depth: Map<string, number>
  /**
   * Edges that point at a screen already on the path to their own source: a
   * loop (save → list → edit → save), not a step forward. They are excluded
   * from the layering, because letting them push depths would fling the graph
   * to the right forever, and they are drawn differently, because "goes back"
   * is a different thing to read than "goes next".
   */
  backEdges: Set<string>
}

/**
 * Assign every screen a column.
 *
 * Longest path rather than shortest: a screen sits one column right of its
 * **deepest** predecessor, so an arrow never points backwards into a column it
 * already passed. The old shortest-path version placed a screen next to the
 * first parent it happened to discover, which left later parents to its right
 * and drew their edges straight back through the cards in between — the single
 * biggest source of lines crossing nodes on this canvas.
 */
export function layerScreens(
  screens: GraphNode[],
  edges: GraphLink[]
): Layering {
  const byId = new Map(screens.map((s) => [s.id, s]))
  const live = edges.filter(
    (e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to
  )

  const out = new Map<string, GraphLink[]>()
  for (const screen of screens) out.set(screen.id, [])
  for (const edge of live) out.get(edge.from)?.push(edge)

  // Depth-first from the entries first, so "forward" means the direction the
  // app is actually read; anything only reachable inside a cycle is walked
  // afterwards so no screen is left without a column.
  const entryIds = new Set(entryNodes(screens, edges).map((s) => s.id))
  const roots = [
    ...screens.filter((s) => entryIds.has(s.id)),
    ...screens.filter((s) => !entryIds.has(s.id)),
  ]

  const backEdges = new Set<string>()
  // 0 unvisited · 1 on the current path · 2 finished. An edge into a node on
  // the current path is the definition of a back edge.
  const state = new Map<string, 0 | 1 | 2>()

  // Iterative: a deep chain of screens must not be able to blow the stack.
  for (const root of roots) {
    if (state.get(root.id)) continue
    state.set(root.id, 1)
    const stack: Array<{ id: string; at: number }> = [{ id: root.id, at: 0 }]
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const list = out.get(frame.id) ?? []
      if (frame.at >= list.length) {
        state.set(frame.id, 2)
        stack.pop()
        continue
      }
      const edge = list[frame.at]
      frame.at += 1
      const seen = state.get(edge.to) ?? 0
      if (seen === 1) {
        backEdges.add(edge.id)
        continue
      }
      if (seen === 2) continue
      state.set(edge.to, 1)
      stack.push({ id: edge.to, at: 0 })
    }
  }

  // What is left is a DAG, so a topological relax gives the longest path.
  const forward = live.filter((e) => !backEdges.has(e.id))
  const indegree = new Map<string, number>()
  for (const screen of screens) indegree.set(screen.id, 0)
  for (const edge of forward) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  }
  const outForward = new Map<string, GraphLink[]>()
  for (const screen of screens) outForward.set(screen.id, [])
  for (const edge of forward) outForward.get(edge.from)?.push(edge)

  const depth = new Map<string, number>()
  for (const screen of screens) depth.set(screen.id, 0)
  const queue = screens.filter((s) => (indegree.get(s.id) ?? 0) === 0).map((s) => s.id)
  let cursor = 0
  while (cursor < queue.length) {
    const id = queue[cursor++]
    const here = depth.get(id) ?? 0
    for (const edge of outForward.get(id) ?? []) {
      depth.set(edge.to, Math.max(depth.get(edge.to) ?? 0, here + 1))
      const left = (indegree.get(edge.to) ?? 0) - 1
      indegree.set(edge.to, left)
      if (left === 0) queue.push(edge.to)
    }
  }

  return { depth, backEdges }
}

/**
 * What kind of relation each edge is, so the canvas can colour it.
 *
 * `next` one step forward · `branch` one of several ways out of the same
 * screen · `jump` skips over columns (a shortcut, or a link from a menu) ·
 * `back` returns to somewhere already visited.
 */
export function classifyEdges(
  screens: GraphNode[],
  edges: GraphLink[]
): Map<string, EdgeKind> {
  const { depth, backEdges } = layerScreens(screens, edges)
  const byId = new Map(screens.map((s) => [s.id, s]))
  const outCount = new Map<string, number>()
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue
    outCount.set(edge.from, (outCount.get(edge.from) ?? 0) + 1)
  }

  const kinds = new Map<string, EdgeKind>()
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue
    const from = depth.get(edge.from) ?? 0
    const to = depth.get(edge.to) ?? 0
    if (backEdges.has(edge.id) || to <= from) kinds.set(edge.id, "back")
    else if (to - from > 1) kinds.set(edge.id, "jump")
    else if ((outCount.get(edge.from) ?? 0) > 1) kinds.set(edge.id, "branch")
    else kinds.set(edge.id, "next")
  }
  return kinds
}

/**
 * Do any two of these sit on top of each other?
 *
 * Used at first paint: positions saved by an older layout, or written by a
 * model that guessed them, routinely overlap — and a canvas that opens with
 * one card covering another reads as lost work.
 */
export function overlapping<T extends PositionedNode>(
  nodes: T[],
  sizes: {
    heights?: Map<string, number> | Record<string, number>
    widths?: Map<string, number> | Record<string, number>
    nodeWidth?: number
    rowHeight?: number
  } = {}
): boolean {
  const heightRead = reader(sizes.heights)
  const widthRead = reader(sizes.widths)
  const height = (id: string) => heightRead(id) ?? sizes.rowHeight ?? 168
  const width = (id: string) => widthRead(id) ?? sizes.nodeWidth ?? DEFAULT_NODE_WIDTH
  // A few pixels of touching is not an overlap; a card over a card is.
  const pad = 4
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]
      const b = nodes[j]
      if (
        a.x + width(a.id) - pad > b.x &&
        b.x + width(b.id) - pad > a.x &&
        a.y + height(a.id) - pad > b.y &&
        b.y + height(b.id) - pad > a.y
      ) {
        return true
      }
    }
  }
  return false
}

export type AutoLayoutOptions = {
  /**
   * Rendered height per screen. Screens showing their modules are several
   * times taller than collapsed ones, and stacking every row at a fixed pitch
   * drops them straight through the screen below.
   */
  heights?: Map<string, number> | Record<string, number>
  /** Rendered width per screen; falls back to `nodeWidth`. */
  widths?: Map<string, number> | Record<string, number>
  /** Width of a node on this surface — a mobile card is narrower than a web one. */
  nodeWidth?: number
  /** Empty space between two columns. An edge label lives in here. */
  colGap?: number
  rowGap?: number
  /** Fixed column pitch. Overrides the measured widths when given. */
  colWidth?: number
  /** Fallback row pitch when no height was measured. */
  rowHeight?: number
}

const DEFAULT_NODE_WIDTH = 224
const DEFAULT_COL_GAP = 136
const DEFAULT_ROW_HEIGHT = 210
const DEFAULT_ROW_GAP = 42

function reader(source: Map<string, number> | Record<string, number> | undefined) {
  return (id: string): number | undefined => {
    if (!source) return undefined
    const value = source instanceof Map ? source.get(id) : source[id]
    return typeof value === "number" && value > 0 ? value : undefined
  }
}

/**
 * Layered auto-arrange — columns by depth, rows ordered to keep a screen next
 * to whatever leads to it.
 *
 * Three passes, in order:
 *  1. **columns** — longest-path layering, so no arrow points backwards.
 *  2. **rows** — barycentre sweeps: a screen drifts towards the average row of
 *     the screens it connects to, which is what untangles crossing edges.
 *  3. **packing** — each screen is placed as close to its predecessors as the
 *     column allows, and never on top of the one above it.
 */
export function autoLayout<T extends PositionedNode>(
  screens: T[],
  edges: GraphLink[],
  opts: AutoLayoutOptions = {}
): T[] {
  if (!screens.length) return screens

  const nodeWidth = opts.nodeWidth ?? DEFAULT_NODE_WIDTH
  const colGap = opts.colGap ?? DEFAULT_COL_GAP
  const rowGap = opts.rowGap ?? DEFAULT_ROW_GAP
  const rowHeight = opts.rowHeight ?? DEFAULT_ROW_HEIGHT
  const heightRead = reader(opts.heights)
  const widthRead = reader(opts.widths)
  const heightOf = (id: string) => heightRead(id) ?? rowHeight - rowGap
  const widthOf = (id: string) => widthRead(id) ?? nodeWidth

  const byId = new Map(screens.map((s) => [s.id, s]))
  const live = edges.filter(
    (e) => byId.has(e.from) && byId.has(e.to) && e.from !== e.to
  )
  const { depth, backEdges } = layerScreens(screens, edges)
  // Loops are excluded from the row maths too: a screen must sit next to what
  // leads *into* it, not next to whatever it returns to.
  const forward = live.filter((e) => !backEdges.has(e.id))

  const predecessors = new Map<string, string[]>()
  const successors = new Map<string, string[]>()
  for (const screen of screens) {
    predecessors.set(screen.id, [])
    successors.set(screen.id, [])
  }
  for (const edge of forward) {
    predecessors.get(edge.to)?.push(edge.from)
    successors.get(edge.from)?.push(edge.to)
  }

  // Columns, each holding its ids in the order they will be stacked.
  const columns: string[][] = []
  const seedOrder = new Map(
    breadthFirstOrder(screens, edges).map((id, index) => [id, index])
  )
  const sorted = [...screens].sort(
    (a, b) =>
      (seedOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (seedOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  )
  for (const screen of sorted) {
    const column = depth.get(screen.id) ?? 0
    while (columns.length <= column) columns.push([])
    columns[column].push(screen.id)
  }

  // Barycentre sweeps. Down then up, a few times: each screen moves towards the
  // average row of its neighbours in the column it was compared against, which
  // is the standard way to pull crossing edges apart.
  const rowOf = new Map<string, number>()
  const reindex = () => {
    for (const column of columns) {
      column.forEach((id, index) => {
        rowOf.set(id, index)
      })
    }
  }
  reindex()

  const sweep = (neighbours: Map<string, string[]>, order: number[]) => {
    for (const index of order) {
      const column = columns[index]
      if (column.length < 2) continue
      const weight = new Map<string, number>()
      column.forEach((id, position) => {
        const linked = (neighbours.get(id) ?? [])
          .map((other) => rowOf.get(other))
          .filter((value): value is number => value !== undefined)
        weight.set(
          id,
          linked.length
            ? linked.reduce((sum, value) => sum + value, 0) / linked.length
            : position
        )
      })
      // Stable: an equal barycentre keeps the order the column already had.
      const before = new Map(column.map((id, position) => [id, position]))
      column.sort(
        (a, b) =>
          (weight.get(a) ?? 0) - (weight.get(b) ?? 0) ||
          (before.get(a) ?? 0) - (before.get(b) ?? 0)
      )
      reindex()
    }
  }

  const down = columns.map((_, index) => index).slice(1)
  const up = down.slice().reverse().map((index) => index - 1).filter((index) => index >= 0)
  for (let pass = 0; pass < 4; pass += 1) {
    sweep(predecessors, down)
    sweep(successors, up)
  }

  // Packing. Each column is walked top to bottom; a screen wants to sit level
  // with the middle of whatever leads into it, and is pushed down only as far
  // as the screen above it requires.
  const x = new Map<string, number>()
  const y = new Map<string, number>()
  let left = 0
  for (const column of columns) {
    const columnWidth = column.reduce(
      (widest, id) => Math.max(widest, widthOf(id)),
      0
    )
    let cursor = 0
    for (const id of column) {
      const height = heightOf(id)
      const parents = (predecessors.get(id) ?? [])
        .map((parent) => {
          const top = y.get(parent)
          return top === undefined ? undefined : top + heightOf(parent) / 2
        })
        .filter((value): value is number => value !== undefined)
      const desired = parents.length
        ? parents.reduce((sum, value) => sum + value, 0) / parents.length -
          height / 2
        : cursor
      const top = Math.max(cursor, desired)
      x.set(id, left)
      y.set(id, top)
      cursor = top + height + rowGap
    }
    left += opts.colWidth ?? columnWidth + colGap
  }

  // Nothing above the origin: the canvas fits to the graph, and a negative
  // corner just means the first thing anyone sees is empty space.
  const lift = Math.min(...[...y.values()])
  return screens.map((screen) => ({
    ...screen,
    x: x.get(screen.id) ?? screen.x,
    y: (y.get(screen.id) ?? screen.y) - (Number.isFinite(lift) ? lift : 0),
  }))
}
