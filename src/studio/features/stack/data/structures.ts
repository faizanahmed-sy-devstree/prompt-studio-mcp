// Vendored from Prompt Studio (features/stack/data/structures.ts). Do not edit here — run `pnpm sync`.
export type StructurePreset = {
  id: string
  name: string
  description: string
  tree: string
  notes: string[]
}

export const structurePresets: StructurePreset[] = [
  {
    id: "feature-based",
    name: "Feature-based (house standard)",
    description: "One folder per product area, shared UI extracted.",
    tree: `app/                  # App Router. Route groups:
  (app)/              #   protected routes (wrapped by the app shell)
  (auth)/             #   public auth routes — no shell
  layout.tsx          #   fonts + theme provider + providers + toaster
  providers.tsx
config/
  env.ts              # validated env, exported as ENV
  api/api.ts          # endpoint catalogue
  instance/           # http instance + interceptors
features/
  <feature>/          # one folder per product area
    index.ts          #   public entry — cross-feature imports go through it
    components/       #   feature-only components
    services/         #   data hooks built on the generic hooks
    data/             #   schemas + static data
    types/            #   feature-local types
    utils/            #   feature-local helpers
components/
  ui/                 # design-system primitives
  shared/             # cross-feature components (form/ table/ feedback/ display/)
  layout/             # app shell, header, navigation
hooks/                # generic reusable hooks
stores/               # client state stores
types/                # cross-app types
lib/                  # low-level utils (cn, formatters)`,
    notes: [
      "A feature's `index.ts` is its only public surface — never import another feature's internals directly.",
      "Anything used by two features moves to `components/shared/` or `hooks/`.",
    ],
  },
  {
    id: "src-layered",
    name: "src/ layered",
    description: "Classic src tree grouped by technical role.",
    tree: `src/
  app/                # routes
  components/         # ui + shared components
  hooks/
  services/           # api clients
  store/
  types/
  utils/
  styles/`,
    notes: ["Group by technical role; keep each folder shallow."],
  },
  {
    id: "atomic",
    name: "Atomic design",
    description: "atoms → molecules → organisms → templates → pages.",
    tree: `src/
  components/
    atoms/
    molecules/
    organisms/
    templates/
  pages/
  hooks/
  services/
  styles/`,
    notes: [
      "Promote a component up a level only when it is reused, not by anticipation.",
    ],
  },
  {
    id: "route-colocated",
    name: "Route-colocated",
    description: "Everything a route needs lives beside the route.",
    tree: `app/
  dashboard/
    page.tsx
    _components/
    _hooks/
    _lib/
  clients/
    page.tsx
    [id]/page.tsx
    _components/
components/            # only genuinely shared UI
lib/`,
    notes: [
      "Private folders (`_components`) stay out of the router.",
      "Promote to the top-level `components/` on the second consumer.",
    ],
  },
  {
    id: "flat",
    name: "Flat / small app",
    description: "Minimal ceremony for a small surface.",
    tree: `app/
components/
lib/
types/`,
    notes: ["Fine below roughly a dozen screens; split by feature after that."],
  },
  {
    id: "expo-feature-based",
    name: "Expo Router, feature-based",
    description: "File routes under app/, features beside them.",
    tree: `app/                    # Expo Router — the file tree IS the navigation
  _layout.tsx           #   root stack + providers + theme
  (auth)/               #   signed-out group
    _layout.tsx
    sign-in.tsx
  (tabs)/               #   bottom tab navigator
    _layout.tsx         #     the <Tabs> definition
    index.tsx           #     first tab
    clients/
      index.tsx         #     /clients
      [id].tsx          #     /clients/:id
  +not-found.tsx
features/
  <feature>/
    index.ts            #   public entry
    components/         #   screen pieces (not routes)
    services/           #   data hooks
    data/               #   schemas
components/
  ui/                   # design-system primitives (Button, Text, Sheet)
  shared/               # cross-feature components
hooks/                  # generic hooks
stores/                 # zustand stores (persisted via MMKV)
lib/                    # api client, formatters, theme
assets/                 # fonts, images
app.json                # Expo config — permissions, icons, splash`,
    notes: [
      "Files under `app/` are routes and nothing else — a screen's real implementation lives in `features/` and the route file just renders it. This keeps the navigation tree readable and stops route files from growing into 800-line screens.",
      "`_layout.tsx` is where a navigator is declared; it is not a screen.",
      "Every permission the app requests is declared in `app.json` with a usage description — a missing one is an App Store rejection, not a warning.",
    ],
  },
  {
    id: "rn-navigation",
    name: "React Native, React Navigation",
    description: "Navigators declared in code, features beside them.",
    tree: `src/
  navigation/
    root-navigator.tsx    # the navigator tree
    tab-navigator.tsx
    types.ts              # typed param list per navigator
  screens/                # one file per screen, thin
    clients/
      client-list-screen.tsx
      client-detail-screen.tsx
  features/
    <feature>/
      index.ts
      components/
      services/
  components/
    ui/                   # design-system primitives
    shared/
  hooks/
  stores/
  lib/                    # api client, theme, formatters
  assets/`,
    notes: [
      "Every navigator has a typed param list in `navigation/types.ts`; `navigation.navigate` is never called with an untyped route name.",
      "Screens stay thin — they wire params to a feature component and nothing more.",
    ],
  },
  {
    id: "swift-features",
    name: "SwiftUI, feature folders",
    description: "One folder per feature, shared design system.",
    tree: `App/
  <Name>App.swift         # @main, root scene, dependency wiring
  RootView.swift          # NavigationStack / TabView
Features/
  Clients/
    ClientListView.swift
    ClientListModel.swift # @Observable, owns the state
    ClientDetailView.swift
    ClientRow.swift       # feature-only subviews
DesignSystem/
  Theme.swift             # colours + spacing + type scale
  Components/             # shared Buttons, Cards, EmptyState
Networking/
  APIClient.swift         # actor over URLSession
  Endpoints.swift
  APIError.swift
Models/                   # Codable domain models
Persistence/              # SwiftData / Keychain
Resources/
  Assets.xcassets         # colour sets with light + dark
  Localizable.xcstrings`,
    notes: [
      "A view and its `@Observable` model sit together in the feature folder; the model holds the state and the view stays declarative.",
      "Colours are colour sets in the asset catalogue with light and dark variants — never `Color(hex:)` in a view.",
      "Nothing in `Features/` imports another feature's internals; shared UI moves to `DesignSystem/Components`.",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Paste your own tree — used verbatim in the prompt.",
    tree: "",
    notes: [],
  },
]

export const structureMap = Object.fromEntries(
  structurePresets.map((s) => [s.id, s])
) as Record<string, StructurePreset>
