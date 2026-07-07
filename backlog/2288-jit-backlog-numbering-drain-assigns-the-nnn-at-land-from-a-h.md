---
kind: story
size: 8
parent: "2289"
status: resolved
blockedBy: ["2290"]
dateOpened: "2026-07-05"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# JIT backlog numbering: drain assigns the NNN at land from a hash placeholder

Stop baking the NNN at creation time. A new backlog item is born with a collision-free hash id used in its branch name and filename (a hash-prefixed slug); all in-flight cross-refs (blockedBy/parent/#refs) use the hash. The drain, as sole writer, assigns the real sequential NNN just before merge — from max+1 against serialized main, so it can never race — and does a blind, safe search-replace of the hash to the final NNN across the filename, this item's frontmatter, other items' blockedBy/parent, and body refs. Use the HASH not the slug as the replace token: a hash is unique and greppable so replace is provably safe; slugs recur in prose and collide. Drain numbers in topological (blockedBy) order so a referenced item is numbered before its dependent lands. check:standards needs a provisional-hash-id state valid pre-merge. Side effect: numbers become contiguous (no burned gap numbers from closed lanes) — this is also the big-gap protection. Blocked by #2290 (drain must be sole writer first).

## Progress
- **Status:** resolved — landed via lane → PR.
- **Done:**
  - New `we:scripts/backlog/id.mjs` — canonical two-form id helpers (`HASH_RE`, `ID_TOKEN_RE`, `isHash`/`isNum`, `idFromName`/`slugFromName`, `normalizeId`, `nextHash`, and the pure `applyLedger` numbering brain). Hash = `x` + 6 base36 (7 chars).
  - `we:scripts/backlog.mjs` scaffold now BIRTHS a hash id (not `max+1`); all ref-parsing (`resolveFile`, queue/unqueue/reserve/settle, and the `file.match` guards that crashed on hashes) accepts a hash; cross-refs normalize (no blind pad).
  - `we:src/_data/backlog.js` loader treats the leading token (numeric OR hash) uniformly as `num` — so every downstream consumer (dup-check, blockedBy resolution, readiness/selection, `/backlog/`) works unchanged and a hash validates green.
  - `we:scripts/check-backlog-item.mjs` blockedBy/known-id patterns widened.
  - `we:scripts/lane-drain.mjs` — `numberLandedCouple`: at land, the sole serial writer assigns DETERMINISTIC `max+1` (NOT the #2292 randomized allocator — no collision to avoid here) and blind-rewrites the hash→NNN across the filename + own body + every referrer, via a LOCAL-ONLY (gitignored, Rule #105) hash→NNN ledger that repairs cross-lane edges and resets when the queue drains. Wired into `finalizeLand`; numeric (legacy) couples skip it untouched.
  - `we:scripts/merge-ai-prs.mjs` — the `/pr` fast-drain + `/merge` sweep (the OTHER sole-writer land route post-#2290) calls the SAME `numberPendingHashes` after a WE land, before the derived regen, and pushes. Without this, a `/pr`-landed hash item would sit un-numbered on main.
  - `we:scripts/readiness/lane-manifest.mjs` — `item`/`blockedBy` no longer coerced through `Number()` (which turned a hash into `NaN` → invalid manifest → drain rejected the couple); accept NNN or hash.
  - Tests: `we:scripts/backlog/__tests__/id.test.mjs` (id parsing + `applyLedger`, incl. the cross-lane edge), `we:scripts/__tests__/lane-drain-numbering.test.mjs` (temp-git integration of the numbering wire), + a hash-couple case in `we:scripts/__tests__/lane-drain.test.mjs`. Full suite 2455 green, `check:standards` 0 errors.
  - Doc note in `we:docs/agent/backlog-workflow.md` (JIT numbering / two-form id).
- **Next:** none — resolved. Follow-ups filed for the remaining lifecycle/consumer surface.
- **Notes:** Whether scaffold-on-primary vs scaffold-in-lane composes with the drain-owns-numbering model is the tracked #2219 concern, not re-solved here. `--session` born-active scaffolds are hash-keyed too. Known residual gap: the rare `pr-land --fallback-git` local-merge path (gh unavailable) does not yet number — folded into the follow-up sweep item; the demoted self-heal backstop (#2291) is the safety net for a stray un-numbered hash.
