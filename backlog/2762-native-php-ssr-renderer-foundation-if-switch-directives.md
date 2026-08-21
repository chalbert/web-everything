---
bornAs: xofezqc
kind: story
size: 5
parent: "2357"
status: open
scope:
  - frontierui:plugs/webdirectives/ssr/php/
  - frontierui:.github/workflows/ci.yml
scopeRationale: "Greenfield: stands up a whole new language subtree (frontierui:plugs/webdirectives/ssr/php/) from scratch — a genuinely dir-spanning build whose exact file set is created here, so a file-level enumeration would under-scope and breach the lease. Mirrors the .NET foundation #2383 scope. The only shared-file touch is frontierui:.github/workflows/ci.yml (adds the PHP conformance-harness CI step, alongside the existing JVM step)."
dateOpened: "2026-07-28"
tags: []
---

# Native PHP SSR renderer foundation + if/switch directives

Stand up the greenfield PHP subtree (frontierui:plugs/webdirectives/ssr/php/) for the native SSR renderer — source parse, top-level template-is dispatch, normative space-padded marker wrapping, shared helpers — plus the PHP-side conformance harness that grades it byte-for-byte against we:conformance-vectors/webdirectives-ssr.vectors.json per the #2354 contract, wired into the frontierui `test` check. Ships `if` + `switch` to prove the pipeline end-to-end; the fourth language beside the JVM, .NET and Python siblings, mirroring the Node reference oracle. Fork-free build (#2030 black box). The foundational slice B/C ride on.

The parser choice (DOMDocument/libxml vs. hand-rolled) is a conforming black box per #2030, not a fork; details and the sibling-subtree survey are in *Design* below.

## Design

**Copy the shape, not the code.** Three sibling language subtrees already exist under
frontierui:plugs/webdirectives/ssr/ and the PHP one must be recognisably the fourth, not a new pattern:

| subtree | build/test entry | how CI reaches it |
| --- | --- | --- |
| frontierui:plugs/webdirectives/ssr/jvm/ | `build.sh` (plain javac) | a named `JVM SSR conformance harness` step in frontierui:.github/workflows/ci.yml |
| frontierui:plugs/webdirectives/ssr/net/ | `build.sh` → `dotnet test` | a named `.NET SSR conformance harness` step in the same job |
| frontierui:plugs/webdirectives/ssr/python/ | `harness.py` + `tests/` (unittest) | a **vitest bridge** (frontierui:plugs/webdirectives/ssr/python/__tests__/pythonReferenceRenderer.conformance.test.ts) that rides the existing `npm run test:unit` step — no extra CI step at all |

**Take the .NET layout and the Python CI route — and the layout half is not optional.** Two already-open
sibling slices ride this foundation and both pin the file names in their `scope`:
`we:backlog/2763-native-php-ssr-renderer-resource-loader-defer-directives.md` and
`we:backlog/2767-native-php-ssr-renderer-for-each-directive-keyed-empty-count.md` are `blockedBy: ["2762"]`
and both declare `frontierui:plugs/webdirectives/ssr/php/src/ServerRenderer.php` +
`frontierui:plugs/webdirectives/ssr/php/tests/ConformanceTest.php`. That is the .NET subtree's shape
(`net/src/ServerRenderer.cs` is the swappable seam interface, `net/src/NetServerRenderer.cs` the impl,
`net/tests/ConformanceTests.cs` the graded suite). **Scaffold those exact paths** — inventing a Python-style
flat module here would silently invalidate both sibling cards' scope and break the dispatcher's overlap
prediction. So:

- `php/src/ServerRenderer.php` — the swap seam, a pure `(source, data) -> string`, mirroring
  frontierui:plugs/webdirectives/ssr/ServerRenderer.ts and the .NET/JVM `ServerRenderer` ports.
- `php/src/PhpServerRenderer.php` (or the class the seam names) — the native impl.
- `php/tests/ConformanceTest.php` — the PHPUnit suite the siblings will add cases to.
- `php/harness.php` — the standalone #2354 grading entry point, mirroring
  frontierui:plugs/webdirectives/ssr/python/harness.py.

**The CI route is the Python one**, because PHP is interpreted and has no compile step: a **vitest bridge**
that shells `php` and self-skips when neither `php` nor the sibling WE checkout is present
(`it.skipIf(!canRun)`, exactly as the Python bridge does) rides the existing `npm run test:unit` and needs no
new workflow step. Whether a named `PHP SSR conformance harness` step + `shivammathur/setup-php` is *also*
wanted in frontierui:.github/workflows/ci.yml is the one CI call to make at build time — note ubuntu-latest
already ships a PHP CLI (unverified here; the self-skip is the fallback either way), and the item's `scope`
already reserves the workflow file.

**The vector contract is fixed and WE-owned — do not re-derive it.** The suite is
we:conformance-vectors/webdirectives-ssr.vectors.json (a generated, committed projection; a vitest drift test
keeps it in step with the TS source). It carries **10** vectors today, ids of the form
`webdirectives-ssr/<directive>/<case>`. The five this slice must pass are the `if`, `switch` and
state-token ones: `webdirectives-ssr/if/true-branch-emitted`, `webdirectives-ssr/if/false-branch-empty-markers`,
`webdirectives-ssr/switch/active-case-only`, `webdirectives-ssr/state-tokens/if-condition-resume-token`,
`webdirectives-ssr/state-tokens/switch-value-resume-token`. Grading is **strict codepoint equality**, UTF-8 both
sides, no trimming or normalization — the protocol in we:conformance-vectors/webdirectives-ssr-harness-contract.md.

**The renderer surface to mirror.** frontierui:plugs/webdirectives/ssr/python/webdirectives_ssr/renderer.py is
the smallest complete reference: a hand-rolled `parse`/`serialize`/`inner_html`, then `resolve_path`,
`interpolate`, `js_truthy`, `djb2_key_hash`, and per-directive `_render_*_inner` helpers behind one public
`render(source, data) -> str`. The PHP port needs the same one-call public surface behind the
`ServerRenderer` seam above, so `harness.php` is a thin loop, and the same `djb2` key-hash — that hash is
wire-format, not an implementation detail. (`we:backlog/2767-native-php-ssr-renderer-for-each-directive-keyed-empty-count.md`
already records the PHP-specific subtlety: the hash input must be re-encoded to UTF-16 code units before
hashing, since PHP strings are raw UTF-8 bytes.)

**Vector-path resolution is already a solved convention — reuse it verbatim.** Both `build.sh` files resolve the
vectors as: explicit first CLI arg → `$WEBDIRECTIVES_SSR_VECTORS` → the sibling `../webeverything` checkout (the
CI layout: the workflow checks WE out beside frontierui). Anything else re-invents a solved problem and breaks
in a bare lane clone.

**The parser is a black box (#2030), so DOMDocument is a free choice, not a fork** — but note every existing
sibling hand-rolled its parser precisely because the byte-exact serializer is the hard part, and libxml
normalizes markup (attribute quoting, void-element closing, entity handling) in ways strict byte-comparison
will expose. Budget for that rather than assuming DOMDocument round-trips.

## Done when

- **Tier 1** — running `harness.php` from the frontierui checkout against the WE vector export
  (`php plugs/webdirectives/ssr/php/harness.php` plus the vectors path, per the resolution order above) exits
  **0** with `failed: []` for the five `if` / `switch` / state-token vector ids named above, byte-for-byte.
  Today the command does not exist, so it fails before and passes after.
- **Tier 1** — the frontierui required `test` check enforces it: `npm run test:unit` in frontierui runs a new
  bridge under frontierui:plugs/webdirectives/ssr/php/__tests__/ that drives both the language-native PHP suite
  and the harness, and self-skips (never silently passes) when `php` or the sibling WE checkout is absent —
  the same `it.skipIf(!canRun)` shape as
  frontierui:plugs/webdirectives/ssr/python/__tests__/pythonReferenceRenderer.conformance.test.ts.
- **Tier 2** — the harness reports honestly on the vectors this slice does NOT implement: the five `for-each` /
  `resource-loader` / `defer` vectors are reported as skipped-by-name, never counted as passes and never
  silently absent from the output. `harness.php` emits its report as JSON on stdout **unconditionally** —
  matching frontierui:plugs/webdirectives/ssr/python/harness.py; there is no `--json` flag convention to
  mirror, so do not invent one. Reading that stdout once proves the criterion.
- **Tier 2** — the scaffold matches what the blocked slices already declare:
  `frontierui:plugs/webdirectives/ssr/php/src/ServerRenderer.php` and
  `frontierui:plugs/webdirectives/ssr/php/tests/ConformanceTest.php` both exist after this slice, so
  `we:backlog/2763-native-php-ssr-renderer-resource-loader-defer-directives.md` and
  `we:backlog/2767-native-php-ssr-renderer-for-each-directive-keyed-empty-count.md` can be built against their
  stated `scope` with no re-scoping.
- **Tier 2** — zero runtime Composer dependency: frontierui:plugs/webdirectives/ssr/php/ contains no
  `require`/`autoload` of a third-party package for the renderer or its parser or its JSON reader (only a test
  runner may be a package), matching the stated zero-dependency posture of the JVM, .NET and Python siblings.
- **Tier 3** — the vectors are consumed, never copied. Read the new subtree: no committed duplicate of
  we:conformance-vectors/webdirectives-ssr.vectors.json, and vector-path resolution follows the existing
  arg → `$WEBDIRECTIVES_SSR_VECTORS` → sibling-checkout order.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build — wording adjusted by the
  driver from the reviewer's template, which tripped the `unverified prerequisite` non-batchable lint as a
  passing mention) — Every specific factual claim I could check held up: the 10 vector ids and exactly the 5 named for this slice (we:conformance-vectors/webdirectives-ssr.vectors.json), the arg → $WEBDIRECTIVES_SSR_VECTORS → sibling-checkout resolution order (matches frontierui:plugs/webdirectives/ssr/jvm/build.sh and frontierui:plugs/webdirectives/ssr/net/build.sh verbatim), the renderer function surface to mirror (parse/serialize/inner_html/resolve_path/interpolate/js_truthy/djb2_key_hash/_render_*_inner all present in frontierui:plugs/webdirectives/ssr/python/webdirectives_ssr/renderer.py), and the claim that every existing sibling hand-rolled its HTML parser (confirmed: frontierui:plugs/webdirectives/ssr/jvm/src/main/java/.../HtmlParse.java, frontierui:plugs/webdirectives/ssr/net/src/HtmlParse.cs, and Python's hand-rolled parse/serialize). The one soft premise (ubuntu-latest shipping a PHP CLI, so no shivammathur/setup-php step is strictly required) is explicitly flagged as unverified and deferred to build time with a legible self-skip fallback, rather than silently assumed.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:backlog/2763-native-php-ssr-renderer-resource-loader-defer-directives.md and we:backlog/2767-native-php-ssr-renderer-for-each-directive-keyed-empty-count.md are both open, both blockedBy ["2762"], and both hardcode scope: frontierui:plugs/webdirectives/ssr/php/src/ServerRenderer.php and frontierui:plugs/webdirectives/ssr/php/tests/ConformanceTest.php — a class-based renderer plus a PHPUnit conformance-test file, matching the base card's own now-superseded 'wired into the PHPUnit suite' framing. This preparation pivots the design to mirror frontierui:plugs/webdirectives/ssr/python/ instead: a functional render(string,mixed):string entry point, a standalone harness.php, and a vitest bridge under php/__tests__/ — and never mentions or reconciles the two sibling cards' file-path assumptions.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The Design section never names #2763/#2767 as consumers of the subtree it is scaffolding, even though both are backlog-declared (not code-import) consumers found via a plain grep for the scope path — the same gap the interface risk above describes, from the 'did the prep search for downstream dependents' angle.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Tier 1 explicitly requires the vitest bridge to self-skip (never silently pass) when php/the WE sibling are absent, and Tier 2 explicitly requires unimplemented-directive vectors to be reported skipped-by-name, never counted as passes or silently dropped — mirroring the real Skipped-bucket precedent I found in frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs and frontierui:plugs/webdirectives/ssr/jvm/src/test/java/.../ConformanceHarness.java.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Same mechanism as decorative-guard above: skip is required to surface distinctly from pass at both the CI-bridge level and the per-vector harness-report level, so a slice gap can't present as green.

**Corrections applied by this review:**

- The Tier 2 done-when's '--json read of the harness output' has no sibling precedent to point to: we:conformance-vectors/webdirectives-ssr-harness-contract.md's report shape is unconditional {passed, failed}, frontierui:plugs/webdirectives/ssr/python/harness.py emits plain JSON to stdout with no flag at all, and frontierui:plugs/webdirectives/ssr/jvm/.../ConformanceHarness.java prints human-readable PASS/SKIP/FAIL text, not JSON — the card should say harness.php emits JSON unconditionally (matching harness.py) rather than implying an existing --json convention it would be mirroring.

The preparation's factual claims (vector ids/count, resolution order, sibling parser precedent, renderer function surface, CI structure, zero-dep posture) all check out precisely against the live frontierui and webeverything repos, but it silently reverses the PHPUnit-centric design the original card and two already-open sibling cards were scoped against, without reconciling that seam.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** Both open findings accepted and applied. The **interface/consumer** finding
was correct and was the important one: `#2763` and `#2767` are `blockedBy: ["2762"]` and both pin
`frontierui:plugs/webdirectives/ssr/php/src/ServerRenderer.php` +
`frontierui:plugs/webdirectives/ssr/php/tests/ConformanceTest.php` in `scope` — verified on disk. The Design now
keeps the **.NET file layout** (seam interface + impl + PHPUnit suite, the shape those cards were scoped
against) while taking the **Python CI route** (a self-skipping vitest bridge on the existing `test:unit`,
because PHP has no compile step), and a new tier-2 criterion pins that both sibling-declared paths exist after
this slice. The `--json` correction is applied verbatim: `harness.php` emits JSON unconditionally, mirroring
frontierui:plugs/webdirectives/ssr/python/harness.py, with no invented flag.
