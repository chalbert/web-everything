---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/critical-work.mjs", "we:scripts/lib/__tests__/critical-work.test.mjs", "we:scripts/lib/__tests__/__tests__/critical-work.test.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2759's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2759's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/lib/critical-work.mjs:61` — Single-source the alias table: have we:scripts/lib/critical-work.mjs's normalizePath/SIBLING_REPO_PATH_ALIASES derive from we:scripts/lib/repo-profile.mjs's SCOPE_PREFIXES/PREFIX_ALIASES instead of a separately maintained regex + hardcoded list, and add a test asserting normalizePath strips every alias SCOPE_PREFIXES.we lists.
2. `we:scripts/lib/__tests__/critical-work.test.mjs:172` — Extend the existing 'every group' parametrized test pattern (already used earlier in this file for NEVER_SPOT_CHECK_PATH_PREFIXES) to also iterate every prefix within the irreversible group under a sibling-repo alias, not just two hand-picked `.github/workflows/` examples.
3. `we:scripts/lib/critical-work.mjs:45` — A shared, single-sourced scope-prefix-to-repo-relative-path normalizer (reading SCOPE_PREFIXES/CONSTELLATION_REPOS directly) used by every one of the three duplicated `^we:`-strip call sites, with a test asserting it round-trips every alias each repo's SCOPE_PREFIXES entry documents.
4. `we:scripts/lib/critical-work.mjs:55` — Add a deterministic parameterized test covering every supported repository scope alias against an irreversible workflow path, asserting the irreversible reason specifically.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
