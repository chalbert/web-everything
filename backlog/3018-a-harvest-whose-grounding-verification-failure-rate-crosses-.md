---
bornAs: xmiltwa
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
blockedBy: ["3016"]
relatedTo: ["2978", "3016"]
tags: [conveyor, learnings, governance]
---

# A harvest whose grounding-verification failure rate crosses a threshold raises an alarm

Fork 1 of #2978 admits a note only if its quoted turn verifies against the real transcript. The falsification
proves transcripts exist NOW (4,477 of 4,481 modified within 30 days), not that they are retained. If the
harness prunes them or the user clears them, every note fails verification and routes silently to
`we:backlog/` — memory quietly stops being written and nothing says so. Fail-safe is the right direction; the
silence is not. Alarm when the per-run verification failure rate crosses a threshold.

## Grounded findings

**The verification this card alarms on does not exist in code yet — this card is structurally blocked on
#3016, not just related to it.** Read end to end:

- `we:scripts/conveyor/learnings-drop.mjs:57-65` — the pool-entry schema (`ALLOWED_KEYS`,
  `FIELD_CAPS`) is `kind | summary | area | suggestion` (+ the emitter-stamped `ts`). There is no
  `quotedTurn` / transcript-pointer field. `validateEntry` (lines 103-139) has nothing to verify against a
  transcript — it only checks the allow-list, the `kind` enum, and per-field length caps.
- `we:scripts/conveyor/learnings-harvest.mjs:104-125` (`readPool`) re-validates each line through the same
  `validateEntry` and buckets it into `stats.{received,valid,malformed,rejected}`. No grounding check runs
  anywhere in this file; there is no `verified`/`groundingFailed` counter to alarm on.
- `we:skills-src/harvest-learnings/SKILL.md:66-74` (Step 2, "Grounding") is a **stopgap agent-judgment
  check**, not the scripted transcript-quote verification #2978 Fork 1(a) ratified. Its own prose says why:
  *"the pool carries no transcript and no evidence field, so the harvest cannot re-ask 'quote the turn that
  established this'... it asks the version it can verify: name a concrete in-repo artifact."* That is a
  deliberately different, weaker check than "the harvest confirms the quote is really in that file"
  (`we:docs/agent/platform-decisions.md:3476`, the ratified #2978 rule). Building #3018's alarm against
  *this* filter would be alarming on the wrong signal — it's a sub-agent's judgment call, not a
  script-verifiable pass/fail, so there is no deterministic "failure rate" to compute from it today.
- `we:backlog/3016-shrink-1068-to-the-ruled-design-delete-the-recurrence-admiss.md` is the item that adds
  "the grounding fields (quoted turn + transcript pointer) and the harvest-side verification." It is
  `status: open`, `blockedBy: ["3015"]`, and is itself only a bare capture card (15 lines, no design/
  interfaces/tasks) — not yet prepared.
- `we:backlog/3015-move-the-learnings-secret-scrub-from-the-append-seam-to-the-.md` is `status: active`
  (`dateStarted: "2026-08-14"`) — in progress right now, one step ahead of #3016 in the ordering #3016's own
  card states: *"adding the uncapped quoted-turn field here removes the append-seam scrub's protection, so a
  raw transcript quote must never be able to enter the pool before the publish-seam scrub exists to catch it
  on the way out."*
- Confirmed via `grep -rl "transcript" scripts/ .claude/ docs/` that the only "transcript" hits outside docs
  are unrelated (workflow-run transcripts in `we:scripts/lane-pool.mjs:378-381`,
  `we:scripts/readiness/conveyor-state.mjs:670-686`, `we:scripts/dev/active-progress-watch.mjs:40-44` — a
  delivery-agent stall/activity scan over `~/.claude/projects/<slug>/*.jsonl`, unrelated to the learnings
  pool). No dead code, no half-built verification, nothing to wire against.

**Conclusion: this card is real and not a no-op, but it cannot be built independently of #3016.** There is no
premise failure (the parent risk #2978 named is still live and unaddressed) and no already-resolved
condition — the gap is exactly as described. But "decide a mechanism" for something with no data source yet
would be inventing an interface I have not read, which the prep checklist (item 8 grounding rule) forbids.
The design below is therefore scoped tightly to what #3018 owns (the alarm, not the verification), decided as
far as it can be without guessing #3016's field names, with the guess-avoidance made an explicit first task.

## Decided design

**#3018 owns the alarm layer only; #3016 owns building the grounding fields and the per-entry verification.**
That split is already implied by the two cards' titles and #2978 Fork 1's own text (verification is the
Fork-1(a) mechanism; "a harvest whose verification failure rate crosses a threshold must raise an alarm" is
named as a *successor* item). #3018 does not re-implement transcript-opening or quote-matching.

**Contract #3018 depends on, not invents:** once #3016 lands, some point in the read/verify path (most likely
`readPool`, `we:scripts/conveyor/learnings-harvest.mjs:104-125`, by direct analogy with how it already buckets
`malformed`/`rejected` inline in the same loop) will classify each schema-valid, grounding-eligible entry as
verified or failed. **The exact field/counter names are #3016's to decide and are not guessed here** — Task 1
below is to read #3016's landed diff and bind to whatever it actually produced, not to a name invented now.

**Fork named and decided — does the alarm apply to `poolStatus`/`--status` too, or only a full harvest run?**
Only a full harvest run (`harvest()`/`harvestPool()`). `poolStatus()` (`we:scripts/conveyor/learnings-harvest.mjs:187-193`) is
documented as the *cheap* depth/age read a session close calls every time
(`we:skills-src/closing-session/SKILL.md:181`, `npm run harvest:status`); grounding verification means opening
a transcript file per entry, which is not cheap. Making every close pay that cost to compute a rate nobody
acts on there would misuse the seam `poolStatus` was built to keep cheap. Rejected for that reason.

**Fork named and decided — what counts in the denominator?** Only entries that carry the new grounding
fields at all (i.e., entries emitted post-#3016). Entries pre-dating #3016 (the ~19 KB / 7 files already
sitting in `~/.claude/conveyor/learnings` on this machine, confirmed present, none carrying any grounding
field under the current schema) must be **excluded from the rate**, not counted as failures. Counting a
missing field as a verification failure would fire a false 100%-failure alarm on the very first harvest run
after #3016 ships, purely from the schema migration — exactly the kind of decorative/miscalibrated guard
`we:agent-memory-src/story-preparation-checklist.md` item 9 warns prep to catch before a build, not after.

**The alarm itself — a new pure function, same file, same section as `ageStats`/`harvest`:**

```js
// we:scripts/conveyor/learnings-harvest.mjs
export function groundingAlarm({ verified = 0, failed = 0 } = {}, { threshold = 0.5, minSample = 3 } = {}) {
  const eligible = verified + failed;
  const rate = eligible ? failed / eligible : null;
  const alarm = eligible >= minSample && rate !== null && rate >= threshold;
  return { eligible, rate, alarm };
}
```

**Threshold = 0.5, minSample = 3 — decided, not left open, with the reasoning stated so it can be
second-guessed with evidence later.** The falsification behind #2978 measured near-total transcript survival
(4,477/4,481, ~99.9%) under normal operation, so the *expected* per-run rate once #3016 ships is ~0. A single
grounded-but-genuinely-unfindable note (a typo'd quote, a since-archived session) is normal noise, not a
system failure — a low bar would nag on that noise and get ignored, which is worse than no alarm (the
"decorative guard" failure mode item 9 names). What #2978's own scenario describes — the harness pruning
transcripts, or the user clearing them — drives the rate toward 100%, not a few points above zero. **50% is
the line between "some notes had a rough edge" and "verification is structurally failing this run."**
`minSample = 3` exists only to stop a single early-run fluke (1 failure out of 1 eligible entry = 100%) from
firing on day one; it is not a statistical-confidence bound, just a floor, mirroring the existing
`sessions >= minSessions` floor pattern already in this file (`harvest()`, lines 151-167). Both numbers are
CLI-overridable (see below) rather than hard-coded, so they can be tuned from real post-#3016 data without a
code change — the same escape hatch `--threshold`/`--min-sessions` already give the dedup/recurrence knobs.

**Wiring:**

- `harvest()` (`we:scripts/conveyor/learnings-harvest.mjs:151-167`) adds `grounding: groundingAlarm({ verified, failed })` to its
  returned `stats` (mirrors how `ageStats(entries, { now })` is already spread into the same object at line
  161). `verified`/`failed` are read off whatever #3016's `readPool`/`harvest` stats actually named — Task 1.
- CLI flags, parsed alongside the existing `threshold`/`min-sessions` flags at `main()` lines 302-303:
  `--grounding-threshold=<0..1>` (default 0.5), `--grounding-min-sample=<int>` (default 3). New names on
  purpose — `--threshold` is already the dedup Jaccard knob (`we:scripts/conveyor/learnings-dedup.mjs`'s `DEFAULT_THRESHOLD`) and
  `--min-sessions` is already the recurrence floor; reusing either name for a third, unrelated knob is exactly
  the kind of collision the interfaces discipline exists to catch before a builder hits it.
- Non-JSON CLI output (`main()`, the `else` branch around lines 316-321) prints one extra, unmissable line
  **only when** `result.stats.grounding.alarm` is true, before the existing `harvested ${dir}: ...` summary
  line, e.g.:
  `⚠ GROUNDING ALARM: ${failed}/${eligible} (${Math.round(rate*100)}%) notes this run failed transcript
  verification — see we:skills-src/harvest-learnings/SKILL.md`.
  `--json` needs no separate change: `stats.grounding` rides along in the existing
  `writeLineSync(1, JSON.stringify(result, null, 2))` (line 312).
- `we:skills-src/harvest-learnings/SKILL.md` — Step 1 (after the `npm run harvest -- --json` block, lines
  24-27) gets a line telling the session to read `stats.grounding` and treat `alarm: true` as a **headline
  finding**, escalated through the normal Step-3 lane→PR routing as its own dedicated `we:backlog/` story
  (kind: friction, naming the systemic cause — e.g. "harvest grounding verification failing at scale, check
  transcript retention") — explicitly **not** the same as the ordinary per-note "a note that cannot be tied
  to a real moment routes to `we:backlog/`" path (that path is expected, quiet, and about ONE note; this is
  about the RATE across the whole run). The Report template (lines 135-143) gets one added line:
  `**Grounding health:** <verified>/<eligible> verified (<rate>%) — or "ALARM: ..." when tripped>`.

## Interfaces & protocol

```js
// we:scripts/conveyor/learnings-harvest.mjs — NEW
export function groundingAlarm(
  counts = { verified: 0, failed: 0 },
  opts = { threshold: 0.5, minSample: 3 },
) { /* → { eligible: number, rate: number|null, alarm: boolean } */ }
```

- **Receives:** plain counts, not entries — pure, no I/O, same shape discipline as `ageStats`. Deliberately
  decoupled from #3016's entry/field shape so this function doesn't have to change if #3016's internal
  representation does.
- **Returns:** `{ eligible, rate, alarm }`. `rate: null` and `alarm: false` when `eligible === 0` (no
  grounding-eligible entries this run — the common case until #3016 ships, and still common right after: a
  run that reads only legacy entries).
- **Consumed by:** `harvest()`/`harvestPool()` (folded into `stats`), the CLI `main()` (the warn line +
  `--json` passthrough), `we:skills-src/harvest-learnings/SKILL.md` (Step 1 read + Report line).
- **CLI:** `--grounding-threshold=<float 0..1>` (default 0.5), `--grounding-min-sample=<int>` (default 3),
  parsed the same way as the existing `f.threshold`/`f['min-sessions']` at `main()` lines 302-303.
- **Not touched:** `we:scripts/conveyor/learnings-drop.mjs` (schema/fields are #3016's), `poolStatus()`
  (`we:scripts/conveyor/learnings-harvest.mjs:187-193`, decided out above), `we:scripts/conveyor/learnings-dedup.mjs` (unrelated
  clustering knob).

## Tasks

1. **Confirm #3016 has landed and read its diff** — the exact counter/field names it added to a validated
   entry and to `readPool`'s (or wherever it lands) per-entry classification. Do not guess; do not start
   task 2 until this is grounded in real, landed code.
2. Add `groundingAlarm(counts, opts)` to `we:scripts/conveyor/learnings-harvest.mjs`, next to `ageStats`.
3. Wire it into `harvest()`: `stats.grounding = groundingAlarm({ verified, failed })`, sourcing
   `verified`/`failed` from #3016's landed counters (task 1).
4. Add `--grounding-threshold=`/`--grounding-min-sample=` parsing to `main()`, passed through
   `harvestPool()` → `harvest()` → `groundingAlarm`.
5. Add the `⚠ GROUNDING ALARM` line to the non-JSON branch of `main()`, gated on
   `result.stats.grounding.alarm`.
6. Update `we:skills-src/harvest-learnings/SKILL.md`: Step 1 prose (read `stats.grounding`, treat `alarm:
   true` as a headline finding routed as its own backlog story) and the Report template (`Grounding health`
   line).
7. Tests in `we:scripts/__tests__/learnings-harvest.test.mjs`: unit tests for `groundingAlarm` (below
   `minSample` → `alarm: false, rate` still computed or null per the zero-eligible case; at-threshold →
   `true`; just-under-threshold → `false`; zero eligible → `{eligible:0, rate:null, alarm:false}`), plus one
   `harvest()`/`harvestPool()` integration test asserting `stats.grounding` is present and shaped as decided,
   built on whatever fixture shape #3016's own tests established for a verified/failed entry.
8. `npm run check:standards` (0 errors) and the full `npm test` (vitest), clean.

## Done when

1. `groundingAlarm({verified, failed}, {threshold, minSample})` returns `{eligible, rate, alarm}` with
   `eligible = verified + failed`; `rate = eligible ? failed/eligible : null`; `alarm = eligible >= minSample
   && rate >= threshold`. Unit tests cover all four branches named in Task 7.
2. `harvest()`/`harvestPool()`'s returned `stats` includes a `grounding` object on every call, including a
   pool with zero grounding-eligible entries (`{eligible:0, rate:null, alarm:false}`, never a thrown error or
   `NaN`).
3. `npm run harvest` (non-JSON) prints the `⚠ GROUNDING ALARM: ...` line if and only if
   `stats.grounding.alarm` is true; a clean run (a test fixture below both the sample floor and the
   threshold) prints no such line — asserted as an explicit negative case, not just "the happy path passes."
4. `npm run harvest -- --json` includes `stats.grounding` in its output.
5. `we:skills-src/harvest-learnings/SKILL.md`'s Report template includes a `Grounding health` line, and Step
   1/3 prose directs a true alarm to a dedicated backlog escalation, distinct in wording from the existing
   per-note ungrounded-routing sentence.
6. `npm run check:standards` is 0 errors; the full `vitest` suite is green.

## Delivery shape

**One piece, and it cannot land before #3016 lands** (`blockedBy: ["3016"]`, which is itself `blockedBy:
["3015"]`, currently active). There is no `verified`/`failed` signal to alarm on until #3016 exists, so
there is no meaningful incremental slice of #3018 to ship first — a version of this landed against
placeholder/zero counts would be a no-op that always reports `eligible: 0`, which is exactly the
"provably-no-op design" failure mode item 9 names (#3004/#3095). Not behind a flag: this is an advisory
script/skill change with no product-facing surface to gate.

## Open risk carried forward (not this card's to close)

#3016 verifying "the quote is really in that file" still has to decide HOW it searches a transcript (whole
file vs. a bounded window — `we:scripts/dev/active-progress-watch.mjs:40-68` shows an existing bounded
tail-read pattern used for a *different* transcript scan, at 16 KB, which would be wrong for a grounding quote
that can be anywhere in a long session, not just the tail). That is #3016's design question, not #3018's;
named here only so it doesn't get silently inherited as an assumption by whoever builds this card next.
