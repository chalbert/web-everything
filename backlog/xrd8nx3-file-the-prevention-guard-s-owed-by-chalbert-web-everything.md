---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/minimal-context-provider.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/minimal-context-provider.test.mjs", "we:scripts/operations/__tests__/explore-io.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-io.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3007's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/minimal-context-provider.mjs:181` — Give buildRestrictedProviderArgv a required `model` parameter (throw if missing) so every caller must supply a resolved model, plus a test that a routed opus item yields --model opus on the restricted path.
2. `we:scripts/operations/explore-io.mjs:359` — A check:standards rule that flags any argv literal containing '--bg' or '-p' with '--session-id' in scripts/ that lacks '--model', or a single shared spawn-argv builder all sites must use.
3. `we:scripts/operations/explore-io.mjs:359` — Add a check:standards rule or repo-wide test that every `claude` spawn site (`execFileSync('claude'`, `--bg` argv builders) routes through a model-asserting builder. Alternatively, move the `--model` guard into the shared `defaultSpawnAgent` layer.
4. `we:scripts/operations/dispatch-lane-io.mjs:2219` — Route both branches through one model-policy function so Fable refusal applies everywhere. Add a test asserting a Fable `--model` is refused with and without `table`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3007@d084d02f01208aaf493e836f2c4093ad9036beed

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
