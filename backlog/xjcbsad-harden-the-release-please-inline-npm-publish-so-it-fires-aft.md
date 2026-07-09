---
kind: story
size: 2
parent: "907"
status: resolved
graduatedTo: "we:.github/workflows/release-please.yml"
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# Harden the release-please inline npm publish so it fires after a release is cut

The #907 publish path is CI-owned (we:.github/workflows/release-please.yml, #2156) but has never published: on the 0.1.0 Release-PR merge (run 28606668569, 2026-07-02) release-please created the contracts-v0.1.0 tag + GitHub Release, then errored on a cosmetic post-step ('Unable to create comment because issue is locked'), marking the release-please job failed. The inline publish job is 'needs: release-please' with no always(), so it was SKIPPED — npm publish never ran and @webeverything/contracts is still E404 on the registry. Fix: gate publish on 'if: always() && needs.release-please.outputs.releases_created == "true"' so a cosmetic downstream error cannot skip a publish once a release is actually cut (releases_created guards it to real releases only), and stop release-please erroring on the locked-conversation comment at the source. check:standards is green today, so the health gate that killed the 07-02 manual we:.github/workflows/publish-contracts.yml fallback runs is no longer the blocker. Firing the one-time 0.1.0 catch-up publish + the FUI consumer-pinning half stay under parent #907.
