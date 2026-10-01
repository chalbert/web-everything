---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xis0x3v-sending-a-review-human-pr-back-for-changes-leaves-it-with-no.md", "we:backlog/xe8y12n-a-pr-with-no-review-label-after-a-ci-heal-is-re-armed-never.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — A backlog lint that checks that symbols or strings named in a card body (e.g. 'unsupported-pair') appea… (from chalbert/web-everything#3385 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xis0x3v-sending-a-review-human-pr-back-for-changes-leaves-it-with-no.md:5` — A backlog lint that checks that symbols or strings named in a card body (e.g. 'unsupported-pair') appear in a file listed in scope:.
2. `we:backlog/xis0x3v-sending-a-review-human-pr-back-for-changes-leaves-it-with-no.md:14` — Add a check:standards rule for cards that remove or auto-resolve a gate label (review:human, a hold, or a refusal). It would require a Must line stating the gate is re-required, plus a named test.
3. `(cited file withheld: not a plain path)` — A pre-merge hook or CI check that parses the PR description for enumerated items and verifies the file count or expected filenames match.
4. `we:backlog/xe8y12n-a-pr-with-no-review-label-after-a-ci-heal-is-re-armed-never.md:17` — A lint rule for backlog markdown files that flags known boilerplate or default template text left unmodified.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3385@145a2696adc0e7e546af4b4a378b4df8b47aec36

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
