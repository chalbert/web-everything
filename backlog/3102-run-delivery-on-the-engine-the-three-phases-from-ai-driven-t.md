---
bornAs: xal4hki
kind: epic
status: open
dateOpened: "2026-08-14"
relatedTo: ["3029", "3099", "2753", "2612", "2606"]
tags: [plateau-loop, delivery, operations, engine, conveyor, roadmap, north-star]
---

# Run delivery on the engine: the three phases from AI-driven to AI-supervised

**The north star, as the operator stated it on 2026-08-14.** The pieces already exist across [#3029],
[#3099] and [#2753]; what was missing was the sequence tying them together and an owner for phase A. This
epic is that sequence. It **files no new implementation work of its own** — every item it names is filed
elsewhere — and it exists so a fresh session can see the order and the critical path in one read.

> Start exercising the operations from AI as soon as possible. When we can **prepare, display, review and
> fix** stories we have reached a great step. The AI session must continue to oversee and capture
> improvements even as the run moves to a mechanical engine. Then fully integrate the conveyor into the
> engine, so the session only **queues and supervises engine failures**. Once the conveyor runs smoothly
> most of the time, delivery runs from AI with only occasional note-harvesting — reducing the token strain
> of delivery.

## Phase A — exercise the operations from AI (prepare · display · review · fix)

**This phase had no owner before this card.** [#3029] owns *declaring* operations; nothing owned *using*
them as the delivery loop. Four verbs, four owners:

| verb | owner | state |
| --- | --- | --- |
| **prepare** | [#3099] + a `prepare-story` slice **not yet filed** | the discipline is written and applied by hand; the operation does not exist |
| **display** | [#3036] — generate the HTTP adapter, wire the console route | WE half landed; the plateau-side route outstanding |
| **review** | [#3072] declare the review loop + [#1220] make `review-pr` aimable | **the weak link — see below** |
| **fix** | the converge editor loop, gated by #2908's editor-enablement | **currently DEAD in production — see below** |

### Review is the weak link, and mechanising it early would be the mistake

On 2026-08-14 every defect that mattered was found by a review **told what to hunt**: the per-item dispatch
lockout ([#3037] round 1), a false all-clear on a third of the board ([#3098] round 1), and four rounds of
population defects on [#3090]. None was found by a green gate.

`review-pr` **cannot be aimed** — `buildPanelMandate` has a `goal` slot and the operation fills it with the
PR title ([#1220]). A mechanical review loop that cannot be told what to look for is a rubber stamp, and
mechanising a rubber stamp removes the only thing that has been catching real defects. **[#1220] before
[#3072]**, not alongside it.

### The `fix` verb is not working today

[#3101] established that `parseEscalationReason` feeds a bogus token to a **strict** gate
(`editorAllowedByReasons`), so **#2908's editor-enablement evaluates `false` on every parked PR carrying a
policy stamp.** A real `size`-only park is editor-allowed only after the fix. So a quarter of this
milestone is non-functional and was not known to be. Phase A cannot be called reached until that is
verified working, not merely merged.

### Phase A's real exit criterion

Not "the four operations exist" — **one real story goes prepare → display → review → fix through the
declared operations, with the review finding something a green gate did not.** Anything less is the
machinery existing rather than working.

## Phase B — the conveyor into the engine (queue + supervise)

**Already owned by [#2753]**, which sequences the remaining items into a DAG and names the critical path:
**#3118, where the conveyor's headless agent-spawning lives** — the one open item that removes
agent-spawning from the session. *(Was #2464; #2464 resolved 2026-08-15 — its literal ask, the
spawn/steer/stop/resume runner, already shipped under #2530, wired only to `plateau-app`'s per-click build
endpoint. The remaining gap, and the open fork deciding it, is #3118.)* Nothing downstream reaches
zero-session without it. [#2612] is the interim main-session operator and is explicitly a bridge, not the
end state.

This card adds one requirement [#2753] does not state:

**Failures must be LEGIBLE before they can be supervised.** Two known cases where they are not:

- a wedged `claude` **hangs the required gate instead of reddening it** — `execFileSync` cannot be
  interrupted by vitest, proven with a 90-second child passing its own 60-second bound ([#3097]);
- the dispatch observer **can never answer `succeeded`** — `claude agents --json` carries no exit status,
  so "gone" collapses *finished cleanly* and *died* ([#3096]).

An engine that hangs does not present as a failure to supervise; it presents as busy. Supervision is only
possible over failures that surface.

## Phase C — delivery from AI, harvest occasionally

The end state: queue, supervise, and harvest notes periodically to keep improving the engine. [#2753]'s
target state is the same line — the session does only what the product UI does.

### The token argument points at a different lever than it appears to

The stated motivation is reducing the token strain of delivery. **Today's evidence says the strain is
review ROUNDS, not the run loop**: [#3090] took four rounds, [#3037] three, [#3091] six. Mechanising the
run does not reduce rounds. **Better preparation does** — which is [#3099]'s whole argument, measured on
items whose card-level omissions caused the rounds.

So for the token goal specifically, [#3099] plausibly returns more than [#2753]. That is not an argument
against Phase B — zero-session is worth having on its own terms — but the plan should not expect Phase C to
deliver the saving if rounds stay where they are. **Worth measuring before committing to it.**

## What "runs smoothly most of the time" needs before it can be claimed

`gate-health` exists to answer exactly this and **cannot yet**: over 500 merged PRs it reports
`bandsTested: 0`, needing ~278 observations per group per band against the 234 that exist ([#3071]'s
measurement). Until a band is testable, "smoothly" is an impression rather than a reading. Either raise the
observable share (currently 47%) or accept that the phase-C exit is judged by eye and say so.

## Done when

- [ ] One real story completes prepare → display → review → fix through the declared operations, and the
      review finds something the gate did not.
- [ ] [#1220] lands before [#3072] — the review loop is aimable before it is mechanised.
- [ ] #2908's editor-enablement is verified working in production, not merely merged.
- [ ] Every failure mode named in Phase B surfaces as a failure rather than as a hang or a silence.
- [ ] The phase-C token claim is either measured or restated as an expectation.

## Watch for

- **This card sequences; it does not own implementation.** If a slice starts being built here rather than
  under [#3029] / [#3099] / [#2753], the sequencing has been confused with the work.
- The AI session keeping oversight **as the run mechanises** is the operator's stated requirement, and it is
  the part most easily lost: each phase moves execution away from the session and must not move the
  improvement loop with it. Harvest stays in the loop by design, not by omission.
