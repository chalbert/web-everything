---
bornAs: xhwesfo
kind: story
size: 5
parent: "2610"
status: open
scope: ["we:scripts/conveyor/", "we:scripts/lib/", "plateau:src/backlog-view/"]
dateOpened: "2026-07-28"
tags: []
---

# Opt-in feedback capture: tenant-ready schema + scrub gate + verbatim preview

The foundation slice of the multi-tenant feedback channel: a client-side suggestion capture over a minimal-by-construction, tenant-ready schema (generalized lessons only, no code/diffs/secrets/paths), the deterministic scrub gate at the SEND seam that denies on hit (the learnings-drop validateEntry/scrubReasons throw precedent, we:scripts/conveyor/learnings-drop.mjs, likely factored into we:scripts/lib/ so a product send-seam and the CLI share one tested core), and the opt-in verbatim payload preview. Defines the schema the review and routing slices read.

## Design

**The single-tenant precedent, read at the code rather than paraphrased.** `we:scripts/conveyor/learnings-drop.mjs`
is the drop-box appender. Its boundary is three exported constants plus one pure validator:

- `KINDS = ['friction', 'missing-convention', 'doc-gap', 'skill-gap', 'improvement']`
- `ALLOWED_KEYS = ['kind', 'summary', 'area', 'suggestion']`
- `FIELD_CAPS = { summary: 240, area: 60, suggestion: 400 }`
- `validateEntry(entry) → { ok, errors, clean }` — deterministic, no fs/clock. It (1) rejects any key outside
  the allow-list (`ts` tolerated as envelope, then stripped), (2) requires `kind ∈ KINDS`, (3) requires each
  text field non-empty and within its cap, and returns a normalized `clean` record including `normalizeTs(ts)`.
  `appendEntry` calls it and refuses on `ok:false`.

**The scrub is ALREADY factored out — the item's "likely factored into `we:scripts/lib/`" is done.**
`we:scripts/lib/secret-scrub.mjs` exports the whole detector surface: `SECRET_PATTERNS`, `PATH_PATTERNS`,
`CODE_PATTERNS`, `PII_PATTERNS`, `CRED_LABEL`, `CODE_EXT`, `DOC_EXT`, `REPO_NAMES`, `shannonEntropy`,
`isHighEntropyToken`, **`scrubReasons(value)`**, **`scrubPublish(value)`** and `isOpaquePublishToken`.
`we:scripts/conveyor/learnings-drop.mjs` re-exports them. So this slice **consumes** that module; it must not fork a second scrubber.

**The one thing that changed under this item's feet, and it matters.** #3015 (ratified as #2978 Fork 3) **moved
the content scrub off the append seam onto the publish seam** — `validateEntry` no longer calls `scrubReasons`,
and the file header says so explicitly. Single-tenant, the pool is untracked machine-local state, so storing the
raw context is safe and the scrub belongs where output is committed. **Multi-tenant that reasoning inverts:**
#2610's hard requirement 2 puts a deny-on-hit gate at the **SEND** seam, because sending *is* the publish. So
this slice's gate is applied at send, **not** a restoration of the append-time gate #3015 deliberately removed.
A reader coming from `we:scripts/conveyor/learnings-drop.mjs` will otherwise read that removal as precedent
against this gate.

**And the choice between the two detectors is already forced — do not leave it open.** `scrubPublish` is the
strictly NARROWER matcher; its file header enumerates what it deliberately does **not** catch, and the list
includes exactly the three classes #2610's requirement 1 names: `CODE_PATTERNS` / `CODE_EXT` / `DOC_EXT`,
`REPO_NAMES`, and absolute filesystem paths — all "ratified out in #3015" *because the destination there is
this repo's own corpus*, where citing a `we:` path is required by #883. A multi-tenant send seam has the
opposite destination. So the send gate is **`scrubReasons`** (the append-seam detector set), not `scrubPublish`.

**But `scrubReasons` is calibrated on the wrong population, and that is the real risk to measure.** Its own
header calls it "deliberately trigger-happy", tuned against 3,319 committed `we:backlog/*.md` files —
engineer-authored generalized-lesson prose — where its path rules already fire on **1,077 of 3,319** files,
every sampled hit legitimate. Applying that unmodified, deny-on-hit, to free-form **end-user** feedback text is
a population swap: a user writing "the button on the settings page did nothing" is not the corpus it was
measured against, and a deny that fires on ordinary feedback trains users to route around the channel — the
same failure the header names ("noise that trains authors to route around the gate"). No end-user corpus exists
pre-launch, so the honest move is either (i) build a small synthetic/pilot corpus and measure the false-positive
rate before wiring deny-on-hit, or (ii) ship a **narrowed** send-seam profile and record what was dropped and
why. Picking the append-seam profile unmeasured is the thing to avoid.

**What "tenant-ready" has to add to the four fields.** The single-tenant record has no tenant axis at all.
Minimal-by-construction (requirement 1) means the tenant discriminator is an **opaque, server-assigned id** —
never a repo name, path, org string or anything user-typed — and it lives in the *envelope*, outside
`ALLOWED_KEYS`, so the content allow-list stays exactly as narrow as it is today. `REPO_NAMES` in
`we:scripts/lib/secret-scrub.mjs` already exists precisely to catch a repo-identifying string leaking into
content; that check must run on the send path.

**Repo split.** The shared, testable core belongs in `we:scripts/lib/` (a send-seam gate the CLI and a product
send path both import — the item's own framing). The client-side capture UI and the verbatim preview land in
`plateau:src/backlog-view/` per this item's `scope`, and cannot be verified from this repo — every criterion
below is deliberately scoped to the `we:` half.

## Done when

- `npx vitest run learnings-drop` fails before and passes after on a new **send-seam gate** in
  `we:scripts/lib/`: an entry carrying a secret / high-entropy token / absolute path / code fragment /
  repo-identifying string is **denied** (deny-on-hit, with the reason enumerated), and a clean generalized
  lesson passes. One case per pattern family in `we:scripts/lib/secret-scrub.mjs`, so a family that stops
  firing turns the suite red.
- The gate is a **consumer**, not a fork, and that is proven by behaviour rather than by a name grep: a test
  stubs/spies `we:scripts/lib/secret-scrub.mjs` and asserts the send gate's verdict changes with it — a forked
  inline detector (however its symbols are named) fails that test, where a `grep -c "shannonEntropy"` check
  would not.
- The false-positive rate is **measured, not assumed**: the build states the deny rate of the chosen profile
  over a named end-user-style corpus (synthetic or pilot), alongside the 1,077/3,319 figure the append-seam
  profile already carries on backlog prose. A gate whose false-positive rate on its real population is unknown
  is not ready to deny.
- The tenant-ready schema is asserted, not described: a test proves `ALLOWED_KEYS` for the *content* record is
  still exactly `['kind', 'summary', 'area', 'suggestion']` (no tenant field smuggled into content), and that
  the tenant discriminator is carried in the envelope and is opaque — rejecting a value that matches
  `REPO_NAMES` or `PATH_PATTERNS`.
- `npm run check:standards` stays green and `we:scripts/conveyor/learnings-drop.mjs`'s append seam is
  **unchanged** — this slice adds a send gate; it does not re-add the append-time scrub #3015 removed. Assert
  via the existing `we:scripts/__tests__/learnings-drop.test.mjs` still passing untouched.
- The cross-repo seam has a **contract test**, not just a described relationship: the `we:` module exports a
  documented send-gate signature, and a fixture round-trips a payload through it asserting the exact
  `{ ok, reasons }` shape the `plateau:` send path consumes. Without it, the two halves drift and neither
  repo's suite notices.
- The `plateau:` half (capture UI + verbatim payload preview) is out of scope for these criteria and is proven
  in that repo — stated here so the item is not closed on the `we:` half alone.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — All quoted facts (KINDS/ALLOWED_KEYS/FIELD_CAPS in we:scripts/conveyor/learnings-drop.mjs, we:scripts/lib/secret-scrub.mjs's full export list, and #3015's removal of the scrub call from validateEntry) verify true against the live repo — the card read the code rather than paraphrasing it, as it claims.
- **blast-radius** (NOT addressed; strategy: measure against the real corpus before wiring) — The proposed send-seam gate reuses we:scripts/lib/secret-scrub.mjs's append-seam detector set, whose own header states isHighEntropyToken and its siblings are 'deliberately trigger-happy' and were measured only against the 3,319-file backlog/*.md corpus (engineer-authored generalized-lesson prose). The card never measures or names the false-positive cost of applying that same detector, unmodified, to free-form end-user product feedback text at a deny-on-hit seam — no such corpus exists pre-launch, and the card doesn't flag that as a known, accepted gap either.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The calibration behind scrubReasons/isHighEntropyToken is a statistic measured over one population (the committed backlog/*.md corpus) and the card reapplies it unmodified to drive a decision (deny-on-hit) over a different population (multi-tenant end-user feedback text) without naming the mismatch.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — ES-import grep confirms we:scripts/conveyor/close-session-sweep.mjs and we:scripts/conveyor/learnings-harvest.mjs both import validateEntry from we:scripts/conveyor/learnings-drop.mjs, and subprocess/CLI callers exist too (the `/note`, `/close-session` and `/harvest` commands invoke the CLI). The card's 'append seam is unchanged... asserted via the existing we:scripts/__tests__/learnings-drop.test.mjs' requirement protects both consumer classes.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The shared gate lives in we:scripts/lib/ and must be consumed by a plateau:src/backlog-view/ send path in a separate repo (confirmed present at /workspace/plateau-app/src/backlog-view/, a large existing console surface, not a feedback-specific directory). The card names this consumer relationship but supplies no round-trip/contract test at that seam, and doesn't cite plateau-app's own existing cross-repo consumption pattern (the weRoot/@webeverything/* aliasing and CLI-script exec already wired in plateau-app/vite.config.mts) that would ground how a 'product send path... import[s]' the we: module.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The Done-when 'cheap check' (grep -c "SECRET_PATTERNS|shannonEntropy" over the new file returns 0) meant to prove the new module isn't a forked scrubber is a bare symbol-name grep, defeated by trivially renaming an inlined entropy/pattern re-implementation; it's paired with an import-list check which helps but doesn't close the gap. No code exists yet to mutate-probe; there is currently no test of any kind that would catch this class of fork.

**Corrections applied by this review:**

- The Design section frames "the gate is scrubPublish/scrubReasons applied at send" as an open choice to be made "in the build," but the Done-when criteria (deny on absolute path / code fragment / repo-identifying string) already force the answer to scrubReasons — scrubPublish's own header in we:scripts/lib/secret-scrub.mjs states it deliberately excludes CODE_PATTERNS, PATH_PATTERNS and REPO_NAMES; the card should say this outright rather than leaving it as a build-time decision.

The card's factual claims about we:scripts/conveyor/learnings-drop.mjs and we:scripts/lib/secret-scrub.mjs all verify true against the live repo, and its Done-when criteria correctly protect existing consumers of the append seam, but it reuses a detector its own target module documents as "deliberately trigger-happy" against an unmeasured, different population (end-user product feedback vs. internal backlog prose) and leaves the cross-repo we:/plateau: seam without a contract test.

**Findings applied after this review** (all four accepted): the detector choice is no longer left open — `scrubPublish`'s header rules out the three classes #2610 requires, so the send gate is `scrubReasons`; the population mismatch (an append-seam detector calibrated on 3,319 backlog files, applied to end-user text) is now named with a measurement step before deny-on-hit; the fork check is behavioural rather than a symbol grep; and the cross-repo seam gains a contract test.

_Recorded through the declared `review-prep` operation._
