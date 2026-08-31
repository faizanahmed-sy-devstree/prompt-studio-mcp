// Vendored from Prompt Studio (features/library/data/section-types.ts). Do not edit here — run `pnpm sync`.
export type SectionType = {
  id: string
  name: string
  icon: string
  description: string
  promptDetails: string
  defaultLayout: string
}

export const sectionTypes: SectionType[] = [
  {
    id: "navigation",
    name: "Navigation",
    icon: "compass",
    description: "Header and menu",
    promptDetails:
      "a sticky site header with the wordmark, primary links and a mobile sheet menu",
    defaultLayout: "nav-split",
  },
  {
    id: "hero",
    name: "Hero",
    icon: "sparkles",
    description: "Above-the-fold pitch",
    promptDetails:
      "an above-the-fold hero carrying the single clearest value proposition and the primary conversion action",
    defaultLayout: "hero-two-column",
  },
  {
    id: "logos",
    name: "Logo Wall",
    icon: "badge",
    description: "Social proof logos",
    promptDetails: "a row of customer logos used as social proof",
    defaultLayout: "logos-strip",
  },
  {
    id: "features",
    name: "Features",
    icon: "layers",
    description: "What it does",
    promptDetails:
      "a feature section explaining capabilities in user outcomes rather than implementation detail",
    defaultLayout: "features-grid-3",
  },
  {
    id: "stats",
    name: "Stats",
    icon: "trending",
    description: "Numbers that persuade",
    promptDetails: "a statistics band with three or four headline numbers",
    defaultLayout: "stats-row",
  },
  {
    id: "testimonials",
    name: "Testimonials",
    icon: "quote",
    description: "Customer voices",
    promptDetails:
      "a testimonial section with attributed quotes including name, role and company",
    defaultLayout: "testimonials-cards",
  },
  {
    id: "gallery",
    name: "Gallery",
    icon: "image",
    description: "Visual showcase",
    promptDetails: "an image gallery with accessible lightbox behaviour",
    defaultLayout: "gallery-grid",
  },
  {
    id: "pricing",
    name: "Pricing",
    icon: "tag",
    description: "Plans and cost",
    promptDetails:
      "a pricing section making the recommended plan obvious and stating what happens after the trial",
    defaultLayout: "pricing-three",
  },
  {
    id: "faq",
    name: "FAQ",
    icon: "help",
    description: "Objection handling",
    promptDetails:
      "an FAQ section answering the objections that block signup, in plain language",
    defaultLayout: "faq-accordion",
  },
  {
    id: "team",
    name: "Team",
    icon: "users",
    description: "The people",
    promptDetails: "a team section with portraits, names and roles",
    defaultLayout: "team-grid",
  },
  {
    id: "blog",
    name: "Articles",
    icon: "newspaper",
    description: "Latest posts",
    promptDetails: "an article teaser grid linking to the latest posts",
    defaultLayout: "blog-grid",
  },
  {
    id: "contact",
    name: "Contact",
    icon: "mail",
    description: "Get in touch",
    promptDetails:
      "a contact section with a validated form and the direct contact details beside it",
    defaultLayout: "contact-split",
  },
  {
    id: "cta",
    name: "Call to Action",
    icon: "zap",
    description: "The ask",
    promptDetails:
      "a call-to-action band repeating the primary conversion action with a reassurance line",
    defaultLayout: "cta-centered",
  },
  {
    id: "footer",
    name: "Footer",
    icon: "panel-bottom",
    description: "Links and legal",
    promptDetails:
      "a footer with grouped links, social icons, legal links and copyright",
    defaultLayout: "footer-columns",
  },
]

export const sectionTypeMap = Object.fromEntries(
  sectionTypes.map((s) => [s.id, s])
) as Record<string, SectionType>
