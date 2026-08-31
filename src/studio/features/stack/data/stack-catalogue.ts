// Vendored from Prompt Studio (features/stack/data/stack-catalogue.ts). Do not edit here — run `pnpm sync`.
import type { Stack, Surface } from "../../../types/project"
import { isNative, platformOf } from "./platforms"

export type StackOption = {
  id: string
  label: string
  /** the line injected into the Tech Stack block */
  promptLine: string
  /** ids from other groups this option cannot be combined with */
  incompatibleWith?: string[]
}

export type StackGroup = {
  key: keyof Omit<Stack, "extras">
  label: string
  hint: string
  options: StackOption[]
  /**
   * Which builds this question is worth asking on. Omitted means all of them.
   *
   * A service has no icon set and a web app has no database; showing both to
   * both is how a backend brief ended up carrying Lucide and a web brief
   * ended up carrying Postgres, neither of which anyone chose.
   */
  appliesTo?: Surface[]
}

export const stackGroups: StackGroup[] = [
  {
    key: "framework",
    label: "Framework",
    hint: "Runtime + routing model",
    options: [
      {
        id: "next-16",
        label: "Next.js 16 (App Router)",
        promptLine:
          "Next.js 16 with the App Router; server components by default and `\"use client\"` only where interactivity requires it.",
      },
      {
        id: "next-15",
        label: "Next.js 15 (App Router)",
        promptLine: "Next.js 15 with the App Router and React Server Components.",
      },
      {
        id: "next-pages",
        label: "Next.js (Pages Router)",
        promptLine: "Next.js using the Pages Router with `getServerSideProps`/`getStaticProps`.",
      },
      {
        id: "vite-react",
        label: "Vite + React SPA",
        promptLine:
          "A Vite-powered React single-page app with React Router for client-side routing.",
        incompatibleWith: ["route-colocated"],
      },
      {
        id: "remix",
        label: "Remix / React Router 7",
        promptLine: "Remix (React Router 7 framework mode) with loaders and actions.",
      },
      {
        id: "astro",
        label: "Astro + React islands",
        promptLine: "Astro for static delivery with React islands for interactive parts.",
      },
      {
        id: "expo-router",
        label: "React Native — Expo Router",
        promptLine:
          "React Native with Expo (SDK 52+) and Expo Router — file-based routing under `app/`, typed routes enabled, `(tabs)` and `(stack)` groups for navigators. Targets Android and iOS from one codebase.",
      },
      {
        id: "react-native",
        label: "React Native — React Navigation",
        promptLine:
          "Bare React Native with React Navigation — navigators declared in code (native stack, bottom tabs, drawer) with a typed param list per navigator. Targets Android and iOS from one codebase.",
      },
      {
        id: "swiftui",
        label: "SwiftUI (iOS)",
        promptLine:
          "Native iOS in SwiftUI, targeting the two most recent major iOS versions. `NavigationStack` with a typed path for navigation, `@Observable` models, and Swift Concurrency (`async`/`await`) for all I/O.",
      },
      {
        id: "uikit",
        label: "UIKit (iOS)",
        promptLine:
          "Native iOS in UIKit with programmatic view controllers and a coordinator per flow — no storyboards for new screens.",
      },
      // ── services ──────────────────────────────────────────────────────
      //
      // The Backend tab existed long before any of these did: it blanked out
      // the presentation fields and offered nothing in their place, so a
      // service brief named no server technology at all.
      {
        id: "fastapi",
        label: "FastAPI + SQLAlchemy (Python)",
        promptLine:
          "FastAPI on Python 3.13 with async SQLAlchemy 2 and Alembic migrations; Pydantic v2 models for every request and response, and dependency-injected sessions rather than a global engine.",
      },
      {
        id: "nestjs",
        label: "NestJS + Prisma (TypeScript)",
        promptLine:
          "NestJS with Prisma; one module per product area, DTOs validated by class-validator, and services that never reach into another module's repository directly.",
      },
      {
        id: "express-drizzle",
        label: "Express / Fastify + Drizzle (TypeScript)",
        promptLine:
          "Fastify with Drizzle ORM; routes declared with typed schemas, handlers thin, and all data access behind a repository module.",
      },
      {
        id: "django-drf",
        label: "Django REST Framework (Python)",
        promptLine:
          "Django with Django REST Framework; serializers for every payload, viewsets over hand-rolled views, and the admin left enabled for internal use.",
      },
    ],
  },
  {
    key: "language",
    label: "Language",
    hint: "Type-safety level",
    options: [
      {
        id: "ts-strict",
        label: "TypeScript (strict)",
        promptLine:
          "TypeScript in strict mode. No implicit `any`; every prop, payload and return value is typed.",
      },
      { id: "ts", label: "TypeScript", promptLine: "TypeScript with default compiler strictness." },
      { id: "js", label: "JavaScript", promptLine: "Plain JavaScript with JSDoc type hints." },
      {
        id: "swift",
        label: "Swift 6",
        promptLine:
          "Swift 6 with strict concurrency checking on. Value types by default, `@MainActor` on anything touching UI, and no force unwraps outside tests.",
      },
      {
        id: "python",
        label: "Python 3.13 (typed)",
        promptLine:
          "Python 3.13 with type hints on every signature, checked by mypy in strict mode. No untyped `dict` passed between layers.",
      },
    ],
  },
  {
    key: "styling",
    appliesTo: ["web", "mobile"],
    label: "Styling",
    hint: "How components are styled",
    options: [
      {
        id: "tailwind4-shadcn",
        label: "Tailwind v4 + shadcn/ui",
        promptLine:
          "Tailwind CSS v4 with shadcn/ui primitives. All colour comes from CSS custom properties defined in `globals.css` — no hardcoded hex values in components.",
      },
      {
        id: "tailwind3-shadcn",
        label: "Tailwind v3 + shadcn/ui",
        promptLine: "Tailwind CSS v3 with shadcn/ui primitives and a `tailwind.config.ts` theme.",
      },
      { id: "tailwind", label: "Tailwind only", promptLine: "Tailwind CSS with hand-built components." },
      { id: "css-modules", label: "CSS Modules", promptLine: "CSS Modules with design tokens in a shared stylesheet." },
      { id: "styled", label: "styled-components", promptLine: "styled-components with a shared ThemeProvider." },
      { id: "mui", label: "MUI", promptLine: "MUI components with a customised theme." },
      {
        id: "nativewind",
        label: "NativeWind (RN)",
        promptLine:
          "NativeWind v4 for styling React Native — Tailwind class names compiled to native styles, with the design tokens defined once in `tailwind.config`.",
      },
      {
        id: "rn-stylesheet",
        label: "StyleSheet + theme (RN)",
        promptLine:
          "React Native `StyleSheet.create` with one shared theme object for colour, spacing and type. No inline style objects in render — they defeat the style registry and re-allocate every frame.",
      },
      {
        id: "swiftui-modifiers",
        label: "SwiftUI modifiers",
        promptLine:
          "SwiftUI view modifiers with a shared design system: colours and spacing from an asset catalogue and a `Theme` enum, custom `ViewModifier`s for repeated treatments, and Dynamic Type respected everywhere.",
      },
    ],
  },
  {
    key: "state",
    label: "State",
    hint: "Server cache + client state",
    options: [
      {
        id: "tanstack-zustand",
        label: "TanStack Query + Zustand",
        promptLine:
          "Server state in TanStack Query v5 (never copied into client stores); client/session state in Zustand; local UI state in `useState`.",
      },
      { id: "tanstack", label: "TanStack Query only", promptLine: "TanStack Query v5 for all server state." },
      { id: "redux", label: "Redux Toolkit", promptLine: "Redux Toolkit with RTK Query for data fetching." },
      { id: "swr", label: "SWR", promptLine: "SWR for data fetching and caching." },
      { id: "context", label: "React Context", promptLine: "React Context plus `useReducer` for shared state." },
      { id: "none-state", label: "Local state only", promptLine: "Component-local state only; no global store." },
      {
        id: "rn-query-zustand",
        label: "TanStack Query + Zustand (RN)",
        promptLine:
          "TanStack Query v5 for server state with a persisted cache so the app opens with data offline; Zustand for session and UI state, persisted through AsyncStorage/MMKV.",
      },
      {
        id: "swift-observable",
        label: "@Observable (SwiftUI)",
        promptLine:
          "SwiftUI state with `@Observable` models owned by the view that presents them, `@State` for local UI, and dependencies injected through the environment rather than singletons.",
      },
      {
        id: "swift-tca",
        label: "TCA (Composable Architecture)",
        promptLine:
          "The Composable Architecture: one reducer per feature, state and actions explicit, effects isolated behind dependencies for testability.",
      },
      {
        id: "none-state-server",
        label: "n/a — service",
        promptLine: "",
      },
    ],
  },
  {
    key: "forms",
    appliesTo: ["web", "mobile"],
    label: "Forms",
    hint: "Inputs + validation",
    options: [
      {
        id: "rhf-zod",
        label: "react-hook-form + zod",
        promptLine:
          "react-hook-form with zod resolvers; form types are inferred from the schema via `z.infer`.",
      },
      { id: "rhf", label: "react-hook-form", promptLine: "react-hook-form with hand-written validation rules." },
      { id: "formik", label: "Formik + Yup", promptLine: "Formik with Yup validation schemas." },
      { id: "native-forms", label: "Native form elements", promptLine: "Native form elements with the Constraint Validation API." },
    ],
  },
  {
    key: "http",
    label: "HTTP",
    hint: "How the API is called",
    options: [
      {
        id: "axios-instance",
        label: "axios (shared instance)",
        promptLine:
          "A single shared axios instance with interceptors for auth headers, response normalisation and 401 refresh — components never call axios directly.",
      },
      { id: "fetch-wrapper", label: "fetch wrapper", promptLine: "A thin typed `fetch` wrapper with a single place for auth and error handling." },
      { id: "server-actions", label: "Server actions", promptLine: "Next.js server actions for mutations; no client-side API layer." },
      { id: "trpc", label: "tRPC", promptLine: "tRPC for end-to-end typed procedures." },
      {
        id: "swift-urlsession",
        label: "URLSession client (Swift)",
        promptLine:
          "One `APIClient` actor over `URLSession` with `async`/`await`, `Codable` models, a typed `APIError`, and auth-token refresh handled in that single place.",
      },
      { id: "none-http", label: "No backend", promptLine: "No network layer — all data is local/mocked." },
      {
        id: "none-http-server",
        label: "n/a — service",
        promptLine: "",
      },
    ],
  },
  {
    key: "icons",
    appliesTo: ["web", "mobile"],
    label: "Icons",
    hint: "Icon set",
    options: [
      { id: "lucide", label: "lucide-react", promptLine: "Icons from lucide-react at a consistent stroke width and size scale." },
      { id: "hugeicons", label: "Hugeicons", promptLine: "Icons from @hugeicons/react." },
      { id: "heroicons", label: "Heroicons", promptLine: "Icons from Heroicons." },
      { id: "radix-icons", label: "Radix icons", promptLine: "Icons from @radix-ui/react-icons." },
      {
        id: "rn-vector-icons",
        label: "Expo / RN vector icons",
        promptLine: "Icons from @expo/vector-icons at one consistent size scale.",
      },
      {
        id: "sf-symbols",
        label: "SF Symbols (iOS)",
        promptLine:
          "SF Symbols for iconography, with symbol weights matched to the adjacent text style so they scale with Dynamic Type.",
      },
    ],
  },
  {
    key: "tables",
    appliesTo: ["web", "mobile"],
    label: "Tables",
    hint: "Grid engine",
    options: [
      { id: "tanstack-table", label: "TanStack Table", promptLine: "TanStack Table v8 behind one shared `DataTable` component." },
      { id: "ag-grid", label: "AG Grid", promptLine: "AG Grid for the data grids." },
      { id: "html-table", label: "Plain table", promptLine: "Semantic HTML tables with hand-rolled sorting." },
      {
        id: "rn-flashlist",
        label: "FlashList (RN)",
        promptLine:
          "Long lists use FlashList (or `FlatList` with `getItemLayout`) — never `.map()` inside a `ScrollView`, which builds every row up front and drops frames.",
      },
      {
        id: "swift-list",
        label: "List / LazyVStack (SwiftUI)",
        promptLine:
          "SwiftUI `List` for rows with system behaviour (swipe actions, selection), or `LazyVStack` in a `ScrollView` for custom cells. Rows are `Identifiable`.",
      },
    ],
  },
  {
    key: "charts",
    appliesTo: ["web", "mobile"],
    label: "Charts",
    hint: "Visualisation library",
    options: [
      { id: "recharts", label: "Recharts", promptLine: "Recharts for charts, wrapped in a shared chart container with themed colours." },
      { id: "visx", label: "visx", promptLine: "visx for bespoke visualisations." },
      { id: "chartjs", label: "Chart.js", promptLine: "Chart.js via react-chartjs-2." },
      {
        id: "victory-native",
        label: "Victory Native (RN)",
        promptLine: "Victory Native XL for charts, wrapped in one shared chart container.",
      },
      {
        id: "swift-charts",
        label: "Swift Charts",
        promptLine:
          "Apple's Swift Charts, with an accessibility representation so VoiceOver can read the series.",
      },
      { id: "none-charts", label: "No charts", promptLine: "No charting library required." },
    ],
  },
  {
    key: "testing",
    label: "Testing",
    hint: "Test runner",
    options: [
      { id: "vitest", label: "Vitest + Testing Library", promptLine: "Vitest with React Testing Library for unit and component tests." },
      { id: "jest", label: "Jest + Testing Library", promptLine: "Jest with React Testing Library." },
      { id: "playwright", label: "Playwright (e2e)", promptLine: "Playwright for end-to-end coverage of the critical flows." },
      {
        id: "rn-testing-library",
        label: "Jest + RN Testing Library",
        promptLine:
          "Jest with React Native Testing Library for component and hook tests, plus Maestro flows for the critical journeys on a real device.",
      },
      {
        id: "swift-testing",
        label: "Swift Testing + XCUITest",
        promptLine:
          "Swift Testing for unit coverage and XCUITest for the critical journeys, both runnable from the command line.",
      },
      { id: "none-testing", label: "No tests", promptLine: "No automated tests required for this build." },
      {
        id: "pytest",
        label: "pytest",
        promptLine:
          "pytest with async support; every endpoint has a test that exercises it through the app, against a real database rather than a mocked session.",
      },
      {
        id: "jest-supertest",
        label: "Jest + Supertest",
        promptLine:
          "Jest with Supertest driving the HTTP layer, so a route is tested the way a client calls it.",
      },
    ],
  },
  {
    key: "tooling",
    label: "Lint / format",
    hint: "Code hygiene",
    options: [
      { id: "biome-prettier", label: "Biome + Prettier", promptLine: "Biome for linting and Prettier for formatting, enforced on commit via Husky and lint-staged." },
      { id: "eslint-prettier", label: "ESLint + Prettier", promptLine: "ESLint with Prettier, enforced on commit." },
      { id: "biome", label: "Biome only", promptLine: "Biome for both linting and formatting." },
      {
        id: "swiftlint",
        label: "SwiftLint + swift-format",
        promptLine: "SwiftLint and swift-format, both run in CI and failing the build on violations.",
      },
      {
        id: "ruff-mypy",
        label: "Ruff + mypy",
        promptLine: "Ruff for linting and formatting, mypy in strict mode, both failing CI on a violation.",
      },
    ],
  },
  {
    key: "packageManager",
    label: "Package manager",
    hint: "Install tooling",
    options: [
      { id: "pnpm", label: "pnpm", promptLine: "pnpm as the package manager." },
      { id: "npm", label: "npm", promptLine: "npm as the package manager." },
      { id: "yarn", label: "yarn", promptLine: "yarn as the package manager." },
      { id: "bun", label: "bun", promptLine: "bun as the runtime and package manager." },
      { id: "uv", label: "uv (Python)", promptLine: "uv for dependency management and virtual environments." },
      { id: "poetry", label: "Poetry (Python)", promptLine: "Poetry for dependency management." },
    ],
  },

  // ── service-only ────────────────────────────────────────────────────────
  {
    key: "database",
    label: "Database",
    hint: "Where the data actually lives.",
    appliesTo: ["backend"],
    options: [
      {
        id: "postgres",
        label: "PostgreSQL",
        promptLine:
          "PostgreSQL as the database. Every schema change ships as a migration — no hand-edited tables, and no `create_all` in application code.",
      },
      {
        id: "mysql",
        label: "MySQL / MariaDB",
        promptLine: "MySQL as the database, with every schema change shipped as a migration.",
      },
      {
        id: "sqlite",
        label: "SQLite",
        promptLine:
          "SQLite as the database — a single file, with migrations, suitable for a single-writer service.",
      },
      {
        id: "mongodb",
        label: "MongoDB",
        promptLine:
          "MongoDB as the database. Documents are validated at the application boundary; the absence of a schema in the engine is not an absence of a schema.",
      },
    ],
  },
  {
    key: "orm",
    label: "Data access",
    hint: "How the service talks to the database.",
    appliesTo: ["backend"],
    options: [
      {
        id: "sqlalchemy",
        label: "SQLAlchemy 2 (async) + Alembic",
        promptLine:
          "Async SQLAlchemy 2 with Alembic migrations. Sessions are injected per request and never held globally; every query is awaited.",
      },
      {
        id: "prisma",
        label: "Prisma",
        promptLine:
          "Prisma as the ORM, with the schema as the source of truth and a migration for every change.",
      },
      {
        id: "drizzle",
        label: "Drizzle",
        promptLine:
          "Drizzle ORM with schema-first tables and generated migrations; queries are typed end to end.",
      },
      {
        id: "django-orm",
        label: "Django ORM",
        promptLine:
          "The Django ORM with generated migrations; `select_related`/`prefetch_related` wherever a list view would otherwise fire a query per row.",
      },
      {
        id: "raw-sql",
        label: "Raw SQL",
        promptLine:
          "Hand-written SQL behind a repository layer. Every statement is parameterised — no string interpolation into a query, ever.",
      },
    ],
  },
  {
    key: "apiStyle",
    label: "API style",
    hint: "The shape of the contract the clients consume.",
    appliesTo: ["backend"],
    options: [
      {
        id: "rest-openapi",
        label: "REST + OpenAPI",
        promptLine:
          "A REST API with an OpenAPI schema generated from the code, not written beside it. The schema is what the clients generate their types from.",
      },
      {
        id: "trpc",
        label: "tRPC",
        promptLine:
          "tRPC, so the clients get the server's types directly with no generation step. Only valid when the clients are TypeScript.",
      },
      {
        id: "graphql",
        label: "GraphQL",
        promptLine:
          "A GraphQL API with a schema-first contract and dataloaders for anything that would otherwise fetch per row.",
      },
      {
        id: "rest-plain",
        label: "REST (no schema document)",
        promptLine:
          "A REST API whose contract is documented in the repository README rather than a generated schema.",
      },
    ],
  },
  {
    key: "apiAuth",
    label: "Auth",
    hint: "How a request proves who it is.",
    appliesTo: ["backend"],
    options: [
      {
        id: "jwt-refresh",
        label: "JWT access + refresh",
        promptLine:
          "JWT authentication: a short-lived access token and a rotating refresh token, with logout revoking the refresh token server-side rather than trusting the client to forget it.",
      },
      {
        id: "session-cookie",
        label: "Server sessions (cookie)",
        promptLine:
          "Server-side sessions in an httpOnly, SameSite cookie, with CSRF protection on every state-changing request.",
      },
      {
        id: "oauth-provider",
        label: "Third-party identity (OAuth/OIDC)",
        promptLine:
          "Authentication delegated to an OIDC provider; the service verifies the token's signature and claims on every request and stores no passwords.",
      },
      {
        id: "api-key",
        label: "API keys (service-to-service)",
        promptLine:
          "API-key authentication for service-to-service calls. Keys are hashed at rest, scoped, and revocable.",
      },
      {
        id: "none-auth",
        label: "No authentication",
        promptLine:
          "No authentication — the service is internal and reachable only on a private network. Say so explicitly in the README.",
      },
    ],
  },
]

export const stackGroupMap = Object.fromEntries(
  stackGroups.map((g) => [g.key, g])
) as Record<string, StackGroup>

export function findStackOption(groupKey: string, id: string) {
  return stackGroupMap[groupKey]?.options.find((o) => o.id === id)
}

/** Combinations that produce nonsense prompts if left unflagged. */
export function stackWarnings(stack: Stack): string[] {
  const warnings: string[] = []
  const selected = Object.entries(stack).filter(([k]) => k !== "extras") as [
    string,
    string,
  ][]
  for (const [groupKey, value] of selected) {
    // Blank is a legitimate answer, not an unknown one: a service has no icon
    // set and a web app has no database. Warning about both directions meant
    // every project carried four complaints about fields nobody was asked to
    // fill in.
    if (!value.trim()) continue
    const option = findStackOption(groupKey, value)
    if (!option) {
      warnings.push(`Unknown ${groupKey} option "${value}" — it will be passed through as free text.`)
      continue
    }
    for (const bad of option.incompatibleWith ?? []) {
      if (selected.some(([, v]) => v === bad)) {
        warnings.push(`${option.label} does not combine with "${bad}".`)
      }
    }
  }
  if (stack.framework === "vite-react" && stack.http === "server-actions") {
    warnings.push("Server actions need a Next.js/Remix server — pick a different HTTP layer for a Vite SPA.")
  }
  // Platform mismatches. These are easy to pick by accident, because the web
  // options are the defaults and the framework is the only thing that moved.
  const platform = platformOf(stack)
  if (isNative(stack)) {
    const webOnly: Array<[keyof Stack, string, string]> = [
      ["styling", "tailwind4-shadcn", "shadcn/ui is web-only — use NativeWind or StyleSheet on React Native, and SwiftUI modifiers on iOS."],
      ["styling", "tailwind3-shadcn", "shadcn/ui is web-only — use NativeWind or StyleSheet on React Native, and SwiftUI modifiers on iOS."],
      ["styling", "css-modules", "CSS Modules do not exist on native."],
      ["styling", "mui", "MUI is web-only."],
      ["tables", "tanstack-table", "TanStack Table renders a DOM table — use FlashList/FlatList or a SwiftUI List."],
      ["tables", "ag-grid", "AG Grid is web-only."],
      ["tables", "html-table", "There is no HTML table on native."],
      ["charts", "recharts", "Recharts is web-only — use Victory Native or Swift Charts."],
      ["charts", "visx", "visx is web-only."],
      ["icons", "lucide", "lucide-react is web-only — use @expo/vector-icons or SF Symbols."],
      ["icons", "radix-icons", "Radix icons are web-only."],
      ["http", "server-actions", "Server actions need a Next.js server; a native app talks to an API."],
      ["testing", "playwright", "Playwright drives a browser — use Maestro/Detox on React Native, XCUITest on iOS."],
    ]
    for (const [key, value, message] of webOnly) {
      if (stack[key] === value) warnings.push(message)
    }
    if (platform === "ios" && stack.language !== "swift") {
      warnings.push("A native iOS build is written in Swift — the language choice says otherwise.")
    }
    if (platform === "react-native" && stack.language === "swift") {
      warnings.push("React Native is TypeScript; Swift only applies to a native iOS build.")
    }
  } else if (stack.language === "swift") {
    warnings.push("Swift is selected but the framework is a web one.")
  }

  if (stack.styling === "tailwind4-shadcn" && stack.framework === "next-pages") {
    warnings.push("Tailwind v4 + shadcn assumes the App Router conventions; double-check with the Pages Router.")
  }

  // Service combinations. These are easy to reach by changing the framework and
  // leaving the rest, and each one produces a brief that contradicts itself —
  // a Python service told to use Prisma, or a Django project with no Django ORM.
  if (platform === "server") {
    const ormLanguage: Record<string, "python" | "ts"> = {
      sqlalchemy: "python",
      "django-orm": "python",
      prisma: "ts",
      drizzle: "ts",
    }
    const frameworkLanguage: Record<string, "python" | "ts"> = {
      fastapi: "python",
      "django-drf": "python",
      nestjs: "ts",
      "express-drizzle": "ts",
    }
    const wanted = frameworkLanguage[stack.framework]
    const chosen = ormLanguage[stack.orm]
    if (wanted && chosen && wanted !== chosen) {
      warnings.push(
        `${findStackOption("orm", stack.orm)?.label ?? stack.orm} is a ${
          chosen === "python" ? "Python" : "TypeScript"
        } library — it cannot be used from ${
          findStackOption("framework", stack.framework)?.label ?? stack.framework
        }.`
      )
    }
    if (stack.framework === "django-drf" && stack.orm && stack.orm !== "django-orm") {
      warnings.push("Django REST Framework is built on the Django ORM; another data layer fights the framework.")
    }
    if (stack.apiStyle === "trpc" && wanted === "python") {
      warnings.push("tRPC is a TypeScript contract — a Python service cannot expose one.")
    }
    if (stack.database === "mongodb" && ["sqlalchemy", "drizzle", "django-orm"].includes(stack.orm)) {
      warnings.push(
        `${findStackOption("orm", stack.orm)?.label ?? stack.orm} talks to a SQL database — MongoDB needs a document mapper.`
      )
    }
    if (stack.language && !stack.language.startsWith("ts") && stack.language !== "python" && wanted) {
      warnings.push("The service's language does not match its framework.")
    }
  }
  return warnings
}
