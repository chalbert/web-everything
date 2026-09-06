# Open-story staleness audit — 445 open backlog items

**Date:** 2026-09-06 · **Scope:** every `status: open` backlog item EXCEPT the #2445 tree
(Plateau Loop / delivery-machinery coordinator product — 224 items, excluded at the operator's
request as the actively-churning mechanical delivery system).

**Method.** 20 parallel reading agents, each given ~20 cards and instructed to verify every claim
against live source in `web-everything`, `frontierui` and `plateau-app` — not to judge plausibility.
Every `ALREADY-DONE` verdict was then re-run through a second, **adversarial** verification pass whose
job was to break the claim: extract the card's `## Done when` clauses verbatim, find the artifact for
each, run the cited tests, and hunt for the clause that *isn't* satisfied.

## Headline numbers

| Verdict | Count | Meaning |
|---|---:|---|
| `OK` | 176 | current and accurate |
| `STALE-INFO` | 209 | still-valid work carrying outdated statements |
| `ALREADY-DONE` (claimed) | 32 | → **25 confirmed**, 7 rejected by the adversarial pass |
| `DEAD-REFS` | 12 | mechanical rot only |
| `STALE-PREMISE` | 6 | motivating premise no longer holds |
| `SUPERSEDED` | 2 | replaced by a later card |

**About 60% of open cards carry something outdated.** The dominant failure is not wrong work — it is
cards whose *prose* describes a tree that has moved underneath them.

## The adversarial pass was necessary

7 of 32 "already done" claims (**22%**) did not survive verification:

| Card | Why it failed |
|---|---|
| #2387 | epic — child #2442 still `open`, so it cannot resolve |
| #3177 | Done-when 2 unmet: no kill-pid-then-redispatch test; `grep -rn 3177` finds one comment, zero artifacts |
| #3357 | Done-when 3 (count recorded on the card) absent; array-argv arm still a hard-coded filename enumeration — the card's own stated defect |
| #3360 | implementation complete, but the card's only Done-when is a literal `TODO` — nothing to prove against |
| #1836 | epic — child #1901 is `parked`, which `openChildrenOf` counts as open; `we:scripts/backlog/epic-resolve.mjs:71` refuses it |
| #2305 | box 1 ticked but false: `we:scripts/guard-lane-install.mjs status` reports NOT registered; frontierui/plateau-app have neither the script nor a settings file |
| #3494 | clause 2 was false at landing (commit `5d051f22`); live-verified only via follow-up #3496, still `active` |

Had these been resolved on the first pass, 7 cards would have been closed over undelivered work.

## Applied in this pass

**25 cards resolved** (each confirmed clause-by-clause, cited tests re-run):
#2369, #2383, #2423, #2914, #2924, #2949, #2953, #2975, #2976, #3045, #3100, #3117, #3189, #3200,
#3206, #3207, #3208, #3209, #3213, #3268, #3350, #3351, #3362, #3363, #3390.

`graduatedTo` was set explicitly on each — the two real graduations name verified-present paths
(`frontierui:plugs/webdirectives/ssr/{jvm,net}/`), the rest are `none`. This is deliberate given the
#2756 failure below.

Everything else in this report is left for an operator call and applied to no card.

## Findings that need a decision

### 1 — #2756 was resolved over work that does not exist (highest severity)

#2756 was flipped to `resolved` on 2026-09-06 with
`graduatedTo: frontierui:plugs/webdirectives/ssr/rust/`. That directory **does not exist**: `frontierui`
`origin/main` (`b2d7b1e`) contains zero `.rs` files, the SSR subtrees present are `{jvm,net,python}`
only, and `git ls-remote --heads origin` shows no Rust branch anywhere. The card resolve landed while
its implementation did not.

The gate for this is already filed — as **#3502** (`bornAs: xlv5507`), *"A card-resolve PR can land
before the impl it names in graduatedTo, and nothing checks the target exists"*, which cites #2756 as
its own reproduction. That card landed stranded with a hash id and was the single `check:standards`
error until the drain numbered it mid-audit.

**The live consequence is unfixed:** #2761 and #2764 carry `blockedBy: ["2756"]`, so with #2756
resolved they now read as Tier-A ready — and their `scope:` points at
`frontierui:plugs/webdirectives/ssr/rust/src/renderer.rs`, a file under a directory that was never
created. Two cards are dispatchable onto a nonexistent foundation.

**Recommended:** reopen #2756. Un-resolving is a lifecycle reversal, not a mechanical fix, so this pass
did not do it.

### 2 — Resolved parents over open children

- **#3321** is `resolved` while children #3379, #3380, #3381, #3382 are all `open`.
- **#3214** is `resolved`, so #3007, #3215, #3216 and #3217 read as unblocked — but the durable store
  they depend on does not exist (`verdictLedgerDir()` is still machine-global). #3255 is the real
  unbuilt blocker; its own `Done when` 5 already owns the retarget.

### 3 — Cards built and shipped without the card ever being ratified

- **#2096** — its three forks are cited as ratified in shipped code (`we:src/spec-pages.njk` cites
  "#2096 Fork 1-a"; `we:src/_data/normativeSpecs.js` says "ratified by #2096"), the pilot spec is
  authored, and child #2097 is `resolved` while still `blockedBy: ["2096"]` — yet #2096 is `open` with
  no ratification block. This needs an operator ratification act, not a silent close.

### 4 — Premises that have inverted

| Card | The card says | Reality |
|---|---|---|
| #1104 | "the site today has **no public deployment**" | live on Cloudflare Workers since 2026-07-02 (`we:worker.js`, `we:wrangler.toml`, `we:.github/workflows/deploy.yml`); #1135 settled both forks |
| #1754 / #1755 / #2401 | "`plateau:packages/dev-browser/src/shell/` does not exist" (marked *verified 2026-08-15*) | shipped in plateau `fe2c210` — `plateau:packages/dev-browser/src/shell/{main,layout,ipc}.ts` + `chrome/` all present |
| #2301 | the "bug, exactly" prose | `we:scripts/guard-lane.mjs:47-56` now reads "AGENT MEMORY IS NOT EXEMPT" and denies primary memory writes; child #2352 resolved |
| #2416 | "documented policy with no code enforcement" | INVARIANT 2 enforced in `we:scripts/review-set-label.mjs:272-280`, `we:scripts/lib/auto-land-seam.mjs`, `we:scripts/workflows/review-parked-prs.mjs` |
| #3009 | "latent, not live — once #1100 lands" | #2844 resolved, `we:scripts/lib/review-independence.mjs` on main; the defect is live now |
| #3185 | "the refusal is NOT live today" | `we:scripts/review-set-label.mjs:587/602/661-662` passes `prCreatedAt`; it is a live refusal |
| #3162 | "no way to ask if an agent is alive/stalled" | `we:skills-src/inspect-agent-health/agent-health.mjs` ships it with tests |
| #3365 | "three unscoped arcs scan the whole repo" | #3372 made `verify-lane`'s default gate auto diff-scoped |
| #2954 | `DEFAULT_CARE` is `low` | it is `elevated` |
| #285 | cleans up `we:demos/maas-consumer-demo.html` | the file does not exist; no demo has an importmap |
| #1294 | webpolicy runtimes are a live placement violation | `we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts` are already deleted |
| #3024 | builds on #3053 | #3053 ruled the *other way*: the delta narrowing is "not authorised to build" — this should be **parked** |
| #2737 | needs #2416/#2502 first | superseded by #3178, already live at `we:scripts/merge-ai-prs.mjs:3931-3949` |

### 5 — Systemic rot classes (worth a guard, not 200 hand-edits)

1. **Line-number citation drift — the single largest class.** Cards cite `file:NNN` anchors that have
   since moved: every `we:docs/agent/platform-decisions.md:NNN` reference in the audited set is off by
   130–520 lines (the file grew to 4138), `we:scripts/lib/review-escalation.mjs` by 100–260, and #3128 alone carries
   six wrong `we:scripts/lib/jury-core.mjs` cites. The prose and the anchors are still correct — only the numbers
   rotted. A `check:standards` rule that resolves `path:line` against the tree would catch all of it.
2. **`scope:` fields broken by file splits.** A six-way split of `we:scripts/__tests__/check-standards-rules.test.mjs`
   silently invalidated the `scope:` of #2906/#2958/#2930/#2934 (and #1770). This one has teeth: the
   dispatcher reads `scope:` to plan lane collisions, so a stale scope mis-plans dispatch.
3. **Stale counts and tallies.** #3276 (433→460 stamped cards), #2255 ("70 files"→63), #2911
   ("last rule is 15"→19; "9 files"→14), #2781/#2783 whose RANK 2 / RANK 3 titles are now inverted
   (recounted: merge-ai-prs 28, review-escalation 13, review-core 8), #2947/#2948 whose whole cost
   model assumes a four-lens panel that is now five (`claim-accuracy` joined via #3314).
4. **`## Done when` that cannot be proven.** The repo's own auditor flags **A1=470** items with no
   provable acceptance criterion; #3360 above is the sharp case — a literal `TODO` where the criterion
   should be. #2949 (now resolved) built the flag; the backlog behind it is untouched.

### 6 — A non-finding worth recording

**Do not strip `blockedBy` edges that point at resolved items.** 76 live items carry one, and several
agents flagged them as stale. They are not:
`we:docs/agent/backlog-workflow.md:241-242` states the convention explicitly — *"Record real
prerequisites even if the blocker is already `resolved` — the lineage is correct and a resolved blocker
leaves the item Tier A"*. The tier logic already handles them. The genuine defect is only when a card's
**prose** still narrates the blocker as open.

## Method limits

- `web-everything` is a **shallow clone** (142 commits), so claims resting on historical SHAs could not
  be checked and were never reported as defects.
- `gh` was unavailable, so no live PR or label state was verified (#3005, #3016, #3392).
- #2383's byte-proof was verified structurally against its executed JVM twin — no dotnet SDK on this host.
- Per-batch detail, card by card with evidence, is in `audits/2026-09-06-open-story-staleness/`.
