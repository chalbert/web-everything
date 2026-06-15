---
type: idea
workItem: story
size: 8
status: open
dateOpened: "2026-06-14"
tags: [tooling, screenshot, exercise-app, conformance, infra]
crossRef: { url: /backlog/610-design-sweep-navigation-menus-closed-open-states-live-naviga/, label: "Sibling — logged-out live-nav sweep (#610)" }
---

# App screenshot access system — managed email/inbox for logged-in demo sites

Investigate a system that lets an automated agent **screenshot real apps behind a login** — the
states you only reach once authenticated (dashboards, account flows, post-signup UI). The hard
part isn't the screenshot (Playwright already does that, e.g. the WE header captures in this
session); it's **getting past signup/login**, which needs a **managed email identity** the agent
controls end-to-end.

> **Scope note:** this is **more an *app* concern than a *menu* concern** — collected here because
> it surfaced alongside the nav-menu sweep [#610](/backlog/610-design-sweep-navigation-menus-closed-open-states-live-naviga/).
> #610 covers **public, logged-out** browsing; **this** card is the **logged-in** capability.

## How (settled by [#709](/backlog/709-managed-inbox-auth-capture-capability-boundary-plateau-servi/))

A **repo-local `scripts/` helper** — internal dev tooling, no Plateau service, no owned-domain infra.
Read the verification/OTP/magic-link mail from the **simplest source the target allows**:

- **Our own exercise apps (primary):** the app's own **dev mail sink** (Mailpit / Inbucket) or a
  provisioned test user / dev-build bypass — no email account needed.
- **Free third-party tiers (secondary):** a **dedicated Gmail / Workspace inbox** read via the **Gmail
  API**, with **`+`-aliasing** for a fresh per-site address off one mailbox (real reputable address →
  not disposable-blocklisted).
- **Throwaway fallback:** a disposable public inbox (mail.tm) driven by Playwright.

Then **drive signup/login with Playwright**, extract the token/link, and capture the authenticated
states. Creds/tokens in a **gitignored env file**, never committed; dedicated `screenshots+*` alias, not
real work mail. Owned-domain catch-all is a **deferred contingency** — only if the above proves blocked.

## Why we'd want it

- **Exercise-app conformance loop** (`.claude/skills/exercise-app`) — the flagship apps have
  authenticated surfaces; conformance
  evidence and visual checks currently can't reach them without a human logging in.
- **Competitive capture behind auth** — many reference products (the good dashboards/app UIs) live
  behind a free signup; the logged-out sweep (#610) can't see them.
- **Reproducible, agent-owned identity** — a controlled inbox makes signup flows deterministic and
  re-runnable in CI/headless (where interactive auth like the claude.ai MCP is absent).

## Boundary decision resolved → [#709](/backlog/709-managed-inbox-auth-capture-capability-boundary-plateau-servi/)

The blocking fork is **resolved (2026-06-15)**: this is **internal dev tooling**, a repo-local `scripts/`
helper — no Plateau service, no owned-domain catch-all (see the *How* section above for the settled
shape). `blockedBy` dropped; this is now a plain, scopeable build. The `/split 611` analysis that flagged
it as decision-inflated is in [reports/2026-06-15-backlog-split-analysis.md](/reports/2026-06-15-backlog-split-analysis.md).

## Progress

- **Status:** OPEN — **unblocked 2026-06-15** (#709 ruled). Now a scoped build, not a research idea.
- **Sized 13 → 8 (2026-06-15):** the +5 was the unresolved boundary decision (now in #709, resolved),
  not volume — restored to its pre-inflation build size. Re-enters `/split` only if the build volume
  itself warrants slicing.
