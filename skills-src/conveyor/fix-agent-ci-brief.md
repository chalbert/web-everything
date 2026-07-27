# Conveyor CI-heal fix-agent brief (template) — rebase + repair a green-at-open PR gone RED / BEHIND, NEVER touch the review gate (#2666)

> **This is a TEMPLATE, not a runnable skill.** The `/conveyor` skill (#2613) instantiates it when a
> conveyor-launched PR that was **green at open** later goes **red on a required check** or **BEHIND + parked** —
> a CI regression, NOT a `review:changes` bounce. It fills the `{{PLACEHOLDERS}}` below and passes the result as
> the prompt for **one background CI-heal agent** spawned into that PR's lane. One agent = one red/BEHIND PR = one
> rebase + repair = one re-push. The agent does the JUDGMENT work (diagnose the failing check, repair it); every
> script-decidable step around it is a script it shells, per
> [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
> (#2607).

> **Why this exists.** The conveyor's merge watcher (`pr-watch.mjs`) resolves a launched PR only on a TERMINAL
> signal (merged / parked / closed / timeout) and only auto-repairs a `review:changes` bounce (#2630). A PR that
> was **green at pr-land** but later goes **red on a required check** — most often because `main` advanced under it
> and its `test` job broke against the new main (a flake is the other cause) — silently stalls: the delivery agent
> has long exited (one agent = one item = one PR), and the drain **skips a red-CI PR**. #2183 rebuilds a BEHIND but
> **landable** PR, but a PR **parked** `review:human` / `review:pending` is NOT landable, so #2183 never fires for
> it. This brief is the **auto CI-heal** path: reconstitute the PR's lane, rebase onto current `main`, repair the
> failing check, re-push — **repairing ONLY CI, never the review label**. This is the CI-axis sibling of
> [`fix-agent-brief.md`](fix-agent-brief.md) (the `review:changes` repair loop); the two share the reuse-the-ref,
> repair-only, re-push shape — the ONE difference is that the review-changes agent RE-ARMS the review and this one
> **must not go near it**.

## Fill these before spawning

| Placeholder | What the conveyor fills it with |
|---|---|
| `{{ITEM_NUM}}` | the backlog item number the PR delivers — e.g. `2638` |
| `{{PR_NUM}}` | the red/BEHIND PR's number — e.g. `743` |
| `{{LANE_REF}}` | the PR's head ref — `lane/{{ITEM_NUM}}-<slug>` (`gh pr view {{PR_NUM}} --json headRefName`) |
| `{{LANE}}` | a FREE lane id the conveyor assigned this heal (a fresh clone; the heal is reconstituted from `{{LANE_REF}}`, not the original lease) |
| `{{SESSION_SLUG}}` | a stable per-heal session slug, e.g. `ci-heal-{{ITEM_NUM}}` (ties `acquire`↔`release`) |
| `{{SCOPE}}` | the item's `scope:` frontmatter, repo-qualified & comma-joined (same as the build's scope) |
| `{{REASON}}` | why it fired — `red-ci` (a required check went red) or `behind` (BEHIND + parked) — for the durable comment |

> **`{{LIKE_THIS}}`** are **conveyor-injected** (the table above). **`<like-this>`** are **agent-runtime values**
> you produce as you work (the `<msgfile>` you write). Do not expect the conveyor to fill a `<...>`; that's your
> job at the moment it's used.

---

## Your job (one sentence)

Reconstitute the PR's work in a lane clone reset to its pushed ref, **rebase onto current `main`**, **diagnose and
repair the failing required check** (repair only the CI break — do NOT touch the item's substance beyond what the
check needs), get the gate green, **re-push HEAD to the same `lane/*` ref**, **post the durable CI-heal comment**,
then **EXIT WITHOUT MERGING** — and **NEVER touch the review label** (`review:human` / `review:pending` /
`review:changes` stay exactly as they were; only CI is repaired).

## The arc — one command per transition

### 1. Reconstitute the PR's work in a lane clone (reuse the ref — never rebuild from scratch)

The work is intact on the `{{LANE_REF}}` ref (the pushed PR head). Acquire a free lane reset **to that ref**, so
your clone opens at the exact HEAD that was pushed:

```bash
export LANE_SESSION={{SESSION_SLUG}}
LANE=$(node scripts/lane-pool.mjs acquire --lane={{LANE}} --purpose=conveyor-ci-heal \
  --session={{SESSION_SLUG}} --scope={{SCOPE}} --base={{LANE_REF}}) && cd "$LANE"
```

- `--base={{LANE_REF}}` lands the clone on the pushed lane tip, so you **reuse the built work** — you are healing a
  diff's CI, not redoing the item. If `--base` fails to resolve (the ref was deleted / the PR was force-closed),
  stop and report `#{{ITEM_NUM}} → ci-heal not-applicable (lane ref gone)`.
- Do **NOT** re-`claim` the item — it is already `active` (or `resolved`) from the build; a re-claim would race.

### 2. Rebase onto current `main` (the usual root cause — `main` advanced under the branch)

```bash
git fetch origin main
git rebase origin/main
```

Resolve any conflict the `/finish` way: **regenerate derived / generated artifacts** rather than hand-merging them,
and **take-main for coordination JSON** (`claims.json`, registries). If it is a genuine same-line CODE overlap you
cannot safely resolve, stop and report `#{{ITEM_NUM}} → ci-heal escalated (conflict with main)` — leave the PR as
it is (do NOT force-push a bad rebase). A clean rebase alone often fixes a BEHIND `test` failure.

### 3. Diagnose + repair the failing required check (repair ONLY the CI break)

Read what actually failed, then make the **smallest** change that turns it green:

```bash
gh pr checks {{PR_NUM}} --repo <owner/name>          # which required check is red
gh run view <run-id> --log-failed --repo <owner/name> # the failing step's log (optional, for a non-obvious break)
```

- If a clean rebase already fixes it (the failure was purely BEHIND against the new main), no code change is
  needed — proceed to the gate.
- If a real break remains (a flake, or a genuine interaction with what landed on `main`), repair **only** that, in
  `$LANE`, on the lane's **current branch** (its local `main` — do **NOT** `git checkout -b`; the single-branch
  hook blocks branch creation even in a lane clone). Keep scope within `{{SCOPE}}`. **Do NOT weaken or delete a
  test to go green**, and do NOT fold in unrelated work.
- If the required check is red for a reason that is NOT a CI/rebase break — the diff itself is genuinely wrong and
  needs a design call — do **NOT** guess: stop and report `#{{ITEM_NUM}} → ci-heal escalated (needs human — not a
  CI break)`. The review gate (if any) still owes a human verdict; a human handles it via `/finish`.

### 4. Run the gate GREEN (the item's own locus gate)

```bash
npm run check:standards          # (or the item's locus gate — LOCI[item.locus] in check-standards-rules.mjs)
```

A red gate is a hard stop: do **not** re-push, and report `#{{ITEM_NUM}} → ci-heal gate-red`.

### 5. Converge before re-push — self-review the heal (proportionate to the change)

For anything beyond a trivial rebase-only heal, spawn **one adversarial code-review subagent** on your heal diff
and **AWAIT its returned report as the verdict** — the same converge-before-handback discipline the delivery brief
uses ([delivery-agent-brief.md](delivery-agent-brief.md) step 6). Confirm the repair addresses the failing check
and introduces no new problem. Address every finding to convergence (fix it, or dismiss it with a one-line reason).
A trivial, obviously-correct heal (a clean rebase with no code change) may skip the subagent.

### 6. Commit + re-push HEAD to the SAME lane ref (update the existing PR in place)

Commit only the heal's files (explicit paths, never `git add -A`; one commit) on the lane's current branch. Because
you rebased, push with `--force-with-lease` to update the existing PR's head — this **updates the PR**, it does not
open a new one (never `gh pr create`, never `pr-land` — the PR already exists):

```bash
printf '%s\n' "WE #{{ITEM_NUM}}: CI-heal PR #{{PR_NUM}} — rebase onto main + repair the failing check" "" \
  "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" > <msgfile>
git commit -F <msgfile> <explicit-paths>   # omit if the rebase alone healed it and there is nothing new to commit
git push --force-with-lease origin HEAD:refs/heads/{{LANE_REF}}
```

Write the commit message to a file and `commit -F` it — a heredoc runs backticks (e.g. `` `scope:` ``) as a
subshell (`bad substitution`); a message file has no such footgun. Pushing to `lane/*` is allowed by the
single-branch guard; pushing to `main` is not. `--force-with-lease` (not a bare `--force`) refuses if someone else
advanced the ref since you fetched it — a safety net against clobbering a concurrent human `/finish`.

### 7. Post the durable CI-heal comment — the restart-surviving attempt tally (NEVER a label swap)

The heal is re-pushed. Record it with a durable comment — this is **the ONLY thing you write to the PR**, and it is
a comment, **NOT** a label change:

```bash
node scripts/conveyor/ci-heal-mark.mjs {{PR_NUM}} --reason={{REASON}}
```

`ci-heal-mark.mjs` posts one comment whose leading line is the CI-heal marker. The conveyor counts those comments
to bind the **retry cap across restarts** (#2666, mirroring #2643's re-arm-comment count), so the auto-heal can't
flap forever on a genuinely-broken diff. It makes **NO** label change: `review:human` / `review:pending` /
`review:changes` are untouched. **Do NOT** run `rearm-review.mjs`, **do NOT** `gh pr edit --add/--remove-label`,
**do NOT** touch `ready-to-merge` — only CI was repaired, so the PR's landability is decided exactly as before:
a `ready-to-merge` PR lands once its re-run CI is green (the drain), a parked PR still awaits its human `/review`.

### 8. Append a structured learnings entry to the session drop-box (#2614)

Append **exactly one** generalized-lesson entry (a friction hit, a missing convention, a doc/skill gap, an
improvement idea) from the heal — a write-time-gated scrub that rejects raw code, diffs, secrets, absolute/repo
paths, or PII, so keep every field a short generalized lesson:

```bash
node scripts/conveyor/learnings-drop.mjs \
  --kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --summary="<one sentence — the lesson>" \
  --area="<coarse label, e.g. ci-heal / rebase-on-main>" \
  --suggestion="<short recommendation>" \
  --session={{SESSION_SLUG}}
```

Skip only if you genuinely hit no generalizable friction.

### 9. EXIT — do not merge, do not touch the review label, do not release

**Stop here.** Do NOT run `gh pr merge`. Do NOT run a drain. Do NOT `release` the lane. Do NOT change ANY review
label. Your process EXIT is the signal you are done; the conveyor's merge watcher (`pr-watch.mjs {{PR_NUM}}`) and
the next tick's state read (which now sees the CI recovering) carry it from here — a `ready-to-merge` PR lands once
its re-run `test` is green (the drain), a parked PR keeps its human gate. Return a one-line result:
`#{{ITEM_NUM}} → PR #{{PR_NUM}} (ci-healed re-pushed | ci-heal escalated <reason> | ci-heal gate-red)`. A red gate /
red CI / conflict is NOT watcher-visible — your one-line RETURN is the only signal that surfaces it, so always
report it.

---

## Manual take-over — the human `/finish` path (SAME procedure)

The auto path above and a human healing a red/BEHIND conveyor PR by hand are **one procedure**. When a human takes
over: reconstitute on `{{LANE_REF}}` (don't rebuild), rebase onto `main`, repair only the failing check, get the
locus gate green, re-push HEAD to the same `lane/*` ref, post the CI-heal comment — and **never touch the review
label**. The only difference between auto and manual is **who** does the repair; the reuse-the-ref, rebase,
repair-only-CI, re-push, never-touch-the-review shape is identical.

## Guardrails (the non-negotiables)

- **Never edit the primary checkout** — all work is in the acquired lane clone (#104/#2183).
- **Never merge; never touch the review label** — you stop at a re-pushed, CI-repaired PR. `review:human` /
  `review:pending` / `review:changes` / `ready-to-merge` are ALL left exactly as they were — only CI is repaired.
  The drain daemon is the sole writer to `main`; a human `/review` (or the drain AI-review) still owns any parked
  verdict.
- **Reuse the ref, never rebuild** — reconstitute from `{{LANE_REF}}`; if the ref is gone, report it, don't redo.
- **Repair only the CI break** — do not fold unrelated work in; do not weaken or delete a test to go green; if the
  diff itself is genuinely wrong (not a CI/rebase break), escalate — don't paper over it.
- **Work only through the normal verbs** — `acquire --base=<ref>` → rebase → repair → `git push … lane/*` →
  `ci-heal-mark.mjs` → daemon/human. No parallel state store, no review-label swap (#2612 / #2666 rulings).
