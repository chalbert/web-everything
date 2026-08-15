---
kind: story
size: 3
parent: "2360"
status: open
blockedBy: ["2383"]
dateOpened: "2026-07-10"
tags: []
scope:
  - frontierui:plugs/webdirectives/ssr/net/src/NetServerRenderer.cs
  - frontierui:plugs/webdirectives/ssr/net/src/Renderers.cs
  - frontierui:plugs/webdirectives/ssr/net/src/ConformanceHarness.cs
  - frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs
---

# Native .NET SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the .NET renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash directly — C# string is natively UTF-16 code units (like the JS oracle), so no extra re-encoding step is needed for the normative UTF-16-code-unit hash input (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md, so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).

## Verification against the live tree (2026-08-15, prepared)

- **`blockedBy: ["2383"]` is satisfied in code but NOT in backlog status.** The foundation slice (#2383 —
  `NetServerRenderer`/`Renderers`/`HtmlParse`/`Json`/`ConformanceHarness`/`ConformanceTests` + CI wiring) is
  already merged to `frontierui:main` (`f918b99` "FUI #2383: native .NET SSR renderer foundation + if/switch
  (#2069)"), confirmed by reading the live files below. **#2383's own backlog card frontmatter still reads
  `status: open`** — a stale/unresolved status on already-shipped work, not a real blocker. This card's design
  and proof below are grounded in the actual merged foundation code, so the work described here is buildable
  today; **`/resolve 2383` should be run so readiness tooling (`we:scripts/check-readiness.mjs`) sees this DAG
  edge as cleared** — that housekeeping is left to the operator/next dispatch, not done as part of this
  preparation-only pass.
- **The for-each conformance vectors already exist**, committed at
  `we:conformance-vectors/webdirectives-ssr.vectors.json` (3 of the corpus's 10 vectors):
  `webdirectives-ssr/for-each/keyed-items-expanded`, `webdirectives-ssr/for-each/empty-list-markers-only`,
  `webdirectives-ssr/for-each/state-tokens-three-items`. No WE-side change is needed — this is a
  frontierui-only story.
- **Executed, not just read: a local offline byte-proof against the REAL merged foundation code**, using the
  `netcoreapp2.0` build the foundation's own `src/` is deliberately kept compatible with (per
  `frontierui:plugs/webdirectives/ssr/net/WebDirectivesSsr.Conformance.csproj`'s comment — this repo's sandbox
  only has an ancient local `dotnet` (2.1.4); CI uses `.NET 8` per `frontierui:.github/workflows/ci.yml:67`, so
  `dotnet test` itself could not be run locally, but the `ConformanceHarness`/`NetServerRenderer`/`Renderers`
  classes compile and run unchanged under `netcoreapp2.0`, which is enough to prove the design):
  1. **Baseline, unmodified merged code**: `ConformanceHarness.RunAll` against the live vectors file reports
     `Passed: 5` (the 2 `if` + 1 `switch` + 2 `state-tokens/{if,switch}` vectors), `Skipped: 5` (the 3
     `for-each` + `resource-loader` + `defer` vectors this slice and #2384 don't own yet), `Failed: 0` — matches
     the card's and #2383's own claims exactly.
  2. **Applying this card's design** (below) to scratch copies of the same 3 files and re-running: `Passed: 8`
     (all 5 baseline + all 3 `for-each` vectors, byte-for-byte, zero regressions), `Skipped: 2`
     (`resource-loader`, `defer` — correctly still deferred to #2384), `Failed: 0`.
  3. **The UTF-16-code-unit claim in this card's own prose was independently checked, not taken on faith**: a
     synthetic non-ASCII probe key (`"𝔘ser,2"`, `𝔘` = U+1D518, an astral/supplementary-plane character requiring
     a surrogate pair) was hashed with both the canonical JS `djb2KeyHash` (`0x8066d012`) and the proposed C#
     `Renderers.Djb2KeyHash` (also `8066d012`) — they agree. C#'s `foreach (char c in s)` already iterates UTF-16
     code units one at a time (an astral character surfaces as its two surrogate `char`s automatically), so the
     port needs no manual surrogate-pair synthesis, unlike the Python port
     (`frontierui:plugs/webdirectives/ssr/python/webdirectives_ssr/renderer.py:311-321`, which must build
     surrogate pairs by hand because Python strings are code-point-indexed, not UTF-16-unit-indexed).

## Decided design

No open fork — this is an additive port of the already-proven Node oracle
(`frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts:114-150`) and the already-shipped Python twin
(`frontierui:plugs/webdirectives/ssr/python/webdirectives_ssr/renderer.py:338-361`), fitted into the existing
.NET foundation's own seams — including the exact spot its own code already names:
`NetServerRenderer.cs`'s dispatch loop comment reads *"Directives that add extra tokens (for-each's
count/key-hash) will append them here."*

**`Renderers.cs` — three new internal statics** (alongside the existing `ResolvePath`/`Stringify`/`Truthy`/
`Interpolate`/`RenderMarkerOptions`):

```csharp
/// The opening tag for a for-each item row: tag + its parsed attrs in source order + an appended
/// data-key="…" (only when dataKeyValue is non-null) — mirrors DOM setAttribute always appending new
/// attributes last, matching the Node oracle's row.setAttribute('data-key', …).
internal static string OpenTag(string tag, IList<HtmlParse.Attr> attrs, string dataKeyValue)
{
    var b = new StringBuilder();
    b.Append('<').Append(tag);
    foreach (var a in attrs) b.Append(' ').Append(a.Name).Append("=\"").Append(a.Value).Append('"');
    if (dataKeyValue != null) b.Append(" data-key=\"").Append(dataKeyValue).Append('"');
    b.Append('>');
    return b.ToString();
}

/// DJB2 (32-bit unsigned) hash of keySequence, lowercase zero-padded to 8 hex digits — the canonical
/// key-hash algorithm (we:conformance-vectors/webdirectives-ssr-harness-contract.md). Hash input is UTF-16
/// code units; C# char already IS a UTF-16 code unit (astral chars iterate as their surrogate pair
/// automatically), so no re-encoding step is needed.
internal static string Djb2KeyHash(string keySequence)
{
    uint h = 5381;
    foreach (char c in keySequence) h = unchecked(((h << 5) + h) ^ c);
    return h.ToString("x8", CultureInfo.InvariantCulture);
}

/// The for-each bounded resume tokens (#2065): count="0" when inner is empty (no list, or an empty list —
/// nothing to hash), else count="N" key-hash="<hex8>", derived by scanning the ALREADY-RENDERED inner HTML
/// for data-key="…" occurrences — mirrors the Node oracle's stateTokens, which reads back the rendered
/// markup rather than re-deriving from the original item list, so the token can never disagree with what
/// was actually emitted.
private static readonly Regex DataKeyAttr = new Regex("\\bdata-key=\"([^\"]*)\"");

internal static string ForEachStateTokens(string inner)
{
    if (inner.Length == 0) return "count=\"0\"";
    var keys = new List<string>();
    foreach (Match m in DataKeyAttr.Matches(inner)) keys.Add(m.Groups[1].Value);
    return "count=\"" + keys.Count + "\" key-hash=\"" + Djb2KeyHash(string.Join(",", keys)) + "\"";
}
```

**`NetServerRenderer.cs` — three edits:**

1. `MarkerToken`: add `if (@is == "for-each") return "control:for-each";`.
2. `RenderInner`: add a new branch (checked first, alongside the existing `if`/`switch` branches):

```csharp
if (@is == "for-each")
{
    string itemsPath = OrEmpty(el.GetAttr("items"));
    string keyField = OrEmpty(el.GetAttr("key"));
    var items = Renderers.ResolvePath(data, itemsPath) as List<object>;
    if (items == null || items.Count == 0) return "";
    var rowSiblings = HtmlParse.Siblings(el.Inner);
    if (rowSiblings.Count == 0) return "";
    var bodyRow = rowSiblings[0];
    var rows = new List<string>();
    foreach (var itemObj in items)
    {
        string dataKeyValue = null;
        if (keyField.Length > 0)
        {
            object key = Renderers.ResolvePath(itemObj, keyField);
            if (key != null) dataKeyValue = Renderers.Stringify(key);
        }
        string rowHtml = Renderers.OpenTag(bodyRow.Tag, bodyRow.Attrs, dataKeyValue) + bodyRow.Inner + "</" + bodyRow.Tag + ">";
        rows.Add(Renderers.Interpolate(rowHtml, itemObj));
    }
    return string.Join("\n", rows);
}
```

3. `Render`'s dispatch loop — replace the bare `string openOptions = options;` (and its now-stale comment)
   with the state-token hook the existing comment already points at:

```csharp
string state = (@is == "for-each") ? Renderers.ForEachStateTokens(inner) : "";
string openOptions = state.Length == 0 ? options
    : (options.Length == 0 ? state : options + " " + state);
```

**`ConformanceHarness.cs` — one edit:** add `"for-each"` to the `Implemented` set:
`new HashSet<string> { "if", "switch", "for-each" }`.

**Not touched:** `HtmlParse.cs` (its existing `Siblings`/`ParseAttrs` already parse a row's tag/attrs/inner —
no new parsing capability needed) and `frontierui:.github/workflows/ci.yml` (already wired to run
`dotnet test` on this subtree; no new CI step). `resource:loader`/`defer` stay `Skipped` — that's #2384, not
this card.

## Interfaces and protocol

- `Renderers.OpenTag(string tag, IList<HtmlParse.Attr> attrs, string dataKeyValue): string` — new, internal,
  pure. `dataKeyValue == null` omits the `data-key` attribute entirely (the untouched `if`/`switch` code paths
  never call this).
- `Renderers.Djb2KeyHash(string keySequence): string` — new, internal, pure. Always returns exactly 8 lowercase
  hex digits.
- `Renderers.ForEachStateTokens(string inner): string` — new, internal, pure. Takes the already-rendered inner
  HTML (post-interpolation, post-`data-key`), not the raw item list.
- `NetServerRenderer.RenderInner(...)` — existing private method, behaviour change: now also handles
  `@is == "for-each"` (previously fell through to the `if` branch's `OrEmpty` helper only — for-each was
  entirely unhandled and would have hit neither the `if` nor `switch` branch, i.e. it's new logic, not a
  changed return value for existing directives).
- `NetServerRenderer.Render(...)` — existing public method (`IServerRenderer.Render`), behaviour change: the
  open-marker options string now includes trailing state tokens for `for-each` regions; `if`/`switch` markers
  are byte-identical to before (`state` is `""` for them, so `openOptions == options` unchanged).
- `ConformanceHarness.Implemented` — existing private `HashSet<string>`, grows by one entry. No signature
  change; `RunAll`'s `Report` shape (`Passed`/`Skipped`/`Failed`) is unchanged — only which vectors land in
  which bucket shifts.
- No new public surface, no new NuGet dependency, no change to `IServerRenderer`, `ServerRenderer.cs`, `Json.cs`,
  or `HtmlParse.cs`.

## Tasks

1. Add `Renderers.OpenTag`, `Renderers.Djb2KeyHash`, `Renderers.ForEachStateTokens` (+ the `DataKeyAttr` regex)
   to `Renderers.cs`.
2. Add the `for-each` branch to `NetServerRenderer.RenderInner` and the `"control:for-each"` case to
   `MarkerToken`.
3. Wire the state-token hook into `NetServerRenderer.Render`'s dispatch loop (replacing `string openOptions =
   options;`).
4. Add `"for-each"` to `ConformanceHarness.Implemented`.
5. Add a small xUnit fact (new or appended to `frontierui:plugs/webdirectives/ssr/net/tests/ConformanceTests.cs`)
   asserting `Renderers.Djb2KeyHash("1,2") == "0b866f0a"` and `Renderers.Djb2KeyHash("A1,B2,C3") == "d792ea35"`
   — a golden self-check mirroring the Python port's own `Djb2KeyHashTest`
   (`frontierui:plugs/webdirectives/ssr/python/tests/test_renderer.py:19-26`), independent of the vector-file
   harness.
6. Run `frontierui:plugs/webdirectives/ssr/net/build.sh` (`.NET 8` SDK; resolves the WE vectors from the sibling
   `../webeverything` checkout or `$WEBDIRECTIVES_SSR_VECTORS`) and confirm the `Done when` counts below.

## Delivery shape

**Single PR, frontierui-only, lands as one piece.** No WE-side change (the vectors + harness contract already
exist and are unmodified). Not incrementable behind a flag: the three `Renderers.cs`/`NetServerRenderer.cs`
edits are one mechanically-dependent unit (the dispatch-loop hook is meaningless without the state-token
function it calls, which is meaningless without `OpenTag`/`Djb2KeyHash`) — same shape as the already-merged
#2383 and the already-shipped Python for-each port, both single PRs.

## Done when

- `frontierui:plugs/webdirectives/ssr/net/build.sh` (`dotnet test` against the WE vectors) exits 0.
- The harness `Report` for a full run shows `Passed.Count == 8` (up from today's 5), including all three
  `webdirectives-ssr/for-each/*` vector ids; `Skipped.Count == 2` (`resource-loader`, `defer` only);
  `Failed.Count == 0`.
- The two `if`/`switch`/`state-tokens` vector groups already passing today keep passing byte-for-byte
  (no regression) — reddening if the `openOptions` change accidentally alters their marker bytes.
- `Renderers.Djb2KeyHash("1,2") == "0b866f0a"` and `Renderers.Djb2KeyHash("A1,B2,C3") == "d792ea35"` are
  asserted by a direct unit test (not only indirectly via the vector harness).
- `npm run check:standards` is 0 errors in `we:` (this card's frontmatter/scope only — no WE code changes).
