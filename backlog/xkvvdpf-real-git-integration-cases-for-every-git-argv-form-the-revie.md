---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Real-git integration cases for every git-argv form the review path uses

PR #1031 review r3's owed prevention, and the finding it comes from is the reason a fake cannot be the guard. resolveNetDiff proved the tracking ref was current with 'git rev-parse --end-of-options <ref>'. rev-parse ECHOES any argument it cannot interpret, unlike fetch/diff which consume it, so the output was '--end-of-options\n<sha>', the sha never parsed, and the function returned degraded on EVERY real invocation — the net basis silently never engaged and the PR's stated purpose was undelivered on all code paths. Twenty new unit cases passed over that dead path because the fake exec answered with the bare sha: it encoded what git was ASSUMED to do. Verified on git 2.50.1 that plain --end-of-options echoes and --verify returns the bare sha while still refusing an option-shaped ref. we:scripts/fetch-parked.mjs now carries a real-git block (throwaway repo under tmpdir, real execFileSync) asserting basis==='net' end-to-end. This item generalizes it: one real-git case per git-argv form the review path depends on (fetch, diff --name-only -z, rev-parse --verify, show <rev>:<path>), so the next fake-vs-reality drift fails in the commit that introduces it. Note the filed #xi938uc (coverage.include) does NOT reach this class — those lines were covered, by a fake that lied.
