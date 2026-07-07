---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-05"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# Provision the review-escalation GitHub labels deterministically — the blast-radius park is inert without them

The #2171/#2262 review-escalation mechanism parks a blast-radius PR by applying the labels defined in we:scripts/lib/review-escalation.mjs REVIEW_LABELS (review:pending / review:accepted / review:changes) via gh, and the drain lands a parked PR only when review:accepted is present. But NOTHING creates those labels in the GitHub repo — so on a fresh repo (or any repo where they were never made) gh can't apply them, the park silently no-ops, and a blast-radius PR falls straight through the gate as if unescalated. Observed 2026-07-05: the three labels did not exist, so #127 (touching we:scripts/backlog.mjs) never actually parked; landing it required hand-creating the labels first. Fix (deterministic, idempotent): ensure the three review labels exist before the escalation relies on them — either a setup/bootstrap step (idempotent gh label create for each REVIEW_LABELS value + color/description) run at repo provisioning, or have the drain UPSERT each label on demand right before it applies one (create-if-missing, ignore-already-exists). Single source of truth: derive the label set + colors from REVIEW_LABELS so the provisioner and the applier never drift. Net: the blast-radius review gate actually functions on every repo, not just where a human happened to create the labels by hand.
