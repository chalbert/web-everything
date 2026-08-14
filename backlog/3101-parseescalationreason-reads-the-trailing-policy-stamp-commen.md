---
bornAs: xjxv1si
kind: story
size: 3
status: open
dateOpened: "2026-08-14"
tags: [review, converge-loop, parse-defect]
relatedTo: ["3044", "2908", "2470"]
scope:
  - we:scripts/review-detail.mjs
  - we:scripts/__tests__/review-detail.test.mjs
  - we:scripts/__tests__/fetch-parked.test.mjs
---

# parseEscalationReason reads the trailing policy-stamp comment as a bogus reason, nulling disposition and defeating the #2908 editor gate

`parseEscalationReason` (`we:scripts/review-detail.mjs:37-51`) reads the PR body's `## Escalation reason` block
too permissively: it collects every non-blank line after the marker up to the next `##` heading, with no check
that a collected line is actually a bullet. `buildEscalationReasonBlock` (`we:scripts/lib/review-escalation.mjs:1562-1566`)
always appends a trailing HTML-comment policy stamp right after the bullets whenever `reasons` is non-empty —
unconditionally, not only sometimes — so that stamp line gets read as a bogus extra "reason".

**No parent set.** #3044 (the sibling write-side bug this was found while preparing) carries no `parent:` either
— matched here rather than inventing a hierarchy neither item has.

## Reproduced, on real PR bodies, not just synthetically

```
node -e "
import('./scripts/review-detail.mjs').then(async (rd) => {
  const body = require('fs').readFileSync('/tmp/pr1177body.txt','utf8'); // real gh pr view body, PR #1177
  console.log(rd.parseEscalationReason(body));
});"
```

Real PR #1177's body (`gh pr view 1177 --json body`) carries:

```
## Escalation reason

- blast-radius (scripts/lib/__tests__/jury-core.test.mjs, scripts/lib/judge-spawn.mjs, scripts/lib/jury-core.mjs, …)
- gate-derivation (scripts/lib/review-core.mjs) — gate derivation code, independent committee review

<!-- policy-set: v1 08da26b668de -->
```

`parseEscalationReason(body)` returns **three** elements, not two — the last one is the literal string
`'<!-- policy-set: v1 08da26b668de -->'`. `assembleReviewDetail({view:{body,...}})` (`we:scripts/review-detail.mjs:70-87`)
then calls `deriveReviewDisposition({reasons: escalationReason})` (`we:scripts/lib/review-core.mjs:581-591`), which
`canonicalizeReason`s every entry and **throws `unknown reason(s): <!-- policy-set: v1 08da26b668de -->`** because
the stamp matches no `REVIEW_REASONS` token. The try/catch at `we:scripts/review-detail.mjs:85-86` swallows that
and sets `disposition: null`. Same PR, same real body — confirmed with `node`, not asserted from reading the code.

This matches the earlier report exactly and confirms it: **not overstated.** The report said "every parked PR
that carries a policy stamp" — that's the correct scope, because the stamp is unconditional whenever
`buildEscalationReasonBlock` writes any reasons at all (`we:scripts/lib/review-escalation.mjs:1565`, no branch
that omits it).

## The blast radius is BIGGER than the disposition field — a second, more serious consequence found while grounding this card

Two separate real-code readers consume the corrupted `escalationReason` array, with two different severities:

**1. `disposition: null` reaches a HUMAN today, via `/review`, not only a future console.** #3036 (the HTTP
route wiring `disposition` into the Plateau Loop console) is still open/unbuilt — but the `/review` skill
(`we:skills-src/review/SKILL.md:57-60`) already tells the operator to read `findings.read.disposition` **today**
to tell apart the two shapes of a `review:human` park: a **sensitivity** park (`gate-self`, `{mode:converge,
autoLand:false}` — scrutinize an agent-authored fix already on the branch) vs. a **deadlock** park
(`non-convergence`/`mandate-conflict`, `{mode:human}` — the operator breaks the tie). With `disposition: null`
the operator loses that distinction on every `review:human` PR carrying a policy stamp — i.e. essentially every
one parked since the stamp shipped (#2567). Traced: `assembleReviewDetail` (`we:scripts/review-detail.mjs:80-87`)
→ `we:scripts/operations/review-pr-io.mjs:29,123` (imports and calls it) → `we:scripts/operations/review-pr.mjs:223`
(`disposition: detail.disposition ?? null`) → `renderVerdictWriteUp` (`we:scripts/operations/review-pr.mjs`,
passes `read.disposition` into `renderPanelComment`) → `we:scripts/lib/review-render.mjs:57-64,137-138`
(`renderDisposition` returns `null` for a `null` input, so the whole `**Disposition:**` line is silently
dropped from the durable verdict comment posted on the PR). This is a live, running path
(`node we:scripts/operations/run.mjs review-pr`), not a stub.

**2. The #2908 editor-enablement gate is unconditionally defeated — the graver finding.** `we:scripts/fetch-parked.mjs`
imports the SAME buggy `parseEscalationReason` (`we:scripts/fetch-parked.mjs:43`, called at `:224`) and exposes
the corrupted array verbatim as `escalationReason`. `we:scripts/workflows/review-parked-prs.mjs` (the converge
loop) shells `node we:scripts/fetch-parked.mjs <pr> --json` (`:636`, a subprocess call embedded in a
fetch-subagent prompt, not an ES import) and feeds the result into `careRigorFor` (`:878-919`), which computes
`reasonsAllowEditor = editorAllowedByReasons(escalationReason)` (`:884`, its own local mirror at `:231-241` —
"no import in the sandbox," per the file's own comment) **before** the rigor agent even runs.
`editorAllowedByReasons` (mirrored identically in `we:scripts/lib/review-core.mjs:727-736`, the
exported/tested original) is deliberately STRICT, not lenient: *"a reason token we cannot weigh is a signal we
cannot rule out: it returns `false`"* (`we:scripts/lib/review-core.mjs:719-721`). Reproduced directly against
the real exported function:

```
node -e "
import('./scripts/fetch-parked.mjs').then(async (fp) => {
  const rc = await import('./scripts/lib/review-core.mjs');
  const esc = await import('./scripts/lib/review-escalation.mjs');
  const body = 'A PR description.\n' + esc.buildEscalationReasonBlock(['size (602 >= 400 changed lines)']);
  const parked = fp.assembleParked({ view: { number:1, body, labels:[{name:'review:pending'}], comments:[], files:[] }, diff:'' });
  console.log(parked.escalationReason);
  console.log(rc.editorAllowedByReasons(parked.escalationReason));           // buggy input
  console.log(rc.editorAllowedByReasons(['size (602 >= 400 changed lines)'])); // correct input, no stamp
});"
```

Output: `escalationReason` is `["size (602 >= 400 changed lines)", "<!-- policy-set: v1 08da26b668de -->"]`;
`editorAllowedByReasons` on it is **`false`**; the same call on the correct (stamp-stripped) array is **`true`**.
`['size']` alone is exactly the editor-ON case #2908 (`we:docs/agent/platform-decisions.md:3434`, ratified by
the operator) was built for. Since the stamp is unconditional, **the converge loop's editor can never be
enabled today, for any parked PR, regardless of how low-risk its real reasons are** — #2908's entire "editor
may push on a `size`-only or `cross-repo`-only park" capability is silently dead. This is a capability
regression, not a safety one: `editorAllowedByReasons` fails CLOSED (an unweighable token forces review-only,
never grants), so no PR gets machine-pushed that shouldn't; the cost is wasted human/agent review-only cycles
on PRs that should self-converge, not an unsafe auto-land.

**Corrects the earlier footnote.** PR #1226 (preparing #3044) footnoted this same parser bug but claimed *"the
converge loop itself is unaffected — it goes through the LENIENT bridge (`we:scripts/lib/review-core.mjs:598`,
`careLevelFromReasons`, 'an unrecognized reason contributes nothing')."* That bridge is real and is lenient,
but it is not the function that gates the editor. `editorAllowedByReasons` is a **different, deliberately
STRICTER** function (`we:scripts/lib/review-core.mjs:719-721` states the contrast explicitly), and it is what
`careRigorFor` actually calls. The converge loop's editor-enablement IS affected — more so than the disposition
field, because it silently defeats a ratified capability on every single park rather than only dropping a
display line.

## Current live count vs. historical rate

**Zero PRs are open and parked right now** (`gh pr list --state open --label review:pending` and `--label
review:human` both return empty at time of writing — the queue is clear). So today's *currently-parked* count
is 0; the defect is otherwise dormant until the next park. Historically: GitHub's full-text search
(approximate, not exact-grep) finds 407 PRs in this repo whose body matches `"## Escalation reason"` and 36
whose body matches `"policy-set"` — i.e. roughly 36 historical PRs carried the block-plus-stamp shape this bug
corrupts (the stamp shipped later than the block marker itself, #2567, so older parks predate it and are
unaffected). Confirmed on two of those directly: real PRs #1177 and #1176 both reproduce the bug as shown above.

## Test-suite grounding: why this shipped unnoticed

Neither existing test file ever builds its fixture body with the real writer, `buildEscalationReasonBlock` —
both hand-write a body that terminates the block with a `## Something else` heading instead of the stamp:
`we:scripts/__tests__/review-detail.test.mjs`'s `parkedHumanView` fixture (body ends `...size (612 ≥ 400
changed lines)\n\n## Something else\n\ntrailing content...`) and `we:scripts/__tests__/fetch-parked.test.mjs`'s
`bodyWith` helper (`:322`, `` `Some PR body.\n\n## Escalation reason\n\n${block}\n\n## Something else\n\n- not a
reason\n` ``). Both shapes already terminate correctly today (next-heading case) — neither exercises the real,
common shape `buildEscalationReasonBlock` actually produces (block, then end-of-body, no heading after the
stamp).

## The decided design (not a menu)

**Fix the loop's stop condition to match the block's real grammar, not to string-match the stamp.**
`buildEscalationReasonBlock` (`we:scripts/lib/review-escalation.mjs:1562-1566`) guarantees the block's body is
*bullets only* (`list.map((r) => `- ${r}`).join('\n')`) between the marker and whatever follows. So
`parseEscalationReason`'s loop should stop collecting at the first line that is neither blank, a `##` heading,
**nor a bullet** (`/^[-*]\s+/`) — not only at the next heading as it does today (`we:scripts/review-detail.mjs:45`).

Considered and rejected: hardcoding a stop on the literal policy-stamp shape (`import POLICY_STAMP_MARKER` from
`we:scripts/lib/review-escalation.mjs` and break on a matching line). Rejected because it only patches the ONE
known trailing shape and re-couples the reader to the writer's exact marker text; the grammar-based fix (stop
on "non-bullet, non-heading, non-blank") is strictly more general — it also protects against any *other*
future trailing content someone appends after the stamp (a second marker, a manifest link) without needing a
matching edit here every time `we:scripts/lib/review-escalation.mjs` grows a new marker. No signature change:
`parseEscalationReason(body): string[]` stays exactly as every caller (`we:scripts/fetch-parked.mjs`,
`we:scripts/review-detail.mjs`'s own CLI, both test files) already expects it.

## Interface and protocol

- **Signature, unchanged:** `parseEscalationReason(body: string|null|undefined): string[]` (`we:scripts/review-detail.mjs:37`).
- **Markers, quoted from source:** `ESCALATION_REASON_MARKER = '## Escalation reason'` (`we:scripts/lib/review-escalation.mjs:1511`);
  `POLICY_STAMP_MARKER = 'policy-set'`, stamp shape `` `<!-- ${POLICY_STAMP_MARKER}: v${version} ${digest} -->` ``
  (`we:scripts/lib/review-escalation.mjs:1524-1526`). Full block shape, from the one writer both drain call
  sites use: `` `\n\n${ESCALATION_REASON_MARKER}\n\n${list.map((r) => `- ${r}`).join('\n')}\n\n${buildPolicyStampMarker()}\n` ``
  (`we:scripts/lib/review-escalation.mjs:1565`).
- **Today's (buggy) stop condition:** breaks only on `line.trimStart().startsWith('##')` (`we:scripts/review-detail.mjs:45`);
  every other non-blank line — bullet or not — is pushed (`trimmed.replace(/^[-*]\s+/, '')` is a no-op on a
  non-bullet line, so the raw line, e.g. the HTML comment, becomes an array element verbatim).
- **New stop condition:** break on `##` heading (unchanged) **or** on a non-blank line that does not match
  `/^[-*]\s+/` (new). Blank lines keep being skipped, not treated as terminators (the block's own writer emits
  one before the stamp).

## Done when

- [ ] `parseEscalationReason(body)` on a real `buildEscalationReasonBlock(['size (602 ≥ 400 changed lines)'])`-built
      body returns exactly `['size (602 ≥ 400 changed lines)']` — length 1, no `<!-- policy-set` element.
- [ ] The same holds for the two-reason PR #1177 shape (`blast-radius (…)`, `gate-derivation (…)` + trailing
      stamp): `parseEscalationReason` returns exactly those two strings, nothing else.
- [ ] `assembleReviewDetail` on that `size`-only stamped body returns `disposition: {mode:'converge',
      autoLand:true}` — not `null` — observable via `we:scripts/review-detail.mjs`'s own CLI output
      (`disposition: converge (autoLand=true)` line, `we:scripts/review-detail.mjs:165`) or the exported
      function directly.
- [ ] `we:scripts/lib/review-core.mjs`'s exported `editorAllowedByReasons` returns `true` when fed
      `we:scripts/fetch-parked.mjs`'s `assembleParked(...).escalationReason` for that same `size`-only stamped
      body (today: `false`) — the concrete #2908 regression proof.
- [ ] A body whose block terminates at a `## Something else` heading (the existing fixtures' shape, no stamp)
      still parses unchanged — no regression on the already-covered case.
- [ ] A legacy body with the reason block but NO trailing stamp (pre-#2567 shape) still parses unchanged.
- [ ] `npm run test:unit` and `npm run check:standards` both green/0-errors.

## Scope

**Edited:**
- `we:scripts/review-detail.mjs` — the fix, `parseEscalationReason`'s stop condition (`:37-51`).
- `we:scripts/__tests__/review-detail.test.mjs` — new fixtures built with the real
  `buildEscalationReasonBlock`/`buildPolicyStampMarker`: stamped single-reason, stamped multi-reason (the real
  PR #1177 shape), the existing no-stamp/next-heading case kept as a regression control, plus an
  `assembleReviewDetail`-level assertion that `disposition` resolves instead of nulling.
- `we:scripts/__tests__/fetch-parked.test.mjs` — extend the `escalationReason` describe block (`:320-…`) with a
  stamped fixture and an assertion that `editorAllowedByReasons` (imported from `we:scripts/lib/review-core.mjs`)
  flips to `true` on the corrected output — the #2908 proof, in the test suite that already owns this
  contract.

**Found by ES import, excluded (become correct automatically, no edit needed):**
- `we:scripts/fetch-parked.mjs` (`:43,224`) — imports and re-exports `parseEscalationReason`'s output verbatim;
  it never re-implements the parse, so it is a beneficiary, not a consumer needing its own fix.
- `we:scripts/operations/review-pr-io.mjs` (`:29,123`) — imports `assembleReviewDetail`, does not touch
  `disposition`'s derivation.
- `we:scripts/operations/review-pr.mjs`, `we:scripts/lib/review-render.mjs` — read `.disposition` for display
  only; correct once the upstream parse is correct.

**Found by subprocess/prompt call, excluded (become correct automatically):**
- `we:scripts/workflows/review-parked-prs.mjs` (`:636` shells `we:scripts/fetch-parked.mjs`; `:210-241` local
  `editorAllowedByReasons`/`canonicalReasonToken` mirror, "no import in the sandbox") — consumes the JSON
  contract across a subprocess boundary; its own logic is unchanged and already correct, it is just fed a
  corrupted array today. Not edited here — same reasoning #3044's card gives for excluding this same file.
- `we:skills-src/review/SKILL.md` (`:57-60`, instructs the operator to read `findings.read.disposition`) —
  prose, not code; nothing to edit, it becomes trustworthy once the field is.

**Not in scope:** #3044's write-side staleness bug (a different bug class — the block goes stale on re-park,
independent of whether this reader parses it correctly) and PR #1226's other footnoted finding
(`we:scripts/pr-body-edit.mjs`'s wholesale-replace dropping the block) — both already tracked on #3044, neither
blocks nor is blocked by this item.

## Delivery shape

One piece. The fix is a single boundary-condition change inside one existing function; there is no safe partial
slice (a half-applied stop condition is just a different wrong parse).

## Tasks

1. Add failing fixtures first (RED) to `we:scripts/__tests__/review-detail.test.mjs` and
   `we:scripts/__tests__/fetch-parked.test.mjs`, built via `buildEscalationReasonBlock`/`buildPolicyStampMarker`
   rather than hand-typed bodies, proving today's bug (extra array element / `disposition: null` /
   `editorAllowedByReasons` false).
2. Fix `parseEscalationReason`'s stop condition in `we:scripts/review-detail.mjs` per the decided design.
3. Confirm the new fixtures go GREEN; add the no-stamp-legacy and next-heading-control fixtures as regression
   guards (must stay GREEN, unchanged behavior).
4. Add the `editorAllowedByReasons` proof to `we:scripts/__tests__/fetch-parked.test.mjs`, importing the real
   exported function from `we:scripts/lib/review-core.mjs` (not a re-derived copy).
5. `npm run test:unit` and `npm run check:standards`; fix any incidental fallout.
