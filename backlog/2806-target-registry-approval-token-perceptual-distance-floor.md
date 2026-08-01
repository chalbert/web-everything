---
bornAs: x8fptpl
kind: story
size: 8
parent: "2804"
status: open
dateOpened: "2026-08-01"
blockedBy: ["2805"]
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# Target registry + approval token + perceptual-distance floor

An independent ratified-mock target registry; an approval token signed over the mock content hash; a perceptual-distance floor that rejects any target too close to a build screenshot and escalates a target authored in the same lane/commit as the render code. Enforces the target-is-not-the-subject invariant.

## Security requirements (owned here — the design-source statute #2801 defers the mechanics to this slice)

The #2801 statute (`we:docs/agent/platform-decisions.md#design-source-locked-in-code-target`) rules the
*direction* of the target registry (in-code artifact = sole content-hashed canon; normalize+archive sources;
minter-agnostic WE contract; interactions cut on assertability). It deliberately does **not** codify the
trust-model mechanics — those are design constraints on this slice, because it (not the statute) closes RRFC
INVARIANT A's circular oracle. Any registry/token design landed under this slice **must** satisfy these seven,
listed as first-class security requirements:

1. **Authorization predicate on mint (not self-issuable).** "Any client mints" needs an authorization check, or a
   build lane can rewrite the target to match what it built, hash it, mint `@vN`, and issue its own token in the
   same commit — re-opening the circular oracle INVARIANT A added the token to close.
2. **Integrity digest, not authenticity — align with #2809.** The token is an *integrity digest* (anti-replay),
   not a signature: an unkeyed `sha256` over public inputs proves neither authenticity nor authorship. Use
   #2809's corrected wording (`integrityDigest`, "NOT authenticity"); do not ship an unkeyed hash described as a
   "signature".
3. **Context binding.** The token must bind `registryId` + `@vN` + `authoredInCommit`, not the bare
   `contentHash` — otherwise two byte-identical artifacts cross-validate and approval for surface A authorizes
   surface B. (Commit dates are attacker-settable, so pre-dating needs cryptographic support, not a timestamp.)
4. **Ledger tamper-evidence.** The append-only ledger needs prev-entry chaining / a signed head / an external
   anchor. Without it an in-place rewrite of `@v3` is undetectable — the drift INVARIANT A forbids.
5. **"Frozen" forbids live/expiring subresources.** The canonical in-code target must not fetch live or expiring
   subresources (a remote script/stylesheet, or an imported Figma CDN image URL that expires in ~30 days while
   `contentHash` still validates against a now-blank render). Freeze must inline/pin every subresource.
6. **Canonicalization rule for `sha256`.** Define the exact canonical-bytes rule the hash is taken over
   (single-file vs file-set, newline normalization) — otherwise a sibling file changes the target with the hash
   unchanged, or a CRLF checkout false-blocks every story.
7. **Raw-payload redaction/PII + `sourceHash` binding.** The archived raw import payload is re-parsed by the
   normalizer (untrusted parser input) and Figma node JSON routinely carries signed image URLs and user
   name/email. Require redaction/PII handling and bind the payload with a `sourceHash` so provenance is not
   self-declared and unverifiable.
