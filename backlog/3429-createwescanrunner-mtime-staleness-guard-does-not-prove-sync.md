---
bornAs: xszq5nk
kind: story
size: 3
status: open
dateOpened: "2026-08-31"
tags: [security, rust-scan, secret-scrub, flagged-by-review]
---

# createWeScanRunner's mtime staleness guard doesn't prove the Rust binary is actually in sync

we:scripts/lib/rust-scan-bridge.mjs's `createWeScanRunner` treats "the `we-scan` binary's mtime is newer
than every `referenceFiles` entry's mtime" as proof the compiled Rust detector logic matches the JS
reference it mirrors. That's only true when the binary was last built *because of* an edit to one of those
references — any other reason to rebuild (a toolchain bump, `cargo clean`, a routine scheduled CI rebuild)
also bumps the mtime, so the guard reads it as fresh even when the Rust source was never updated to match an
earlier JS-side pattern change.

Added by we:PR #1741 (we:backlog/xwt6ola-captureviaexecfilesync-catch-block-cannot-tell-a-killed-chil.md).
This feeds `secret-scrub`, the credential-prevention gate (#3015): if a JS-only pattern is added, the JS
reference file's mtime correctly marks the binary stale — but if an unrelated rebuild happens before anyone
ports the pattern to Rust, that rebuild's mtime silently "un-stales" the binary again, and a real credential
matching only the unported pattern could pass through the Rust path undetected. Low probability (needs an
out-of-order rebuild plus a real secret matching the gap) but high severity: a credential that reaches this
gate is COMMITTED and PUSHED, unrecoverable by the time anyone notices. we:scripts/lib/__tests__/rust-scan-bridge.test.mjs
covers missing/malformed/erroring/mtime-stale cases already, but nothing models a Rust source file drifting
independently of a rebuild, so this gap has no regression coverage either.

we:scripts/lib/rust-scan-bridge.mjs's own header already discusses and rejects embedding a content-hash of
the JS reference(s) in the binary at build time, on the grounds that mtime is "far simpler to implement and
test" and its only failure direction is safe (a false "stale" reading costs an extra JS fallback run, never
a missed detection) — that reasoning holds for the in-order case (edit-then-rebuild) but doesn't address the
out-of-order rebuild case this item raises, so it isn't a reason to skip fixing this.

Recommended direction: a deterministic check-standards rule pairing each `runWeScan` call's `referenceFiles`
with its corresponding Rust source file — mirroring the existing `PLAYWRIGHT_CONTAINER_PIN_REQUIRED_FILES`
coupled-file pattern in we:scripts/check-standards-rules.mjs — and failing a commit that edits a reference
file's pattern list without a matching edit to the paired Rust file in the same diff. Concretely, today's two
call sites in we:scripts/check-standards.mjs pair as: we:scripts/lib/secret-scrub.mjs +
we:scripts/check-standards-rules.mjs ↔ we:scripts/rust-scan/src/secret_scrub.rs, and
we:scripts/lib/stdout-flush-scan.mjs ↔ we:scripts/rust-scan/src/stdout_flush.rs. This is cheaper and more
targeted than the content-hash approach, and doesn't relitigate that rejection since it's a different
mechanism (a commit-diff lockstep check, not a build-time embedded hash) — worth reconsidering the hash route
only if the coupled-file lint proves too blunt in practice.

## Done when

1. **Executable** — a new test (in we:scripts/lib/__tests__/rust-scan-bridge.test.mjs or a new
   we:scripts/__tests__/rust-scan-reference-lockstep.test.mjs) asserts the new validator flags a diff that
   edits `we:scripts/lib/secret-scrub.mjs`'s pattern list with no matching edit to
   `we:scripts/rust-scan/src/secret_scrub.rs` in the same commit, and passes clean when both are edited
   together.
2. **Executable** — `npm run check:standards` fails on a crafted local diff that edits only the JS side of a
   paired reference (reproducing the gap today: nothing currently flags this), and passes once both sides are
   edited together.
3. **Executable** — `npx vitest run we:scripts/lib/__tests__/rust-scan-bridge.test.mjs` continues to pass
   unchanged — the new coverage is additive, not a replacement for the existing mtime fallback tests.
