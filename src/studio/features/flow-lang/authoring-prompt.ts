// Vendored from Prompt Studio (features/flow-lang/authoring-prompt.ts). Do not edit here — run `pnpm sync`.
import { fieldTypes } from "../data/data/field-types"
import { groupLayouts } from "../library/data/layout-catalogue"
import { allLayouts } from "../library/data/layouts"
import { moduleKinds } from "../library/data/module-kinds"
import { sectionTypes } from "../library/data/section-types"
import { snippets } from "../library/data/snippets"
import { screenTemplates } from "../library/data/templates"
import { promptTargets } from "../prompt/engine/targets"
import { conventions } from "../stack/data/conventions"
import { stackGroups } from "../stack/data/stack-catalogue"
import { structurePresets } from "../stack/data/structures"
import { designLanguages } from "../theme/data/design-languages"
import type { ProjectDoc } from "../../types/project"
import {
  bodyFontValues,
  colorSchemeValues,
  elevationValues,
  fontCharacterValues,
  iconStyleValues,
  motionValues,
  typeScaleValues,
} from "../../types/project"

/**
 * The prompt a developer copies into ChatGPT alongside the client's
 * requirements. It is generated from the same catalogues the app uses, so the
 * list of valid ids can never drift from the code.
 */
/**
 * The decisions already made, written as constraints rather than questions.
 *
 * Rule 10 asks the model to work out which builds a product needs, which is
 * the right instruction for a blank page and the wrong one once somebody has
 * chosen in the app. A model told to decide will decide — and a file saying
 * `builds web` then lands in a project that ships three of them.
 */
function decidedBuilds(doc: ProjectDoc): string {
  const chosen = (["web", "mobile", "backend"] as const).filter(
    (surface) => doc.builds[surface]
  )
  if (!chosen.length) return ""

  const lines = [
    "# Already decided — do not choose these for yourself",
    "",
    `This product ships **${chosen.length} build${chosen.length === 1 ? "" : "s"}**: ${chosen.join(", ")}. Put exactly that in the \`app\` block:`,
    "",
    "```",
    `builds ${chosen.join(", ")}`,
    "```",
    "",
    "Rule 10 below explains how to decide which builds a product needs. It does not apply here — the decision is made. Tag every screen to one of these builds, and add no build beyond them.",
  ]

  if (chosen.includes("backend")) {
    const stack = doc.surfaces.backend.stack
    const parts = [
      stack.framework && `framework  ${stack.framework}`,
      stack.language && `language   ${stack.language}`,
      stack.database && `database   ${stack.database}`,
      stack.orm && `orm        ${stack.orm}`,
      stack.apiStyle && `apiStyle   ${stack.apiStyle}`,
      stack.apiAuth && `apiAuth    ${stack.apiAuth}`,
    ].filter(Boolean) as string[]
    if (parts.length) {
      lines.push(
        "",
        "The service's technology is chosen too. Write it back verbatim — do not substitute something you would have picked instead:",
        "",
        "```",
        "stack backend {",
        ...parts.map((part) => `  ${part}`),
        "}",
        "```"
      )
    }
  }

  return `${lines.join("\n")}\n\n`
}

export function buildAuthoringPrompt(doc?: ProjectDoc): string {
  // Grouped, and with the one-line description the picker shows.
  //
  // The list used to be bare ids with the display name in brackets, which asks
  // a model to choose between twenty-eight options from their names alone. It
  // did what anyone would: reached for the four whose names were self-evident
  // and used them for everything. The description is what makes the rest
  // reachable — it is the same sentence a person reads in the layout picker.
  const screenLayoutIds = groupLayouts(allLayouts.filter((l) => l.scope === "screen"))

  const sectionLayoutsByType = sectionTypes
    .map((type) => {
      const ids = allLayouts
        .filter((l) => l.sectionType === type.id)
        .map((l) => l.id)
      return ids.length ? `- ${type.id}: ${ids.join(", ")}` : ""
    })
    .filter(Boolean)

  const stackLines = stackGroups.map(
    (group) => `- ${group.key}: ${group.options.map((o) => o.id).join(", ")}`
  )

  // What the person already chose in the app, stated as settled.
  const decided = doc ? decidedBuilds(doc) : ""

  return `# Task

You are turning a client's requirements into a **Flow** file — a small
declarative language that describes a frontend application: its screens, how the
user moves between them, the marketing sections of its landing page, and the
technology it should be built with.

One file, **two diagrams**. The same screens are read two ways:

- the **whole-app** diagram — every screen and every transition between them;
- the **flow-wise** diagram — those same screens grouped into named user
  journeys ("Authentication", "Invite a user", "Checkout"), each with its own
  user story.

Nothing is drawn twice. The transitions are written once in \`flow { … }\`, and a
screen's \`flows [ … ]\` tag is what the second diagram reads. **You must produce
both**, and a story for every screen and every flow.

The Flow file will be pasted into **Prompt Studio**, an internal tool that
renders it as an editable flow diagram and then generates a full build prompt
for a coding agent. Your output is therefore not documentation — it is source
code for that tool.

Alongside this prompt you will be given the client's requirements. Read them,
decide what screens the product needs, and write the Flow file.

${decided}# Output rules

1. Output **one fenced code block** and nothing else. No preamble, no
   explanation, no bullet summary.
2. Use **only** the ids listed under "Valid values" below. Do not invent ids.
   If nothing fits, pick the closest listed id — never make one up.
3. Every screen must be reachable: each screen except the entry point must be
   the target of at least one connection.
4. **Label every connection** with what causes it, e.g. \`: "on successful login"\`,
   \`: "click Add Client"\`, \`: "on save"\`. Unlabelled connections are useless.
5. Prefer 6–15 screens. Cover the real flows the requirements imply, including
   create/edit paths and empty or error screens where they matter.
5a. **Name the journeys before you name the screens.** Read the requirements and
   decide what the real user journeys are — signing in and recovering an
   account, first-run onboarding, the create path, the day-to-day path, billing,
   administration — and write the \`flows { … }\` block first. Aim for **3–8
   flows**: one flow per screen is just the screen list renamed, and two flows
   for forty screens groups nothing.
5b. **Every screen carries at least one \`flows [ … ]\` tag.** This is the one
   place to be strict: an untagged screen is a screen nobody could say why they
   built. Tag generously — a screen used in three journeys gets three tags, and a
   dashboard that several journeys return to belongs to all of them. That is
   correct, not a mistake to tidy up.
5c. **A flow is a journey, never a role.** "Admin" is a \`views\` entry — who can
   reach a screen. "Invite a user" is a flow — what someone is trying to get
   done. If a name would fit in \`views\`, it is not a flow.
5d. **Write a \`story { … }\` for every screen and every flow.** One line each for
   \`as\`, \`want\` and \`so\`, then **3–6 acceptance criteria** under \`accept\`.
   Details that matter:
   - criteria must be **checkable** — a rule about what the screen does, not a
     restatement of its layout. "Clearing a filter returns to page 1" is a
     criterion; "has a filter bar" is not.
   - write them in the **client's language, not the framework's**: "an empty
     result says what to change", never "render the EmptyState component".
   - cover what happens when it **goes wrong** — the wrong password, the expired
     link, the half-filled form abandoned and returned to.
   - a flow's story covers the journey **end to end**; a screen's covers only
     that screen. Do not repeat one inside the other.
   - do not repeat the scaffolding: write \`as "a billing admin"\`, not
     \`as "As a billing admin"\`.
6. Screen keys are lowercase snake_case and unique. Titles are human labels.
7. Include a \`landing { ... }\` block only if the requirements mention a public
   marketing site.
8. Add a \`views { … }\` block only when the requirements describe more than one
   kind of user. Then tag a screen with \`in [admin]\` **only when it is
   restricted** — an untagged screen belongs to every role, which is what most
   screens are.
9. Modules are **optional**. Add them to a screen that carries real behaviour —
   a list screen with filters and a create dialog, a detail screen with tabs —
   and leave them off a screen that is genuinely one thing. A modal opening is
   an \`inner\` connection, never a \`flow\` one: \`flow\` means the route changed.
10. **Decide which builds the product needs, and say so.** A product ships as
    some combination of a **web** app, a **mobile** app, a public **landing**
    page and a **backend**. Read the requirements and pick:
    - "internal admin tool", "dashboard", "portal" → web
    - "app", "on their phone", "iOS/Android", "offline in the field",
      "push notifications", "camera", "scan", "GPS" → mobile
    - "marketing site", "public page", "sign-ups from the website" → landing
    - "API", "service", "webhook", "scheduled job", "integration" → backend

    Most real products need **more than one**. A field-service product is a
    mobile app for the engineer *and* a web console for the dispatcher *and* an
    API both of them call — write all of them, in one file.

    Two things follow, and both are required:

    - **Declare them**: \`builds web, mobile, backend\` in the \`app\` block. This
      is what tells the tool to generate one brief covering the whole system
      rather than one app.
    - **Tag every screen** with the build it belongs to: \`surface mobile\`,
      \`surface backend\`; no \`surface\` line means the web build. A build you
      declared with no screens tagged to it is an empty promise.

    Give each build its own stack: \`stack mobile { … }\` and
    \`stack backend { … }\` alongside the web \`stack { … }\` (see Grammar). The
    phone app is not written in the web app's libraries and the service is not
    written in either.

    Never draw a \`flow\` arrow from one build to another — a phone screen
    calling an endpoint is an integration, not a transition. Say it in the
    screen's \`note\` or in \`requirements\`.

11. **Mobile screens are not web screens.** Use the \`mobile-*\` layouts — a
    phone screen is never \`dashboard-sidebar\` or \`table-advanced\`. Reach for
    \`mobile-auth\`, \`mobile-onboarding\`, \`mobile-tabs\` (or
    \`mobile-floating-tabs\` / \`mobile-tabs-fab\`), \`mobile-list\`,
    \`mobile-detail\`, \`mobile-form\`, \`mobile-sheet\`, \`mobile-profile\`.
    Useful module kinds there: \`sheet\`, \`permission\`, \`camera\`, \`map\`. In the
    mobile \`stack\`, pick the native options (\`expo-router\`/\`swiftui\`,
    \`nativewind\`, \`rn-flashlist\`, \`victory-native\`) — the web ones do not
    exist on a phone.
12. **A backend "screen" is a service area, not a page.** The grammar has one
    word for a node, so on \`surface backend\` a \`screen\` is a group of related
    endpoints — \`auth\`, \`clients\`, \`billing\`, \`webhooks\`, \`jobs\` — and its
    \`module\`s are the endpoints and jobs inside it. Give it no \`layout\`: there
    is nothing to lay out. Its story is written from the caller's point of view
    ("as the web app", "as a scheduled job"), and its criteria are the rules the
    service enforces — what it rejects, what it is allowed to do twice, what it
    never returns.

    A \`flow\` arrow between two backend screens means one service area calls
    another: worth drawing when it is true, worth leaving out when it is not.

13. **Choose the service's technology deliberately.** In \`stack backend\`, set
    \`framework\`, \`database\`, \`orm\`, \`apiStyle\` and \`apiAuth\`. These are the
    decisions both clients are built against — \`apiStyle\` decides whether the
    apps generate their types from a schema or share them directly, and
    \`trpc\` is only possible when the service is TypeScript.

14. **Write the data model.** Everything the product stores goes in one
    \`data { … }\` block: the tables, their columns, and how they relate. This is
    required whenever the product keeps anything at all — which is nearly
    always, and is certain if you declared a \`backend\` build.

    It exists because the screens and the endpoints are otherwise described
    without the thing underneath them, and each build then invents its own
    schema. One model, read by every build.

    - **One table per real thing**, named in the plural and snake_case:
      \`users\`, \`orders\`, \`order_items\`. 4–12 tables is the usual range; a
      product with one table has probably not been read closely enough.
    - **Every table gets \`id uuid pk\` and \`created_at timestamp\`**, plus
      \`updated_at\` on anything that is edited.
    - **Draw the relations.** A foreign key column and a \`rel\` line for it —
      \`rel orders.user_id -> users.id : many-to-one\`. Say what deleting the
      parent does: \`on_delete cascade\` for rows that only exist as part of it,
      \`restrict\` for rows that must block the delete, \`set-null\` for a link
      that may simply go away.
    - **Many-to-many needs a join table**: \`rel posts <-> tags : many-to-many
      through post_tags\`.
    - **Use \`enum [ … ]\` for a fixed set** — a status, a role — rather than free
      text nobody constrains.
    - **Mark \`unique\` and \`index\`** where the requirements imply them: an email
      that identifies an account is unique; a column every list filters by is
      indexed.
    - The columns must actually support the screens. If a list screen filters by
      date and status, those columns exist; if a screen shows an author's name,
      there is a relation that reaches it.

15. Put anything that does not fit the grammar into the \`requirements """..."""\`
   block in plain English — business rules, roles, integrations, edge cases.

# Grammar

\`\`\`
app "Product name" {
  target claude-code          # who will build it
  ui_level 3                # 1 = build exactly what is described, 5 = a showpiece
  builds web, mobile, backend # which builds this product ships — see rule 10
  theme {
    design modern-soft; primary #2563eb; secondary #10b981
    radius md; buttons filled; density comfortable
    # Optional, and all defaulted — set the ones the product has an opinion about.
    headings grotesque; body pair; scale balanced
    icons line; elevation subtle; motion restrained; scheme both
  }
}

# OPTIONAL — only if the product has more than one kind of user.
# A screen with no "in [...]" line belongs to every one of them.
views { admin "Admin"; rep "Sales Rep" }

# REQUIRED — the named user journeys. This is the flow-wise diagram.
# A flow declares itself and its story; which screens are in it is a tag on
# the screen, below.
flows {
  flow auth "Authentication" {
    story {
      as     "a returning user"
      want   "get into the console, and back in when I have lost my password"
      so     "I can start work without asking anyone for help"
      accept [
        "a wrong password says so without revealing which field was wrong"
        "a reset link expires 30 minutes after it is issued"
        "signing in lands on the dashboard, not back on the form"
      ]
    }
  }
  flow client_admin "Managing clients" {
    story { as "an operations admin"; want "keep the client list accurate"; so "the team is never working from stale records" }
  }
}

screen login "Sign In" {
  template auth               # what kind of screen it is
  layout   auth-split         # how it is laid out
  flows    [auth]             # which journeys it is part of — one or many
  story {
    as     "a signed-out user"
    want   "sign in with my email and password"
    so     "I can reach my work"
    accept [
      "the submit button stays disabled until both fields have something in them"
      "a failed attempt keeps the email filled in"
      "five failed attempts in a row locks the form for a minute"
    ]
  }
  note     "email + OTP, Google SSO"   # anything else specific to this screen
}

screen clients "Clients" {
  template table
  layout   table-advanced
  flows    [client_admin]
  story {
    as     "an operations admin"
    want   "see every client in one filterable table"
    so     "I can reach the right record without hunting through pages"
    accept [
      "the table paginates and never loads more than 50 rows at once"
      "clearing a filter returns to page 1 rather than an empty page 7"
      "an empty result says what to change, not 'no data'"
    ]
  }

  # OPTIONAL — the pieces inside the screen. Add them where a screen carries
  # real behaviour; leave them off for simple screens.
  module filters   "Filter bar"   { kind filters; on "page load" }
  module table     "Client table" { kind table }
  module add_modal "Add client"   { kind modal; on "click Add Client" }

  # movement *inside* the screen, with no route change
  inner {
    filters   -> table : "on filter change, refetch page 1"
    table     -> add_modal : "click Add Client"
    add_modal -> table : "on save, close and refetch"
  }
}

screen dashboard "Dashboard" { template dashboard; layout dashboard-sidebar; flows [auth, client_admin] }
screen team      "Team"      { template admin; layout table-basic; in [admin]; flows [client_admin] }

# A phone screen. No "surface" line means web; the "landing" block is the
# public marketing page; "surface backend" is a service rather than a UI.
screen app_home "Today" { template dashboard; layout mobile-tabs; surface mobile; flows [client_admin] }

# Every screen a \`flow\` line mentions must be declared, and tagged.
screen client_new "New Client" { template form; layout form-sidebar-summary; flows [client_admin] }

# movement *between* screens — a real route change
flow {
  login      -> dashboard  : "on successful login"
  dashboard  -> clients    : "click Clients in the sidebar"
  clients    -> client_new : "click Add Client"
  client_new -> clients    : "on save"
}

landing {
  section hero     "Hero"     layout hero-two-column
  section features "Features" layout features-grid-3
  section pricing  "Pricing"  layout pricing-three
}

# What the product stores. One model, shared by every build — see rule 14.
data {
  table users "Users" {
    note "Anyone who can sign in."
    id         uuid      pk
    email      string    unique required
    full_name  string    required
    role       enum [admin, member] required default "member"
    created_at timestamp required default "now()"
  }

  table clients "Clients" {
    id         uuid      pk
    name       string    required
    owner_id   uuid      required index
    status     enum [active, paused, closed] required default "active"
    created_at timestamp required default "now()"
    updated_at timestamp required default "now()"
  }

  # The foreign key column above, and what it joins.
  rel clients.owner_id -> users.id : many-to-one "a client belongs to one account manager" on_delete restrict

  # Many on both sides needs a join table.
  rel clients <-> tags : many-to-many through client_tags
}

stack {
  framework next-16
  language  ts-strict
  styling   tailwind4-shadcn
  state     tanstack-zustand
  forms     rhf-zod
  http      axios-instance
  extras    "socket.io for live updates"
}

structure feature-based

# One stack per build. Omit a block for a build this product does not ship.
stack mobile {
  framework expo-router
  styling   nativewind
  state     rn-query-zustand
}
structure mobile expo-feature-based

stack backend {
  framework fastapi          # or nestjs, express-drizzle, django-drf
  language  python
  database  postgres
  orm       sqlalchemy
  apiStyle  rest-openapi     # how the clients get their types
  apiAuth   jwt-refresh
  testing   pytest
}
structure backend src-layered

conventions [kebab-files, barrel-exports, alias-@, a11y-baseline]
snippets [a11y, states, tables]

requirements """
Multi-tenant. Admin actions gated by role.
Clients import from CSV; duplicates are merged, never overwritten.
"""
\`\`\`

Notes on syntax: braces and semicolons are optional, \`->\` may also be written
\`→\`, and \`# \` starts a comment. Multi-line text uses \`"""\` fences. Inside a
\`story\`, \`accept [ … ]\` may run over several lines with one quoted criterion
per line, and a short story fits on one line with semicolons between its parts.

# Valid values

## column types (\`data\` block)
${fieldTypes.map((t) => `- ${t.id} — ${t.hint}`).join("\n")}

Relation kinds: \`many-to-one\`, \`one-to-many\`, \`one-to-one\`, \`many-to-many\`
(\`n:1\`, \`1:n\`, \`1:1\`, \`n:n\` are read the same way). Column flags:
\`pk\`, \`required\`, \`unique\`, \`index\`, \`default "…"\`, \`note "…"\`.

## targets
${promptTargets.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## design languages (theme \`design\`)
${designLanguages.map((d) => `- ${d.id} — ${d.tagline}`).join("\n")}

## the rest of the theme block
Every one has a default, so omit what the product has no opinion about. Setting
them is how a brief gets a look of its own rather than the same soft-modern
default every product gets.

- \`headings\` — ${fontCharacterValues.join(", ")}
- \`body\` — ${bodyFontValues.join(", ")} (\`pair\` = choose something that sits under the heading face)
- \`scale\` — ${typeScaleValues.join(", ")}: how far apart the heading sizes sit
- \`icons\` — ${iconStyleValues.join(", ")}
- \`elevation\` — ${elevationValues.join(", ")}: how much the surfaces lift off the page
- \`motion\` — ${motionValues.join(", ")}
- \`scheme\` — ${colorSchemeValues.join(", ")}: \`both\` ships light and dark, \`dark-first\` designs dark and derives light

## screen templates
${screenTemplates.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## screen layouts
${screenLayoutIds}

## module kinds
${moduleKinds.map((k) => `- ${k.id} — ${k.description}`).join("\n")}

## section types
${sectionTypes.map((s) => `- ${s.id} — ${s.description}`).join("\n")}

## section layouts (by section type)
${sectionLayoutsByType.join("\n")}

## stack options
${stackLines.join("\n")}

## folder structures
${structurePresets.map((s) => `- ${s.id} — ${s.description}`).join("\n")}

## conventions
${conventions.map((c) => `- ${c.id} — ${c.label}`).join("\n")}

## requirement snippets
${snippets.map((s) => `- ${s.id} — ${s.description}`).join("\n")}

# Worked example — one product, three builds

\`\`\`
app "FieldOps" {
  target claude-code
  ui_level 3
  builds web, mobile, backend
  theme { design modern-soft; primary #0891b2; secondary #f97316; radius large }
}

views { dispatcher "Dispatcher"; engineer "Field Engineer" }

flows {
  flow access "Getting in" {
    story {
      as     "anyone on the team"
      want   "sign in on whichever device I am holding"
      so     "I can start work without finding a laptop"
      accept [
        "the same credentials work on the phone app and the web console"
        "a failed sign in says what to do next, not just that it failed"
      ]
    }
  }
  flow dispatching "Dispatching work" {
    story {
      as     "a dispatcher"
      want   "see every open job and put the right engineer on each one"
      so     "nobody is sent across the county for a ten minute call"
      accept [
        "an unassigned job is visible without filtering for it"
        "assigning a job reaches the engineer's phone without them refreshing"
      ]
    }
  }
  flow on_site "Doing the job" {
    story {
      as     "a field engineer"
      want   "update a job and attach proof while I am standing in front of it"
      so     "I never write the same thing twice in the van afterwards"
      accept [
        "a status change made with no signal is kept and sent when signal returns"
        "the app says plainly when something is queued rather than saved"
        "declining the camera permission leaves a way to finish without a photo"
      ]
    }
  }
}

# ---- web console (no surface line = web) ----
screen login     "Sign In"    { template auth;      layout auth-split;        flows [access] }
screen board     "Dispatch"   { template dashboard; layout dashboard-sidebar; in [dispatcher]; flows [dispatching] }
screen jobs      "All Jobs"   { template table;     layout table-advanced;    in [dispatcher]; flows [dispatching] }

# ---- phone app ----
screen app_signin "Sign In"  { template auth;      layout mobile-auth;   surface mobile; flows [access] }
screen app_today  "Today"    { template dashboard; layout mobile-tabs;   surface mobile; in [engineer]; flows [on_site] }
screen app_job    "Job"      {
  template detail
  layout   mobile-detail
  surface  mobile
  in [engineer]
  flows [on_site]
  story {
    as     "a field engineer standing on site"
    want   "change the job status and add a photo in a few taps"
    so     "the office knows where things are without me phoning them"
    accept [
      "the status sheet opens over the job without losing my place"
      "a photo taken with no signal is queued, and the screen says so"
      "the sticky actions stay reachable one-handed on a small phone"
    ]
  }
  module actions "Sticky actions" { kind action }
  module sheet   "Update status"  { kind sheet;      on "tap Update status" }
  module camera  "Photo proof"    { kind camera;     on "tap Add photo" }
  module perms   "Camera access"  { kind permission; on "first photo attempt" }
  inner {
    actions -> sheet  : "tap Update status"
    sheet   -> camera : "choose Add photo"
    camera  -> perms  : "permission not granted yet"
  }
}

flow {
  login      -> board    : "on successful sign in" @dispatcher
  board      -> jobs     : "click All jobs"
  app_signin -> app_today : "on successful sign in" @engineer
  app_today  -> app_job   : "tap a job"
}

# ---- the service both clients call ----
screen api_auth "Auth" {
  surface backend
  flows   [access]
  note    "Issues and refreshes tokens for both clients."
  story {
    as     "either client app"
    want   "exchange credentials for a token, and refresh it without asking again"
    so     "an engineer is not signed out halfway through a job"
    accept [
      "a wrong password answers 401 without saying which field was wrong"
      "a refresh token is single-use and rotates; reuse of an old one revokes the session"
      "the same account works from both clients, and signing out on one does not sign out the other"
    ]
  }
  module login   "POST /auth/login"   { kind action }
  module refresh "POST /auth/refresh" { kind action }
}

screen api_jobs "Jobs" {
  surface backend
  flows   [dispatching, on_site]
  story {
    as     "the phone app and the web console"
    want   "read the jobs I am allowed to see and record what happened on them"
    so     "the board and the device never disagree about a job's state"
    accept [
      "an engineer only ever receives their own jobs, enforced on the server"
      "the same status update sent twice leaves one record, not two — the device retries after a dropped connection"
      "a job list is paginated and filtered in the query, never in the client"
      "a photo upload that fails halfway leaves no half-attached record"
    ]
  }
  module list   "GET /jobs"              { kind action }
  module detail "GET /jobs/{id}"         { kind action }
  module status "POST /jobs/{id}/status" { kind action }
}

flow {
  login      -> board    : "on successful sign in" @dispatcher
  board      -> jobs     : "click All jobs"
  app_signin -> app_today : "on successful sign in" @engineer
  app_today  -> app_job   : "tap a job"
}

stack { framework next-16; styling tailwind4-shadcn; state tanstack-zustand }
structure feature-based

stack mobile {
  framework expo-router
  styling   nativewind
  state     rn-query-zustand
  testing   rn-testing-library
}
structure mobile expo-feature-based

stack backend {
  framework fastapi
  language  python
  database  postgres
  orm       sqlalchemy
  apiStyle  rest-openapi
  apiAuth   jwt-refresh
  testing   pytest
}
structure backend src-layered

requirements """
Three builds, one product. Engineers use the phone app offline in poor signal;
dispatchers use the web console; both call the same API and neither talks to the
database directly. Job status updates queue on the device and sync when the
network returns, so every write endpoint has to tolerate being sent twice.
"""
\`\`\`

# Worked example — internal admin app

\`\`\`
app "Acme Ops Console" {
  target claude-code
  ui_level 3
  theme { primary #2563eb; secondary #10b981; radius md; buttons filled }
}

flows {
  flow auth "Authentication" {
    story {
      as     "an agent starting a shift"
      want   "sign in and land where I left off"
      so     "I am not clicking through menus before I can take the first call"
      accept [
        "signing in goes straight to Operations"
        "a wrong password does not say whether the address exists"
      ]
    }
  }
  flow order_handling "Handling an order" {
    story {
      as     "a support agent"
      want   "find an order and see everything that has happened to it"
      so     "I can answer the customer on the first call"
      accept [
        "an order is findable by its number, the customer's email, or both"
        "the detail screen shows the full history, newest first"
      ]
    }
  }
  flow refunds "Issuing a refund" {
    story {
      as     "a supervisor"
      want   "refund a charge and have it recorded against the order"
      so     "the next person to open it can see what was done and by whom"
      accept [
        "an agent who is not a supervisor sees the button disabled with the reason"
        "a refund cannot be submitted twice by double-clicking"
        "every refund writes an audit entry visible on the order detail screen"
      ]
    }
  }
}

screen login     "Sign In"        { template auth;      layout auth-split;         flows [auth] }
screen dashboard "Operations"     { template dashboard; layout dashboard-sidebar;  flows [auth, order_handling] }
screen orders    "Orders"         { template table;     layout table-advanced;     flows [order_handling] }
screen order     "Order Detail"   { template detail;    layout detail-two-column;  flows [order_handling, refunds] }
screen refund    "Issue Refund"   { template form;      layout form-sidebar-summary; flows [refunds] }
screen settings  "Settings"       { template settings;  layout settings-sections;  flows [order_handling] }

flow {
  login     -> dashboard : "on successful login"
  dashboard -> orders    : "click Orders"
  orders    -> order     : "click an order row"
  order     -> refund    : "click Issue refund"
  refund    -> order     : "on refund submitted"
  dashboard -> settings  : "open the settings menu"
}

stack { framework next-16; styling tailwind4-shadcn; state tanstack-zustand; forms rhf-zod }
structure feature-based
conventions [kebab-files, barrel-exports, alias-@, states-required, a11y-baseline]
snippets [a11y, states, tables]

requirements """
Only supervisors can issue refunds; agents see the button disabled with a tooltip.
Every refund writes an audit entry visible on the order detail screen.
"""
\`\`\`

# Worked example — marketing site

\`\`\`
app "Northwind Launch" {
  target v0
  ui_level 4
  theme { primary #7c3aed; secondary #f59e0b; radius lg; buttons rounded }
}

flows {
  flow convert "Starting a trial" {
    story {
      as     "someone who arrived from a search result"
      want   "understand what this is and start using it"
      so     "I can judge it myself instead of booking a call"
      accept [
        "the first screen states what the product does without scrolling"
        "the trial can be started without entering card details"
        "pricing is reachable from anywhere on the page"
      ]
    }
  }
}

screen home "Home" {
  template landing
  layout   hero-two-column
  flows    [convert]
  story {
    as     "a first-time visitor"
    want   "see what this does and what it costs"
    so     "I can decide in under a minute"
    accept [
      "there is one obvious next action above the fold"
      "no pricing claim appears that the pricing section contradicts"
    ]
  }
}

landing {
  section navigation   "Header"      layout nav-split
  section hero         "Hero"        layout hero-two-column
  section logos        "Trusted by"  layout logos-strip
  section features     "Features"    layout features-bento
  section testimonials "Loved by"    layout testimonials-cards
  section pricing      "Pricing"     layout pricing-three
  section faq          "Questions"   layout faq-accordion
  section cta          "Get started" layout cta-banner
  section footer       "Footer"      layout footer-columns
}

structure route-colocated
conventions [kebab-files, tokens-only, a11y-baseline]
snippets [responsive, a11y]

requirements """
Single conversion goal: start a free trial. No credit card copy above the fold.
"""
\`\`\`

Now write the Flow file for the requirements provided. Both diagrams — the whole
app, and the flows — and a story on every screen and every flow.`
}
