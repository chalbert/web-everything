---
name: project_check_standards_skips_11ty_build
description: "check:standards (the /check gate) does NOT run the 11ty build, so template render errors stay green-invisible; only npm run verify catches them"
metadata: 
  node_type: memory
  type: project
  originSessionId: 182b84b4-067b-4df1-b22c-03059ae14619
---

`npm run check:standards` (the `/check` invariant gate) validates the registries/backlog
but **never runs the 11ty build** — so a Nunjucks template render error leaves the gate green
while `npm start` / the docs site is actually broken. The **only** thing that catches it is
`npm run verify` (vitest + 11ty build smoke), or `/check full` / `/check tests` which adds verify.

**Why:** on 2026-06-13 the docs build was red across the whole branch lineage (every
`/research/<id>/` page) yet `/check` reported green and nobody noticed until the dev server crashed.

**How to apply:** when a session touches `.njk` templates, `_includes/`, `_data/*.json`, or anything
the docs site renders, don't trust a green `check:standards` alone — run `npx @11ty/eleventy --dryrun`
(or `npm run verify`) as a build smoke before declaring health.

Concrete gotcha that bit us: Nunjucks' built-in `iterable` test does `value[Symbol.iterator]` with
no null-guard, so `x is iterable` **throws** "undefined is not iterable" when `x` is undefined.
Always short-circuit truthiness first: `x and x is iterable`. (Fixed in
`src/_includes/research-freshness.njk`.) See [[feedback_backlog_is_tracker]].
