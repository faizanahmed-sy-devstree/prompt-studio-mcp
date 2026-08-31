// Vendored from Prompt Studio (features/library/data/module-kinds.ts). Do not edit here — run `pnpm sync`.
/**
 * What a module *is*. Drives the icon on the canvas, the wording in the
 * generated prompt, and the list of valid `kind` ids in every authoring prompt —
 * one catalogue, so the language and the app can never drift apart.
 */
export type ModuleKind = {
  id: string
  name: string
  icon: string
  description: string
  /** the sentence the build prompt uses for this module */
  promptDetails: string
}

export const moduleKinds: ModuleKind[] = [
  {
    id: "panel",
    name: "Panel",
    icon: "layers",
    description: "A region of the screen",
    promptDetails:
      "a distinct region of the screen with its own heading and content",
  },
  {
    id: "table",
    name: "Table",
    icon: "table",
    description: "Rows, sorting, paging",
    promptDetails:
      "a data table with sortable columns, pagination, row selection and its own loading, empty and error states",
  },
  {
    id: "list",
    name: "List",
    icon: "clipboard",
    description: "Repeating cards or rows",
    promptDetails:
      "a repeating list of cards or rows with its own loading, empty and error states",
  },
  {
    id: "form",
    name: "Form",
    icon: "file",
    description: "Fields, validation, submit",
    promptDetails:
      "a form with labelled fields, inline validation, a disabled-while-submitting action and a success path",
  },
  {
    id: "modal",
    name: "Modal",
    icon: "message",
    description: "Dialog over the screen",
    promptDetails:
      "a modal dialog rendered over the screen, dismissible by overlay click and Escape, returning focus to its trigger on close",
  },
  {
    id: "drawer",
    name: "Drawer",
    icon: "panel-bottom",
    description: "Slide-over panel",
    promptDetails:
      "a slide-over panel anchored to the edge of the viewport, dismissible by overlay click and Escape",
  },
  {
    id: "tabs",
    name: "Tabs",
    icon: "layers",
    description: "Switches inner views",
    promptDetails:
      "a tab set that switches the content beneath it, with the active tab reflected in the URL",
  },
  {
    id: "filters",
    name: "Filters",
    icon: "search",
    description: "Search and refine",
    promptDetails:
      "a filter and search bar whose state is reflected in the URL so the view is shareable and survives a reload",
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "calendar",
    description: "Month/week view of events",
    promptDetails:
      "a calendar view of dated records with month and week modes, selectable days and an event detail on click",
  },
  {
    id: "map",
    name: "Map",
    icon: "compass",
    description: "Geographic view, markers, routes",
    promptDetails:
      "a map with markers and route overlays, a selected-item state, and a visible fallback when location data is missing",
  },
  {
    id: "timeline",
    name: "Timeline",
    icon: "trending",
    description: "Chronological activity",
    promptDetails:
      "a chronological timeline of events with timestamps, grouped by day, and its own empty state",
  },
  {
    id: "chart",
    name: "Chart",
    icon: "trending",
    description: "Visualised data",
    promptDetails:
      "a chart with an accessible text summary, a legend and an empty state for no data",
  },
  {
    id: "stats",
    name: "Stat cards",
    icon: "gauge",
    description: "KPI tiles",
    promptDetails:
      "a row of KPI tiles, each with a value, a label and a skeleton while loading",
  },
  {
    id: "action",
    name: "Action",
    icon: "zap",
    description: "Button, menu, bulk action",
    promptDetails:
      "an action control — button, menu or bulk action — with a confirmation step when it is destructive",
  },
  {
    id: "upload",
    name: "Upload",
    icon: "inbox",
    description: "File input or import",
    promptDetails:
      "a file upload with drag-and-drop, type and size validation, per-file progress and a clear failure path",
  },
  {
    id: "sheet",
    name: "Bottom sheet",
    icon: "panel-bottom",
    description: "Sheet over the screen (mobile)",
    promptDetails:
      "a bottom sheet with a drag handle and detents, dismissible by swipe-down and backdrop tap, over a screen that stays visible behind it",
  },
  {
    id: "permission",
    name: "Permission prompt",
    icon: "shield",
    description: "Runtime permission ask (mobile)",
    promptDetails:
      "a runtime permission request explaining why it is needed *before* the system dialog, with an explicit denied path that offers a route into Settings rather than a dead screen",
  },
  {
    id: "camera",
    name: "Camera / scanner",
    icon: "smartphone",
    description: "Capture or scan (mobile)",
    promptDetails:
      "a camera or scanner surface with a visible capture affordance, a torch toggle where useful, and handled states for permission denied and no camera available",
  },
  {
    id: "nav",
    name: "Navigation",
    icon: "compass",
    description: "Sidebar, tabs, breadcrumb",
    promptDetails:
      "a navigation element that marks the current location and is reachable by keyboard",
  },
  {
    id: "api",
    name: "API call",
    icon: "globe",
    description: "Endpoint or service call",
    promptDetails:
      "a data call, wired through the shared request hooks with loading, error and retry handled at the call site",
  },
  {
    id: "job",
    name: "Job / event",
    icon: "calendar",
    description: "Background work",
    promptDetails:
      "background work — a scheduled job, queue consumer or emitted event — with its trigger and failure behaviour stated",
  },
]

export const moduleKindMap = Object.fromEntries(
  moduleKinds.map((kind) => [kind.id, kind])
) as Record<string, ModuleKind>

export function describeModuleKind(id: string): ModuleKind {
  return moduleKindMap[id] ?? moduleKindMap.panel
}
