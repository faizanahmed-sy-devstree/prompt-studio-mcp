// Vendored from Prompt Studio (features/library/data/snippets.ts). Do not edit here — run `pnpm sync`.
export type Snippet = {
  id: string
  name: string
  description: string
  category: "Quality" | "Data" | "UX" | "Delivery"
  lines: string[]
}

/**
 * Reusable requirement blocks. Toggling one appends its lines to the
 * Technical Requirements block of the generated prompt — so the whole team
 * ships the same non-negotiables without retyping them.
 */
export const snippets: Snippet[] = [
  {
    id: "a11y",
    name: "Accessibility pack",
    description: "Keyboard, labels, contrast, focus",
    category: "Quality",
    lines: [
      "Every interactive element is reachable and operable by keyboard, with a visible focus ring.",
      "Form controls have associated labels; icon-only buttons carry an accessible name.",
      "Colour contrast meets WCAG AA (4.5:1 for body text, 3:1 for large text and UI borders).",
      "Dialogs trap focus, close on Escape and return focus to the trigger.",
      "Respect prefers-reduced-motion: no essential information is conveyed by motion alone.",
    ],
  },
  {
    id: "states",
    name: "Loading / empty / error states",
    description: "No blank screens, ever",
    category: "Quality",
    lines: [
      "Every async surface has three explicit states: layout-shaped skeleton while loading, an illustrated empty state with one primary action, and an error state with a retry.",
      "Never render a bare spinner in place of a page, and never render a blank area for an empty list.",
      "Mutations show pending state on the triggering control and disable double submission.",
    ],
  },
  {
    id: "forms",
    name: "Form validation pack",
    description: "Schema-first, inline errors",
    category: "Data",
    lines: [
      "Validate with a schema (zod) and infer the form types from it — no duplicated type definitions.",
      "Show field errors inline beneath the field, and summarise on submit for screen readers.",
      "Preserve entered values on failure; warn before discarding unsaved changes.",
    ],
  },
  {
    id: "api-hooks",
    name: "Generic data hooks (house API layer)",
    description: "useFetchData / usePostData / usePutData / usePatchData",
    category: "Data",
    lines: [
      "The API layer is REQUIRED to have this exact shape — it is not a suggestion and not one option among several. Four generic hooks (`useFetchData`, `usePostData`, `usePutData`, `usePatchData`) over TanStack Query and ONE shared axios instance. Components never call axios or fetch directly, and never hand-roll a `useQuery`/`useMutation`; a feature that does is a defect to be refactored, not left in place.",
      `Implement them with exactly these contracts:

\`\`\`ts
// hooks/use-fetch-data.ts
const useFetchData = <TData, TParams>({
  url,
  params,           // serialised through a shared buildQueryString()
  queryKey,         // defaults to [url, params, token]
  queryOptions,     // Omit<UseQueryOptions, "queryKey" | "queryFn">
  enabled = true,
  token,            // optional per-call bearer override
  requiredPermission, action,   // opt-in permission gate: skips the request entirely
}: FetchDataOptions<TData, TParams>) => { /* ... */ }
// Returns the query plus isLoading = query.isLoading || query.isFetching, so a
// background refetch from a filter or page change still shows the skeleton.

// hooks/use-post-data.ts  (and use-put-data.ts / use-patch-data.ts, same shape)
const usePostData = <TData, TVariables>({
  url,
  mutationOptions,
  headers,
  refetchQueries,   // string[] of query keys refetched on success
  onSuccess, onError,
  skipToast = false,          // screens that own their success UX pass true
  toastDuration, toastPosition,
}: UsePostDataProps<TData, TVariables>) => { /* ... */ }
\`\`\``,
      "Mutations unwrap `response.data`, toast success and error through sonner using a shared TOAST_CONFIG, throw an Error carrying `statusCode` and `messageCode` on failure, and refetch the query keys listed in `refetchQueries`.",
      "Error text comes from one shared `extractErrorInfo(error)` helper — never surface a raw axios or exception message to the user.",
      "The axios instance owns auth headers, response-envelope normalisation, 401 refresh and error conversion. Nothing above it repeats that logic.",
      "Feature services are thin wrappers over these hooks (e.g. `useClients()` calls `useFetchData({ url: API.clients.list })`) and live in `features/<feature>/services/`.",
    ],
  },
  {
    id: "pagination",
    name: "Shared pagination hook",
    description: "usePagination + table wiring, no per-page boilerplate",
    category: "Data",
    lines: [
      "Every list screen uses ONE shared `usePagination()` hook instead of a hand-rolled `useState({ page, limit })`.",
      `\`\`\`ts
// hooks/use-pagination.ts
export interface PaginationState { page: number; limit: number; [key: string]: any }

export function usePagination(initial?: Partial<PaginationState>): {
  pagination: PaginationState              // spread straight into the list fetch hook
  setPagination: Dispatch<SetStateAction<PaginationState>>
  onPaginationChange: (page: number, pageSize: number) => void  // wire to the table
  resetPage: () => void                    // call after any search/filter change
}
// Seeds every provided key (status, search, …) so filters autofill from a URL query
// on first render, with page/limit falling back to DEFAULT_PAGE_NUMBER/DEFAULT_PAGE_SIZE.
\`\`\``,
      "Pass `pagination` as the params of the list fetch hook so a page or filter change re-keys the query and refetches automatically.",
      "Wire the table with `paginationCallbacks={{ onPaginationChange }}`; call `resetPage()` whenever a filter or search term changes so the user is never stranded on an empty page 7.",
      "Page size options and defaults come from shared constants, not per-screen literals.",
    ],
  },
  {
    id: "tables",
    name: "Data table pack",
    description: "Sort, filter, paginate, export",
    category: "Data",
    lines: [
      "Tables support column sorting, text search, faceted filters, column visibility and pagination with page size.",
      "Row actions live in an overflow menu; destructive actions require confirmation naming the record.",
      "Provide a CSV export of the current filtered view.",
      "Tables scroll horizontally inside their own container — the page body never scrolls sideways.",
    ],
  },
  {
    id: "data-table-shell",
    name: "One global CRUD table shell",
    description: "CustomDataTable — every list screen looks identical",
    category: "Data",
    lines: [
      "There is exactly ONE table component in the codebase — `components/shared/table/custom-data-table.tsx` — and every CRUD list screen renders it. A feature that hand-rolls its own `<table>`, its own header card or its own pagination row is a defect, not a variation.",
      `It takes the whole list page, not just the grid, so all list screens are identical by construction:

\`\`\`tsx
<CustomDataTable
  title="Customers"                    // shell mode: renders header card + filters + table + pagination
  count={totalCount} countLabel="customer" countSuffix="in directory"
  action={{ label: "Add Customer", onClick: openCreate, icon: Plus,
            permission: { module: "customers", action: "add" } }}
  filters={filterConfig}               // shared FilterConfig[], one horizontal scrolling row
  columns={columns} data={rows} totalCount={totalCount}
  loading={isLoading}                  // renders a table-shaped skeleton, never a spinner
  currentPage={pagination.page}
  paginationCallbacks={{ onPaginationChange }}
  enableColumnToggle                   // "Columns" dropdown; opt out per column with enableHiding: false
  emptyState={<EmptyState … />}        // defaults to an illustrated empty state
/>
\`\`\``,
      "Shell mode (a `title` is passed) renders one rounded card: header with title, sub-stat and primary action; a single-line filter row that scrolls horizontally on overflow; the table; the pagination. Bare mode (`bare`) renders only the grid, for nesting inside an existing card.",
      "Built on TanStack Table with the core, sorted, filtered, faceted and pagination row models. Pagination is server-driven: pass `totalCount` and `paginationCallbacks`, never slice rows in the component.",
      "The primary action is permission-gated by the table itself — pass `permission: { module, action }` and the button disappears for users who lack it, rather than rendering disabled with no explanation.",
      "Loading renders a table-shaped skeleton of the same column widths; empty renders an illustration with one primary action; neither is ever a blank area or a bare spinner.",
    ],
  },
  {
    id: "responsive",
    name: "Responsive rules",
    description: "Mobile-first, no clipped viewports",
    category: "UX",
    lines: [
      "Mobile-first: design the small screen first, then enhance upward at sm/md/lg/xl.",
      "Use dvh rather than vh for full-height layouts so mobile browser chrome cannot clip content.",
      "Multi-column layouts collapse to a single column below md; side panels become sheets.",
      "Tap targets are at least 44×44px with 8px of separation.",
    ],
  },
  {
    id: "rbac",
    name: "Permissions / RBAC",
    description: "Gate UI by capability",
    category: "Data",
    lines: [
      "Gate every action by an explicit permission check, not by role name comparisons scattered in components.",
      "Hide actions the user cannot perform rather than showing them disabled without explanation.",
      "Treat the client-side check as UX only — the server remains the authority.",
    ],
  },
  {
    id: "dark-mode",
    name: "Theming & dark mode",
    description: "Token-driven, both themes",
    category: "UX",
    lines: [
      "All colour comes from CSS custom properties defined once for light and dark; no hardcoded hex values in components.",
      "Both themes are designed, not inverted: verify contrast in each.",
      "Respect the system preference by default and remember an explicit user override.",
    ],
  },
  {
    id: "perf",
    name: "Performance budget",
    description: "Fast by construction",
    category: "Delivery",
    lines: [
      "Server components by default; add a client boundary only where interactivity requires it.",
      "Lazy-load heavy widgets (charts, editors, maps) and avoid blocking the first paint on them.",
      "Images use the framework's image component with explicit dimensions to prevent layout shift.",
    ],
  },
  {
    id: "testing",
    name: "Testing expectations",
    description: "Cover the logic that can break",
    category: "Delivery",
    lines: [
      "Unit-test pure logic (formatters, reducers, validation) and cover each non-trivial branch.",
      "Add a smoke test per screen asserting it renders its loading, empty and populated states.",
    ],
  },
  {
    id: "copy",
    name: "Microcopy rules",
    description: "Plain, specific language",
    category: "UX",
    lines: [
      "Buttons name the action ('Create client'), never 'Submit' or 'OK'.",
      "Error messages say what happened and what to do next; never surface a raw exception.",
      "Dates, currency and numbers use a shared formatter — no ad-hoc formatting in components.",
    ],
  },
]

export const snippetMap = Object.fromEntries(
  snippets.map((s) => [s.id, s])
) as Record<string, Snippet>
