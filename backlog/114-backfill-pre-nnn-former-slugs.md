---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-06"
tags: [backlog, routing, back-compat, dx]
crossRef: { url: /backlog/, label: Backlog index }
---

# Backfill `formerSlugs` for the pre-NNN URL migration

> **Resolved 2026-06-06 — deliberate no-op (won't backfill).** The pre-NNN un-numbered URLs were never
> published: the site has no public deployment (no Netlify/Vercel/Pages config, no deploy workflow — it
> only runs on localhost) and nothing in the repo links to an old un-numbered `/backlog/<slug>/`. So a
> 404 on those stems harms no one, and the owner confirmed 404s on them are acceptable. Backfilling 69
> items would generate 69 redirect pages for URLs nobody has ever visited — pure build noise. The
> mechanism stays in place for *going-forward* rewords (a rename adds `formerSlugs` at the time it
> happens), and #075's number-only `/backlog/<NNN>/` redirect already survives any reword. #020 keeps
> its lone `formerSlugs` entry as the canonical live proof of the redirect path. Original note below.

The old-slug redirect mechanism (#110, shipped) keeps a renamed item's prior URL alive via a
`formerSlugs:` list → a generated `/backlog/<former>/` redirect. The NNN-prefix migration earlier
renamed every item from `backlog/<slug>.md` to `backlog/<NNN>-<slug>.md`, so each item's original
un-numbered URL (`/backlog/base-select-first-class-adapter/`) now 404s. #110 seeded just **one** item
(`#020`) as the live proof; the rest are still un-redirected.

Backfill the remaining items: for each, add its pre-NNN stem (the filename minus the `NNN-` prefix —
recoverable from `git log --diff-filter=R --name-status -- 'backlog/*.md'`) to `formerSlugs:`. Low
risk (the validator already guards collisions), purely mechanical, and only worth doing if those
un-numbered URLs were actually published anywhere — otherwise leave it as a documented no-op, since
new rewords are covered going forward and `/backlog/<NNN>/` already survives any reword.
