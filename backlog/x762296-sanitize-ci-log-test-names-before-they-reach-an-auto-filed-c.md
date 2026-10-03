---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Sanitize CI-log test names before they reach an auto-filed card digest

Follow-up from the #3559 advisory (operator approved #3559, 2026-10-02). we:scripts/operations/ci-heal-pr-dispatch.mjs:451 writes free-text test names parsed from untrusted CI logs (parseTimeoutFailures) unsanitized into the digest of a generated backlog card; a PR can craft test output that injects text into the backlog. Pass every such field through a single-line, length-bounded sanitizer (strip control characters, markdown and HTML, cap length), and add a check that flags interpolation of parseTimeoutFailures fields into scaffold digests without it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
