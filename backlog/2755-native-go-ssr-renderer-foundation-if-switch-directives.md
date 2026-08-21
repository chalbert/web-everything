---
bornAs: x2evydc
kind: story
size: 5
parent: "2356"
status: open
scope:
  - frontierui:plugs/webdirectives/ssr/go/
  - frontierui:.github/workflows/ci.yml
scopeRationale: "Greenfield: stands up a whole new language subtree (frontierui:plugs/webdirectives/ssr/go/) from scratch — a genuinely dir-spanning build whose exact file set is created here, so a file-level enumeration would under-scope and breach the lease. Mirrors the .NET foundation #2383 scope. The only shared-file touch is frontierui:.github/workflows/ci.yml (adds the Go conformance-harness CI step, alongside the existing JVM step)."
dateOpened: "2026-07-28"
tags: []
---

# Native Go SSR renderer foundation + if/switch directives

Stand up the greenfield Go build subtree (frontierui:plugs/webdirectives/ssr/go/) for the native SSR renderer — source parse, top-level template-is dispatch, normative space-padded marker wrapping and the shared helpers — plus the Go-side cross-language conformance harness that reads we:conformance-vectors/webdirectives-ssr.vectors.json and byte-compares per the #2354 contract, wired into go test and repo CI. Includes if + switch to prove the pipeline end to end: it passes the five if/switch/state-tokens vectors byte-for-byte. Third instance of the JVM (#2368) and .NET (#2383) foundations; fork-free (#2030 black box). The per-directive slices ride on it.

Detail carried over from the original digest: the parser is `golang.org/x/net/html` (mirroring the Node
happy-dom strategy), the helpers are `resolvePath` / mustache `interpolate` / `renderMarkerOptions`, `if` and
`switch` share `interpolate` `innerHtml` with their resume tokens riding the generic `renderMarkerOptions`,
and the Node reference oracle is `frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts`.

## Design

### Mirror the .NET foundation (#2383), which mirrored the JVM one (#2368)

Two greenfield language subtrees already exist and the shape is settled — do not re-derive it. The Go slice
is the third instance of the same six pieces:

| piece | JVM / .NET precedent | Go |
|---|---|---|
| renderer + dispatch loop | `frontierui:plugs/webdirectives/ssr/net/src/NetServerRenderer.cs` | `frontierui:plugs/webdirectives/ssr/go/` |
| shared helpers (`resolvePath`, mustache `interpolate`, `renderMarkerOptions`) | `frontierui:plugs/webdirectives/ssr/net/src/Renderers.cs` | ditto |
| source HTML parser | `frontierui:plugs/webdirectives/ssr/net/src/HtmlParse.cs` (hand-rolled, zero-dep) | `golang.org/x/net/html` per this item |
| vector reader | `frontierui:plugs/webdirectives/ssr/net/src/Json.cs` | `encoding/json` (stdlib) |
| harness runner | `frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs` + `tests/ConformanceTests.cs` | `go test` |
| build task + CI step | `frontierui:plugs/webdirectives/ssr/net/build.sh`, wired in `frontierui:.github/workflows/ci.yml` | `build.sh` + a sibling CI step |

**`build.sh` owns vector resolution**, in this exact precedence (copy it verbatim from the .NET one): explicit
first CLI arg → `$WEBDIRECTIVES_SSR_VECTORS` → the sibling `../webeverything` checkout (the CI layout,
`$GITHUB_WORKSPACE/{frontierui,webeverything}`). It exports `WEBDIRECTIVES_SSR_VECTORS` for the test to read
and exits 2 with a named error when the file is absent. Do **not** put path resolution in the Go test.

**The CI step goes in the `test` job**, beside the two that exist (`JVM SSR conformance harness` →
`bash plugs/webdirectives/ssr/jvm/build.sh`, `.NET SSR conformance harness` → the `net` twin), preceded by a
`setup-go` action mirroring the `setup-java` / `setup-dotnet` blocks. Putting it in `test` rather than a new
job is what makes a wire-format drift fail the **required** check.

### One deviation from the precedent, deliberately

The JVM and .NET slices hand-rolled a zero-dependency parser rather than take the library the item named
(AngleSharp), and #2383's README records why. This item names `golang.org/x/net/html` explicitly, and its
`scopeRationale` treats the subtree as greenfield — so a `go.mod` with one non-stdlib dependency is the
expected outcome here, not a drift from the precedent. `#2030` makes the parser a conforming black box either
way; state the choice in the Go README the way `frontierui:plugs/webdirectives/ssr/net/README.md` states its
own.

### What is graded, and what "vectors this slice does not own" means

`we:conformance-vectors/webdirectives-ssr.vectors.json` holds **10** vectors across five directives. This
foundation slice implements `if` + `switch`, which is exactly **five** of them:

- `webdirectives-ssr/if/true-branch-emitted`
- `webdirectives-ssr/if/false-branch-empty-markers`
- `webdirectives-ssr/switch/active-case-only`
- `webdirectives-ssr/state-tokens/if-condition-resume-token`
- `webdirectives-ssr/state-tokens/switch-value-resume-token`

The other five (`for-each` ×3, `resource-loader`, `defer`) belong to the per-directive slices that ride on
this foundation, and per the .NET README's rule are **skipped by the harness, not failed**. Getting that
skip-vs-fail distinction right matters: a harness that fails on unowned vectors makes the CI step red from
day one and the slice cannot land.

### The grading protocol is pinned, and two clauses bite a Go port

`we:conformance-vectors/webdirectives-ssr-harness-contract.md` is normative. Two clauses to read before
writing any comparison code:

- **Strict byte/codepoint equality**, UTF-8 both sides, no trimming and no normalization — not a DOM diff,
  not whitespace-insensitive. Marker space-padding and attribute-quote style are part of the oracle.
- **Report ALL failing ids**, not the first: the run's result is
  `{ passed: [...], failed: [{ id, got, want }] }` or equivalent, and a renderer is conformant iff `failed`
  is empty.

And the one latent trap: **`key-hash` folds UTF-16 code units, not UTF-8 bytes** (the contract's *Reference*
section). Go strings are UTF-8 and `range` yields runes, so the natural port is wrong for any key above
U+007F. Every current vector uses ASCII-only keys so this is invisible today — and `for-each` is not in this
slice anyway — but the helper lands here, so implement it against UTF-16 code units (astral characters as a
surrogate pair) or leave it unimplemented rather than shipping a plausible-looking wrong one.

## Done when

1. `bash frontierui:plugs/webdirectives/ssr/go/build.sh` (run from the `frontierui` root, with the sibling
   `webeverything` checkout present) exits 0, and its harness reports all **five** `if` / `switch` /
   `state-tokens` vector ids listed above as passed — byte-for-byte. It does not exist before, so it fails
   trivially before and passes after. (Tier 1.)
2. The same harness reports the other five vector ids as **skipped**, not failed, and its output distinguishes
   the two. A harness that cannot tell "not implemented in this slice" from "wrong bytes" fails this
   criterion. (Tier 1.)
3. A deliberate one-byte mutation — drop a single space from one open marker's padding in the Go renderer —
   turns that `build.sh` run non-zero and names the affected vector id. Run once by hand, recorded in the PR body.
   This is what proves the comparison is byte-exact rather than whitespace-tolerant. (Tier 1.)

   *Known limit, carried over deliberately:* this is a one-time manual act, not a persisted regression test, so
   a future refactor that quietly loosens the byte comparison would not be caught by CI. That gap is
   pre-existing and shared — neither `frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs` nor
   the JVM twin carries a mutation-based test either. Closing it properly means one change across all three
   renderers, which is a separate item; do not widen this slice to do it, and do not silently drop the manual
   proof because it is only manual.

4. `frontierui:.github/workflows/ci.yml` runs the Go harness inside the **`test`** job (not a new job), with a
   `setup-go` step beside the existing `setup-java` / `setup-dotnet` blocks — so a drift fails the required
   check. One read of the `test` job's step list. (Tier 2.)
5. `frontierui:plugs/webdirectives/ssr/go/README.md` exists and records the parser choice and the
   implemented-vector subset, in the shape `frontierui:plugs/webdirectives/ssr/net/README.md` uses. (Tier 2.)

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — Verified against the live repo: frontierui:plugs/webdirectives/ssr/go/ does not exist yet (truly greenfield, matches the card's framing), and both precedents it claims to mirror (frontierui:plugs/webdirectives/ssr/net/, frontierui:plugs/webdirectives/ssr/jvm/) are merged and present with the exact shared-helper/dispatch/harness shape the card describes.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The Done-when list requires build.sh to actually run the full source-to-render-to-byte-compare round trip against we:conformance-vectors/webdirectives-ssr.vectors.json, which is the real seam between the WE-owned vector contract and the FUI-owned renderer, not a mocked or partial check.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when #3's byte-mutation proof is a one-time manual act ('run once by hand, recorded in the PR body'), not a persisted automated test. Verified this gap is also true of the merged .NET precedent (frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs has no mutation-based regression test) and the JVM precedent, so a future refactor that quietly loosens byte comparison would go uncaught by CI in any of the three renderers. This is a pre-existing pattern inherited from #2383/#2368, not introduced by this card, so it is a carve-out rather than a blocker here.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when #2 explicitly requires the harness to distinguish 'skipped' from 'failed' for the five vectors this slice does not own, matching the .NET precedent's Report.Skipped/Report.Failed split (frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs), so a silent-skip-as-pass bug would be visible rather than merely occurring.

**Corrections recommended:**

- none — the preparation held up as written.

_Recorded through the declared `review-prep` operation._
