// Vendored from Prompt Studio (features/library/data/templates.ts). Do not edit here — run `pnpm sync`.
export type ScreenTemplate = {
  id: string
  name: string
  /** lucide icon key — resolved in `components/glyph.tsx` */
  icon: string
  description: string
  /** what the template contributes to the generated prompt */
  promptDetails: string
  defaultLayout: string
}

export const screenTemplates: ScreenTemplate[] = [
  {
    id: "auth",
    name: "Authentication",
    icon: "lock",
    description: "Sign in, sign up, reset, verify",
    promptDetails:
      "an authentication screen with validated credentials, visible error handling, disabled-while-submitting state and a redirect to the next screen on success",
    defaultLayout: "auth-center",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "gauge",
    description: "KPIs, charts, recent activity",
    promptDetails:
      "a dashboard summarising the key metrics with cards, at least one chart and a recent-activity list, each with its own loading skeleton and empty state",
    defaultLayout: "dashboard-sidebar",
  },
  {
    id: "table",
    name: "Data Table",
    icon: "table",
    description: "List, filter, sort, paginate",
    promptDetails:
      "a list screen backed by a data table with search, filters, sorting, pagination, row actions and explicit loading/empty/error states",
    defaultLayout: "table-advanced",
  },
  {
    id: "form",
    name: "Form",
    icon: "clipboard",
    description: "Create or edit a record",
    promptDetails:
      "a create/edit form with typed fields, schema validation, inline field errors, an unsaved-changes guard and a clear primary action",
    defaultLayout: "form-two-column",
  },
  {
    id: "list",
    name: "Card List",
    icon: "clipboard",
    description: "Cards or feed, not a grid",
    promptDetails:
      "a list screen rendered as cards or a feed rather than a data grid, with filters above it and its own loading, empty and error states",
    defaultLayout: "search-results",
  },
  {
    id: "detail",
    name: "Detail",
    icon: "file",
    description: "One record in full",
    promptDetails:
      "a record detail screen showing the full record with its related data, status, and the actions available on it",
    defaultLayout: "detail-two-column",
  },
  {
    id: "profile",
    name: "Profile",
    icon: "user",
    description: "User info and preferences",
    promptDetails:
      "a profile screen with the user's identity block, editable details and account preferences",
    defaultLayout: "profile-tabs",
  },
  {
    id: "settings",
    name: "Settings",
    icon: "settings",
    description: "Grouped configuration",
    promptDetails:
      "a settings screen grouping related configuration into sections that save independently, with confirmation for destructive options",
    defaultLayout: "settings-sections",
  },
  {
    id: "admin",
    name: "Admin Panel",
    icon: "shield",
    description: "Privileged management surface",
    promptDetails:
      "an administrative screen gated behind a permission check, with management tables and audit-friendly confirmations on every destructive action",
    defaultLayout: "dashboard-sidebar",
  },
  {
    id: "onboarding",
    name: "Onboarding",
    icon: "sparkles",
    description: "First-run guidance",
    promptDetails:
      "an onboarding flow that tracks completion, lets the user resume later, and explains each step in one sentence",
    defaultLayout: "onboarding-checklist",
  },
  {
    id: "checkout",
    name: "Checkout",
    icon: "credit-card",
    description: "Cart, payment, confirmation",
    promptDetails:
      "a checkout flow with an order summary that stays visible, validated payment inputs, and an unambiguous success screen",
    defaultLayout: "checkout-steps",
  },
  {
    id: "product",
    name: "Product",
    icon: "package",
    description: "Item detail with actions",
    promptDetails:
      "a product screen with gallery, variants, price, availability and an add-to-cart action that gives immediate feedback",
    defaultLayout: "product-gallery",
  },
  {
    id: "landing",
    name: "Landing Page",
    icon: "globe",
    description: "Marketing page inside the app",
    promptDetails:
      "a marketing landing page composed of clearly separated sections with a single conversion goal",
    defaultLayout: "hero-two-column",
  },
  {
    id: "search",
    name: "Search",
    icon: "search",
    description: "Query with facets",
    promptDetails:
      "a search screen with a query input, facet filters, result count, sorting and a no-results state that suggests next steps",
    defaultLayout: "search-results",
  },
  {
    id: "chat",
    name: "Conversation",
    icon: "message",
    description: "Threads and messages",
    promptDetails:
      "a conversation screen with a thread list, a message pane that scrolls to the newest message, and a composer with send-on-enter",
    defaultLayout: "chat-split",
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "calendar",
    description: "Scheduling and events",
    promptDetails:
      "a calendar screen with month/week switching, event chips, and a create-event dialog",
    defaultLayout: "calendar-month",
  },
  {
    id: "empty",
    name: "Empty / Error",
    icon: "inbox",
    description: "No data or failure state",
    promptDetails:
      "a dedicated empty or error screen with an illustration, a plain explanation and one recovery action",
    defaultLayout: "empty-first-run",
  },
  {
    id: "mobile",
    name: "Mobile Screen",
    icon: "smartphone",
    description: "Phone-first surface",
    promptDetails:
      "a mobile-first screen with thumb-reachable actions, a sticky bottom bar and tap targets of at least 44px",
    defaultLayout: "mobile-first",
  },
]

export const screenTemplateMap = Object.fromEntries(
  screenTemplates.map((t) => [t.id, t])
) as Record<string, ScreenTemplate>
