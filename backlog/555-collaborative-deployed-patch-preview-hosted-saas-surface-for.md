---
type: idea
workItem: epic
size: 13
status: open
blockedBy: ["410", "554"]
dateOpened: "2026-06-14"
tags: [dev-browser, live-patch, deployed-app, saas, collaboration, approval, open-core, hosted]
---

# Collaborative deployed-patch preview — hosted SaaS surface for #410 overlays

Once the #410 deployed live-patch overlay exists, a hosted SaaS turns the single-session preview into a shared, governed artifact — the paid open-core surface atop the open local primitive. This epic umbrellas the collaboration + approval features: (A) shareable live-fix preview links a stakeholder opens against the deployed app; stakeholder-initiated fix requests (annotate the live view → seed the loop); async comments anchored to an overlay; (B) designer/PM approve-to-PR sign-off on the rendered result; side-by-side variant preview (pick one → PR); a designer visual/token-only patch lane. Blocked on #410 (the overlay) and #554 (the SaaS shell).

## Why this is the open-core line

#410's overlay viewed in your own tab is a dev convenience (open primitive). The moment a patch can be
**shared, approved, and governed across a team**, it's a product — which is exactly the open-core boundary
 and the constellation layering:
the local overlay graduates to WE/FUI; this collaborative surface is served from the Plateau hosted product
(#554). All features here presuppose the overlay never mutates the deployed artifact (#410 Fork 1-A) — they
collaborate over a *view*, so the blast radius stays one-session-per-viewer even when shared.

## Cluster A — the overlay becomes shareable (collaboration)

- **Shareable live-fix preview link** — a URL a teammate/stakeholder opens to see the *same* overlay against
  the deployed app (read-only). Figma-share for a live code-fix preview; the highest-leverage feature — it
  unlocks the rest. Each viewer gets their own session overlay; nothing is mutated server-side.
- **Stakeholder-initiated fix request** — a non-engineer annotates a bug *on the live view*, seeding the
  fix-loop. Two-way: report-in, fix-out.
- **Async comments anchored to an overlay** — review a proposed fix without a live screenshare.

## Cluster B — approval / sign-off workflow

- **Designer/PM "approve-to-PR"** — a non-engineer signs off on the *rendered result*, not the diff;
  approval is what flips overlay → PR. (Maps to #410 Fork 2's per-app authorization policy.)
- **Variant preview** — several candidate overlays shown side-by-side; the stakeholder picks one → that
  becomes the PR.
- **Designer visual/token-only patch lane** — designers patch spacing/color tokens via overlay, approve,
  and it lands as a *token* PR — no engineer in the loop for purely visual fixes.

## Sequencing

Build the **shareable preview link** first (it underpins comments, approval, and variant-pick); the
approval/variant/token features layer on once a shared overlay exists. Likely splits into per-feature
stories when this epic is sliced — file them with `parent: <this NNN>`. Sibling hosted stories that are
**not** under this epic: per-app policy console (#556) and audit/compliance dashboard (#557).
