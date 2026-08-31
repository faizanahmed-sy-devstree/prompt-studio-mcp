// Vendored from Prompt Studio (features/stack/data/platforms.ts). Do not edit here — run `pnpm sync`.
import type { Stack } from "../../../types/project"

/**
 * Web, React Native or native iOS — derived from the chosen framework rather
 * than stored, so it can never disagree with the stack.
 *
 * This matters because most of the generated prompt's non-negotiables are
 * platform-specific and actively wrong on the other side: "no horizontal page
 * scroll" and "visible focus ring" mean nothing on a phone, while safe-area
 * insets, the Android hardware back button and a denied location permission
 * have no web equivalent. Shipping web rules to a React Native build reads as
 * boilerplate and gets ignored, which then costs the rules that do matter.
 */
export type Platform = "web" | "react-native" | "ios" | "server"

const byFramework: Record<string, Platform> = {
  "expo-router": "react-native",
  "react-native": "react-native",
  swiftui: "ios",
  uikit: "ios",
  // A service is a platform of its own, and needs saying: before this it fell
  // through to "web" and a backend brief was handed rules about horizontal
  // scrolling and focus rings.
  fastapi: "server",
  nestjs: "server",
  "express-drizzle": "server",
  "django-drf": "server",
}

export function platformOf(stack: Stack): Platform {
  return byFramework[stack.framework] ?? "web"
}

export function isNative(stack: Stack) {
  return platformOf(stack) !== "web"
}

export const platformLabels: Record<Platform, string> = {
  web: "Web",
  "react-native": "React Native (Android + iOS)",
  ios: "Native iOS",
  server: "Backend service",
}

/**
 * The baseline every build of this platform must meet. Replaces the web list
 * wholesale rather than adding to it.
 */
export const platformRequirements: Record<Platform, string[]> = {
  web: [
    "Fully responsive from 360px to wide desktop — mobile-first, no horizontal page scroll at any width.",
    "Every screen handles its loading, empty and error states explicitly.",
    "Keyboard accessible with visible focus, labelled controls and WCAG AA contrast.",
    "Consistent navigation, spacing and typography across every screen.",
  ],
  "react-native": [
    "Every screen respects the safe area — status bar, notch and home indicator — using `useSafeAreaInsets`, never hardcoded padding.",
    "The Android hardware back button and the iOS swipe-back gesture both work on every screen, and neither loses unsaved input without asking.",
    "Every screen handles its loading, empty and error states explicitly, plus a fourth the web does not have: offline. Assume the network drops mid-request.",
    "Long lists are virtualised (FlashList/FlatList) — never `.map()` inside a `ScrollView`.",
    "The keyboard never covers the focused field: keyboard-avoiding views, `Next`/`Done` return keys, and dismiss-on-scroll.",
    "Every runtime permission (location, camera, notifications, photos) has an explicit denied path and a route to Settings — never a dead screen.",
    "Tap targets are at least 44×44pt with real spacing between them; nothing depends on hover.",
    "Screen reader labels on every interactive element (`accessibilityLabel`, `accessibilityRole`), and layouts that survive the largest system font size.",
    "Built and verified on **both** Android and iOS — shadows, fonts, safe areas and keyboard behaviour differ, and a screen is not done until it is right on both.",
  ],
  server: [
    "Every endpoint validates its input at the boundary and answers a malformed request with a 4xx that names the field, never a 500.",
    "Every response the clients depend on has one shape, including its errors — a failure is a documented status and body, not a stack trace.",
    "Authorisation is checked on the server for every request. A hidden button is not a permission, and an id in a URL is not proof of ownership.",
    "Anything that must not happen twice is idempotent or guarded — a double-clicked payment, a retried webhook, a replayed job.",
    "Every list endpoint is paginated and every filter is indexed; no endpoint loads a whole table to count it.",
    "No secret, token or password is logged, returned, or committed. Passwords are hashed with a slow algorithm, never encrypted.",
    "Schema changes ship as migrations that run forward on a database with data in it. `create_all` at boot is not a migration.",
    "Every query that runs per row of a list is a bug — resolve relations in one round trip.",
    "Time is stored and compared in UTC; the timezone is a rendering decision the client makes.",
  ],
  ios: [
    "Every screen respects the safe area and works on the smallest supported device as well as the largest.",
    "Dynamic Type is honoured up to the accessibility sizes: no fixed font sizes, no layouts that clip when text grows.",
    "VoiceOver labels, hints and traits on every interactive element; custom controls declare what they are.",
    "Every screen handles loading, empty, error and offline states explicitly.",
    "Light and dark appearance both designed, driven by the asset catalogue rather than conditional colour code.",
    "All I/O is `async`/`await` off the main actor; UI updates are `@MainActor`. No blocking the main thread.",
    "Navigation state is restorable and deep links resolve to the right screen.",
    "Follows the Human Interface Guidelines for the components used — a native app that fights the platform feels broken even when it works.",
  ],
}

/** Extra platform-specific delivery expectations. */
export const platformDelivery: Record<Platform, string[]> = {
  web: [],
  server: [
    "Every endpoint has a test that exercises it through the app the way a client calls it — status, body and the failure path, against a real database rather than a mocked session.",
    "The service starts from a clean checkout with documented commands, and the README says how to run it, migrate it and test it.",
  ],
  "react-native": [
    "Verify each screen on an Android device and an iOS device, at the smallest supported width and at the largest system font size.",
  ],
  ios: [
    "Verify each screen in light and dark appearance and at an accessibility Dynamic Type size before calling it done.",
  ],
}

/**
 * Conventions that only make sense on the web. Silently shipping "no raw
 * `<input type="date">`" or "no `window` at module scope" to a Swift build is
 * the kind of filler that teaches a reader to skim the rules.
 */
export const webOnlyConventionIds = ["ssr-safe", "no-native-controls", "next-proxy"]

/**
 * Conventions with no meaning on a service. They are about rendering, and a
 * brief that hands a backend "every async surface ships all three states" in
 * its UI wording teaches the reader that these lines are filler.
 */
export const serverIrrelevantConventionIds = ["ssr-safe", "next-proxy"]

/** Conventions whose wording changes per platform rather than disappearing. */
export const conventionOverrides: Record<Platform, Record<string, string>> = {
  web: {},
  server: {
    // The UI-shaped rules still have a true form on a service; they are about
    // shared code and validated boundaries, not about pixels.
    "shared-first":
      "Before writing a query or a handler, check what already exists — a repository, a service, a dependency. Anything used by two routers moves into the shared layer on its second use.",
    "no-native-controls":
      "Never hand-roll what the framework provides — dependency injection, validation, pagination and error handling all have one implementation, and a route that does its own is a bug.",
    "states-required":
      "Every endpoint handles its three outcomes explicitly: the success, the client's mistake, and the failure that is ours. None of them is an unhandled exception.",
    "a11y-baseline":
      "Every response is machine-readable before it is human-readable: documented status codes, stable error shapes, and messages a client can act on.",
    "tokens-only":
      "No magic values in handlers — limits, page sizes, timeouts and expiry windows come from configuration, not from a literal two calls deep.",
  },
  "react-native": {
    "a11y-baseline":
      "Accessible: `accessibilityLabel` and `accessibilityRole` on every control, tap targets of at least 44×44pt, and layouts that survive the largest system font size.",
    "tokens-only":
      "No hardcoded colours, radii or shadows in components — everything comes from the shared theme, and both light and dark are designed.",
  },
  ios: {
    "a11y-baseline":
      "Accessible: VoiceOver labels, hints and traits on every control, Dynamic Type honoured up to the accessibility sizes, and contrast that holds in both appearances.",
    "tokens-only":
      "Colours and spacing come from the asset catalogue and a shared `Theme` — never `Color(hex:)` or a magic number in a view.",
  },
}
