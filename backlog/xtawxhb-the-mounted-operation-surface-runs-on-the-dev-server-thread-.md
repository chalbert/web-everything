---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-17"
tags: [plateau-loop, operations, console, dev-server, cross-locus]
---

# The mounted operation surface runs on the dev server thread, so a click blocks it

Mounting WE's derived operation surface in the Vite dev-panel plugin (#3036) put every operation's io on the dev server's single thread. WE's io shells are synchronous by design — review-pr's read step runs gh pr view plus a git fetch and three more git calls through execFileSync — so a Run the review click freezes the dev server for as long as they take (routinely 5-20s): no page load, no HMR, and the panel's own status poll stalls. The deleted review-detail route never did this because it spawned a child with async execFile. The same property makes the ungated safe-method routes a liveness risk rather than the harmless recompute the mount's comment first claimed: GET .../suggest-next/run and .../gate-health/run each do a synchronous whole-tree read, and any page the developer visits can fire them in a loop at localhost:4000. Both need one answer: execute the surface off the dev server's thread.

## Why it is not a docblock fix

#3036's mount is correct and its trade is deliberate — the console imports WE's modules rather than shelling a
CLI *because* `createFileRunStore()` resolves the run sidecar by script location, which is what makes "a review
begun in the terminal can be finished in the browser" true. That property must survive whatever this item does.
What must change is WHERE the work runs, not who owns the declaration.

## The two symptoms, one cause

- **An operator-initiated click freezes the dev server.** Annoying but consented-to, and now disclosed in
  `plateau:tools/dev-panel/operations-bridge.mjs`'s header rather than left to be discovered.
- **An ungated safe-method route can be fired by any page the developer visits.** `GET …/<op>/run` is planned
  only for a `compute`-only declaration and is served on a safe method for that reason, so it cannot be gated
  behind the JSON-content-type CSRF check the POST routes use. Its cost today is liveness, not data: there are
  no CORS headers, so a cross-site caller gets an opaque response. Note this is NOT unique to the operation
  surface — `GET /__dev-panel/drain-daemon/queue` is an ungated GET that runs a multi-repo dry run against
  GitHub — so a fix that only covers the operations prefix leaves the larger shape in place.

## Options, none ruled

- **A worker thread** holding the imported WE modules, with the middleware posting requests to it. Keeps one
  import and one process; the sidecar resolution is unchanged. Most faithful to what #3036 built.
- **A pooled child process** running the same generic handler. Cheaper to reason about than a worker, at one
  process spawn per request — which is what the deleted route paid anyway, and with no per-operation argv.
- **Leave execution inline and make only the safe-method EXECUTE route unreachable cross-site** (a required
  custom request header, which `<img src>`/`<script>`/form posts cannot set and cross-origin `fetch` cannot set
  without a preflight). Narrower: it answers the second symptom and not the first.

## Done when

1. **Executable** — a test asserts the dev server's middleware answers an unrelated request while an operation
   is mid-flight (today it cannot, because the operation holds the thread).
2. The bridge header's "AND WHAT IMPORTING COSTS" section is rewritten to describe what is now true, or deleted
   because it no longer is.
