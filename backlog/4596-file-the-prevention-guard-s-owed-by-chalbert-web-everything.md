---
bornAs: xqfyg17
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4595-automatically-postmortem-every-builder-outcome-using-the-can.md", "we:reports/data/2026-09-30-builder-postmortem.json", "we:scripts/lib/report-snapshot.mjs", "we:scripts/lib/__tests__/report-snapshot.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs", "we:scripts/__tests__/report-snapshot-gate.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "ac2e9dc86bcaf9c5f27bcc5a2091e11de598e967"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3089's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4595-automatically-postmortem-every-builder-outcome-using-the-can.md:8` — Add a check:standards rule that any `open` story card has a `# title` and either a Done-when section or a `relatedReport` that the prepare readiness check verifiably resolves. Alternatively give the card a short body with a title and Done-when pointing to the report's proof plan.
2. `we:reports/data/2026-09-30-builder-postmortem.json:1` — Add a check:standards rule, or a pre-commit secret and absolute-home-path scan, over `we:reports/data/*.json`. Generate these snapshots through the same scrub function the scorecard store uses.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3089@d703d5fd68f99f5fdb23eb7ea61b3e8e4e9dfad3

## Progress

Preparation research (2026-10-02): the original scope contained only the two reviewed artifacts, and treated a bodyless story and a raw snapshot as the prevention seams. The artifact citations above identify the historical review locations, not implementation entry points.

- **Corrected card premise:** `we:backlog/4595-automatically-postmortem-every-builder-outcome-using-the-can.md` still contains only frontmatter and a report pointer. This is supported, not inherently malformed: `we:src/_data/backlog.js#derive` and its report-loading branch derive the displayed content from the report. `we:scripts/check-standards-rules.mjs#validateBacklogItem` checks report existence. The report already has “MVP deliverables and proof plan” in `we:reports/2026-09-30-builder-postmortem.md`. Use the review's explicit short-body alternative: give #4595 its own title, digest and concrete Done when that points to those obligations. A new universal open-story rule is unnecessary for this accepted alternative.
- **Corrected snapshot premise:** a recursive JSON probe found 47 strings containing absolute home paths, all under `builds[].eventsSummary[].commandSummary`, in `we:reports/data/2026-09-30-builder-postmortem.json`. Its top-level keys are `method`, `builds`, `verify`, and `dispatch`. No tracked snapshot generator was found by searching for the attachment's basename in `we:scripts/`. This is a historical attachment, not the live scorecard store.
- **Missing enforcement:** the publish sweep in `we:scripts/check-standards.mjs` (section 6f-i) walks only backlog and agent-memory markdown and explicitly excludes reports. Its Rust accelerator also owns a separate walk. The new JSON scan must run independently of that accelerator so either backend still checks attachments.
- **Scrub correction:** `we:scripts/conveyor/run-scorecard-store.mjs#validateScorecard` applies `scrubReasons` only to deduction evidence. `we:scripts/lib/secret-scrub.mjs#scrubReasons` also rejects source citations, code and long hex hashes, while `scrubPublish` deliberately permits those publication artifacts. Blindly applying the scorecard evidence policy to the entire snapshot would discard useful source hashes and command evidence. Reuse the same shared scrub module's publication detector plus a narrow home-path check; do not change the scorecard's policy.
- **Corrected scope:** retain the two artifacts; add a reusable JSON publication helper, standards-gate wiring, and matching tests. The planned helper tests cover both artifact repairs; the existing scoped-scan test and planned gate integration test cover the gate source. The helper is new; all other implementation references here are research evidence, not additional edit targets. The owed work is still present; no already-delivered conclusion is supported.

## Design

Implement a pure JSON publication helper in `we:scripts/lib/report-snapshot.mjs`, backed by `we:scripts/lib/secret-scrub.mjs#scrubPublish`. Traverse object keys and string values, including nested arrays, and report credential findings and absolute home paths (POSIX user homes, tilde homes, Windows user homes, and their file-URL forms). Parse JSON before inspection so escaped separators cannot bypass detection. Findings carry the attachment path, JSON pointer and reason category, never the offending value. Malformed JSON is a hard error.

Expose validation and a deterministic sanitizing serialization entry point from the helper. For the serializer, replace unsafe string values with a fixed redaction marker, refuse unsafe object keys, validate the resulting document, then return JSON text. Do not rewrite the input object. Preserve safe strings, source hashes, source line numbers, identifiers, counts, timings and token totals. This is a publication boundary, not an expansion of the scorecard evidence scrub or an operational data store.

Add a separate hard-error scan of `we:reports/data/*.json` to `we:scripts/check-standards.mjs`, calling the helper. Keep this JS scan outside the existing Rust-or-JS markdown branch. Respect the existing local changed-file selection; full mode scans every attachment in that directory. A selected existing malformed or unreadable attachment must fail, not silently disappear. Deleted files are skipped using the gate's existing file-selection convention.

For #4595, take the review's permitted artifact repair instead of changing all open-story policy. Retain its report pointer and all metadata, add its own H1 and prose digest, and add a Done when section summarizing the report's replay, adversarial, filing/idempotency and live-graduation obligations with a precise report section reference. Do not imply that adding this body prepares or delivers #4595's implementation.

## MVP

1. **Must 1 — card repair:** add the short body and meaningful Done when to `we:backlog/4595-automatically-postmortem-every-builder-outcome-using-the-can.md`, retaining the existing report link and automation goal.
2. **Must 2 — publication boundary:** implement validation and sanitizing serialization in `we:scripts/lib/report-snapshot.mjs`; regenerate `we:reports/data/2026-09-30-builder-postmortem.json` through that helper from the existing attachment. Preserve structural and quantitative evidence, and visibly redact unsafe prose rather than quietly deleting records.
3. **Must 3 — gate:** wire the attachment validator into `we:scripts/check-standards.mjs` in both full and locally scoped execution. The new scan must run whether or not the Rust markdown scanner is available.
4. **Must 4 — regression coverage:** add `we:scripts/lib/__tests__/report-snapshot.test.mjs` and `we:scripts/__tests__/report-snapshot-gate.test.mjs`; extend `we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs` for the new scan's scope wiring.

## Done when

- Must 1: a fixture-backed assertion reads #4595 and confirms its own H1, nonempty digest, substantive Done when, and preserved existing report target; the target report and cited proof section exist.
- Musts 2 and 4: the helper suite passes on the repaired committed attachment, proves sanitization is idempotent and leaves all numeric evidence and source hashes unchanged, and rejects a synthetic nested credential or home path before sanitization.
- Musts 3 and 4: the gate integration suite demonstrates a nonzero process exit for a selected unsafe JSON attachment, then zero attachment findings after repair; a safe JSON fixture passes. The same unsafe fixture fails in full mode. Diagnostics never include its secret or username.
- All Musts: the affected suites and `npm run check:standards` pass. Record separate pre-existing failures if the repository gate is not green; do not call an unrelated failure proof of this guard.

## Test plan

- `we:scripts/lib/__tests__/report-snapshot.test.mjs` covers nested strings and keys, arrays, escaped JSON paths, synthetic token formats already recognized by the shared detector, home-path variants, malformed JSON, safe repo-qualified citations, safe source hashes and URLs, redaction determinism, input immutability, and unsafe-key refusal. Include the two real artifact assertions from Done when. Capture only field locations/counts for unsafe historical evidence, never raw private values in test output.
- `we:scripts/__tests__/report-snapshot-gate.test.mjs` uses disposable checkout fixtures and executes the real gate entry point. Check exit status and attributed findings for full mode, selected JSON, an unrelated changed file, a deleted attachment, and malformed JSON. Exercise the attachment scan with the markdown accelerator available and unavailable; it must not depend on that branch's result. Assert a nonzero test/fixture count so empty discovery cannot pass.
- `we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs` pins use of the existing changed-file context for the new directory scan. This source-level assertion supplements the behavioral integration suite.
- Run the three affected Vitest suites through the repository's admitted test interface. No runtime feature or rendered template changes are involved.

## Proof plan

1. Before implementation, retain a local structural/quantitative baseline of the historical attachment: record counts, all numeric leaves, source hashes and line references. Record the observed 47 command-summary home-path hits without printing their contents.
2. Establish RED with the gate integration fixture: inject a synthetic home path and synthetic credential into nested JSON, execute the current gate, and show that it has no attachment finding. With the new guard enabled, the same fixture must produce an attributed hard error and nonzero exit. Disable only the new scan in a disposable copy and show the regression assertion fails again.
3. Serialize the historical attachment with the shared helper, validate the resulting JSON, compare against the retained baseline, and show zero unsafe-field findings with unchanged quantitative evidence. Show the repaired #4595 body and verify its report target and proof-section reference.
4. Run affected tests and the full standards gate, recording commands, selected test counts and process exits. Restore every disposable mutation and confirm the final implementation diff contains only the declared scope. This preparation does not perform or claim these implementation proofs.

## Follow-ups

- #4595 owns automated postmortem production. Its eventual snapshot/export callers should use this helper before publishing attachments; this item does not implement terminal scheduling, parser changes or baseline analysis.
- A universal story-body/readiness rule is outside this MVP because the review explicitly allows repairing #4595. Report pointers remain supported.
- The guard is limited to JSON attachments under `we:reports/data/`; markdown-report privacy scanning and history cleanup are separate work. No real credential was established by the preparation probe, and a home-path count is not evidence of credential exposure.
