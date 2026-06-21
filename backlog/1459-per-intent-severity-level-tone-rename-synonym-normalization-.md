---
kind: story
size: 3
status: resolved
blockedBy: ["1427"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/feedback.json"
tags: []
---

# per-intent severity/level → tone rename + synonym normalization sweep (realizes #1427 Fork 2a)

Realizing build for #1427(a) Fork 2: rename the divergent dimension names (feedback/system-notification severity → tone) to the canonical tone and apply the canonical synonym table (danger≡negative≡critical≡error; success≡positive; warning≡caution) so the theme resolves any synonym to one token. info and neutral stay DISTINCT tokens (#1427 dropped the info≡neutral mapping as lossy). Touches we:src/_data/intents/{action,status-indicator,tag,message,feedback,system-notification}.json. Action keeps neutral|danger regardless (#1337).

## Progress (batch-2026-06-21)

Applied the #1427 Fork-2a canonical rename + synonym normalization across the 6 named intents:
- **Dimension rename `severity` → `tone`:** `we:src/_data/intents/feedback.json` +
  `we:src/_data/intents/system-notification.json` (key, dimension description, `summary`, the description
  prose headings/vocabulary, and the TS interface — `FeedbackSeverity`→`FeedbackTone` /
  `NotificationSeverity`→`NotificationTone`, `severity:`→`tone:`).
- **Synonym normalization to canonical tokens** (`positive→success`, `caution→warning`,
  `negative→danger`, `error→danger`): feedback/system-notification `error→danger`; message
  `[neutral,positive,caution,negative]→[neutral,success,warning,danger]`; status-indicator + tag
  `positive→success, caution→warning`.
- **Kept distinct per #1427:** `neutral` and `info` (info≡neutral mapping dropped as lossy); the
  intent-local `progress` (status-indicator) and `categorical` (tag) tokens (fail the tone-membership
  test, not in the shared palette); `action` unchanged (`neutral|danger`, #1337 non-negotiable);
  `message.attention.critical` untouched (a priority level, not a tone).
- **`critical` kept as a distinct canonical token** (status-indicator, tag) — the #1427 **roster** explicitly
  lists `critical` as a shared-palette member ("ruled now so the palette can't re-flatten"), which
  *supersedes* the Fork-2 synonym line's contradictory `danger ≡ … ≡ critical`. Chose the
  information-preserving reading; flagged for confirmation (the only contested mapping — the other 4
  synonyms + the rename are unambiguous).
- Each per-intent dimension description now documents the synonym equivalences inline. `check:standards`
  → 0 errors (intent count unchanged — no inventory regen).
