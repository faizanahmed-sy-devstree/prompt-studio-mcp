// Vendored from Prompt Studio (features/library/data/layouts.ts). Do not edit here — run `pnpm sync`.
import type { LayoutOption } from "./layout-types"
import { screenLayouts } from "./layouts-screen"
import { sectionLayouts } from "./layouts-section"

export const allLayouts: LayoutOption[] = [...screenLayouts, ...sectionLayouts]

export const layoutMap = Object.fromEntries(
  allLayouts.map((l) => [l.id, l])
) as Record<string, LayoutOption>

export function getLayout(id: string): LayoutOption | undefined {
  return layoutMap[id]
}

/** Never throws — an unknown id still produces usable prompt text. */
export function describeLayout(id: string) {
  const known = layoutMap[id]
  if (known) return known
  return {
    id,
    name: id || "Default layout",
    description: "Custom layout",
    category: "Custom",
    scope: "screen" as const,
    promptDetails: id
      ? `A ${id.replace(/[-_]/g, " ")} layout, implemented sensibly for this screen.`
      : "Use the conventional layout for this kind of screen.",
    wire: { k: "spacer" as const },
  }
}

export function layoutsForSection(sectionType: string) {
  return sectionLayouts.filter((l) => l.sectionType === sectionType)
}

/** A phone layout — the `mobile-*` family, which draws in a phone frame. */
export function isMobileLayout(id: string) {
  return id.startsWith("mobile-")
}

/** Screen layouts, best matches for the template first. */
export function layoutsForTemplate(template: string) {
  if (!template) return screenLayouts
  const matches = screenLayouts.filter((l) => l.templates?.includes(template))
  const rest = screenLayouts.filter((l) => !l.templates?.includes(template))
  return [...matches, ...rest]
}

/**
 * The layouts worth offering for a build. A phone screen is never a sidebar
 * dashboard and a web page is never a bottom sheet, so showing the other
 * platform's options is just a longer list to scroll past — and an easy way to
 * pick something that cannot exist.
 */
export function layoutsForSurface(template: string, surface: "web" | "mobile" | "backend") {
  const ordered = layoutsForTemplate(template)
  if (surface === "mobile") {
    const phone = ordered.filter((l) => isMobileLayout(l.id))
    // Fall back to everything if a template has no phone layout at all, rather
    // than showing an empty picker.
    return phone.length ? phone : ordered
  }
  return ordered.filter((l) => !isMobileLayout(l.id))
}

/** The layout a new screen starts with on this build. */
export function defaultLayoutFor(templateDefault: string, surface: "web" | "mobile" | "backend") {
  if (surface !== "mobile") return templateDefault
  return mobileEquivalent[templateDefault] ?? "mobile-tabs"
}

/** Nearest phone layout for a template's web default. */
const mobileEquivalent: Record<string, string> = {
  "auth-center": "mobile-auth",
  "auth-split": "mobile-auth",
  "auth-minimal": "mobile-auth",
  "auth-otp": "mobile-otp",
  "dashboard-sidebar": "mobile-tabs",
  "dashboard-topnav": "mobile-tabs",
  "dashboard-cards": "mobile-stats",
  "dashboard-analytics": "mobile-stats",
  "table-basic": "mobile-list",
  "table-advanced": "mobile-list",
  "table-master-detail": "mobile-list",
  "search-results": "mobile-search",
  "detail-hero": "mobile-detail",
  "detail-two-column": "mobile-detail",
  "product-gallery": "mobile-detail",
  "form-single": "mobile-form",
  "form-two-column": "mobile-form",
  "form-wizard": "mobile-wizard",
  "form-sidebar-summary": "mobile-form",
  "checkout-steps": "mobile-checkout",
  "profile-sidebar": "mobile-profile",
  "profile-tabs": "mobile-profile",
  "settings-sections": "mobile-settings",
  "onboarding-checklist": "mobile-onboarding",
  "calendar-month": "mobile-calendar",
  "chat-split": "mobile-chat",
  "board-kanban": "mobile-grid",
  "empty-first-run": "mobile-empty",
}

export function layoutCategories(layouts: LayoutOption[]) {
  return Array.from(new Set(layouts.map((l) => l.category)))
}

export type { LayoutOption }
export { screenLayouts, sectionLayouts }
