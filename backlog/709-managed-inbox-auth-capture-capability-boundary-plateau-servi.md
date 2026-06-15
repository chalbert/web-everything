---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
preparedDate: "2026-06-15"
relatedReport: reports/2026-06-15-managed-inbox-auth-capture.md
tags: [tooling, screenshot, exercise-app, infra, boundary]
crossRef: { url: /backlog/611-app-screenshot-access-system-managed-email-inbox-for-logged-/, label: "Unblocks — managed-inbox app-screenshot capability (#611)" }
---

# Managed-inbox / auth-capture capability — boundary (Plateau service vs repo-local devtooling)

> **Decision status: RESOLVED — 2026-06-15.** Reframed during the ratify turn: this is **internal dev
> tooling** for our own capture loop, *not* a product-facing capability — so the #475 "Plateau service +
> no-leakage seam" template was over-applied, and the linear-cost rule doesn't bind (the cost never
> reaches a paying surface). **Ruling: keep it dead simple — a repo-local `scripts/` helper that reads
> mail from the simplest available source per target; no Plateau service, no owned-domain catch-all, no
> credential-vault-as-infra.** Both prepared forks dissolve (below). The prior-art survey
> ([/research/managed-inbox-auth-capture/](/research/managed-inbox-auth-capture/),
> [report](/reports/2026-06-15-managed-inbox-auth-capture.md)) stands as context, but its heavier options
> are not the floor here.

## The ruling — simplest viable, by target

The need: during automated signup/login, receive a verification/OTP/magic-link mail, read it, extract the
link. **Read from the simplest source the target allows**, in this order:

1. **Our own exercise apps (primary target).** We own the auth flow → read from the app's **own dev mail
   sink** (Mailpit / Inbucket) or provision a test user / bypass verification in dev builds. **No email
   account needed at all.** (Dev sinks are the *right* tool here precisely because the target is ours —
   they were only "wrong" for third-party targets.)
2. **Free third-party tiers (secondary — competitive captures behind a free signup).** A **dedicated
   Gmail / Workspace inbox**, read via the **Gmail API** (the `claude_ai_Gmail` connector is already
   wired in this environment). A real reputable address is **not on disposable blocklists** (so signup
   forms accept it), and **`+`-aliasing** gives a fresh per-site address off one mailbox
   (`screenshots+stripe@…`, `screenshots+notion@…` all land filterable in one inbox) — "fresh address
   per site" with zero provisioning.
3. **Throwaway fallback.** A disposable public inbox (e.g. mail.tm's API) driven by Playwright, when you'd
   rather not touch the real account and the target accepts disposable domains.

Fixed-cost, zero standing infra, fully repo-local. The escalation to an **owned domain + catch-all** (the
old Fork 2-A) is **deferred, not built** — reach for it *only if* the disposable/Gmail path proves
blocked in practice on a target we actually need.

## How the two prepared forks dissolved

- **Fork 1 (where it lives) → repo-local devtooling, not a Plateau service.** The #475 replay assumed this
  capability graduates into the *product* (as vision does: design-ref QC → MaaS). It doesn't — it's an
  internal forcing-function for the exercise-app / design-ref loop, never a sold surface. So: no
  no-leakage seam, no Plateau hand-off, no graduation. Devtools = zero lock-in. *If* it ever becomes
  product-facing, repoint then (YAGNI). (The `vision.mjs` seam at
  [scripts/design-refs/vision.mjs:1-14](scripts/design-refs/vision.mjs#L1-L14) remains the precedent for
  capabilities that *do* graduate — this one simply isn't one.)
- **Fork 2 (build vs buy) → simplest reader, not an owned-domain build.** The linear-cost rule that
  forced the fixed-cost owned floor only bites when cost reaches a paying surface; internal dev tooling
  has bounded, internal volume. A dev sink (own apps) and a Gmail inbox (third-party) are both fixed-cost
  *and* simpler than a catch-all — so the heavyweight floor is unnecessary. Owned-domain catch-all stays
  on the shelf as a contingency (survey options B/C — metered SaaS — remain excluded on cost + ToS).

## Required by default (guardrails — carry over unchanged)

Automated third-party signups carry ToS risk on both the inbox vendor and the target site. Fixed,
non-negotiable constraints baked into the build (no decision branch): only sign up where the target's
terms permit (own products, or free tiers that allow automation); never circumvent CAPTCHA or anti-bot;
respect rate limits and robots; keep creds/tokens in a **gitignored env file, never committed**; use a
**dedicated alias/sub-address** (a `screenshots+*` convention), not your real work mail stream, so signup
traffic stays isolated and filterable — a fresh per-site alias per run.

## Per-fork classification (recorded)

- **Layer:** Devtooling — *no runnable standard code, and not product-facing*; a repo-local `scripts/`
  helper that reads mail. Unlike vision (#475/#480), this never graduates into the served product, so the
  no-leakage / Plateau-service machinery does not apply.
- **Protocol?** No — no independent-vendor interop/swap story; no registry. It's a plain dev helper that
  reads from whichever source the target allows (dev sink → Gmail API → disposable inbox).
- **DI-injectable / default:** trivially — the reader is chosen per target in code; default = dev sink for
  own apps, Gmail for third-party. No env-selected provider registry needed at this size.
- **Separate-and-decouple:** N/A — single repo-local helper; nothing to decouple from a service that
  doesn't exist.
- **Fork-existence test (retro):** both forks **dissolved** once reframed as internal devtooling — Fork 1
  had no product-graduation to anchor the Plateau-service branch; Fork 2's linear-cost floor doesn't bind
  off a paying surface. The genuine residual (owned-domain escalation) is a *deferred contingency*, not a
  branch to decide now.

---

## Context

- **Origin.** Carved out of
  [#611](/backlog/611-app-screenshot-access-system-managed-email-inbox-for-logged-/) (its `size: 13` was
  an unresolved decision, not volume — so it could not be sliced; see
  [reports/2026-06-15-backlog-split-analysis.md](/reports/2026-06-15-backlog-split-analysis.md), the
  `/split 611` run). **At resolution #611 is unblocked** — `blockedBy: ["709"]` dropped; it becomes a
  plain build (read mail per the ruling, drive signup with Playwright, capture authenticated states) and
  re-enters `/split` if its volume warrants slicing. **No Plateau-side spinout** — the ruling needs no
  service.
- **Precedents.** #475 (vision = Plateau service / no-leakage client — the template that was *over-applied*
  here; vision graduates to the product, this doesn't),
  [#091](/backlog/091-managed-offering-constellation-layering/) (managed-offering layering),
  [#488](/backlog/488-on-device-ui-screenshot-vision-model-as-a-plateau-capability/) (on-device /
  linear-cost).

## Progress

- **Status:** RESOLVED — **2026-06-15**. Reframed mid-ratify as internal dev tooling → both forks
  dissolved; ruling = repo-local `scripts/` helper reading the simplest source per target (own-app dev
  sink → dedicated Gmail inbox + `+`-aliasing via the Gmail API → disposable fallback), owned-domain
  catch-all deferred as a contingency. #611 unblocked as a plain build (no Plateau spinout).
