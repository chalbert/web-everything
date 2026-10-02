---
bornAs: xu48h7u
kind: story
size: 1
tier: pinned
parent: "2562"
status: open
scope: ["plateau-app:src/backlog-view/proof-tiers.ts", "plateau-app:src/backlog-view/proof-tiers.test.ts"]
dateOpened: "2026-09-07"
preparedDate: "2026-10-01"
preparedAgainstSha: "281118c289a546a1188f982d4a3cf63ea19474b3"
tags: []
deliveryAgent: codex
deliveryAgentReason: "astra graduation trial (epic #3383/#4034/#3906): non-critical per the #4034/#2752 critical-work rule — a tiny (size 1) same-origin/host-allowlist hardening in plateau-app's proof-tiers UI, no daemon/conveyor/gate/statute path in scope; the pre-existing deliveryAgent marker had no reason, which #3840's rule refuses outright — this reason fills that gap; operator-directed, 2026-09-26"
---

# Harden the proof-tiers evidence-link sanitizer against protocol-relative/open-redirect URLs

Prevent untrusted proof evidence from becoming a live cross-origin link. The current sanitizer checks only the parsed scheme against a synthetic base, then returns the original input (we:../plateau-app/src/backlog-view/proof-tiers.ts:55–70). The public renderer interpolates that result into the evidence anchor (we:../plateau-app/src/backlog-view/proof-tiers.ts:115–117). This is a Plateau UI hardening story; preparation changes this card only.

Path convention in this body: `we:../plateau-app/` denotes the sibling Plateau repository inspected at its workspace checkout. Keep the machine-readable scope's existing `plateau-app:` locus: it names the implementation repository, not WE.

## Progress

Premise checked 2026-10-01 against Plateau HEAD `105ad0050967c7ba48f284fa4fce13a2d5ecdc57` and the current WE lane. Plateau's tracked files were clean; untracked operational directories were left alone. The prepare worker brief was read from `main` at we:skills-src/conveyor/prepare-item-worker-brief.md:1–21. The operator explicitly requests stamping and lane verification here, overriding the brief's runner-owned stamping instruction.

- **Old premise:** scheme-only filtering permits cross-host evidence links. **Confirmed by execution:** a read-only Node probe transpiled and imported the actual module, then called `stampTier` and `renderEvidenceLink`. Both `//attacker.example/phish` and `https://attacker.example/x` appeared verbatim in `href`; `javascript:alert(1)` and `data:text/html,x` yielded `href="#"`; `/backlog/3383` survived unchanged. Source: we:../plateau-app/src/backlog-view/proof-tiers.ts:63–70 and :99–117. No sanitizer implementation or test was changed for this probe.
- **Old acceptance drift:** it described direct `safeHref` tests and an empty/non-navigable placeholder. **Correction:** the helper is private, and the existing public-renderer tests assert exactly `href="#"` (we:../plateau-app/src/backlog-view/proof-tiers.ts:63; we:../plateau-app/src/backlog-view/proof-tiers.test.ts:101–138). A hash anchor can navigate within the page; call it the existing fallback, not a disabled control.
- **Missing origin context:** the only base is `https://evidence-url.invalid/`; none of the three render entry points accepts the document URL (we:../plateau-app/src/backlog-view/proof-tiers.ts:66, :115–128). Comparing against that sentinel would reject legitimate deployed absolute URLs. The design below supplies trusted context through the entire render chain.
- **Existing positive fixtures need adaptation:** the link and row tests explicitly expect external `https://ci.example/...` links (we:../plateau-app/src/backlog-view/proof-tiers.test.ts:69–80, :141–153). Preserve those assertions by supplying that origin as trusted test context; also test that it is rejected when another origin is trusted. Do not silently delete the positive coverage.
- **Surface and threat wording:** the module describes itself as pure helpers for future review integration (we:../plateau-app/src/backlog-view/proof-tiers.ts:9–11); a search of Plateau source found no consumers outside its own tests. The observed defect is unsafe outbound navigation, not evidence that a server redirect endpoint exists. This local URL check cannot stop an allowed same-origin server from subsequently redirecting elsewhere.
- **Scope correction:** retain the two Plateau files, including their tests; expand the planned edit within the module to pass origin context through link, row and bundle rendering (we:../plateau-app/src/backlog-view/proof-tiers.ts:115–128). WE's similarly named helper is a separate PR-link renderer (we:scripts/lib/decision-docket-render.mjs:268–269, :295); do not conflate or edit it.

## Design

Use the card's same-origin option: both the HTTP(S) scheme check and equality of parsed URL origins must pass. Compare the full origin (scheme, hostname and effective port), not a hostname substring. Preserve the private sanitizer and the existing `#` fallback, with HTML escaping still applied at the rendering boundary (we:../plateau-app/src/backlog-view/proof-tiers.ts:43–47, :63–70, :117).

Proposed API: add a required trusted `baseUrl: string` argument to `renderEvidenceLink`, `renderProofBundleRow` and `renderProofBundle`, forwarding it through each call to the private sanitizer. The caller supplies the actual document/base URL from trusted application context, never from the evidence payload. This retains the current pure, DOM-free helper boundary (we:../plateau-app/src/backlog-view/proof-tiers.ts:9) and makes same-origin behavior reproducible without inventing a production host allowlist. Update the module's API comments before its implementation. No generic standard or WE API is introduced.

Parse and validate the trusted base as HTTP(S), resolve the candidate with the platform URL parser against that base, then require HTTP(S) and equal origins. Invalid/missing context and malformed URLs fail closed to `#`, rather than trusting the synthetic sentinel. Accepted values retain their original spelling before HTML attribute escaping, as required by the original acceptance. A same-origin protocol-relative URL is allowed; a cross-origin one is rejected. Do not add a blanket ban on all absolute URLs. The trusted base must match the eventual document's effective base so validation and anchor resolution agree.

Scope: product rendering and its integration-style unit tests only, at we:../plateau-app/src/backlog-view/proof-tiers.ts:55–70, :108–128 and we:../plateau-app/src/backlog-view/proof-tiers.test.ts:69–170. Product ownership follows we:docs/agent/platform-decisions.md:143–150 (`#constellation-placement`). No WE implementation or contract change is needed, so the #4289 per-repo split is unnecessary: Plateau owns the complete implementation/test deliverable; WE carries this backlog preparation only. The build wrapper detects mixed declared loci before dispatch (we:scripts/operations/deliver-item-wrapper.mjs:369–380). If implementation later needs a WE contract change, stop and propose independently testable WE predecessor and Plateau consumer scopes with a dependency edge; do not hide a real cross-repo edit from scope.

## MVP

1. Document and thread the trusted base URL through all three render entry points; update existing callers in the scoped tests. Keep tier stamping, badges and minimum-tier gate behavior unchanged (we:../plateau-app/src/backlog-view/proof-tiers.ts:74–105, :140–142).
2. Add same-origin validation beside the current scheme validation, preserving the fallback and escaping boundary.
3. Extend the existing renderer tests with the cases below, including a full-bundle assertion proving context reaches nested evidence links. Keep all existing label, accessibility, escaping, tier and ordering assertions (we:../plateau-app/src/backlog-view/proof-tiers.test.ts:81–100, :141–170).

## Test plan

Extend we:../plateau-app/src/backlog-view/proof-tiers.test.ts:69–170 using a trusted base such as `https://review.example/items/3604`:

- **Capability — RED today:** Reject `//attacker.example/phish` and `https://attacker.example/x` with exactly `href="#"`. Also cover a deceptive hostname suffix, a username/host confusion URL, a changed port and HTTP versus HTTPS on the same hostname.
- **Preservation — passes on both:** Preserve `/backlog/3383`, a path-relative URL, a fragment, `https://review.example/x` and `//review.example/x`; include default-port normalization. Assert raw attribute spelling, with existing HTML escaping preserved. Mutation proof: forcing all candidates to `#` must fail these positive cases.
- **Preservation — passes on both:** Retain JavaScript/data and mixed-case/whitespace scheme cases (we:../plateau-app/src/backlog-view/proof-tiers.test.ts:101–129); add malformed input. Mutation proof: returning raw input before scheme validation must fail the dangerous-scheme assertions.
- **Capability — RED today:** Reject invalid/non-HTTP or missing base context, and parser-normalized cross-host forms such as backslashes and leading whitespace. Expected results derive from parsed origin, not string-prefix matching.
- **Capability — RED today:** Use two different trusted origins with the same absolute evidence URL: allowed in one, rejected in the other. This catches a hardcoded fixture host or synthetic-base comparison. Existing `ci.example` positives must still pass with matching trusted context.
- **Capability — RED today:** Render a full bundle containing allowed and rejected evidence across provenance tiers; assert each anchor's own raw `href`, label and accessible name, not merely that one fallback exists somewhere. Use the existing happy-dom environment (we:../plateau-app/vitest.config.ts:14–16) to inspect anchors and their resolved origins without network requests.

Run `npx vitest run proof-tiers` from a writable Plateau implementation lane, followed by that repository's required verification. This preparation does not execute a mutation or write tests in the primary Plateau checkout.

## Proof plan

At implementation time, capture a red/green run: add the cross-host renderer assertions before the sanitizer fix, confirm they fail for live outbound `href` values, then run the same suite green after the fix. Record Plateau base/candidate SHAs, commands, exit codes and the relevant assertion output.

Perform the requested mutation in the implementation lane: remove only the origin-equality clause while keeping scheme validation, confirm both protocol-relative and absolute cross-origin cases fail, restore the clause, and rerun green. Also ensure the full-bundle test fails if origin forwarding is removed. This proves both the guard and its integration, not just a helper detached from rendering.

The acceptance boundary is the emitted/DOM-parsed anchor before navigation. The preparation probe recorded above demonstrates the current defect; it is not proof of the future fix, a deployed review route, or server-side redirect protection. On eventual review-surface integration, repeat the cases with its actual effective document base.

## Done when

1. The public renderers neutralize cross-origin protocol-relative and absolute evidence to `#` while preserving same-origin relative and absolute links with trusted context.
2. Existing dangerous-scheme, escaping, accessibility, label and bundle-order coverage remains green; invalid context fails closed.
3. The focused Plateau suite and required repo checks pass; removing the new origin check demonstrably fails the regression tests.
4. Only the two scoped Plateau implementation/test files are needed for delivery; any newly discovered consumer or contract work is explicitly re-scoped before building.

## Follow-ups

- Review-surface integration must provide the real trusted effective base URL and exercise browser navigation semantics; do not infer a deployed surface from helper tests (we:../plateau-app/src/backlog-view/proof-tiers.ts:9–11).
- A future external artifact-host allowlist or protection against redirects originating on an allowed server needs separate requirements and proof. This card implements same-origin admission, not redirect-chain inspection.
- Testing lesson: test through the exported render chain, distinguish literal `href` attributes from resolved DOM properties, and mutate only the guard under test. Keep these lessons here; no shared agent documentation changes are required.

## Preparation verification

`node we:scripts/backlog.mjs prepare-stamp 3604` recorded the preparation date and WE base SHA; status remains open. The focused card check is clean with no warnings, and `git diff --check` passes. `node we:scripts/verify-lane.mjs` passed: no related Vitest test files were selected for this markdown-only change, and its standards gate reported zero errors with repository-wide warnings. The final text is rechecked after correcting the test-plan classifications. The executable premise probe above ran against the actual Plateau module; implementation red/green and mutation proofs remain future delivery work.
