// Vendored from Prompt Studio (features/library/data/layouts-screen.ts). Do not edit here — run `pnpm sync`.
import type { LayoutOption } from "./layout-types"
import {
  avatarRow,
  bar,
  card,
  chart,
  circle,
  col,
  field,
  frame,
  grid,
  heading,
  pill,
  row,
  spacer,
  sub,
  table,
} from "./wire-helpers"
import {
  appBar,
  bubbles,
  chipRow,
  codeBoxes,
  composer,
  floatingTabBar,
  homeIndicator,
  keyboard,
  largeTitle,
  listRow,
  media,
  searchBar,
  segmented,
  settingRow,
  sheet,
  socialButtons,
  statTiles,
  statusBar,
  stickyAction,
  tabBar,
  tabBarWithFab,
} from "./wire-mobile"

/** Left navigation rail used by most app-shell layouts. */
const rail = (width = 22) =>
  col(
    [
      bar(70, "accentLine", 2),
      spacer(0),
      bar(90, "accentSoft"),
      bar(80, "line"),
      bar(85, "line"),
      bar(60, "line"),
    ],
    { gap: 1, pad: 1, tone: "surface", rounded: true, h: 100, grow: 0, w: width }
  )

const topbar = () =>
  row([bar(18, "strong", 2), spacer(1), bar(10, "line"), circle("sm", "accentLine")], {
    gap: 1,
    pad: 1,
    tone: "surface",
    rounded: true,
  })

const kpis = (n = 3) =>
  grid(
    n,
    (i) =>
      col([bar(52, "line"), bar(38, i === 0 ? "accent" : "strong", 2)], {
        gap: 1,
        pad: 1,
        tone: "surface",
        rounded: true,
        border: true,
      }),
    { gap: 1, h: 32 }
  )

export const screenLayouts: LayoutOption[] = [
  // ---------------------------------------------------------- authentication
  {
    id: "auth-center",
    name: "Centered Auth",
    description: "Single centred card — logo, fields, primary action.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A centred authentication card on a plain background: brand logo, heading, email and password fields, a full-width primary submit button, an inline error slot, and secondary links for forgot-password and sign-up.",
    wire: col(
      [
        spacer(1),
        col(
          [
            circle("md", "accent"),
            heading(56),
            field(),
            field(),
            pill(100),
            bar(48, "line"),
          ],
          { gap: 1, pad: 2, tone: "surface", border: true, rounded: true, align: "center", w: 62 }
        ),
        spacer(1),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "auth-split",
    name: "Split Screen Auth",
    description: "Form one side, branded panel the other.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A 50/50 split authentication screen: the form (logo, heading, fields, submit, alternate-provider buttons) on the left, and a branded panel with an illustration plus a short value proposition on the right. The branded panel collapses on mobile.",
    wire: row(
      [
        col([circle("sm", "accentLine"), heading(70), field(), field(), pill(60)], {
          gap: 1,
          pad: 1,
          grow: 1,
        }),
        col([heading(70), sub(90), sub(60), spacer(1), bar(40, "accentLine")], {
          gap: 1,
          pad: 2,
          tone: "accentSoft",
          rounded: true,
          grow: 1,
          align: "center",
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "auth-minimal",
    name: "Minimal Auth",
    description: "No card, generous whitespace, one field at a time.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A minimal authentication screen with no card chrome: small wordmark, one large heading, a single email field with an inline continue button, and provider buttons underneath. Generous vertical whitespace.",
    wire: col(
      [spacer(1), heading(50), sub(34), field(false, 70), pill(30), spacer(1)],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "auth-otp",
    name: "OTP / Verification",
    description: "Code entry boxes with resend timer.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A verification screen with six single-character OTP inputs that auto-advance and accept paste, a masked destination line, a resend link with a countdown, and a verify button that is disabled until the code is complete.",
    wire: col(
      [
        spacer(1),
        heading(48),
        sub(62),
        grid(6, bar(100, "surface", 3), { gap: 1, h: 18 }),
        pill(40),
        bar(30, "line"),
        spacer(1),
      ],
      { gap: 1, align: "center" }
    ),
  },

  // -------------------------------------------------------------- dashboards
  {
    id: "dashboard-sidebar",
    name: "Sidebar Dashboard",
    description: "Left nav rail, KPI row, chart and table.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard", "admin", "settings"],
    promptDetails:
      "An app shell with a collapsible left sidebar (grouped nav items, active state, user block at the bottom), a top bar with breadcrumbs and search, then a KPI card row, a primary chart, and a recent-activity table in the content area.",
    wire: row(
      [
        rail(),
        col([topbar(), kpis(3), chart("bars", { grow: 1 }), table({ rows: 2, cols: 4 })], {
          gap: 1,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "dashboard-topnav",
    name: "Top Nav Dashboard",
    description: "Horizontal nav, full-width content.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard", "admin"],
    promptDetails:
      "A dashboard with horizontal top navigation (logo, primary links, search, notifications, avatar menu) and full-width content below: a filter bar, a KPI row, and two charts side by side.",
    wire: frame(
      col(
        [
          row([bar(16, "strong", 2), spacer(1), bar(8, "line"), bar(8, "line"), circle("sm")], {
            gap: 1,
          }),
          kpis(4),
          row([chart("line", { grow: 2 }), chart("donut", { grow: 1 })], { gap: 1, grow: 1 }),
        ],
        { gap: 1 }
      ),
      "browser"
    ),
  },
  {
    id: "dashboard-cards",
    name: "Card Grid Dashboard",
    description: "Equal-weight metric cards in a grid.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard"],
    promptDetails:
      "A card-grid dashboard: a responsive grid of equally weighted metric cards, each with a label, a large value, a delta chip and a sparkline. Cards reflow 4 → 2 → 1 across breakpoints.",
    wire: col(
      [
        row([bar(24, "strong", 2), spacer(1), pill(14)], { gap: 1 }),
        grid(
          3,
          (i) =>
            col([bar(50, "line"), bar(40, "strong", 2), bar(70, i % 2 ? "accentLine" : "accent")], {
              gap: 1,
              pad: 1,
              tone: "surface",
              border: true,
              rounded: true,
            }),
          { cols: 3, rows: 2, gap: 1, grow: 1 }
        ),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "dashboard-analytics",
    name: "Analytics Dashboard",
    description: "Chart-first with a filter rail.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard"],
    promptDetails:
      "An analytics-first dashboard: a date-range and segment filter bar pinned at the top, one large primary chart, a legend with toggleable series, and a breakdown table beneath it.",
    wire: col(
      [
        row([pill(16, "accentSoft"), pill(16, "accentSoft"), spacer(1), bar(12, "line")], {
          gap: 1,
        }),
        chart("line", { grow: 2 }),
        row([table({ cols: 3, rows: 3, grow: 2 }), chart("donut", { grow: 1 })], { gap: 1, grow: 2 }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------- forms
  {
    id: "form-single",
    name: "Single Column Form",
    description: "One field per row, sticky actions.",
    category: "Forms",
    scope: "screen",
    templates: ["form"],
    promptDetails:
      "A single-column form on a centred content column: section heading, labelled fields stacked one per row with inline validation messages, a helper text slot, and a sticky footer with cancel and save actions.",
    wire: col(
      [heading(40), field(), field(), field(), spacer(1), row([spacer(1), pill(18, "accentSoft"), pill(18)], { gap: 1 })],
      { gap: 1 }
    ),
  },
  {
    id: "form-two-column",
    name: "Two Column Form",
    description: "Paired fields, full-width for long inputs.",
    category: "Forms",
    scope: "screen",
    templates: ["form", "onboarding"],
    promptDetails:
      "A two-column form: related short fields sit side by side (first/last name, city/postcode) while long inputs (email, address, notes) span the full width. Fields collapse to one column below the medium breakpoint.",
    wire: col(
      [
        heading(38),
        row([field(), field()], { gap: 1 }),
        row([field(), field()], { gap: 1 }),
        field(),
        row([spacer(1), pill(20)], { gap: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "form-wizard",
    name: "Multi-Step Wizard",
    description: "Numbered steps with progress and draft save.",
    category: "Forms",
    scope: "screen",
    templates: ["form", "onboarding", "checkout"],
    promptDetails:
      "A multi-step wizard: a numbered step indicator with completed/current/upcoming states, one step's fields visible at a time, per-step validation before advancing, back/next actions, and a saved-draft banner on return.",
    wire: col(
      [
        row([circle("sm", "accent"), bar(20, "accentLine"), circle("sm", "line"), bar(20, "line"), circle("sm", "line")], {
          gap: 1,
        }),
        field(),
        field(),
        spacer(1),
        row([pill(16, "accentSoft"), spacer(1), pill(16)], { gap: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "form-sidebar-summary",
    name: "Form + Summary Rail",
    description: "Fields left, live summary right.",
    category: "Forms",
    scope: "screen",
    templates: ["form", "checkout"],
    promptDetails:
      "A form with a sticky summary rail: inputs on the left, and a right-hand panel that mirrors the entered values live (totals, selections) and holds the primary submit button. The rail moves below the form on mobile.",
    wire: row(
      [
        col([heading(46), field(), field(), field()], { gap: 1, grow: 2 }),
        col([bar(60, "strong"), bar(90), bar(70), spacer(1), pill(100)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------ tables
  {
    id: "table-basic",
    name: "Basic Data Table",
    description: "Sortable columns, simple pagination.",
    category: "Tables",
    scope: "screen",
    templates: ["table"],
    promptDetails:
      "A straightforward data table: sortable column headers, zebra-free bordered rows, a row count, and simple previous/next pagination. Includes explicit loading skeleton and empty states.",
    wire: col([row([bar(22, "strong", 2), spacer(1), pill(14)], { gap: 1 }), table({ rows: 5, cols: 4, grow: 1 })], {
      gap: 1,
    }),
  },
  {
    id: "table-advanced",
    name: "Advanced Data Table",
    description: "Filters, column toggles, bulk actions.",
    category: "Tables",
    scope: "screen",
    templates: ["table", "admin"],
    promptDetails:
      "A full data grid: search plus faceted filter chips, column visibility toggle, sticky header, row selection with a bulk-action bar, per-row overflow menu (view/edit/delete), server-style pagination with page size, and CSV export.",
    wire: col(
      [
        row([pill(20, "accentSoft"), pill(12, "accentSoft"), spacer(1), pill(12), pill(10)], { gap: 1 }),
        table({ rows: 5, cols: 5, grow: 1 }),
        row([bar(18, "line"), spacer(1), bar(10, "accentLine"), bar(6, "line")], { gap: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "table-master-detail",
    name: "Master / Detail",
    description: "List on the left, record on the right.",
    category: "Tables",
    scope: "screen",
    templates: ["table", "detail", "admin"],
    promptDetails:
      "A master/detail screen: a searchable list of records on the left with the selected row highlighted, and the full record on the right with tabs for its sub-sections. On mobile the detail opens as a full-screen view with a back action.",
    wire: row(
      [
        col([field(false), bar(100, "accentSoft", 3), bar(100, "surface", 3), bar(100, "surface", 3), bar(100, "surface", 3)], {
          gap: 1,
          grow: 1,
        }),
        col([heading(50), row([bar(14, "accentLine"), bar(14, "line"), bar(14, "line")], { gap: 1 }), table({ rows: 3, cols: 3, grow: 1 })], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "board-kanban",
    name: "Kanban Board",
    description: "Draggable cards across status columns.",
    category: "Tables",
    scope: "screen",
    templates: ["table", "admin"],
    promptDetails:
      "A kanban board: horizontally scrolling status columns with counts, draggable cards showing title, tags and assignee avatar, an add-card affordance per column, and keyboard-accessible move actions as a drag alternative.",
    wire: grid(
      4,
      (i) =>
        col(
          i === 1
            ? [bar(60, "accentLine"), card(), card()]
            : [bar(60, "line"), card(), card()],
          { gap: 1, pad: 1, tone: "surface", rounded: true }
        ),
      { gap: 1, grow: 1 }
    ),
  },

  // ------------------------------------------------------- profile & settings
  {
    id: "profile-sidebar",
    name: "Profile with Side Nav",
    description: "Section nav left, content right.",
    category: "Profile",
    scope: "screen",
    templates: ["profile", "settings"],
    promptDetails:
      "A profile screen with a left section navigation (Overview, Security, Notifications, Billing), and the selected section on the right with a header block showing avatar, name and role.",
    wire: row(
      [
        col([bar(80, "accentSoft"), bar(70, "line"), bar(75, "line"), bar(60, "line")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 1,
        }),
        col([avatarRow(), field(), field(), row([spacer(1), pill(22)], { gap: 1 })], { gap: 1, grow: 2 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "profile-tabs",
    name: "Tabbed Profile",
    description: "Hero header with tabbed sections.",
    category: "Profile",
    scope: "screen",
    templates: ["profile", "detail"],
    promptDetails:
      "A profile with a hero header (large avatar, name, role, key stats, primary action) and tabbed sections below it that keep the tab in the URL so a tab can be linked to directly.",
    wire: col(
      [
        row([circle("lg", "accentLine"), col([heading(60), sub(40)], { gap: 1, grow: 1 }), pill(18)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
        }),
        row([bar(14, "accentLine"), bar(14, "line"), bar(14, "line"), spacer(1)], { gap: 1 }),
        grid(2, card(), { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "settings-sections",
    name: "Settings Sections",
    description: "Stacked cards, one concern each.",
    category: "Profile",
    scope: "screen",
    templates: ["settings"],
    promptDetails:
      "A settings page built from stacked cards, one concern per card (profile, security, notifications, danger zone), each with its own description, controls and save button so a change saves independently.",
    wire: col(
      [
        heading(30),
        row([col([bar(50, "strong"), bar(80)], { gap: 1, grow: 2 }), pill(20, "accentSoft")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        row([col([bar(45, "strong"), bar(75)], { gap: 1, grow: 2 }), pill(20, "accentSoft")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        row([col([bar(40, "strong"), bar(65)], { gap: 1, grow: 2 }), pill(20)], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------ detail
  {
    id: "detail-hero",
    name: "Detail with Hero",
    description: "Header summary, then content blocks.",
    category: "Detail",
    scope: "screen",
    templates: ["detail", "product"],
    promptDetails:
      "A record detail screen: a hero summary strip (title, status chip, key facts, primary and overflow actions) followed by content blocks — description, related records table, and an activity timeline.",
    wire: col(
      [
        row([col([heading(50), sub(34)], { gap: 1, grow: 1 }), pill(16, "accentSoft"), pill(16)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
        }),
        row([col([bar(90), bar(80), bar(60)], { gap: 1, grow: 2 }), card()], { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "detail-two-column",
    name: "Detail Two Column",
    description: "Main content left, meta rail right.",
    category: "Detail",
    scope: "screen",
    templates: ["detail"],
    promptDetails:
      "A two-column detail view: primary content on the left (description, tabs, comments) and a sticky metadata rail on the right (status, owner, dates, quick actions). The rail stacks under the content on mobile.",
    wire: row(
      [
        col([heading(56), bar(95), bar(88), bar(70), table({ rows: 2, cols: 3, grow: 1 })], { gap: 1, grow: 2 }),
        col([bar(70, "strong"), bar(90), bar(60), pill(100, "accentSoft"), pill(100)], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ---------------------------------------------------------------- commerce
  {
    id: "product-gallery",
    name: "Product Page",
    description: "Gallery left, buy box right.",
    category: "Commerce",
    scope: "screen",
    templates: ["product"],
    promptDetails:
      "A product page: image gallery with thumbnails on the left, and a buy box on the right holding title, price, rating, variant selectors, quantity, add-to-cart and delivery info. Specs and reviews follow below.",
    wire: row(
      [
        col([bar(100, "surface", 3), grid(4, bar(100, "line", 2), { gap: 1, h: 22 })], { gap: 1, grow: 3 }),
        col([heading(80), bar(40, "accent", 2), bar(60), row([pill(30, "accentSoft"), pill(30, "accentSoft")], { gap: 1 }), pill(100)], {
          gap: 1,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "checkout-steps",
    name: "Checkout Flow",
    description: "Steps left, order summary right.",
    category: "Commerce",
    scope: "screen",
    templates: ["checkout"],
    promptDetails:
      "A checkout screen: address, delivery and payment as collapsible steps on the left with the active step expanded, and a sticky order summary on the right showing line items, discounts, taxes and total with the pay action.",
    wire: row(
      [
        col([bar(100, "surface", 3), field(), field(), pill(30)], { gap: 1, grow: 2 }),
        col([bar(60, "strong"), bar(90), bar(85), bar(50, "accentLine"), spacer(1), pill(100)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------- misc
  {
    id: "onboarding-checklist",
    name: "Onboarding Checklist",
    description: "Progress + guided task list.",
    category: "Onboarding",
    scope: "screen",
    templates: ["onboarding"],
    promptDetails:
      "A first-run onboarding screen: a progress ring with completion percentage, a checklist of setup tasks each with a description and action button, completed items visibly struck through, and a dismiss-for-now option.",
    wire: row(
      [
        col([chart("donut", { h: 60 }), bar(60, "line")], { gap: 1, pad: 1, tone: "surface", rounded: true, grow: 1, align: "center" }),
        col([row([circle("sm", "accent"), bar(70, "line")], { gap: 1 }), row([circle("sm", "accent"), bar(60, "line")], { gap: 1 }), row([circle("sm", "line"), bar(75, "line")], { gap: 1 }), row([circle("sm", "line"), bar(55, "line")], { gap: 1 })], {
          gap: 1,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "chat-split",
    name: "Conversation Split",
    description: "Thread list left, messages right.",
    category: "Communication",
    scope: "screen",
    templates: ["chat"],
    promptDetails:
      "A conversation screen: thread list on the left with unread indicators and search, message pane on the right with day separators, own/other message alignment, and a composer pinned to the bottom.",
    wire: row(
      [
        col([field(false), avatarRow(), avatarRow(), avatarRow()], { gap: 1, grow: 1 }),
        col([bar(55, "surface", 3), bar(70, "accentSoft", 3), bar(45, "surface", 3), spacer(1), row([field(false, 80), pill(18)], { gap: 1 })], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "calendar-month",
    name: "Calendar Month",
    description: "Month grid with events.",
    category: "Communication",
    scope: "screen",
    templates: ["calendar"],
    promptDetails:
      "A month calendar: weekday header, a 7-column day grid with out-of-month days dimmed, up to three event chips per day plus a +N overflow, and a toolbar to switch month/week/day and create an event.",
    wire: col(
      [
        row([bar(20, "strong", 2), spacer(1), pill(10, "accentSoft"), pill(10, "accentSoft")], { gap: 1 }),
        grid(7, (i) => (i % 5 === 2 ? bar(100, "accentSoft", 3) : bar(100, "surface", 3)), {
          cols: 7,
          rows: 4,
          gap: 1,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "search-results",
    name: "Search & Filters",
    description: "Filter rail with result list.",
    category: "Communication",
    scope: "screen",
    templates: ["search", "table"],
    promptDetails:
      "A search results screen: a filter rail (checkbox facets, range, clear-all) on the left, a result count with sort control, and result cards with highlighted matches. Filters become a bottom sheet on mobile.",
    wire: row(
      [
        col([bar(60, "strong"), bar(80, "line"), bar(70, "line"), bar(75, "line"), bar(50, "accentLine")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 1,
        }),
        col([row([field(false, 70), pill(20, "accentSoft")], { gap: 1 }), card(), card()], { gap: 1, grow: 2 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "empty-first-run",
    name: "Empty / First Run",
    description: "Illustration, explanation, one action.",
    category: "Onboarding",
    scope: "screen",
    templates: ["empty", "onboarding"],
    promptDetails:
      "An empty state screen: a centred illustration, a heading explaining what belongs here, one sentence of guidance, a single primary action and a secondary link to documentation.",
    wire: col([spacer(1), circle("lg", "accentSoft"), heading(46), sub(60), pill(26), spacer(1)], {
      gap: 1,
      align: "center",
    }),
  },
  // ------------------------------------------------------------------ mobile
  // These render inside a phone-shaped frame (LayoutThumb `shape="phone"`),
  // so each wire is just the screen content — the chrome helpers in
  // `wire-mobile.ts` supply the status bar, app bar and tab bar that make a
  // 160px picture read as a phone.
  {
    id: "mobile-auth",
    name: "Sign In",
    description: "Logo, fields, social buttons.",
    category: "Mobile · Auth",
    scope: "screen",
    templates: ["mobile", "auth"],
    promptDetails:
      "A phone sign-in screen: brand mark and a short welcome above the fold, email and password fields with the keyboard never covering the focused one, a full-width primary button, an inline error region above the fields rather than a toast, a Forgot password link, and third-party sign-in buttons below a divider. Submitting disables the button and shows progress in place.",
    wire: col(
      [
        statusBar(),
        spacer(1),
        circle("lg", "accentSoft"),
        largeTitle(58),
        sub(76),
        field(),
        field(),
        row([spacer(1), bar(30, "accentLine")], { align: "end" }),
        pill(100, "accent"),
        row([bar(38, "line")], { align: "center" }),
        socialButtons(2),
        spacer(1),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-auth-social",
    name: "Social Sign In",
    description: "Provider-first, email second.",
    category: "Mobile · Auth",
    scope: "screen",
    templates: ["mobile", "auth"],
    promptDetails:
      "A provider-first sign-in: full-bleed brand imagery in the top half, then Apple/Google/email buttons stacked full width with 44pt minimum height, and a legal line linking terms and privacy. Email/password is a secondary route, not the default. Apple sign-in is present on iOS whenever any other social provider is.",
    wire: col(
      [
        statusBar(),
        media(4),
        spacer(1),
        largeTitle(70),
        sub(84),
        pill(100, "accent"),
        socialButtons(2),
        pill(100, "surface", true),
        row([bar(56, "line")], { align: "center" }),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-otp",
    name: "OTP / Verification",
    description: "Code boxes and keypad.",
    category: "Mobile · Auth",
    scope: "screen",
    templates: ["mobile", "auth"],
    promptDetails:
      "A verification screen: one code box per digit with auto-advance, paste-the-whole-code support and OS autofill from SMS, the destination address shown so the user can check it, a resend control with a visible countdown, and automatic submission once the last digit lands.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, title: 30 }),
        spacer(1),
        largeTitle(64),
        sub(88),
        codeBoxes(4),
        row([bar(44, "accentLine")], { align: "center" }),
        spacer(1),
        keyboard(),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-splash",
    name: "Splash / Launch",
    description: "Logo centred, then route.",
    category: "Mobile · Auth",
    scope: "screen",
    templates: ["mobile", "empty", "onboarding"],
    promptDetails:
      "A launch screen matching the native splash exactly so there is no flash between them: centred brand mark, no spinner unless the wait exceeds a second, and a decision made off-screen about where to send the user — onboarding, sign-in or home.",
    wire: col([statusBar(), spacer(1), circle("lg", "accent"), bar(40, "strong", 2), spacer(1), homeIndicator()], {
      gap: 1,
      align: "center",
    }),
  },
  {
    id: "mobile-onboarding",
    name: "Onboarding Slides",
    description: "Paged intro, dots, skip.",
    category: "Mobile · Onboarding",
    scope: "screen",
    templates: ["mobile", "onboarding"],
    promptDetails:
      "A paged onboarding flow: one illustration, one heading and one line of copy per page, page dots showing position, a Skip control top-right that is always reachable, and a primary button that becomes Get Started on the final page. Swipe and button both advance.",
    wire: col(
      [
        statusBar(),
        row([spacer(1), bar(18, "line")], { align: "end" }),
        spacer(1),
        circle("lg", "accentSoft"),
        largeTitle(72),
        sub(88),
        sub(64),
        row([circle("sm", "accent"), circle("sm", "line"), circle("sm", "line")], {
          gap: 1,
          align: "center",
        }),
        spacer(1),
        pill(100, "accent"),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-onboarding-hero",
    name: "Welcome Hero",
    description: "Full-bleed image, CTA pair.",
    category: "Mobile · Onboarding",
    scope: "screen",
    templates: ["mobile", "onboarding", "landing"],
    promptDetails:
      "A welcome screen with edge-to-edge imagery behind the status bar, a gradient scrim so the copy stays legible, a headline and one supporting line low on the screen, a primary Get started button and a quieter I already have an account link beneath it.",
    wire: col(
      [
        media(6),
        spacer(1),
        largeTitle(80),
        sub(90),
        pill(100, "accent"),
        pill(100, "surface", true),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-permission",
    name: "Permission Ask",
    description: "Explain, then request.",
    category: "Mobile · Onboarding",
    scope: "screen",
    templates: ["mobile", "empty", "onboarding"],
    promptDetails:
      "A pre-permission screen shown *before* the system dialog: an icon, a plain sentence saying what the app will do with the access and what the user gets for it, an Allow button that triggers the real prompt, and a Not now that leaves the app usable. The denied path routes to Settings rather than dead-ending.",
    wire: col(
      [
        statusBar(),
        spacer(1),
        circle("lg", "accentSoft"),
        largeTitle(66),
        sub(90),
        sub(70),
        spacer(1),
        pill(100, "accent"),
        pill(100, "surface", true),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-tabs",
    name: "Bottom Tab Bar",
    description: "Standard tabs, scrolling body.",
    category: "Mobile · Navigation",
    scope: "screen",
    templates: ["mobile", "dashboard", "list"],
    promptDetails:
      "The app shell: 3–5 bottom tabs with icon plus label, the active one clearly marked, each tab keeping its own navigation stack so switching away and back returns to where you were. The bar sits above the home indicator and hides for full-screen media only.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true }),
        largeTitle(58),
        card(),
        card(),
        spacer(1),
        tabBar(4, 0),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-floating-tabs",
    name: "Floating Nav Bar",
    description: "Detached pill navigation.",
    category: "Mobile · Navigation",
    scope: "screen",
    templates: ["mobile", "dashboard", "list"],
    promptDetails:
      "A floating pill navigation detached from the screen edge, with the content scrolling beneath it and bottom padding so the last row is never trapped under the bar. Icon-only with the active item tinted; use it when the content is visual and the chrome should recede.",
    wire: col(
      [
        statusBar(),
        largeTitle(56),
        card(),
        card(),
        card(),
        spacer(1),
        floatingTabBar(4, 0),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-tabs-fab",
    name: "Tabs with Centre Action",
    description: "Raised primary action.",
    category: "Mobile · Navigation",
    scope: "screen",
    templates: ["mobile", "dashboard", "form"],
    promptDetails:
      "A bottom tab bar with a raised centre button for the app's one dominant create action. The button is not a tab — it opens a sheet or a full-screen flow and returns you where you were. Two tabs sit either side of it.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true }),
        largeTitle(52),
        card(),
        card(),
        spacer(1),
        tabBarWithFab(),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-drawer",
    name: "Drawer Navigation",
    description: "Hamburger, slide-over menu.",
    category: "Mobile · Navigation",
    scope: "screen",
    templates: ["mobile", "dashboard", "settings"],
    promptDetails:
      "A drawer shell: hamburger in the app bar opens a slide-over holding the account block and every destination that does not earn a tab. The drawer closes on selection and on backdrop tap, and the hardware back button closes it rather than leaving the screen.",
    wire: row(
      [
        col([circle("sm", "accentSoft"), bar(80, "strong"), listRow({ trailing: false }), listRow({ trailing: false }), listRow({ trailing: false }), spacer(1)], {
          gap: 1,
          pad: 1,
          w: 62,
          tone: "surface",
          border: true,
        }),
        col([statusBar(), appBar({ back: true }), card(), card(), spacer(1)], { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-list",
    name: "Scrolling List",
    description: "Search, pull to refresh, rows.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "table", "list", "search"],
    promptDetails:
      "A phone list: a search field under the header, a virtualised scrolling list of rows (never a data table), pull-to-refresh, infinite scroll with a footer spinner, swipe actions where they apply, and an illustrated empty state with one action.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true }),
        searchBar(),
        listRow(),
        listRow(),
        listRow(),
        listRow(),
        listRow(),
        spacer(1),
        tabBar(4, 1),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-feed",
    name: "Card Feed",
    description: "Scrolling media cards.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "dashboard", "list"],
    promptDetails:
      "A vertically scrolling feed of media cards: image, title, one line of meta, and an action row. Cards are full-bleed to the screen edges with generous vertical rhythm, images have explicit dimensions so nothing shifts as they load, and the feed paginates as the user scrolls.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true }),
        col([media(2), bar(70, "strong"), bar(46, "line"), row([circle("sm", "line"), circle("sm", "line"), spacer(1)], { gap: 1 })], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        col([media(2), bar(64, "strong"), bar(40, "line")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        spacer(1),
        tabBar(4, 0),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-grid",
    name: "Two Column Grid",
    description: "Tiles, filter chips.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "product", "search", "list"],
    promptDetails:
      "A two-column tile grid for browsing visual items: filter chips that scroll horizontally above it, square-ish tiles with an image, a name and a price or meta line, and skeleton tiles of the same shape while loading.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true }),
        chipRow(4, 0),
        grid(2, () => col([media(2), bar(80, "strong"), bar(50, "line")], {
          gap: 0,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }), { gap: 1, rows: 2 }),
        spacer(1),
        tabBar(4, 1),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-detail",
    name: "Detail with Hero",
    description: "Image header, sticky action.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "detail", "product"],
    promptDetails:
      "A detail screen: hero image or coloured header that collapses on scroll, a back control overlaid on it, title and metadata, the body in a single column, and a sticky bottom bar holding the primary action above the safe area so it is always reachable by thumb.",
    wire: col(
      [
        media(4),
        largeTitle(78),
        sub(52),
        segmented(3, 0),
        bar(92, "line"),
        bar(84, "line"),
        bar(70, "line"),
        spacer(1),
        stickyAction(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-profile",
    name: "Profile",
    description: "Avatar header, stats, rows.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "profile"],
    promptDetails:
      "A profile screen: avatar, name and role centred at the top, a row of stat counts beneath, then grouped rows of actions. The edit action sits in the app bar rather than competing with the content.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true }),
        circle("lg", "accentSoft"),
        bar(50, "strong", 2),
        bar(34, "line"),
        statTiles(3),
        col([settingRow(), settingRow(), settingRow()], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        spacer(1),
        tabBar(4, 3),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-settings",
    name: "Settings List",
    description: "Grouped rows and switches.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "settings"],
    promptDetails:
      "A settings screen built from grouped rows with section headings: each row is a label with a value, a chevron or a switch, switches apply immediately with no Save button, and destructive actions sit in their own group at the bottom behind a confirmation.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, title: 34 }),
        bar(26, "line"),
        col([settingRow(true), settingRow(true), settingRow()], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        bar(22, "line"),
        col([settingRow(), settingRow(true)], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        spacer(1),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-chat",
    name: "Chat",
    description: "Bubbles and composer.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "chat"],
    promptDetails:
      "A conversation screen: alternating message bubbles, sender avatar on incoming messages, day separators, the newest message visible on open, and a composer pinned above the keyboard that grows to a few lines before it scrolls. Sending is optimistic with a failed state that can be retried.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, action: true, title: 36 }),
        bubbles(5),
        spacer(1),
        composer(),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-search",
    name: "Search",
    description: "Field, chips, results.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "search"],
    promptDetails:
      "A search screen: the field focused on entry with the keyboard already up, recent searches before a query is typed, filter chips under the field, and results appearing as the user types with a debounce. An empty result shows what was searched and how to widen it.",
    wire: col(
      [
        statusBar(),
        row([searchBar(), bar(14, "accentLine")], { gap: 1, align: "between" }),
        chipRow(4, 1),
        listRow(),
        listRow(),
        listRow(),
        spacer(1),
        keyboard(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-notifications",
    name: "Notifications",
    description: "Unread dots, grouped.",
    category: "Mobile · Content",
    scope: "screen",
    templates: ["mobile", "list"],
    promptDetails:
      "A notification list grouped by day, unread entries marked with a dot and a tinted background, swipe to dismiss, a mark-all-read action in the app bar, and each entry navigating to the thing it is about rather than a generic screen.",
    wire: col(
      [
        statusBar(),
        appBar({ action: true, title: 46 }),
        bar(24, "line"),
        row([circle("sm", "accent"), col([bar(80, "strong"), bar(56, "line")], { gap: 0, grow: 1 })], { gap: 1 }),
        row([circle("sm", "accent"), col([bar(72, "strong"), bar(48, "line")], { gap: 0, grow: 1 })], { gap: 1 }),
        bar(20, "line"),
        listRow({ trailing: false }),
        listRow({ trailing: false }),
        spacer(1),
        tabBar(4, 2),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-stats",
    name: "Stats Dashboard",
    description: "KPI tiles and a chart.",
    category: "Mobile · Data",
    scope: "screen",
    templates: ["mobile", "dashboard"],
    promptDetails:
      "A phone dashboard: a greeting, a row of KPI tiles sized for two per row, one chart with an accessible text summary, and a recent-activity list below. Every tile has a skeleton of its own shape while loading; nothing is a spinner over the whole screen.",
    wire: col(
      [
        statusBar(),
        largeTitle(56),
        sub(40),
        statTiles(2),
        col([bar(50, "strong"), chart("line", { h: 40 })], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        listRow(),
        listRow(),
        spacer(1),
        tabBar(4, 0),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-calendar",
    name: "Calendar",
    description: "Month grid, agenda below.",
    category: "Mobile · Data",
    scope: "screen",
    templates: ["mobile", "calendar"],
    promptDetails:
      "A calendar screen: a month grid with dots marking days that have events, the selected day highlighted, and that day's agenda listed beneath it. Swiping moves between months, and today is always one tap away.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, action: true, title: 40 }),
        grid(7, () => bar(100, "line"), { gap: 1, rows: 5 }),
        bar(30, "line"),
        listRow({ avatar: false }),
        listRow({ avatar: false }),
        spacer(1),
        tabBar(4, 1),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-map",
    name: "Map",
    description: "Full-bleed map, sheet over it.",
    category: "Mobile · Data",
    scope: "screen",
    templates: ["mobile", "dashboard"],
    promptDetails:
      "A full-bleed map with markers and a floating recentre control, and a bottom sheet listing what is on the map that drags to full height. Location permission denied and location unavailable are visible states with a way forward, not silence.",
    wire: col(
      [
        media(7),
        spacer(1),
        sheet([bar(52, "strong", 2), listRow(), listRow()]),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-scanner",
    name: "Camera / Scanner",
    description: "Viewfinder and capture.",
    category: "Mobile · Data",
    scope: "screen",
    templates: ["mobile", "empty"],
    promptDetails:
      "A camera surface: full-screen viewfinder with a framing guide, a large capture control at the bottom, torch and flip actions, and handled states for permission denied and no camera available. Captured media is confirmed before it is used.",
    wire: col(
      [
        media(7),
        spacer(1),
        row([circle("sm", "line"), circle("lg", "accent"), circle("sm", "line")], {
          gap: 1,
          align: "between",
        }),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-form",
    name: "Form",
    description: "Stacked fields, keyboard aware.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "form"],
    promptDetails:
      "A phone form: full-width stacked fields with labels above them, a keyboard-avoiding scroll so the focused field is never covered, Next/Done return keys moving between fields, inline validation beneath each field, and the submit button pinned above the keyboard.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, title: 38 }),
        field(),
        field(),
        field(),
        spacer(1),
        pill(100, "accent"),
        keyboard(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-wizard",
    name: "Multi-Step Flow",
    description: "Progress bar, one step per screen.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "form", "onboarding", "checkout"],
    promptDetails:
      "A multi-step flow: a progress indicator showing step n of m, exactly one decision per screen, Back always available without losing entered data, and the final step summarising everything before the commit action.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, title: 30 }),
        row([bar(100, "accent"), bar(100, "surface"), bar(100, "surface")], { gap: 1 }),
        largeTitle(66),
        sub(84),
        field(),
        field(),
        spacer(1),
        row([pill(100, "surface", true), pill(100, "accent")], { gap: 1 }),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-checkout",
    name: "Checkout",
    description: "Summary, method, pay.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "checkout"],
    promptDetails:
      "A phone checkout: order summary at the top, delivery and payment method as tappable rows that open sheets, the total pinned with the pay button above the safe area, and native payment (Apple Pay / Google Pay) offered first where available. The pay button shows progress and cannot be double-tapped.",
    wire: col(
      [
        statusBar(),
        appBar({ back: true, title: 36 }),
        col([listRow(), listRow()], { gap: 1, pad: 1, tone: "surface", border: true, rounded: true }),
        settingRow(),
        settingRow(),
        spacer(1),
        row([bar(30, "line"), spacer(1), bar(24, "strong", 2)], { align: "between" }),
        pill(100, "accent"),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-sheet",
    name: "Bottom Sheet",
    description: "Modal sheet over a screen.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "form", "detail"],
    promptDetails:
      "Content presented as a bottom sheet over the screen beneath: a drag handle, half and full detents, dismissal by swipe-down and backdrop tap, and the screen behind dimmed but visible. Never used for something the user must not lose.",
    wire: col(
      [
        statusBar(),
        bar(60, "line"),
        bar(46, "line"),
        spacer(1),
        sheet([largeTitle(62), sub(84), field(), pill(100, "accent")]),
        homeIndicator(),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-filters",
    name: "Filter Sheet",
    description: "Chips, ranges, apply.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "search", "list"],
    promptDetails:
      "A filter sheet raised over the results: chip groups per facet, a reset that clears everything, a live count on the Apply button so the effect is known before committing, and the sheet closing back to the list with the filters visible as chips.",
    wire: col(
      [
        statusBar(),
        listRow(),
        listRow(),
        spacer(1),
        sheet([
          row([bar(30, "strong", 2), spacer(1), bar(18, "accentLine")], { align: "between" }),
          bar(24, "line"),
          chipRow(4, 1),
          bar(22, "line"),
          chipRow(3, 0),
          pill(100, "accent"),
        ]),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-paywall",
    name: "Paywall / Plans",
    description: "Plan cards, restore.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "checkout", "product"],
    promptDetails:
      "A subscription screen: the value stated in three short lines, plan cards with one marked as recommended and the per-period price spelled out, a single subscribe action, and Restore purchases plus terms links — both required by the app stores.",
    wire: col(
      [
        statusBar(),
        row([spacer(1), circle("sm", "line")], { align: "end" }),
        circle("lg", "accentSoft"),
        largeTitle(70),
        sub(86),
        sub(70),
        row([
          col([bar(60, "strong"), bar(40, "line")], { gap: 0, pad: 1, tone: "surface", border: true, rounded: true, grow: 1 }),
          col([bar(60, "strong"), bar(40, "line")], { gap: 0, pad: 1, tone: "accentSoft", border: true, rounded: true, grow: 1 }),
        ], { gap: 1 }),
        pill(100, "accent"),
        row([bar(52, "line")], { align: "center" }),
        homeIndicator(),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-empty",
    name: "Empty / First Run",
    description: "Illustration and one action.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "empty"],
    promptDetails:
      "An empty state: a centred illustration, a heading naming what belongs here, one sentence of guidance and a single primary action. Used for a first run and for a filtered list that matched nothing — in which case it says what was filtered.",
    wire: col(
      [
        statusBar(),
        appBar({ title: 32 }),
        spacer(1),
        circle("lg", "accentSoft"),
        largeTitle(64),
        sub(84),
        pill(70, "accent"),
        spacer(1),
        tabBar(4, 0),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "mobile-first",
    name: "Mobile First Screen",
    description: "Single column, sticky action.",
    category: "Mobile · Flows",
    scope: "screen",
    templates: ["mobile", "onboarding", "auth"],
    promptDetails:
      "A mobile-first screen: a single scrolling column, a sticky bottom action bar holding the primary control within thumb reach, tap targets of at least 44pt, and content that stays legible at the largest system font size.",
    wire: col([statusBar(), largeTitle(70), sub(50), card(), card(), spacer(1), stickyAction()], {
      gap: 1,
    }),
  },
]
