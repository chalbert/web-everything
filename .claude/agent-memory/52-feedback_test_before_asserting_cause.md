---
name: feedback_test_before_asserting_cause
description: "when diagnosing a \"it's missing / it's broken\" report, run a real test BEFORE naming a cause; never present an untested assumption (cache, stale tab, reload) as the diagnosis; for a UI/rendered-page complaint the probe is a real BROWSER (Playwright) on the live page FIRST, not curl-only — curl shows server HTML, never what client JS renders"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b31eca39-9447-41a3-bb48-aae335d19dad
---

When the user reports something is missing/broken, **verify with a real observation before
asserting a cause.** Run the actual probe — curl the rendered page, grep the served HTML, run the
gate, drive the browser — and let the result name the cause. Do not reach for the convenient
untested explanation ("stale cache", "hard-reload", "it's just uncommitted") and present it as the
diagnosis.

**Why:** On the #610 "can't find it in the backlog" report I asserted *three times* — uncommitted,
wrong port, stale browser tab, hard-reload — each a plausible-sounding guess, none tested against the
live site. The user had to say "please check yourself." The real cause was a template bug: the
/backlog/ type-filter `typeOrder` list (src/backlog.njk) omitted `review`, so every `type: review`
card rendered into the DOM but was permanently hidden (no filter chip to re-enable it). One curl of
the rendered filter chips would have found it in the first reply. Guessing wasted three round-trips
and eroded trust.

**How to apply:**
- A cause is a *finding*, not a hunch — back it with the command output that proves it. If I haven't
  run the probe, I haven't diagnosed; say "let me check" and check, don't speculate.
- "Cache / stale / reload / uncommitted" are hypotheses to *test and rule out by observation*, never
  conclusions to hand the user. Reproduce against the real running system first.
- **For a UI / rendered-page complaint, drive a real browser (Playwright) on the live page as the
  FIRST step, not a last resort.** `curl`/grep only sees the *server* HTML — it cannot see what the
  client JS does to it (a row present in the DOM but hidden/buried by a filter or sort is invisible to
  curl yet is exactly what the user sees). On the /backlog/ "to split" report the count was correct in
  the served HTML, so I concluded "stale tab" — but the real gap was discoverability: client-side
  filter/sort left the rows present-but-buried. A headless browser check (load page → activate tab →
  read computed visibility) found it in one pass; the user had to tell me browser-first should be the
  default. Project has Playwright installed (`node_modules/.bin/playwright`); run a tiny script from the
  repo root so module resolution works, against the live dev port (:3000/:8080, [[project_webeverything_dev_ports]]).
- When I do fix the class of bug, add a gate guard so it can't recur silently, and PROVE the guard
  fires (reintroduce the bug → see it error → restore) rather than assuming it works. See
  [[project_check_standards_skips_the_11ty_build]] — green checks can hide render-layer bugs.
