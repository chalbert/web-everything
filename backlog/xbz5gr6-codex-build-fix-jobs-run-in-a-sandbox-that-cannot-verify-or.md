---
kind: story
size: 3
status: open
scope: ["we:scripts/codex-direct-task.mjs", "we:scripts/__tests__/codex-direct-task.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Codex build/fix jobs run in a sandbox that cannot verify or prove: read-only .git, no network, fixture temp failures

Live 2026-09-30, four detached Codex jobs through we:scripts/codex-direct-task.mjs (`codex exec -s workspace-write`): every one reported that `node we:scripts/verify-lane.mjs` failed with EPERM writing its marker under the lane's .git (Codex workspace-write keeps .git read-only), that check:standards could not create its host admission lock under the lane pool, that soak fixtures failed (ENOTEMPTY / unable to read tree in temp git fixtures), and that no authenticated GitHub read was possible (no network). Result: #4655 (meter the drain) came back as notes only — the job could not reproduce the 90 s soak timeout or take live proof — and every other job reported its gate RED "in this environment", so each PR relies on the outer script's verify. Fix: give build/fix/heal Codex runs the writable roots they legitimately need (the lane's own gitdir, the lane-pool admission root, a per-run temp root) and network for read-only proof, via codex exec config (e.g. `-c sandbox_workspace_write.writable_roots=[…]`, `network_access=true`) or `--add-dir`; keep review/read-only mode unchanged. Proof: rerun #4655 in the new sandbox and show verify-lane writes its marker and the drain soak runs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
