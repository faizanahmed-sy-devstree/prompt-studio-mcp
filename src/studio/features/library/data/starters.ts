// Vendored from Prompt Studio (features/library/data/starters.ts). Do not edit here — run `pnpm sync`.
import { parseFlow } from "../../flow-lang/parser"
import type { ProjectDoc } from "../../../types/project"

export type Starter = {
  id: string
  name: string
  description: string
  source: string
}

/**
 * Starter projects are authored in Flow source rather than as object literals —
 * one representation, and every starter doubles as a parser fixture.
 */
export const starters: Starter[] = [
  {
    id: "blank",
    name: "Blank project",
    description: "Empty canvas — start from nothing.",
    source: `app "Untitled project" {
  target claude-code
  ui_level 3
}`,
  },
  {
    id: "full-system",
    name: "Web + mobile + API",
    description: "One product, three builds, wired together and tested end to end.",
    source: `app "Field Service" {
  target claude-code
  ui_level 3
  builds web, mobile, backend
  theme { design modern-soft; primary #0891b2; secondary #f97316; radius large }
}

views { dispatcher "Dispatcher"; engineer "Field Engineer" }

flows {
  flow access "Signing in" {
    story {
      as     "anyone on the team"
      want   "sign in on whichever device I am holding"
      so     "I can start work without finding a laptop"
      accept [
        "the same account works on the phone and in the console"
        "a wrong password does not say whether the address is registered"
        "signing out on one device does not sign me out of the other"
      ]
    }
  }
  flow dispatching "Assigning work" {
    story {
      as     "a dispatcher"
      want   "see the day's jobs and give each one to an engineer"
      so     "nobody is idle and nothing is double-booked"
      accept [
        "a job assigned to someone already busy is refused, and says who has them"
        "the board reflects an engineer's update without a refresh"
      ]
    }
  }
  flow on_site "Working a job" {
    story {
      as     "an engineer in the field"
      want   "open my next job, record what I did, and move on"
      so     "the office knows where things stand without me phoning in"
      accept [
        "an update made with no signal is sent when the network returns"
        "the same update arriving twice leaves one record, not two"
        "the job I am on survives closing and reopening the app"
      ]
    }
  }
}

# ---- web console ----
screen login "Sign In" {
  template auth
  layout   auth-split
  flows    [access]
}

screen board "Dispatch Board" {
  template dashboard
  layout   dashboard-sidebar
  in       [dispatcher]
  flows    [dispatching]
  story {
    as     "a dispatcher starting the day"
    want   "see every job and who is on it"
    so     "I can fix a gap before a customer notices it"
    accept [
      "an unassigned job is visible without filtering for it"
      "assigning from here reaches the engineer's phone"
    ]
  }
  module queue  "Unassigned"   { kind list }
  module people "Engineers"    { kind list }
  module assign "Assign"       { kind modal; on "drag a job onto an engineer" }
  inner {
    queue  -> assign : "drag a job onto an engineer"
    assign -> people : "on assigned, their column updates"
  }
}

screen jobs "All Jobs" {
  template table
  layout   table-advanced
  in       [dispatcher]
  flows    [dispatching]
}

# ---- phone app ----
screen app_signin "Sign In" {
  template auth
  layout   mobile-auth
  surface  mobile
  flows    [access]
}

screen app_today "Today" {
  template dashboard
  layout   mobile-tabs
  surface  mobile
  in       [engineer]
  flows    [on_site]
  story {
    as     "an engineer between jobs"
    want   "see what is next without hunting for it"
    so     "I can drive straight there"
    accept [
      "the list is readable in sunlight and usable with gloves on"
      "it opens to something useful with no signal"
    ]
  }
}

screen app_job "Job" {
  template detail
  layout   mobile-detail
  surface  mobile
  in       [engineer]
  flows    [on_site]
  module status "Update status" { kind action }
  module photo  "Add photo"     { kind camera; on "tap Add photo" }
  module perms  "Camera access" { kind permission; on "camera not granted yet" }
  inner {
    photo -> perms : "permission not granted yet"
  }
}

# ---- the service both call ----
screen api_auth "Auth" {
  template admin
  surface  backend
  flows    [access]
  story {
    as     "either client app"
    want   "exchange credentials for a token and refresh it without asking again"
    so     "an engineer is not signed out halfway through a job"
    accept [
      "a wrong password answers 401 without saying which field was wrong"
      "a refresh token is single-use; reusing an old one revokes the session"
      "signing out on one device leaves the other signed in"
    ]
  }
  module login   "POST /auth/login"   { kind action }
  module refresh "POST /auth/refresh" { kind action }
}

screen api_jobs "Jobs" {
  template admin
  surface  backend
  flows    [dispatching, on_site]
  story {
    as     "the console and the phone app"
    want   "read the jobs a person may see and record what happened on them"
    so     "the board and the device never disagree"
    accept [
      "an engineer only ever receives their own jobs, enforced on the server"
      "the same status update sent twice leaves one record — the phone retries after a dropped connection"
      "a job already assigned cannot be assigned again without releasing it first"
      "lists are paginated and filtered in the query, never in the client"
    ]
  }
  module list   "GET /jobs"              { kind action }
  module detail "GET /jobs/{id}"         { kind action }
  module assign "POST /jobs/{id}/assign" { kind action }
  module status "POST /jobs/{id}/status" { kind action }
}

flow {
  login      -> board     : "on successful sign in" @dispatcher
  board      -> jobs      : "click All jobs"
  app_signin -> app_today : "on successful sign in" @engineer
  app_today  -> app_job   : "tap a job"
}

data {
  table users "Users" {
    note "Anyone who can sign in, on either device."
    id uuid pk
    email string unique required
    password_hash text required
    full_name string required
    role enum [dispatcher, engineer] required default "engineer"
    active boolean required default "true"
    created_at timestamp required default "now()"
  }

  table customers "Customers" {
    note "Whose site the work happens at."
    id uuid pk
    name string required
    phone string
    address text required
    created_at timestamp required default "now()"
  }

  table jobs "Jobs" {
    note "One visit to one site. The board is a day of these."
    id uuid pk
    reference string unique required note "What everyone calls it on the phone"
    customer_id uuid required index
    assigned_to uuid index note "Null until a dispatcher assigns it"
    status enum [unassigned, assigned, in_progress, done, cancelled] required default "unassigned"
    scheduled_for timestamp required index
    notes text
    created_at timestamp required default "now()"
    updated_at timestamp required default "now()"
  }

  table job_events "Job events" {
    note "Every status change, kept rather than overwritten — this is what the office reads."
    id uuid pk
    job_id uuid required index
    actor_id uuid required
    status enum [assigned, in_progress, done, cancelled] required
    note text
    idempotency_key string unique note "The phone retries after a dropped connection; the second arrival must not add a row"
    created_at timestamp required default "now()"
  }

  table sessions "Sessions" {
    note "One row per signed-in device, so signing out on the phone leaves the console signed in."
    id uuid pk
    user_id uuid required index
    refresh_token_hash text unique required
    device string
    expires_at timestamp required
    revoked_at timestamp
    created_at timestamp required default "now()"
  }

  rel jobs.customer_id -> customers.id : many-to-one "a job happens at one customer's site" on_delete restrict
  rel jobs.assigned_to -> users.id : many-to-one "a job is assigned to one engineer" on_delete set-null
  rel job_events.job_id -> jobs.id : many-to-one "an event belongs to one job" on_delete cascade
  rel job_events.actor_id -> users.id : many-to-one "somebody recorded it" on_delete restrict
  rel sessions.user_id -> users.id : many-to-one "a session belongs to one person" on_delete cascade
}


stack { framework next-16; styling tailwind4-shadcn; state tanstack-zustand; forms rhf-zod }
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
  tooling   ruff-mypy
  packageManager uv
}
structure backend src-layered

requirements """
Three builds, one product. Engineers work offline in poor signal, so every write
endpoint has to tolerate the same request arriving twice. Neither client talks to
the database — both go through the API.
"""`,
  },
  {
    id: "saas-dashboard",
    name: "SaaS dashboard",
    description: "Auth, dashboard, records, detail, settings.",
    source: `app "SaaS Dashboard" {
  target claude-code
  ui_level 3
  theme { primary #4f46e5; secondary #0ea5e9; radius md; buttons filled }
}

flows {
  flow access "Getting in" {
    story {
      as     "a returning customer"
      want   "sign in and land where the work is"
      so     "I am not navigating before I can start"
      accept [
        "signing in goes straight to the dashboard, not to a landing page"
        "a wrong password does not reveal whether the address is registered"
      ]
    }
  }
  flow record_work "Working with records" {
    story {
      as     "somebody who lives in this product"
      want   "find a record, open it, and change it"
      so     "the day's work takes a few clicks rather than a search"
      accept [
        "the list keeps its filters when you come back from a record"
        "saving a new record returns to the list with it visible"
        "an empty list says what to do next, not 'no data'"
      ]
    }
  }
  flow account "Account and settings" {
    story {
      as     "an account owner"
      want   "change how the product is set up for us"
      so     "I do not have to ask support for a routine change"
      accept [ "every change says whether it saved" ]
    }
  }
}

screen login "Sign In" {
  template auth
  layout   auth-split
  flows    [access]
  story {
    as     "a signed-out customer"
    want   "sign in with my email and password"
    so     "I can reach my work"
    accept [
      "the submit button stays disabled until both fields have something in them"
      "a failed attempt keeps the email filled in"
    ]
  }
}

screen dashboard "Dashboard" {
  template dashboard
  layout   dashboard-sidebar
  flows    [access, record_work]
  story {
    as     "somebody starting their day"
    want   "see what needs attention before I go looking for it"
    so     "nothing important waits because nobody opened the right screen"
    accept [ "every figure says the period it covers" ]
  }
}

screen records "Records" {
  template table
  layout   table-advanced
  flows    [record_work]
  story {
    as     "somebody looking for one record"
    want   "filter and sort until I can see it"
    so     "I do not page through hundreds by hand"
    accept [
      "clearing a filter returns to page 1 rather than an empty page 7"
      "the filtered list can be shared as a link"
    ]
  }
}

screen record "Record" {
  template detail
  layout   detail-two-column
  flows    [record_work]
  story {
    as     "somebody who opened a record"
    want   "see everything about it in one place"
    so     "I can answer a question without opening three more screens"
  }
}

screen record_new "New Record" {
  template form
  layout   form-two-column
  flows    [record_work]
  story {
    as     "somebody adding a record"
    want   "fill it in and save without losing what I typed"
    so     "a mistyped field does not cost me the whole form"
    accept [
      "validation errors appear beside the field, not only at the top"
      "leaving with unsaved changes asks first"
    ]
  }
}

screen settings "Settings" {
  template settings
  layout   settings-sections
  flows    [account]
}

flow {
  login      -> dashboard  : "on successful login"
  dashboard  -> records    : "click Records"
  records    -> record     : "click a row"
  records    -> record_new : "click New record"
  record_new -> records    : "on save"
  dashboard  -> settings   : "open the account menu"
}

structure feature-based
conventions [kebab-files, barrel-exports, alias-@, states-required, a11y-baseline, tokens-only]
snippets [a11y, states, tables, data-table-shell, api-hooks, pagination]`,
  },
  {
    id: "auth-flow",
    name: "Authentication flow",
    description: "Sign in, sign up, OTP, reset, first run.",
    source: `app "Authentication" {
  target claude-code
  ui_level 2
  theme { primary #0f766e; secondary #f59e0b; radius md; buttons filled }
}

flows {
  flow sign_up "Creating an account" {
    story {
      as     "somebody who has just decided to try this"
      want   "create an account and get in"
      so     "I can judge the product rather than the sign-up form"
      accept [
        "the email is verified before the account can do anything"
        "the resend link says how long until it can be used again"
      ]
    }
  }
  flow sign_in "Signing in" {
    story {
      as     "a returning user"
      want   "get back in"
      so     "I can carry on"
      accept [ "a failed attempt says what to try, not just that it failed" ]
    }
  }
  flow recovery "Recovering an account" {
    story {
      as     "somebody who has forgotten their password"
      want   "set a new one without contacting support"
      so     "I am not blocked for a day waiting on someone"
      accept [
        "the screen never reveals whether an address is registered"
        "a reset link works once, and expires"
        "changing the password signs out every other session"
      ]
    }
  }
  flow first_run "First run" {
    story {
      as     "somebody who has just signed up"
      want   "know what to do first"
      so     "the empty product does not feel like a mistake"
    }
  }
}

screen login "Sign In" {
  template auth
  layout   auth-split
  flows    [sign_in]
  story {
    as     "a returning user"
    want   "sign in with my email and password"
    so     "I reach my work"
  }
}

screen signup "Create Account" {
  template auth
  layout   auth-center
  flows    [sign_up]
  story {
    as     "a new user"
    want   "create an account with as little typing as possible"
    so     "I can see the product before committing to anything"
    accept [ "password rules are stated before the first attempt, not after it" ]
  }
}

screen otp "Verify Email" {
  template auth
  layout   auth-otp
  flows    [sign_up]
  story {
    as     "somebody who has just signed up"
    want   "enter the code from my email"
    so     "I can finish setting up"
    accept [
      "pasting the whole code fills every box"
      "a wrong code can be corrected without starting over"
    ]
  }
}

screen forgot "Forgot Password" {
  template auth
  layout   auth-minimal
  flows    [recovery]
  story {
    as     "somebody locked out"
    want   "ask for a reset link"
    so     "I can get back in myself"
    accept [ "the confirmation is the same whether or not the address exists" ]
  }
}

screen reset "Set New Password" {
  template auth
  layout   auth-center
  flows    [recovery]
  story {
    as     "somebody who clicked a reset link"
    want   "set a new password and be signed in"
    so     "I am not asked to sign in again immediately"
    accept [ "an expired or reused link explains itself and offers a new one" ]
  }
}

screen welcome "Welcome" {
  template onboarding
  layout   onboarding-checklist
  flows    [first_run]
  story {
    as     "somebody on their first visit"
    want   "be told the two or three things worth doing first"
    so     "the empty product does not look broken"
  }
}

flow {
  login  -> signup  : "click Create account"
  signup -> otp     : "on submit"
  otp    -> welcome : "on code verified"
  login  -> forgot  : "click Forgot password"
  forgot -> reset   : "click the emailed link"
  reset  -> login   : "on password changed"
}

structure feature-based
conventions [kebab-files, alias-@, states-required, a11y-baseline]
snippets [a11y, forms, states]

requirements """
Rate-limit OTP resend to once every 30 seconds and show the countdown.
Never reveal whether an email address exists on the forgot-password screen.
"""`,
  },
  {
    id: "admin-crud",
    name: "Admin CRUD",
    description: "Master/detail, bulk actions, audit.",
    source: `app "Admin Console" {
  target claude-code
  ui_level 2
  theme { primary #1d4ed8; secondary #059669; radius sm; buttons filled; density compact }
}

flows {
  flow access "Getting in" {
    story { as "an administrator"; want "sign in"; so "I can do the work" }
  }
  flow user_admin "Managing users" {
    story {
      as     "an administrator"
      want   "add people, change what they can do, and remove them"
      so     "access matches who actually works here"
      accept [
        "a destructive action names the record it is about to affect"
        "deactivating somebody does not delete their history"
        "bulk actions say how many rows they will touch before they run"
      ]
    }
  }
  flow governance "Roles and audit" {
    story {
      as     "whoever answers for access in an audit"
      want   "see who can do what, and who changed it"
      so     "I can answer the question without asking engineering"
      accept [
        "every destructive action writes an audit entry"
        "the audit log records who, what, and when — and cannot be edited"
      ]
    }
  }
}

screen login "Sign In" {
  template auth
  layout   auth-center
  flows    [access]
}

screen users "Users" {
  template table
  layout   table-master-detail
  flows    [user_admin]
  story {
    as     "an administrator"
    want   "find a person and act on them without leaving the list"
    so     "routine changes take seconds"
    accept [
      "the list keeps its filters after an action closes"
      "an action on a row says what happened when it finishes"
    ]
  }

  module filters   "Filter bar"    { kind filters; on "page load" }
  module table     "User table"    { kind table;   note "server-driven paging, 25 per page" }
  module row_menu  "Row actions"   { kind action;  on "click the row overflow menu" }
  module bulk      "Bulk actions"  { kind action;  on "select one or more rows" }
  module deactivate "Deactivate"   { kind modal;   on "choose Deactivate" }

  inner {
    filters  -> table      : "on filter change, refetch page 1"
    table    -> row_menu   : "click the row overflow menu"
    table    -> bulk       : "select one or more rows"
    row_menu -> deactivate : "choose Deactivate"
    deactivate -> table    : "on confirm, close and refetch"
  }
}

screen user_new "Invite User" {
  template form
  layout   form-single
  flows    [user_admin]
  story {
    as     "an administrator"
    want   "invite somebody with the right role from the start"
    so     "they do not need a second change on their first day"
    accept [ "inviting an address that already has an account says so" ]
  }
}

screen roles    "Roles"     { template admin;    layout table-advanced; flows [governance] }
screen audit    "Audit Log" { template table;    layout table-basic;    flows [governance] }
screen settings "Settings"  { template settings; layout settings-sections; flows [user_admin] }

flow {
  login    -> users    : "on successful login"
  users    -> user_new : "click Invite user"
  user_new -> users    : "on invite sent"
  users    -> roles    : "click Roles"
  roles    -> audit    : "click Audit log"
  users    -> settings : "open settings"
}

structure feature-based
conventions [kebab-files, barrel-exports, no-deep-imports, alias-@, states-required, a11y-baseline]
snippets [a11y, states, tables, data-table-shell, rbac, api-hooks, pagination]

requirements """
Every destructive action names the record in its confirmation and writes an audit entry.
"""`,
  },
  {
    id: "marketing-site",
    name: "Marketing site",
    description: "Full landing page, section by section.",
    source: `app "Marketing Site" {
  target v0
  ui_level 4
  theme { primary #7c3aed; secondary #f59e0b; radius lg; buttons rounded; density spacious }
}

flows {
  flow convert "Deciding to try it" {
    story {
      as     "somebody who arrived from a search result"
      want   "understand what this is and what it costs"
      so     "I can decide without booking a call"
      accept [
        "what the product does is legible without scrolling"
        "pricing is reachable from anywhere on the page"
        "there is one obvious next action, and it is the same one throughout"
      ]
    }
  }
  flow enquiry "Talking to a person" {
    story {
      as     "somebody whose situation does not fit the pricing table"
      want   "reach a human without a lengthy form"
      so     "I do not give up and go elsewhere"
      accept [ "the form says what happens next and when to expect a reply" ]
    }
  }
}

screen home    "Home"    { template landing; layout hero-two-column; flows [convert] }
screen pricing "Pricing" { template landing; layout hero-center;     flows [convert] }
screen contact "Contact" { template form;    layout form-single;     flows [enquiry] }

flow {
  home    -> pricing : "click Pricing"
  pricing -> contact : "click Talk to sales"
}

landing {
  section navigation   "Header"       layout nav-split
  section hero         "Hero"         layout hero-two-column
  section logos        "Trusted by"   layout logos-strip
  section features     "Features"     layout features-bento
  section stats        "By the numbers" layout stats-row
  section testimonials "Customers"    layout testimonials-cards
  section pricing      "Pricing"      layout pricing-three
  section faq          "FAQ"          layout faq-accordion
  section cta          "Get started"  layout cta-banner
  section footer       "Footer"       layout footer-columns
}

structure route-colocated
conventions [kebab-files, shared-first, tokens-only, a11y-baseline]
snippets [responsive, a11y]`,
  },
  {
    id: "checkout",
    name: "Commerce checkout",
    description: "Product, cart, checkout, confirmation.",
    source: `app "Storefront Checkout" {
  target claude-code
  ui_level 3
  theme { primary #db2777; secondary #0ea5e9; radius lg; buttons rounded }
}

flows {
  flow browse "Finding something to buy" {
    story {
      as     "a shopper"
      want   "narrow a large catalogue to the few things I might buy"
      so     "I am not scrolling past things that were never relevant"
      accept [ "a filtered catalogue can be shared as a link" ]
    }
  }
  flow purchase "Buying it" {
    story {
      as     "a shopper who has decided"
      want   "pay without being made to create an account first"
      so     "I do not abandon a full basket at the last step"
      accept [
        "the order summary stays visible at every step, including on mobile"
        "a payment failure returns to the payment step with the details kept"
        "the total, including delivery and tax, is shown before payment"
      ]
    }
  }
}

screen catalogue "Catalogue"  { template search;  layout search-results;  flows [browse] }
screen product   "Product"    { template product; layout product-gallery; flows [browse, purchase] }
screen cart      "Cart"       { template table;   layout table-basic;     flows [purchase] }

screen checkout "Checkout" {
  template checkout
  layout   checkout-steps
  flows    [purchase]
  story {
    as     "a shopper paying"
    want   "get through the steps without losing what I have entered"
    so     "one mistake does not cost me the whole order"
    accept [
      "going back a step keeps everything already filled in"
      "the step I am on, and how many remain, is always visible"
    ]
  }
}

screen confirm "Order Placed" {
  template empty
  layout   empty-first-run
  flows    [purchase]
  story {
    as     "somebody who has just paid"
    want   "proof it worked and a way to check on it"
    so     "I do not have to email to ask whether the order went through"
  }
}

flow {
  catalogue -> product  : "click a product"
  product   -> cart     : "click Add to cart"
  cart      -> checkout : "click Checkout"
  checkout  -> confirm  : "on payment accepted"
  confirm   -> catalogue: "click Continue shopping"
}

structure feature-based
conventions [kebab-files, alias-@, states-required, a11y-baseline, tokens-only]
snippets [a11y, states, forms, responsive, api-hooks]

requirements """
The order summary stays visible at every checkout step, including on mobile.
Payment failures return to the payment step with the entered details preserved.
"""`,
  },
  {
    id: "mobile-app",
    name: "React Native app",
    description: "Expo Router, tabs, offline-aware.",
    source: `app "Field App" {
  target claude-code
  ui_level 3
  theme { design modern-soft; primary #0891b2; secondary #f97316; radius large; buttons rounded }
}

flows {
  flow access "Getting in" {
    story {
      as     "a field engineer picking up a phone at 7am"
      want   "sign in once and stay signed in"
      so     "I am not typing a password in a van in the rain"
      accept [ "the session survives the app being closed and reopened" ]
    }
  }
  flow day_of_work "Working through the day" {
    story {
      as     "a field engineer"
      want   "see today's jobs and update each one as I finish it"
      so     "the office knows where things stand without phoning me"
      accept [
        "the app opens with the last known list even before the network answers"
        "a status update made offline is queued, and the screen says so"
        "queued work syncs on its own when signal returns"
      ]
    }
  }
  flow getting_there "Getting to the job" {
    story {
      as     "a field engineer between calls"
      want   "see where my stops are"
      so     "I am not driving back across the same town twice"
      accept [ "declining location permission still leaves the addresses readable" ]
    }
  }
}

screen onboarding "Get Started" { template onboarding; layout mobile-onboarding; surface mobile; flows [access] }
screen signin     "Sign In"     { template auth;       layout mobile-form; surface mobile; flows [access] }

screen home "Today" {
  template dashboard
  layout   mobile-tabs
  surface  mobile
  flows    [day_of_work]
  story {
    as     "a field engineer starting the day"
    want   "see what I have on, in the order I will do it"
    so     "I can leave without planning it myself"
    accept [ "the list is readable one-handed, outdoors, in daylight" ]
  }
  module tabs   "Tab bar"      { kind nav }
  module stats  "Today's jobs" { kind stats }
  module list   "Job list"     { kind list; on "screen focus" }
  module offline "Offline banner" { kind panel; on "network drops" }
  inner {
    list -> offline : "request fails while offline"
  }
}

screen job "Job Detail" {
  template detail
  layout   mobile-detail
  surface  mobile
  flows    [day_of_work]
  story {
    as     "a field engineer standing on site"
    want   "change the status and attach a photo in a few taps"
    so     "I never write the same thing again in the van afterwards"
    accept [
      "a photo taken with no signal is queued rather than lost"
      "declining the camera permission leaves a way to finish without a photo"
      "the sticky actions stay reachable one-handed"
    ]
  }
  module summary "Job summary"   { kind panel }
  module actions "Sticky actions" { kind action }
  module sheet   "Update status"  { kind sheet; on "tap Update status" }
  module camera  "Photo proof"    { kind camera; on "tap Add photo" }
  module perms   "Camera permission" { kind permission; on "first photo attempt" }
  inner {
    actions -> sheet  : "tap Update status"
    sheet   -> camera : "choose Add photo"
    camera  -> perms  : "camera permission not granted yet"
    sheet   -> summary : "on save, close and refresh"
  }
}

screen map "Route Map" {
  template dashboard
  layout   mobile-map
  surface  mobile
  flows    [getting_there]
  module map_view "Map"          { kind map }
  module sheet    "Stops sheet"  { kind sheet }
  module perms    "Location permission" { kind permission; on "screen open" }
  inner {
    perms -> map_view : "permission granted"
    map_view -> sheet : "tap a marker"
  }
}

screen profile "Profile" { template profile; layout mobile-profile; surface mobile; flows [access] }

flow {
  onboarding -> signin  : "tap Get started"
  signin     -> home    : "on successful sign in"
  home       -> job     : "tap a job"
  home       -> map     : "tap the Map tab"
  home       -> profile : "tap the Profile tab"
  job        -> home    : "on job completed"
}

stack {
  framework expo-router
  language  ts-strict
  styling   nativewind
  state     rn-query-zustand
  forms     rhf-zod
  http      axios-instance
  icons     rn-vector-icons
  tables    rn-flashlist
  charts    victory-native
  testing   rn-testing-library
}

structure expo-feature-based
conventions [kebab-files, barrel-exports, alias-@, shared-first, reuse-components, states-required]
snippets [states, api-hooks, forms]

requirements """
Field engineers use this on Android in poor signal. Job data is cached and the
app opens with the last known list; status updates queue and sync when the
network returns.
Permissions: location (background while on a job), camera, notifications.
"""`,
  },
  {
    id: "swift-app",
    name: "SwiftUI app",
    description: "NavigationStack, sheets, Swift Charts.",
    source: `app "Swift Client" {
  target claude-code
  ui_level 3
  theme { design minimal-mono; primary #0a84ff; secondary #30d158; radius large; buttons filled }
}

flows {
  flow access "Getting in" {
    story { as "a returning user"; want "sign in on my phone"; so "I can reach my clients" }
  }
  flow client_work "Keeping client records" {
    story {
      as     "somebody who sees clients all day"
      want   "find a client, read their history, and add to it"
      so     "the record is written while I still remember the visit"
      accept [
        "reads work offline from the local store"
        "a write made offline retries when connectivity returns"
        "the list stays usable at accessibility text sizes"
      ]
    }
  }
  flow overview "Seeing how things are going" {
    story {
      as     "somebody running their own book of work"
      want   "see the trend without exporting anything"
      so     "I notice a quiet month while I can still do something about it"
    }
  }
}

screen signin "Sign In" { template auth; layout mobile-form; surface mobile; flows [access] }

screen home "Overview" {
  template dashboard
  layout   mobile-tabs
  surface  mobile
  flows    [overview]
  module tabs  "Tab view"    { kind nav }
  module cards "Summary"     { kind stats }
  module chart "Trend chart" { kind chart }
}

screen clients "Clients" {
  template list
  layout   mobile-list
  surface  mobile
  flows    [client_work]
  module search "Searchable list" { kind filters }
  module list   "Client list"     { kind list }
  module add    "Add client"      { kind sheet; on "tap the plus button" }
  inner {
    search -> list : "on search text change"
    list   -> add  : "tap the plus button"
    add    -> list : "on save, dismiss and refresh"
  }
}

screen client "Client Detail" {
  template detail
  layout   mobile-detail
  surface  mobile
  flows    [client_work]
  story {
    as     "somebody who has just finished a visit"
    want   "add what happened to the client's history"
    so     "the next visit starts from what actually happened"
  }
  module header  "Header"      { kind panel }
  module history "Visit history" { kind timeline }
  module edit    "Edit sheet"  { kind sheet; on "tap Edit" }
  inner {
    header -> edit : "tap Edit"
  }
}

screen settings "Settings" { template settings; layout mobile-profile; surface mobile; flows [access] }

flow {
  signin  -> home     : "on successful sign in"
  home    -> clients  : "tap the Clients tab"
  clients -> client   : "tap a client row"
  home    -> settings : "tap the Settings tab"
}

stack {
  framework swiftui
  language  swift
  styling   swiftui-modifiers
  state     swift-observable
  http      swift-urlsession
  icons     sf-symbols
  tables    swift-list
  charts    swift-charts
  testing   swift-testing
  tooling   swiftlint
}

structure swift-features
conventions [shared-first, reuse-components, typed-payloads, small-files, comments-why]

requirements """
Supports the two most recent major iOS versions.
Dynamic Type up to the accessibility sizes; light and dark from the asset catalogue.
Offline reads come from the local store; writes retry when connectivity returns.
"""`,
  },
]

export function starterDoc(id: string): ProjectDoc | null {
  const starter = starters.find((s) => s.id === id)
  if (!starter) return null
  const { doc } = parseFlow(starter.source)
  return { ...doc, name: starter.name }
}
