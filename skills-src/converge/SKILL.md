---
name: converge
description: Run the REAL bounded editor↔reviewer convergence loop on working-tree work in a lane clone — before any PR exists. A multi-lens panel judges the lane's diff, an editor fixes or dismisses each finding, and the panel re-judges, until it converges or hits the round cap. Use when the user wants to "converge" the current work, "review and fix until it's clean", "run the convergence loop on this lane", or when a delivery agent needs its converge-before-PR pass. ADVISORY — it reports a verdict and never opens, labels, or lands a PR. NOT for a parked PR (that is `/drain`), NOT for the interactive human verdict on one (that is `/review`), and NOT for a judge-only opinion with no fixes (that is `/jury`).
---

# /converge — converge working-tree work before a PR exists

The convergence loop — panel judges → editor revises → panel re-judges, bounded by a round cap — used to exist
only for PRs the drain had already parked. Everything upstream of that ran on **prose**: the conveyor's
delivery-agent brief tells an agent to "address every finding to convergence", with no round cap, no panel
reduction, and no ledger. This skill gives that step the real loop.

**The improvement is boundedness, not enforcement.** `/converge` reports a verdict. It does **not** gate opening
a PR, and it never commits, pushes, labels, or merges. Whether the work ships stays the human's call.

## What this skill owns — and what it must never re-decide

It owns **driving**: run a command, spawn the agents an action calls for, feed the results back. That is all.

Every decision is a pure derivation it shells for and obeys:

- **The loop's control flow** — [we:scripts/lib/converge-core.mjs](../../scripts/lib/converge-core.mjs):
  `convergeStep` (what happens next), `deriveRoundObservations` (what actually happened), the round-cap backstop,
  the grow-only roster union, the fail-closed degradations. Unit-tested in
  [we:scripts/lib/\_\_tests\_\_/converge-core.test.mjs](../../scripts/lib/__tests__/converge-core.test.mjs).
- **The judging** — [we:scripts/lib/jury-core.mjs](../../scripts/lib/jury-core.mjs): who is on the panel, how many
  jurors a care band earns, which lenses are mandatory, how verdicts reduce.
- **Where material comes from and where revisions go** —
  [we:scripts/lib/converge-transports.mjs](../../scripts/lib/converge-transports.mjs).

**Never** re-derive any of it in this skill. If you find yourself deciding whether to run another round, stop —
that is `convergeStep`'s call, and hand-deciding it is exactly the prose-loop failure this skill exists to fix.

## Run it

Everything goes through [we:scripts/converge-cli.mjs](../../scripts/converge-cli.mjs). Keep the state file for
the whole run — it carries the round counter and the roster.

### 1. Seed the run

```bash
STATE=$(mktemp -t converge)   # keep this path for every later call
node scripts/converge-cli.mjs init --lane="$LANE" --state="$STATE" --care=elevated
```

`--care` dials the jury size and the round cap through `panelRigorForCareLevel` — never hand-tune either.

> **Pick the care level deliberately.** Working-tree material has no escalation reasons, so nothing derives care
> for you and the floor (`low`) is the weakest review available — on work nothing has judged yet. Use `elevated`
> or `high` for anything touching a trust boundary, a gate, a contract, or a shared derivation. (Deriving care
> from the touch-set is a known open question on the backlog item, not yet built.)

### 2. Loop until the action is `land` or `escalate`

`init` and every `step` print an `action`. Do exactly what it says, then step again with what happened.

| action | what you do | what you feed back |
|---|---|---|
| `read` | run the printed `read.command` | `{"readResult": {"material": "<the diff>"}}` |
| `panel` | spawn ONE fresh subagent per printed lens (× `jurors`), each seeded with that lens's `mandate` and the diff | `{"readResult": …, "lensResults": [{"lens": …, "ok": true, "findings": […]}], "invites": […]}` |
| `edit` | spawn ONE editor subagent with the printed `edit.prompt` | `{"readResult": …, "lensResults": …, "editResult": {"advanced": true, "dismissed": […]}}` |
| `invite` | shell `review-core-cli invite` for the growth delta | `{"invite": …, "inviteEcho": <what it returned>, "findings": <this round's findings>}` |
| `land` | done — report the verdict | — |
| `escalate` | done — report the escalation packet | — |

```bash
echo "$OBSERVATIONS_JSON" | node scripts/converge-cli.mjs step --state="$STATE"
```

**Carry `readResult` on every step.** The core reads an absent field as "did not happen", so dropping it makes
the round look like a failed read and escalates a run that was fine.

**Carry `findings` into an `invite` step too.** A rejected invite falls through to an editor round on the same
round number, and the editor prompt is built from those findings — omit them and you get an editor with nothing
to fix.

### 3. Report

On `land`: the verdict, the per-lens table, how many rounds it took, and every dismissed finding with its stated
reason. On `escalate`: the printed `escalation` packet — the reason, the round history, and the findings that
survived. Say plainly which one happened; a `land` here means a non-author panel accepted the final diff, and an
`escalate` means it did not.

## The invariants you are not allowed to soften

These are enforced in the tested core, so you cannot break them by accident — but do not paper over them in how
you report, either.

- **A reviewer that did not run never reads as accept.** If a mandatory lens (`correctness` / `security`) crashes
  or was never scheduled, the round degrades to `needs-human` and escalates. No round budget saves it.
- **A failed read escalates.** No material means nothing was judged.
- **The round cap is real.** It is enforced from the core's own counter, not from anything an agent returned.
- **An editor that could not advance the work escalates.** Re-judging identical material just replays the verdict.
- **Every finding is fixed or dismissed with a stated reason.** Silence is a stall, not an acceptance.
- **The panel never authors what it judges.** The editor writes; the NEXT round's fresh reviewers judge. Never
  let one agent do both.

## Boundary

`/converge` applies no label, posts no comment, opens no PR, and merges nothing. It does not commit or push —
the editor is explicitly told not to. Landing a PR is [`/drain`](../drain/SKILL.md); the human verdict on a
parked PR is [`/review`](../review/SKILL.md); a judge-only opinion with no fixes is [`/jury`](../jury/SKILL.md).
