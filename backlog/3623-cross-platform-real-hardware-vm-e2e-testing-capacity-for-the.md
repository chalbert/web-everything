---
bornAs: xkyisxe
kind: epic
status: open
blockedBy: ["1391", "1753"]
humanGate: { kind: setup, short: "Provision cloud VM/real-hardware E2E testing capacity — a spend decision gated on validated cross-platform demand, not filed as immediately actionable work.", what: "Standing up manual, low-volume real-hardware/real-VM end-to-end exercising capacity for the installed dev-browser app means committing to recurring infra spend (cloud VM hours, and for macOS betas/new Apple Silicon, real non-virtualized hardware billing) ahead of any confirmed cross-platform user. That is a founder go/no-go, not agent-mechanical work — it mirrors #1590's own sequencing logic (avoid infra/hosting spend before revenue validates demand)." }
dateOpened: "2026-09-08"
dateParked: "2026-09-08"
tags: [testing, e2e, dev-browser, plateau, cross-platform, infra, deferred]
---

# Cross-platform real-hardware/VM E2E testing capacity for the dev-browser installed app — parked until demand signal

> **PARKED at creation 2026-09-08 — placeholder home, not active work.** This epic is intentionally a
> *concept anchor*, not a build queue, in the same shape as [#554](/backlog/554-plateau-hosted-saas-product-suite-shell-multi-product-accoun/):
> it gives the recurring "we'll eventually need real-hardware/VM end-to-end exercising for the installed
> app" idea a citable `#NNN` so it doesn't get re-litigated from scratch each time it comes up. It stays
> parked behind the humanGate above. **Unpark when** any cross-platform demand signal validates —
> macOS revenue, an enterprise pilot request, SaaS traction implying cross-platform need, or similar.

Deferred concept anchor for the **manual, low-volume, real-hardware/real-VM end-to-end exercising layer**
the installed dev-browser app ([#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/),
we:packages/dev-browser/) will eventually need on top of its automated CI matrix (GitHub Actions
windows-latest/ubuntu-latest/macos-latest) — a few dispatched work items per cycle, **not** continuous
fleets, and **not** a replacement for the automated suite, which stays separate. [#1753](/backlog/1753-dev-browser-shell-scaffold-stock-chromium-desktop-shell-we-c/)
(the active foundational build slice) is already blocked on a human boot-verify step that needs a real
display — direct, already-happening evidence that automated test suites alone are not enough for a native
installed shell; the product needs real end-to-end exercising on actual hardware/OS at some point, not
just CI.

## Why this exists separately from #1391/#1753

#1391/#1753 own *building* the dev-browser shell. This card is not build scope for that shell — it is the
separate, later question of *how the finished/near-finished installed app gets manually exercised across
real operating systems and hardware generations* once CI-only coverage stops being sufficient (the same
boundary #1753's own humanGate already had to cross once, by hand, for one boot-verify step). Keeping it
as its own parked anchor rather than a stray paragraph inside #1391/#1753 means future infra-spend
proposals for this cite a number instead of re-deriving the reasoning.

## What this concept covers (researched, not yet a ratified decision)

Framing only — these are not open forks to carve now, just the shape a future unpark would settle:

- **Scope is the manual layer only.** A few dispatched real-hardware/real-VM exercising work items per
  cycle, human- or agent-driven against real targets — explicitly **not** continuous device fleets, and
  explicitly **not** the automated test suite (CI matrix via GitHub Actions windows-latest/ubuntu-latest/
  macos-latest), which is a separate, already-standard mechanism that stays as-is.
- **Preferred mechanism: cloud VMs over owning a single physical machine.** VMs give the flexibility to
  snapshot and switch across OS versions and distros on demand, rather than being pinned to whatever one
  physical box happens to run.
- **Real (non-virtualized) hardware only where fidelity genuinely can't be faked: macOS betas and new
  Apple Silicon generations.** Options surveyed: AWS EC2 Mac instances (real Mac hardware, 24h minimum
  billing), Scaleway Apple Silicon (hourly billing, EU-based), MacStadium (dedicated rental, monthly-
  oriented).
- **Windows/Linux: VM-based fidelity is accepted as sufficient.** This matches industry norms —
  BrowserStack, Sauce Labs, and LambdaTest all serve Windows/Linux over VMs rather than real hardware;
  "real device farm" offerings exist only for mobile, because that is where the virtualization fidelity
  gap is actually real. Fallback to bare-metal cloud (Equinix Metal, Hetzner dedicated, OVHcloud bare
  metal) only if a specific GPU/driver bug ever needs it.

## Gate

`humanGate` above, triggered not strictly by macOS revenue specifically but by **any validated demand
signal** for cross-platform reach — macOS revenue, an enterprise pilot request, SaaS traction implying a
cross-platform need, or similar. This mirrors the sequencing logic already ratified in
[#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) (avoid infra/hosting
spend before revenue validates demand) — applied here to test-infra spend rather than product-hosting
spend.

## Relationship to neighbours

- [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) — the dev-browser
  shell epic; this card's installed app.
- [#1753](/backlog/1753-dev-browser-shell-scaffold-stock-chromium-desktop-shell-we-c/) — the active
  foundational slice, and the direct motivating blocker: its own humanGate already needed a real display
  for one boot-verify step.
- [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) — the ratified
  decision whose infra-before-demand sequencing logic this card's gate mirrors.
- [#554](/backlog/554-plateau-hosted-saas-product-suite-shell-multi-product-accoun/) — not a dependency,
  just the structural precedent this card's own shape follows: a parked concept anchor with a `humanGate`,
  citable so deferred ideas don't have to be re-argued each time they resurface.
