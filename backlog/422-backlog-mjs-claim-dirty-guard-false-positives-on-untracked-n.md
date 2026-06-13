---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: []
---

# backlog.mjs claim dirty-guard false-positives on untracked-new items

The claim verb's isDirty guard runs git status --short and die()s on ANY hit — including untracked-new files (??), the normal state of a freshly-scaffolded item never committed. So claim refuses every new item until committed, though the guard's own comment says 'Warn (don't block)'. This forces a manual status hand-flip (open→active + dateStarted) per item, defeating the mechanical verb (hit 4× in one session). Fix: distinguish untracked (??) from tracked-modified ( M) — only a tracked modification is the concurrency smell the guard targets — or downgrade to a warning. Adjacent to #083, which owns the claim concurrency model.

## Location & fix

- [scripts/backlog.mjs:71-77](scripts/backlog.mjs#L71-L77) — `isDirty(relPath)` returns `true` for any non-empty `git status --short` output (untracked `??` included).
- [scripts/backlog.mjs:85](scripts/backlog.mjs#L85) — `if (v === 'claim' && isDirty(rel)) die(...)` — the comment on line 71 says "Warn (don't block)" but the call `die()`s.

**Suggested fix:** parse the porcelain status code — treat only a tracked modification (`' M'`, `'MM'`, `'M '`, etc.) as the concurrency smell that should block; an untracked file (`'??'`) is a freshly-scaffolded item, not a racing edit, so it should pass (or at most warn). Repro: `scaffold` an item, then `claim` it without committing → it dies on "uncommitted edits".
