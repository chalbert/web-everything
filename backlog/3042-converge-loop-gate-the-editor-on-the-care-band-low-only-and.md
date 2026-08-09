---
bornAs: xlambgc
kind: story
size: 3
status: resolved
blockedBy: ["2908"]
dateOpened: "2026-08-08"
dateResolved: "2026-08-08"
tags: []
---

# Converge loop: gate the editor on the care band (low only) and give low a 2-round budget on a dedicated knob

Implements the #2908 ruling. **Delivered in PR #1106, alongside the ruling itself.**

Before: the editor ran wherever the round budget allowed (`elevated` and `high`) and was unreachable at `low`,
because the loop forces `escalate` at `roundCap` before the editor step
(`we:scripts/workflows/review-parked-prs.mjs`, the round-cap backstop before the `editorRound` call). So the
editor was enabled *precisely and only* on the PRs carrying a risk signal — the inversion the fork existed to
fix.

Shipped:

- `editorPolicyForCareLevel` + `EDITOR_ENABLED_CARE_LEVELS` (`['low']`) + `EDITOR_MIN_ROUNDS` (2) in
  `we:scripts/lib/jury-core.mjs` — a DEDICATED knob. `panelRigorForCareLevel` is untouched, so `/jury`,
  `/review` and `/converge` still get `low` = 1 round.
- `editorPolicyFromReasons` in `we:scripts/lib/review-core.mjs`, surfaced as the `editor` block on
  `we:scripts/review-core-cli.mjs` (`rigor --json`).
- The gate in `we:scripts/workflows/review-parked-prs.mjs`: the one and only door to `editorRound`, resolved
  once at loop start from the same band the panel dialed, re-derived from the allow-list rather than trusted
  from the rigor agent's echo.
- Fail-closed band resolution: an empty escalation-reason list, an unrecognized band, or a dead rigor agent all
  resolve to `null` / review-only. This closes the fail-open the PR #1106 technical pass named — the
  `low`/1-round fallback used to protect against it only by accident.
- Review-only still reports: the escalation carries the round's findings, verdict and operator comment.
