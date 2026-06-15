---
type: idea
workItem: story
size: 13
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

## What it has to do

- **Create & manage email addresses** programmatically (per-site or per-run), so each signup has a
  fresh, owned inbox — avoiding shared-account collisions and rate caps.
- **Receive & read inbound mail** automatically — verification links, magic links, OTP codes,
  password resets — and extract the token/link for the agent to continue the flow.
- **Drive the signup/login** (Playwright) using those credentials, then capture the authenticated
  states.
- **Store & rotate credentials** securely (vault, not plaintext in the repo); never commit secrets.

## Why we'd want it

- **Exercise-app conformance loop** (`.claude/skills/exercise-app`) — the flagship apps have
  authenticated surfaces; conformance
  evidence and visual checks currently can't reach them without a human logging in.
- **Competitive capture behind auth** — many reference products (the good dashboards/app UIs) live
  behind a free signup; the logged-out sweep (#610) can't see them.
- **Reproducible, agent-owned identity** — a controlled inbox makes signup flows deterministic and
  re-runnable in CI/headless (where interactive auth like the claude.ai MCP is absent).

## To investigate before scoping (deferred research)

- **Build vs buy:** disposable/programmable-inbox services & catch-all domains
  (Mailosaur / MailSlurp / Postmark inbound / a self-hosted catch-all on an owned domain) vs a
  thin self-hosted IMAP+API. Cost, ToS, deliverability, secret-handling.
- **Boundary:** is this a generic capability (a Plateau-style service the WE project *consumes* —
  cf. the vision no-leakage ruling #475), or repo-local devtooling? Likely the
  former — it's infra, not a WE standard.
- **Abuse/ToS guardrails:** only sign up to sites where it's permitted; respect rate limits and
  terms; no scraping that violates a site's policy.
- **Linear-cost check:** keep per-run cost bounded (cf. the linear-cost-with-revenue rule)
  — owned domain + self-host over per-call SaaS if volume grows.

## Progress

- **Status:** OPEN — idea collected 2026-06-14 (raised during the nav-menu work). Not scoped to a
  build yet; needs the build-vs-buy + boundary research above.
- **Sized 8 → 13 (2026-06-15, batch pre-flight):** not a build yet (research idea) and the boundary
  question (Plateau-consumed service vs. repo-local devtooling, a #475-class call) is unresolved —
  dropped from the batch pool until scoped.
