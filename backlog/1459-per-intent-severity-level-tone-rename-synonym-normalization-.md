---
kind: story
size: 3
status: open
blockedBy: ["1427"]
dateOpened: "2026-06-21"
tags: []
---

# per-intent severity/level → tone rename + synonym normalization sweep (realizes #1427 Fork 2a)

Realizing build for #1427(a) Fork 2: rename the divergent dimension names (feedback/system-notification severity → tone) to the canonical tone and apply the canonical synonym table (danger≡negative≡critical≡error; success≡positive; warning≡caution) so the theme resolves any synonym to one token. info and neutral stay DISTINCT tokens (#1427 dropped the info≡neutral mapping as lossy). Touches we:src/_data/intents/{action,status-indicator,tag,message,feedback,system-notification}.json. Action keeps neutral|danger regardless (#1337).
