// Vendored from Prompt Studio (features/library/data/layouts-section.ts). Do not edit here — run `pnpm sync`.
import type { LayoutOption } from "./layout-types"
import {
  avatarRow,
  bar,
  card,
  circle,
  col,
  field,
  grid,
  heading,
  pill,
  row,
  spacer,
  sub,
} from "./wire-helpers"

const navBar = (children: LayoutOption["wire"][]) =>
  row(children, { gap: 1, pad: 1, tone: "surface", rounded: true })

const section = (
  id: string,
  sectionType: string,
  name: string,
  description: string,
  promptDetails: string,
  wire: LayoutOption["wire"]
): LayoutOption => ({
  id,
  name,
  description,
  category: sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
  scope: "section",
  sectionType,
  promptDetails,
  wire,
})

export const sectionLayouts: LayoutOption[] = [
  // ------------------------------------------------------------- navigation
  section(
    "nav-left",
    "navigation",
    "Left Aligned",
    "Logo and links both left.",
    "A navigation bar with the logo on the far left and the menu items immediately after it, a single ghost action on the right, a hover underline on links, and a hamburger sheet below the medium breakpoint.",
    col([navBar([bar(16, "strong", 2), bar(10), bar(10), bar(10), spacer(1), bar(8, "accentLine")]), spacer(1)], { gap: 1 })
  ),
  section(
    "nav-center",
    "navigation",
    "Center Aligned",
    "Centred logo, links either side.",
    "A symmetrical navigation bar with the wordmark centred and menu items distributed evenly to its left and right. Collapses to a centred logo plus hamburger on mobile.",
    col([navBar([bar(10), bar(10), spacer(1), bar(16, "strong", 2), spacer(1), bar(10), bar(10)]), spacer(1)], { gap: 1 })
  ),
  section(
    "nav-right",
    "navigation",
    "Right Aligned",
    "Logo left, links right.",
    "A navigation bar with the logo on the left and the menu items pushed to the right, ending with a prominent primary call-to-action button.",
    col([navBar([bar(16, "strong", 2), spacer(1), bar(10), bar(10), bar(10), pill(14)]), spacer(1)], { gap: 1 })
  ),
  section(
    "nav-split",
    "navigation",
    "Split with CTA",
    "Links centre, CTA far right.",
    "A split navigation bar: logo left, primary links centred, and a login link plus a filled call-to-action button on the far right, separated by a subtle divider.",
    col([navBar([bar(14, "strong", 2), spacer(1), bar(9), bar(9), bar(9), spacer(1), bar(8), pill(14)]), spacer(1)], { gap: 1 })
  ),
  section(
    "nav-mega",
    "navigation",
    "Mega Menu",
    "Dropdown panel with grouped links.",
    "A navigation bar whose product menu opens a full-width mega panel with grouped links, short descriptions and a highlighted promo card. Keyboard navigable, closes on Escape and outside click.",
    col(
      [
        navBar([bar(14, "strong", 2), bar(10, "accentLine"), bar(10), spacer(1), pill(12)]),
        grid(3, col([bar(60, "accentLine"), bar(90), bar(75)], { gap: 1, pad: 1, tone: "surface", rounded: true }), { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "nav-transparent",
    "navigation",
    "Transparent over Hero",
    "Overlays the hero, solid on scroll.",
    "A transparent navigation bar layered over the hero that becomes a solid, subtly shadowed bar once the page scrolls past the fold.",
    col(
      [
        row([bar(14, "strong", 2), spacer(1), bar(9), bar(9), pill(12)], { gap: 1, pad: 1 }),
        col([heading(60), sub(40), pill(22)], { gap: 1, pad: 2, tone: "accentSoft", rounded: true, align: "center", grow: 1 }),
      ],
      { gap: 1 }
    )
  ),

  // -------------------------------------------------------------------- hero
  section(
    "hero-center",
    "hero",
    "Centred Hero",
    "Headline, subline, one action.",
    "A centred hero: eyebrow label, a large headline, one supporting sentence, a primary and a secondary button, and a subtle gradient or grid background. Nothing competes with the primary action.",
    col([spacer(1), bar(18, "accentLine"), heading(66), sub(48), row([pill(20), pill(20, "accentSoft")], { gap: 1 }), spacer(1)], {
      gap: 1,
      align: "center",
    })
  ),
  section(
    "hero-two-column",
    "hero",
    "Two Column Hero",
    "Copy left, visual right.",
    "A two-column hero: headline, supporting paragraph, primary and secondary actions and a trust line on the left (about 55% width); a product screenshot or illustration on the right. Stacks with the visual below the copy on mobile.",
    row(
      [
        col([bar(30, "accentLine"), heading(90), sub(80), sub(60), row([pill(34), pill(30, "accentSoft")], { gap: 1 })], { gap: 1, grow: 3 }),
        col([bar(100, "accentSoft", 3), spacer(1)], { gap: 1, grow: 2, tone: "surface", rounded: true, pad: 1 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "hero-background",
    "hero",
    "Background Image Hero",
    "Full-bleed image with overlay.",
    "A full-bleed background image hero with a dark gradient overlay for contrast, centred white headline and subline, one primary button, and a scroll cue at the bottom. Text keeps at least 4.5:1 contrast over the image.",
    col([spacer(1), heading(70), sub(50), pill(24), spacer(1)], {
      gap: 1,
      pad: 2,
      tone: "accentSoft",
      rounded: true,
      align: "center",
    })
  ),
  section(
    "hero-app-shot",
    "hero",
    "Hero + App Screenshot",
    "Copy above, product shot below.",
    "A centred hero with the headline and actions above, and a large perspective-free product screenshot below the fold line, cropped by a rounded frame with a soft shadow.",
    col([heading(60), sub(44), pill(20), col([bar(100, "surface", 3)], { pad: 1, grow: 1, tone: "surface", rounded: true, border: true })], {
      gap: 1,
      align: "center",
    })
  ),
  section(
    "hero-form",
    "hero",
    "Hero with Signup Form",
    "Copy left, capture form right.",
    "A hero that captures leads: headline and three benefit bullets on the left, a short signup card (2–3 fields plus submit and a privacy line) on the right.",
    row(
      [
        col([heading(85), sub(70), row([circle("sm"), bar(70)], { gap: 1 }), row([circle("sm"), bar(60)], { gap: 1 })], { gap: 1, grow: 3 }),
        col([bar(60, "strong"), field(), field(), pill(100)], { gap: 1, pad: 1, tone: "surface", border: true, rounded: true, grow: 2 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "hero-video",
    "hero",
    "Video Background Hero",
    "Muted looping video behind text.",
    "A hero with a muted, auto-playing looping background video, an overlay for legibility, centred copy and a play-full-video action. Falls back to a poster image when reduced motion is requested.",
    col([spacer(1), circle("lg", "accent"), heading(58), sub(42), spacer(1)], {
      gap: 1,
      pad: 1,
      tone: "accentSoft",
      rounded: true,
      align: "center",
    })
  ),

  // ---------------------------------------------------------------- features
  section(
    "features-grid-3",
    "features",
    "3 Column Grid",
    "Icon, title, description ×3.",
    "A three-column feature grid; each cell has an icon in a tinted rounded square, a short title and two lines of description. Reflows to two columns on tablet and one on mobile.",
    col(
      [
        heading(46),
        grid(3, col([circle("sm", "accentSoft"), bar(70, "strong"), bar(90), bar(60)], { gap: 1, pad: 1 }), { gap: 1, grow: 1 }),
      ],
      { gap: 1, align: "center" }
    )
  ),
  section(
    "features-grid-4",
    "features",
    "4 Column Grid",
    "Compact, more items.",
    "A compact four-column feature grid with small icons, one-line titles and a single line of supporting copy. Two columns on tablet, one on mobile.",
    col([heading(40), grid(4, col([circle("sm", "accentSoft"), bar(80, "strong"), bar(90)], { gap: 1, pad: 1 }), { gap: 1, grow: 1 })], {
      gap: 1,
      align: "center",
    })
  ),
  section(
    "features-list",
    "features",
    "Feature List",
    "Vertical rows with dividers.",
    "A vertical feature list: each row has a larger icon on the left and a title with a fuller description on the right, separated by hairline dividers.",
    col([row([circle("md", "accentSoft"), col([bar(50, "strong"), bar(85)], { gap: 1, grow: 1 })], { gap: 1 }), row([circle("md", "accentSoft"), col([bar(45, "strong"), bar(80)], { gap: 1, grow: 1 })], { gap: 1 }), row([circle("md", "accentSoft"), col([bar(55, "strong"), bar(75)], { gap: 1, grow: 1 })], { gap: 1 })], {
      gap: 1,
    })
  ),
  section(
    "features-alternating",
    "features",
    "Alternating Rows",
    "Image and copy swap sides.",
    "Three or four alternating feature rows where the visual and the copy swap sides each row; each block has an eyebrow, a heading, a paragraph and a text link. All rows stack image-first on mobile.",
    col(
      [
        row([col([bar(100, "surface", 3)], { grow: 1, pad: 1, tone: "surface", rounded: true }), col([bar(70, "strong"), bar(90), bar(50, "accentLine")], { gap: 1, grow: 1 })], { gap: 1, grow: 1 }),
        row([col([bar(65, "strong"), bar(85), bar(45, "accentLine")], { gap: 1, grow: 1 }), col([bar(100, "surface", 3)], { grow: 1, pad: 1, tone: "surface", rounded: true })], { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "features-bento",
    "features",
    "Bento Grid",
    "Mixed-size tiles.",
    "A bento grid of feature tiles in mixed sizes: one large hero tile, two medium tiles and two small ones, each with its own visual treatment. Collapses to a single column stack on mobile.",
    row(
      [
        col([bar(60, "strong"), bar(85), spacer(1)], { gap: 1, pad: 1, tone: "accentSoft", rounded: true, grow: 2 }),
        col([card(), card()], { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "features-tabs",
    "features",
    "Tabbed Features",
    "Tabs switch the showcase.",
    "A tabbed feature showcase: a row of tabs, and a panel below showing the selected feature's copy on one side and its screenshot on the other. Tabs are keyboard-navigable and the active tab is reflected in the URL.",
    col(
      [
        row([bar(16, "accentLine"), bar(16), bar(16), spacer(1)], { gap: 1 }),
        row([col([bar(80, "strong"), bar(95), bar(70)], { gap: 1, grow: 1 }), col([bar(100, "surface", 3)], { grow: 1, pad: 1, tone: "surface", rounded: true })], { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    )
  ),

  // ------------------------------------------------------------- social proof
  section(
    "testimonials-cards",
    "testimonials",
    "Card Grid",
    "Quote cards with attribution.",
    "A grid of testimonial cards: quote, then avatar with name, role and company. Three across on desktop, one on mobile, with equal card heights.",
    col([heading(44), grid(3, col([bar(95), bar(80), spacer(1), avatarRow()], { gap: 1, pad: 1, tone: "surface", border: true, rounded: true }), { gap: 1, grow: 1 })], {
      gap: 1,
      align: "center",
    })
  ),
  section(
    "testimonials-carousel",
    "testimonials",
    "Carousel",
    "One at a time with controls.",
    "A testimonial carousel showing one quote at a time with previous/next controls and dot indicators, pausing on hover and focus, swipeable on touch and operable by arrow keys.",
    col(
      [
        row([circle("sm", "accentSoft"), col([bar(90), bar(70), avatarRow(60)], { gap: 1, grow: 1, pad: 1, tone: "surface", rounded: true, border: true }), circle("sm", "accentSoft")], { gap: 1, grow: 1 }),
        row([circle("sm", "accent"), circle("sm", "line"), circle("sm", "line")], { gap: 1, align: "center" }),
      ],
      { gap: 1, align: "center" }
    )
  ),
  section(
    "testimonials-single",
    "testimonials",
    "Single Featured",
    "One large pull quote.",
    "A single featured testimonial: an oversized pull quote in display type, the customer's logo, and their name and role underneath, centred with plenty of whitespace.",
    col([spacer(1), heading(80), bar(60), avatarRow(40), spacer(1)], { gap: 1, align: "center" })
  ),
  section(
    "logos-strip",
    "logos",
    "Logo Strip",
    "Single row of customer logos.",
    "A single row of six customer logos, evenly spaced, desaturated with full colour on hover, and a short 'trusted by' line above. Scrolls horizontally on mobile.",
    col([bar(30, "line"), grid(6, bar(100, "line", 2), { gap: 1, h: 40 })], { gap: 1, align: "center" })
  ),
  section(
    "logos-grid",
    "logos",
    "Logo Grid",
    "Bordered grid of logos.",
    "A bordered grid of customer logos, three or four per row, each cell equal size with hairline separators.",
    grid(4, col([bar(70, "line", 2)], { pad: 1, align: "center", border: true, rounded: true }), { cols: 4, rows: 2, gap: 1, grow: 1 })
  ),
  section(
    "stats-row",
    "stats",
    "Stat Row",
    "Three or four big numbers.",
    "A row of headline statistics: a large number with a short label beneath each, separated by vertical hairlines, stacking two-by-two on mobile.",
    grid(4, col([bar(60, "accent", 3), bar(80, "line")], { gap: 1, align: "center", pad: 1 }), { gap: 1, grow: 1 })
  ),
  section(
    "stats-cards",
    "stats",
    "Stat Cards",
    "Numbers in tinted cards.",
    "Statistics presented as tinted cards with an icon, a large value, a label and an optional trend chip.",
    grid(3, col([circle("sm", "accentLine"), bar(50, "strong", 2), bar(70)], { gap: 1, pad: 1, tone: "accentSoft", rounded: true }), { gap: 1, grow: 1 })
  ),

  // ----------------------------------------------------------------- pricing
  section(
    "pricing-three",
    "pricing",
    "3 Tier Pricing",
    "Middle tier highlighted.",
    "Three pricing tiers side by side with the middle one visually promoted (accent border, 'Most popular' badge, slight lift): plan name, price with billing period, feature list with ticks, and a call-to-action per tier.",
    col(
      [
        heading(40),
        grid(
          3,
          (i) =>
            col([bar(60, "strong"), bar(45, i === 1 ? "accent" : "strong", 3), bar(90), bar(80), bar(70), pill(100, i === 1 ? "accent" : "accentSoft")], {
              gap: 1,
              pad: 1,
              tone: i === 1 ? "accentSoft" : "surface",
              border: true,
              rounded: true,
            }),
          { gap: 1, grow: 1 }
        ),
      ],
      { gap: 1, align: "center" }
    )
  ),
  section(
    "pricing-two",
    "pricing",
    "2 Tier Pricing",
    "Simple either/or choice.",
    "Two pricing cards side by side — a free or starter plan and a paid plan — each with price, a short feature list and one action. The paid card carries the accent treatment.",
    grid(2, (i) => col([bar(55, "strong"), bar(40, i === 1 ? "accent" : "strong", 3), bar(85), bar(70), pill(100, i === 1 ? "accent" : "accentSoft")], { gap: 1, pad: 1, tone: i === 1 ? "accentSoft" : "surface", border: true, rounded: true }), { gap: 1, grow: 1 })
  ),
  section(
    "pricing-table",
    "pricing",
    "Comparison Table",
    "Features × plans matrix.",
    "A full pricing comparison table: plans across the top with sticky headers, feature rows grouped by category, ticks and dashes per cell, and a call-to-action row repeated at the bottom.",
    col(
      [
        row([bar(30, "strong"), spacer(1), bar(14, "accentLine"), bar(14, "accentLine"), bar(14, "accentLine")], { gap: 1 }),
        grid(4, (i) => bar(100, i % 4 === 0 ? "line" : i % 3 === 0 ? "accentLine" : "surface", 2), { cols: 4, rows: 4, gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "pricing-toggle",
    "pricing",
    "Monthly / Yearly Toggle",
    "Billing switch above the tiers.",
    "A pricing section with a monthly/yearly segmented toggle above the tiers that swaps prices in place and shows the yearly saving as a badge.",
    col(
      [
        row([pill(18, "accent"), pill(18, "accentSoft")], { gap: 1, align: "center" }),
        grid(3, (i) => col([bar(55, "strong"), bar(40, i === 1 ? "accent" : "strong", 3), bar(85), pill(100, "accentSoft")], { gap: 1, pad: 1, tone: "surface", border: true, rounded: true }), { gap: 1, grow: 1 }),
      ],
      { gap: 1, align: "center" }
    )
  ),

  // --------------------------------------------------------------------- faq
  section(
    "faq-accordion",
    "faq",
    "Accordion FAQ",
    "Expandable question rows.",
    "An FAQ accordion: one question per row with a chevron that rotates when open, only one panel open at a time, and the whole row as the accessible toggle target.",
    col([heading(40), row([bar(70), spacer(1), circle("sm", "line")], { gap: 1, pad: 1, tone: "surface", rounded: true }), col([row([bar(60, "accentLine"), spacer(1), circle("sm", "accentLine")], { gap: 1 }), bar(90), bar(70)], { gap: 1, pad: 1, tone: "accentSoft", rounded: true }), row([bar(65), spacer(1), circle("sm", "line")], { gap: 1, pad: 1, tone: "surface", rounded: true })], {
      gap: 1,
    })
  ),
  section(
    "faq-two-column",
    "faq",
    "Two Column FAQ",
    "Questions in two columns.",
    "An FAQ laid out as two columns of always-open question and answer pairs, with a contact-support prompt underneath.",
    col([heading(36), grid(2, col([bar(70, "strong"), bar(95), bar(75)], { gap: 1, pad: 1 }), { cols: 2, rows: 2, gap: 1, grow: 1 })], {
      gap: 1,
      align: "center",
    })
  ),

  // --------------------------------------------------------------------- CTA
  section(
    "cta-centered",
    "cta",
    "Centred CTA",
    "Headline plus one button.",
    "A centred call-to-action: a short headline, one supporting line, a primary button and a reassurance line (no card required, cancel anytime).",
    col([spacer(1), heading(56), sub(40), pill(24), bar(30, "line"), spacer(1)], { gap: 1, align: "center" })
  ),
  section(
    "cta-split",
    "cta",
    "Split CTA",
    "Copy left, form right.",
    "A split call-to-action: heading and supporting copy on the left, an inline email capture form with a submit button on the right, plus a privacy note.",
    row(
      [
        col([heading(85), sub(70)], { gap: 1, grow: 1 }),
        col([row([field(false, 70), pill(26)], { gap: 1 }), bar(60, "line")], { gap: 1, grow: 1 }),
      ],
      { gap: 1, pad: 1, tone: "accentSoft", rounded: true }
    )
  ),
  section(
    "cta-banner",
    "cta",
    "Full Width Banner",
    "Accent band across the page.",
    "A full-width call-to-action band in the accent colour with contrasting text, a headline, and two buttons (one solid, one outline on the band).",
    col([spacer(1), heading(60), row([pill(20), pill(20, "surface")], { gap: 1 }), spacer(1)], {
      gap: 1,
      pad: 2,
      tone: "accentSoft",
      rounded: true,
      align: "center",
    })
  ),
  section(
    "cta-newsletter",
    "cta",
    "Newsletter",
    "Subscribe with one field.",
    "A newsletter block: short heading, one email field with an inline subscribe button, success and error states handled inline, and a frequency reassurance line.",
    col([heading(46), row([field(false, 60), pill(22)], { gap: 1 }), bar(34, "line")], { gap: 1, align: "center" })
  ),

  // ------------------------------------------------------------------ others
  section(
    "gallery-grid",
    "gallery",
    "Gallery Grid",
    "Uniform image grid.",
    "A responsive image gallery grid with consistent aspect ratios, hover captions and a lightbox on click that traps focus and closes on Escape.",
    grid(4, bar(100, "surface", 3), { cols: 4, rows: 2, gap: 1, grow: 1 })
  ),
  section(
    "gallery-masonry",
    "gallery",
    "Masonry Gallery",
    "Mixed heights, staggered.",
    "A masonry gallery with mixed image heights in a staggered column layout, lazy-loaded images and a load-more action.",
    row([col([bar(100, "surface", 3), bar(100, "surface", 2)], { gap: 1, grow: 1 }), col([bar(100, "surface", 2), bar(100, "surface", 3)], { gap: 1, grow: 1 }), col([bar(100, "surface", 3), bar(100, "surface", 2)], { gap: 1, grow: 1 })], {
      gap: 1,
    })
  ),
  section(
    "team-grid",
    "team",
    "Team Grid",
    "Portraits with roles.",
    "A team grid: circular portraits with name, role and social links, four across on desktop and two on mobile.",
    grid(4, col([circle("lg", "accentSoft"), bar(70, "strong"), bar(50)], { gap: 1, align: "center", pad: 1 }), { gap: 1, grow: 1 })
  ),
  section(
    "blog-grid",
    "blog",
    "Article Grid",
    "Cards with cover images.",
    "A blog card grid: cover image, category chip, title, excerpt, author and read time. Three across on desktop, one on mobile.",
    grid(3, col([bar(100, "surface", 3), bar(30, "accentLine"), bar(85, "strong"), bar(70)], { gap: 1, pad: 1, border: true, rounded: true }), { gap: 1, grow: 1 })
  ),
  section(
    "contact-split",
    "contact",
    "Contact Split",
    "Form left, details right.",
    "A contact section: a validated form (name, email, message) on the left, and contact details, office address and a map placeholder on the right.",
    row([col([field(), field(), field(), pill(30)], { gap: 1, grow: 1 }), col([bar(60, "strong"), bar(90), bar(70), bar(100, "surface", 3)], { gap: 1, grow: 1, pad: 1, tone: "surface", rounded: true })], {
      gap: 1,
    })
  ),
  section(
    "footer-columns",
    "footer",
    "Multi Column Footer",
    "Link groups plus newsletter.",
    "A multi-column footer: brand block with a short description on the left, three link columns (Product, Company, Resources), a newsletter field, and a bottom bar with legal links, locale switcher and copyright.",
    col(
      [
        row([col([bar(60, "strong", 2), bar(85)], { gap: 1, grow: 2 }), col([bar(70), bar(60), bar(65)], { gap: 1, grow: 1 }), col([bar(70), bar(55), bar(60)], { gap: 1, grow: 1 }), col([bar(80), bar(65)], { gap: 1, grow: 1 })], { gap: 1, grow: 1 }),
        row([bar(30, "line"), spacer(1), circle("sm", "line"), circle("sm", "line")], { gap: 1 }),
      ],
      { gap: 1 }
    )
  ),
  section(
    "footer-simple",
    "footer",
    "Simple Footer",
    "One row of essentials.",
    "A simple footer: wordmark on the left, a handful of essential links in the middle, social icons on the right, and a copyright line beneath a hairline divider.",
    col([row([bar(16, "strong", 2), spacer(1), bar(9), bar(9), bar(9), spacer(1), circle("sm", "line"), circle("sm", "line")], { gap: 1 }), bar(100, "line"), bar(24, "line")], {
      gap: 1,
    })
  ),
  section(
    "footer-minimal",
    "footer",
    "Minimal Footer",
    "Copyright and two links.",
    "A minimal footer: just the wordmark, copyright and two legal links, centred on one line.",
    col([spacer(1), row([bar(14, "strong"), bar(10, "line"), bar(10, "line")], { gap: 1, align: "center" }), spacer(1)], {
      gap: 1,
      align: "center",
    })
  ),
]
