---
kind: epic
size: 8
status: open
dateOpened: "2026-08-30"
relatedTo: ["3049", "3010", "3012"]
tags: [governance, throughput, conveyor, product-strategy]
---

# Generalize delivery-mix classification into an open, admin-configurable tag+target system

## Where this came from

Filed out of the ratification of [#3049](3049-the-conveyor-as-a-shippable-product-not-machinery-and-what-t.md)
(2026-08-30, operator in-session). #3049's own Fork 1 proposed adding one more fixed value
(`product-in-disguise`) to `we:scripts/lib/output-mix-paths.json`'s closed `product`/`machinery` enum.
**That default was rejected, not adopted** — the operator's own framing: a closed enum is a special case of a
more general capability a real product needs. Fork 1 and Fork 2 of #3049 are both superseded by this item;
neither is ratified as originally written. See #3049's own `## Ruling` for the full record.

## The shape, per the operator's own words

- **Open tags, not a closed enum.** A project should be able to classify its own work with whatever
  categories mean something to it (e.g. `product-core`, `conveyor-infra`, `conformance-tooling`) — not be
  limited to a fixed 2- or 3-value set decided once in a statute document. A path/lane may carry more than one
  tag.
- **Admin-configured targets, not a hardcoded ratio.** "At least half must be X" should be a setting a team
  admin sets per tag in product config — not a number written into `we:docs/agent/platform-decisions.md` that
  requires a fresh decision item to change.
- **Repo-agnostic and tenant-aware from the start, not WE-only + defer.** #3049's Fork 2 proposed keeping the
  instrument WE-scoped and revisiting cross-repo reach only if the quota is ever gamed. Rejected: since this
  is meant to become a product capability (per #3049's own Call 1 ruling — assume productization, build
  toward it), it must work against **any repo a customer configures into the product**, not just this
  constellation's own three repos. That does not mean wiring up plateau-app/frontierui data now — it means the
  tag schema and config surface must not structurally assume "one repo."
- **Design for access/zone boundaries eventually, don't build them now.** A real multi-tenant product needs
  per-tenant isolation — whose repos, whose tags, whose targets, who can see what. Not in this item's Done
  When; named here so the schema isn't designed single-tenant and then has to be reshaped later.

## What this replaces

- `we:scripts/lib/output-mix-paths.json`'s closed `class: "product" | "machinery"` enum (`we:scripts/lib/output-mix.mjs`).
- The premise of #3010's proposed numeric floor as a hardcoded statute value — under this item's shape, "half
  must be product" becomes one example of an admin-set target for one tag, not a number ratified once into
  `we:docs/agent/platform-decisions.md`. #3010 itself is a separate, still-open decision and is not ruled by
  this item; its validation gate's un-gate trigger (#3049's third-class question) is satisfied by this item's
  existence, not by this item shipping.

## Not in scope (this pass)

- Actually wiring plateau-app/frontierui repo data into the metric.
- Building real per-tenant access control. Recorded as a forward design constraint on the schema, not a
  Done-when criterion.
- Migrating any existing WE governance callers (#3010, the progress board) onto the new shape — that is
  follow-on work once the shape exists, and may itself want its own card.

## Done when

This is an epic and needs a slicing/design pass before it is buildable — filed to capture the ruling and the
shape, not as an executable spec. At minimum, before slicing:

1. A schema for open, per-path/per-lane tags (replacing the closed `class` field) is designed and reviewed,
   with the repo-agnostic and tenant-boundary constraints above stated in its own doc rather than left
   implicit.
2. A config surface exists for setting a target per tag (which admin, which tags, what ratio, what cadence),
   separate from any one repo's hardcoded governance document.
3. `we:scripts/lib/output-mix.mjs` (or its successor) reads targets from that config rather than a fixed
   two-value comparison, with the existing WE product/machinery split expressible as one concrete
   configuration of the new system (regression: today's board output must remain reproducible under the new
   shape before anything else migrates onto it).
