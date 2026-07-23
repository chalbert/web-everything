# Conveyor fix-agent brief (template) — repair a `review:changes` bounce IN ITS OWN LANE, then hand back for re-review (#2630)

> **This is a TEMPLATE, not a runnable skill.** The `/conveyor` skill (#2613) instantiates it when a
> conveyor-launched PR is bounced `review:changes` (a human ran `/review` and requested changes). It fills the
> `{{PLACEHOLDERS}}` below and passes the result as the prompt for **one background fix agent** spawned into
> that PR's lane. One agent = one bounced PR = one repair = one re-push. The agent does the JUDGMENT work (apply
> the reviewer's finding); every script-decidable step around it is a script it shells, per
> [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
> (#2607).

> **Why this exists.** Before #2630, a `review:changes` bounce only PARKED (pr-watch exit 2): the delivery agent
> that built the PR had already exited (one agent = one item = one PR), so nothing repaired it — a human had to
> take over via `/finish` or by hand. This brief is the **auto** path: the conveyor re-dispatches a fix agent
> into the bounced PR's lane to apply the finding, re-push, and re-arm review. The **human `/finish` path uses
> this SAME procedure** (see *Manual take-over* at the end) — the auto and manual repairs are one procedure, not
> two.

## Fill these before spawning

| Placeholder | What the conveyor fills it with |
|---|---|
| `{{ITEM_NUM}}` | the backlog item number the bounced PR delivers — e.g. `2608` |
| `{{PR_NUM}}` | the bounced PR's number (the one carrying `review:changes`) — e.g. `701` |
| `{{LANE_REF}}` | the PR's head ref — `lane/{{ITEM_NUM}}-<slug>` (`gh pr view {{PR_NUM}} --json headRefName`) |
| `{{LANE}}` | a FREE lane id the conveyor assigned this repair (a fresh clone; the repair is reconstituted from `{{LANE_REF}}`, not the original lease) |
| `{{SESSION_SLUG}}` | a stable per-repair session slug, e.g. `fix-{{ITEM_NUM}}` (ties `acquire`↔`release`) |
| `{{SCOPE}}` | the item's `scope:` frontmatter, repo-qualified & comma-joined (same as the build's scope) |

> **`{{LIKE_THIS}}`** are **conveyor-injected** (the table above). **`<like-this>`** are **agent-runtime values**
> you produce as you work (the reviewer's finding you read off the PR, the `<msgfile>` you write). Do not expect
> the conveyor to fill a `<...>`; that's your job at the moment it's used.

---

## Your job (one sentence)

Reconstitute the bounced PR's work in a lane clone, **apply the reviewer's requested change** (repair only the
broken part — reuse, don't rebuild), get the gate green, **re-push HEAD to the same `lane/*` ref**, then
**re-arm the review** (`review:changes → review:pending`) and **EXIT WITHOUT MERGING**. You **NEVER** self-clear
the human review label — the human (or the drain's AI-review convergence pass) re-verdicts.

## The arc — one command per transition

### 1. Reconstitute the bounced PR's work in a lane clone (reuse the ref — never rebuild from scratch)

The work is intact on the `{{LANE_REF}}` ref (the pushed PR head). Acquire a free lane reset **to that ref**
(not to `origin/main`), so your clone opens at the exact HEAD the reviewer saw:

```bash
export LANE_SESSION={{SESSION_SLUG}}
LANE=$(node scripts/lane-pool.mjs acquire --lane={{LANE}} --purpose=conveyor-fix \
  --session={{SESSION_SLUG}} --scope={{SCOPE}} --base={{LANE_REF}}) && cd "$LANE"
```

- `--base={{LANE_REF}}` lands the clone on the pushed lane tip (via `checkout -B main <ref>`), so you **reuse
  the ~done work** — you are repairing a diff, not redoing the item. If `--base` fails to resolve (the ref was
  deleted / the PR was force-closed), stop and report `#{{ITEM_NUM}} → fix not-applicable (lane ref gone)`.
- Do **NOT** re-`claim` the item — it is already `active` from the build; a re-claim would race. The repair is
  a diff on an existing PR, not a fresh item pickup.

### 2. Read the reviewer's finding (the change to apply)

The `/review` changes-verdict posts a durable PR comment (header `🔁 human review — changes requested` or
`🔁 review — changes requested`) summarizing what to fix. Read it — and the escalation block in the PR body:

```bash
gh pr view {{PR_NUM}} --json title,body,comments --repo <owner/name>
```

Take the **latest** changes-requested comment as the authoritative ask. If the finding is ambiguous or needs a
judgment you cannot safely make, do **NOT** guess — leave the PR `review:changes` (do not re-arm) and RETURN
`#{{ITEM_NUM}} → fix escalated (finding needs human judgment)`. A human handles it via `/finish`.

### 3. Apply the fix — repair ONLY the reviewer's finding

Make the smallest change that addresses the finding, in `$LANE`, on the lane's **current branch** (its local
`main` — do **NOT** `git checkout -b`; the single-branch hook blocks branch creation even in a lane clone).
Keep scope tight: the repair's files should stay within `{{SCOPE}}`. Do not fold in unrelated work, and do not
weaken or delete a test to sidestep the finding. If `origin/main` advanced under the lane and a **conflict**
blocks the gate, resolve it the `/finish` way (regenerate derived artifacts, take-main for coordination JSON) —
or, if it is a genuine same-line code overlap you cannot safely resolve, stop and report `#{{ITEM_NUM}} → fix
escalated (conflict with main)`.

### 4. Run the gate GREEN (the item's own locus gate)

```bash
npm run check:standards          # (or the item's locus gate — LOCI[item.locus] in check-standards-rules.mjs)
```

A red gate is a hard stop: leave the PR `review:changes` (do **not** re-arm) and RETURN `#{{ITEM_NUM}} → fix
gate-red`. Do not re-push a red diff.

### 5. Converge before handback — self-review the repair (proportionate to the change)

For anything beyond a trivial one-liner, spawn **one adversarial code-review subagent** on your repair diff and
**AWAIT its returned report as the verdict** — the same converge-before-handback discipline the delivery brief
uses ([we:skills-src/conveyor/delivery-agent-brief.md](delivery-agent-brief.md) step 6). Confirm the repair
actually addresses the reviewer's finding and introduces no new problem. Address every finding to convergence
(fix it, or dismiss it with a one-line reason). Only then re-push. A trivial, obviously-correct fix (a typo, a
pinned-count bump) may skip the subagent — but never skip re-reading the reviewer's finding to confirm you met it.

### 6. Commit + re-push HEAD to the SAME lane ref (update the existing PR in place)

Commit only the repair's files (explicit paths, never `git add -A`; one commit) on the lane's current branch,
then push HEAD to `{{LANE_REF}}` — this **updates the existing PR**, it does not open a new one (never
`gh pr create`, never `pr-land` — the PR already exists; you are pushing a new head to it):

```bash
printf '%s\n' "WE #{{ITEM_NUM}}: address review:changes on PR #{{PR_NUM}} — <one-line what you fixed>" "" \
  "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" > <msgfile>
git commit -F <msgfile> <explicit-paths>
git push origin HEAD:refs/heads/{{LANE_REF}}
```

Write the commit message to a file and `commit -F` it — a heredoc runs backticks (e.g. `` `scope:` ``) as a
subshell (`bad substitution`); a message file has no such footgun. Pushing to `lane/*` is allowed by the
single-branch guard; pushing to `main` is not.

### 7. Re-arm the review — hand back for re-review (NEVER self-clear the human gate)

The bounce is repaired and re-pushed; now hand it back. This is **the one label swap you may make** — and it is
a script, so you cannot route around the invariant:

```bash
node scripts/conveyor/rearm-review.mjs {{PR_NUM}}
```

`rearm-review.mjs` swaps `review:changes → review:pending` (an independent re-review is owed) and posts a
durable re-arm comment. It **NEVER** emits `review:accepted` and **NEVER** removes `review:human` — a gate-self
bounce stays human-ceremony-only. So the strongest thing you can do is re-arm the review; the human (via
`/review`) or the drain's AI-review convergence pass re-verdicts. **Do NOT** `gh pr edit --add-label
review:accepted`, **do NOT** merge, **do NOT** run a drain. If the script refuses (the PR no longer carries
`review:changes` — e.g. a human already re-touched it), stop and report it; do not force a label.

### 8. Append a structured learnings entry to the session drop-box (#2614)

Append **exactly one** generalized-lesson entry (a friction hit, a missing convention, a doc/skill gap, an
improvement idea) from the repair — a write-time-gated scrub that rejects raw code, diffs, secrets,
absolute/repo paths, or PII, so keep every field a short generalized lesson:

```bash
node scripts/conveyor/learnings-drop.mjs \
  --kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --summary="<one sentence — the lesson>" \
  --area="<coarse label, e.g. review-changes repair / re-arm>" \
  --suggestion="<short recommendation>" \
  --session={{SESSION_SLUG}}
```

Skip only if you genuinely hit no generalizable friction.

### 9. EXIT — do not merge, do not clear review, do not release

**Stop here.** Do NOT run `gh pr merge`. Do NOT run a drain. Do NOT `release` the lane. Do NOT set
`review:accepted`. Your process EXIT is the signal you are done; the conveyor's merge watcher
(`scripts/conveyor/pr-watch.mjs {{PR_NUM}}`) is re-armed by the conveyor skill, sees the PR return to
`review:pending` (still parked, exit 2), and surfaces it for `/review`. Return a one-line result:
`#{{ITEM_NUM}} → PR #{{PR_NUM}} (re-armed review:pending | fix escalated <reason> | fix gate-red)`. A red gate /
red CI is NOT watcher-visible — your one-line RETURN is the only signal that surfaces it, so always report it.

---

## Manual take-over — the human `/finish` path (SAME procedure)

The auto path above and a human repairing a bounce by hand are **one procedure**, so a human doesn't reinvent
it. When a human takes over a `review:changes` bounce (the `/finish` `review-changes` bucket, or directly):

1. **Reconstitute the ref, don't rebuild.** Clone / acquire on `{{LANE_REF}}` (`/finish` clones the ref;
   `acquire --base=<ref>` does the same for a pool lane). Reuse the ~done work.
2. **Read the reviewer's finding** off the PR's latest changes-requested comment (step 2 above).
3. **Repair only the finding**, resolve any conflict the `/finish` way (regenerate derived artifacts; take-main
   for coordination JSON; STOP on a genuine same-line overlap), get the locus gate green (steps 3–5 above).
4. **Re-push HEAD to the same `lane/*` ref** — update the PR in place, never open a new one (step 6 above).
5. **Re-arm, never clear.** Hand back with `node scripts/conveyor/rearm-review.mjs {{PR_NUM}}` — the same
   invariant-guarded swap (`review:changes → review:pending`; never `review:accepted`; never removes
   `review:human`). A human still clears the eventual re-review via `/review` — repairing a bounce is not
   accepting it.

The only difference between auto and manual is **who** applies the finding; the reuse-the-ref, repair-only,
re-push, re-arm-never-clear shape is identical — which is the point (#2630).

## Guardrails (the non-negotiables)

- **Never edit the primary checkout** — all work is in the acquired lane clone (#104/#2183).
- **Never merge, never self-clear the review** — you stop at `review:pending` (re-armed); a human `/review` (or
  the drain AI-review) verdicts, and the drain daemon is the sole writer to `main`. `review:human` is never
  touched by a fix agent.
- **Reuse the ref, never rebuild** — reconstitute from `{{LANE_REF}}`; if the ref is gone or the item is
  unrecoverable, report it, don't silently redo the item.
- **Repair only the finding** — do not fold unrelated work in; do not weaken or delete a test to go green.
- **Work only through the normal verbs** — `acquire --base=<ref>` → repair → `git push … lane/*` →
  `rearm-review.mjs` → daemon/human re-review. No parallel state store (#2612 ruling).
