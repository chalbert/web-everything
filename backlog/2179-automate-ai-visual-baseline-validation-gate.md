---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Automate the AI visual-baseline validation gate (don't leave it as judgment)

Standing rule (user, 2026-07-02): any `toHaveScreenshot` baseline that changes must be AI-validated — the agent looks at old vs new and confirms the diff IS the intended change before the new baseline is committed, never a blind `check:visual:update`. Right now that is a judgment step (the same hookable-vs-judgment gap, #51, that recurs). Make it enforced: e.g. a `check:visual` failure writes the diff PNG + the old/new pair to a known path, and accepting a baseline update requires a reviewed PR that carries the before/after and an explicit AI verdict — a bare snapshot-only diff is blocked otherwise. Surfaced while refreshing the home baseline after the orange-gradient + card changes.

## Delivered

- **`we:scripts/check-visual-baseline-update.mjs`** — the gate script. When staged PNG files live under `*-snapshots/` dirs, each must have a matching approved AI verdict in `we:tests/visual/verdicts/` (snapshot filename + `"verdict": "approved"` + mtime newer than the snapshot). Exits 2 to block the commit if any are missing. Run as `npm run check:visual:guard` or invoked automatically by the pre-commit hook.

- **`we:scripts/dev/visual-baseline-review.mjs`** — the review helper. Reads Playwright diff artifacts from `playwright-report/data/` and `test-results/`, copies diff/before/after PNGs to `we:tests/visual/review/` (stable path, gitignored), and scaffolds a verdict JSON in `we:tests/visual/verdicts/`. The AI reviewer fills in `"verdict": "approved"|"rejected"` + `"intendedChange"` + `"notes"`. Run as `npm run visual:review`.

- **`we:.githooks/pre-commit`** — extended with the gate call after the existing locus-prefix check. A snapshot-only diff is now structurally blocked at commit time.

- **`we:package.json`** — two new scripts: `check:visual:guard` (standalone gate) and `visual:review` (review helper).

- **`we:tests/visual/verdicts/`** — new tracked directory (`.gitkeep`) where verdict JSON files live. Each verdict file rides the PR as the paper trail of the AI approval.

- **`we:tests/visual/review/`** — gitignored working directory for diff artifacts (not committed).

### Enforced workflow

```
1. npm run check:visual              # identifies changed snapshots
2. npm run visual:review             # copies diffs to review/, scaffolds tests/visual/verdicts/<name>.json
3. AI reviews before/after images and sets "verdict": "approved" in the JSON
4. npm run check:visual:update       # accept the baseline(s)
5. git add tests/visual/verdicts/ <updated-snapshots>
6. git commit                        # pre-commit gate now passes
```

A bare snapshot-only commit is blocked at the pre-commit hook: no verdict = exit 2.
