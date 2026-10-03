---
bornAs: xh69wwb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/deploy-config.test.mjs", "we:.github/workflows/deploy-alpha.yml"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Widen the invariant to reject any bsecretsb token in the admit job, workflow env and defaults, and add a to… (from chalbert/plateau-app#195 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/deploy-config.test.mjs:131` — Widen the invariant to reject any `\bsecrets\b` token in the admit job, workflow `env` and `defaults`, and add a `toJSON(secrets)` mutation case to the `it.each` table.
2. `we:scripts/deploy-config.test.mjs:128` — Match `\bsecrets\b` inside `${{ }}` expressions (or ban the token outright in admit) and add a toJSON mutation case. Include `secrets: inherit` in the check. Cheapest as a standards-lint rule over workflow YAML.
3. `we:.github/workflows/deploy-alpha.yml:173` — Make the immutable-Actions test glob every `.github/workflows/*.yml` instead of only we:deploy.yml, or add a check:standards rule requiring a 40-hex SHA for any external `uses:`.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#195@30e9b72489c6b5e8d960bf61e851a42bc962f418

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
