# Latent-standard discovery program (#1399) — living report

The single living report for the [#1399](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
program watch. One section per run; append, never fork. Set on #1399 as `relatedReport`.

Program: a multi-axis lens catalogue that surfaces **latent standards** — patterns recurring across web
apps that aren't yet in the WE intent/block registry — by enumerating an authoritative axis and diffing
it against the registry. Cards-only; the human disposes.

---

## Run 1 — 2026-07-01 (external-source currency re-diff; APG + OpenUI + ARIA spec)

First review of the program (all 7 lens children ran in one founding burst on 2026-06-21; this is the
first re-diff against later external data). Focus: the two fastest-moving external axes owned by the
program — **ARIA APG** (#1400) and **OpenUI** (#1401) — plus a bleed-in check of the WAI-ARIA *spec*
itself. The native-platform-API axis (#1257) and component-catalog axis (`/gap-sweep`) are delegated to
their own watches and were skipped (no double-file).

### Front A — state of prior output (grounded)

- 7 lens children (#1390, #1400–#1405) all `resolved`; the founding harvest (#1384, #1393–#1423, …) all
  `resolved` (placed or dismissed-with-reason). For a discovery program, `resolved` = "the lens ran once
  and emitted its cards" — verified against each child's resolution note, not code.
- The two load-bearing lenses re-checked this run both concluded **axis saturated** in run 1 (OpenUI:
  0 new cards; APG: 3 filed, now all resolved). Baselines confirmed intact.

### Front A — goal-set coverage (completeness pass)

Goal-set = the axis catalogue (each axis needs a lens). All ten have one → complete against the goal-set;
the residual here is *refresh-staleness* of the slow-corpus lenses (a front-B cadence matter), **not**
missing coverage — the honest-0 completeness case.

| Axis (goal-set element) | Lens | In place? | Verdict |
|---|---|---|---|
| Component catalog | `/gap-sweep` skill | ✓ (ran dry 2026-06-20) | covered (delegated) |
| Interaction verb | #1390 | ✓ resolved | covered |
| Native platform API | #1257 watch | ✓ (own watch) | covered (delegated) |
| ARIA role / pattern | #1400 | ✓ resolved | covered |
| Standards-in-flight (OpenUI) | #1401 | ✓ resolved | covered |
| App infrastructure | #1402 | ✓ resolved | covered (unrefreshed this run) |
| Data lifecycle | #1403 | ✓ resolved | covered (unrefreshed this run) |
| Production teardown | #1404 | ✓ resolved | covered (unrefreshed this run) |
| Divergence | #1405 | ✓ resolved | covered (unrefreshed this run) |
| Intra-standard (dimension vacancy) | `check:axis-vacancy` | ✓ existing | covered |

**Coverage: 10/10 axes have a lens.** Completeness residuals filed this run: **none** — the program is
complete against its goal-set (every axis is manned); #1402–#1405 are covered-but-stale, re-run on cadence.

### Front B — currency (web search + authoritative fetch)

- **APG patterns** — fetched the current [APG index](https://www.w3.org/WAI/ARIA/apg/patterns/): **30
  patterns, identical** to the #1400 baseline (accordion … window splitter). Index version unchanged →
  **dry**, axis still saturated.
- **OpenUI** — the notable in-flight item is **`focusgroup`** (declarative roving-tabindex for composite
  widgets; Microsoft + Google). Already owned by [we:src/_data/intents/focus-delegation.json](../src/_data/intents/focus-delegation.json)
  + research topic `we:src/_data/researchTopics/toolbar-composite-focus-placement.json` → **dismiss
  (covered)**, no new/route card. Axis still saturated.
- **WAI-ARIA 1.3 spec** (editor's draft Feb 2026) — new document-structure roles **`comment`**,
  **`suggestion`**, **`mark`**. Diffed against the shipped [we:src/_data/intents/annotation.json](../src/_data/intents/annotation.json):
  `comment` → `commenting` motivation (covered); `mark` → `highlight` disposition / Custom Highlight API
  (covered); **`suggestion`** → the `suggestion` motivation *marker* is covered, but its accept/reject
  **host-mutation lifecycle** is an unowned residual (annotation is UX-only and delegates no engine) —
  and it's currently only an `openQuestion` inside the intent, tracked nowhere. `role=suggestion` gives
  it native grounding → newly decidable.

### Outcome

- **1 child filed** — **[#2029](/backlog/2029-suggestion-accept-reject-handoff-annotation-vs-rich-text-pla/)**
  (`decision`): where the suggestion accept/reject lifecycle lives — rich-text editor-engine (default) vs
  a standalone `suggested-edit` contract vs annotation end-to-end. Un-prepared.
- **0 clean new latent standards** — a healthy near-dry idempotent re-run (#315): both owned external
  axes re-confirmed saturated; the one card is a partial-coverage placement fork the ARIA 1.3 delta
  ripened, not a new pattern.
- New native grounding recorded for the `annotation` intent (ARIA 1.3 `role=suggestion`/`comment`/`mark`).

**Next run:** re-diff APG only when its index version changes and OpenUI only when a genuinely new
research page publishes (both idempotent-dry today). Re-run the *internal-corpus* lenses (#1402 app-infra,
#1403 data-lifecycle, #1404 production-teardown, #1405 divergence) on a slower cadence — the design-system
landscape barely moves in 10 days. Watch WAI-ARIA 1.3 toward Candidate Recommendation for further
role-level deltas.
