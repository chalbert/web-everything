---
bornAs: xmn1we6
kind: decision
parent: "3383"
status: open
scope: ["we:backlog/"]
dateOpened: "2026-09-14"
relatedTo: ["3621", "3654", "3673", "3611"]
tags: [codex, review, container, isolation, tool-parity, calibration]
---

# Give Codex's review seat container-scoped write access to a full lane checkout

Give Codex's advisory-review seat (and potentially other providers' review seats) container-scoped write access to a full, real lane checkout — not bare-host write access, not a scratch-subset copy. Grounded in three findings from tonight: Codex's seat is read-only while Claude's juror has write tools and mutation-verifies; a bounded scratch experiment showed write-mode confirmed more bugs, including one read-only missed entirely; we:backlog/3621's live 2026-09-14 test proved a container fully contains a provider's writes, including a planted git-hook escape attempt. The operator's reframe: the experiment's scratch-copy limit was a diagnostic safety precaution, not a fundamental constraint.

## Why, with evidence, in order

1. **A real diagnostic tonight found Codex's review seat is read-only by policy, while Claude's equivalent
   juror has write tools and routinely does mutation verification** (write a scratch repro, break it,
   confirm a test reddens). This tooling asymmetry was suspected as the real cause of an apparent "Codex
   misses bugs" pattern. See [#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/)
   (the calibration-veto remediation question — its own live incident, PR #2107, records Codex correctly
   *identifying* a bug but rating it non-blocking where Claude's juror rated the same bug a blocker) and the
   `agent-capability-parity-principle` agent-memory note (`we:agent-memory-src/agent-capability-parity-principle.md`,
   PR #2212, open — not yet merged to `main` as of this filing): default toward equal tool/capability parity
   across agent types rather than leaving an unexamined asymmetric constraint in place, with this exact
   Codex read-only-seat case as its motivating example.

2. **A bounded, isolated experiment tonight tested this directly**: reran 5 historical PRs through Codex
   twice, once read-only and once with write access to a scratch copy (a session-local temp dir, no
   production writes, real production code path). Result: 9/10 read-only findings explicitly couldn't
   mutation-verify; 7/9 write-mode findings explicitly ran a real scratch test to confirm a bug. Write mode
   found a genuinely new bug on PR #1924 that read-only missed entirely. Experiment artifact location
   (session-local, ephemeral — not committed, not expected to still exist):
   `scratchpad/codex-parity-experiment/`.

3. **Separately, real live testing tonight proved an Apple container fully contains a provider's writes**
   — an amendment already landed on [#3621](/backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl/)
   ("LIVE test: a container DOES fully contain Antigravity's write tools, git-hook write-escape ruled out,
   and the auth gap is confirmed real," 2026-09-14): every write attempted outside the single declared mount
   — including a planted `.git/hooks/post-commit` hook engineered to write outside the mount, fired via a
   real `git commit` inside the container — either failed outright or landed only in the guest's own
   ephemeral disk, never reaching the real host. The same item's earlier 2026-09-14 amendments (the
   `we:scripts/lib/container-exec.mjs` heavy-command-pool POC, landed via PR #2211/#2206) separately proved
   `check:standards` and `test:unit` (the latter needing a real linux-built `node_modules` plus a
   sibling-checkout mount for `@frontierui/plugs`) both run inside a container with identical results to the
   host — a real heavy command with full real dependencies, not a toy case.

4. **The operator's own framing, just now: the experiment's "repo context" limitation (a scratch copy
   missing sibling imports) wasn't a fundamental constraint — it was a safety precaution for the diagnostic
   itself**, avoiding real write access to a real checkout. In production, the right fix is giving Codex real
   write access to the REAL, FULL lane checkout, made safe by running it inside a container (the same
   containment already proven for Antigravity, above) rather than on bare host. This closes both the
   tool-parity gap (finding 1) and the repo-context gap (finding 2) at once, using infrastructure already
   proven feasible tonight (finding 3).

## Explicitly NOT decided by this filing

Left as open forks for the eventual `/prepare` pass:

- Whether this should wait for the heavy-command capacity-reservation/resource-aware-admission work
  ([#3611](/backlog/3611-hardware-usage-aware-heavy-command-capacity-control-a-staged/) and its
  [#3610](/backlog/3610-how-far-to-take-heavy-command-admission-control-beyond-stage/) fork) to land first,
  since running review-seat containers safely at scale needs that capacity model.
- Exactly what "container-scoped write access" should look like for a review seat specifically (full lane
  mount vs. some narrower scope).
- Whether this applies only to Codex or should generalize to Antigravity/future providers' review seats too.
- How this interacts with the still-unresolved [#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/)
  (what clears a calibration veto) — this proposal might be a PRECONDITION for generating trustworthy
  calibration data, not just an unrelated capability upgrade.

Also not decided: whether/when [#3654](/backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob/)'s
graduation bar (probation → trusted) should account for write-mode-verified trials differently than
read-only ones, given finding 1 above.

No `preparedDate` is set — this is an open decision awaiting a full `/prepare` pass (fork authoring,
prior-art survey, a recommended default per fork), not a ready-to-ratify item, per this repo's "never take
an unprepared decision" doctrine.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show <this item>` reports `status: resolved` with
   `codifiedIn:` set, and the ruling states whether/how container-scoped write access is granted to Codex's
   (and potentially other providers') review seat, and under what scope.
2. **Grounded** — the ruling explicitly addresses all four open forks above, including the interaction with
   [#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/) and the sequencing
   question against [#3611](/backlog/3611-hardware-usage-aware-heavy-command-capacity-control-a-staged/).
3. **Not decided here, by design** — this card only records the proposal and its evidence; a full fork
   breakdown with a recommended default is authored by `/prepare` before ratification.
