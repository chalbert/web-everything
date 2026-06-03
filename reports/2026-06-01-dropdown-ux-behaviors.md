# Dropdown UX Behaviors: Best-Practice Research Report

**Date:** 2026-06-01
**Scope:** The full "dropdown" family — native HTML `<select>`, custom select/listbox, combobox/autocomplete (filterable), and menu-button dropdowns.
**Method:** Two fan-out web-research passes (core behaviors, then positioning/multi-select/async-states/clear-truncate), each surviving 3-vote adversarial verification against primary standards (W3C WAI-ARIA APG, WCAG, CSS WG/MDN) and top-tier UX authorities (NN/g, Carbon, CMS/USWDS, Baymard, Floating UI, React Aria, MUI, PatternFly).
**Goal:** Beyond a dropdown spec — identify the cross-cutting paradigms a dropdown composes (see [Cross-cutting paradigms](#cross-cutting-paradigms-candidate-composable-intents)) so they can be raised as standalone, reusable intents.

---

## Executive summary

A "dropdown" is not one component but a family, and choosing the right member is the highest-leverage UX decision: prefer a **native `<select>`** for form-heavy and mobile experiences (it submits data and renders OS-native pickers more reliably), use **radio buttons** for roughly fewer than 7 mutually-exclusive options (and always for just 2), reserve a **custom listbox/select** for the ~7–15 range with limited space, and switch to a **filterable combobox** above ~15 options or whenever typing is faster than scanning (states, countries, dates). Across every variant, the accessibility contract is well-defined and stable: listbox/option roles with `aria-selected`/`aria-checked`, a button exposing `aria-haspopup` + `aria-expanded` + `aria-controls`, and a keyboard model of arrow keys to move within the widget (never Tab), Home/End to jump, type-ahead to seek, Esc to close retaining value, and Enter/Space/Tab to commit. Focus is managed either by roving `tabindex` or — for comboboxes — by keeping DOM focus on the input and moving virtual focus with `aria-activedescendant`, scrolling the active option into view. Content rules round it out: always show a visible label (never substitute the placeholder), use a good default or a descriptive placeholder, and gray out unavailable options rather than removing them.

**The deeper finding is that almost none of a dropdown's hard parts are *about* dropdowns.** Anchored positioning, edge-aware flipping, dismissal-and-focus-return, focus delegation, type-ahead seek, the selection model, live-region status, windowed rendering of huge lists, async lifecycle, validation, clearability, truncation, and grouping are all general capabilities a dropdown merely *composes*. The [Cross-cutting paradigms](#cross-cutting-paradigms-candidate-composable-intents) section abstracts each into a candidate standalone intent that menus, popovers, tooltips, comboboxes, date pickers, command palettes, and data tables would reuse — turning a "dropdown standard" into a thin composition manifest rather than a monolith.

---

## Implementation status — what's done / what's open

> Tracks how this research has been turned into repo standards. Updated 2026-06-02.

### ✅ Done

**All 13 cross-cutting paradigms are materialized as intents** (catalog at `/intents/`):

| How | Paradigms → intents |
|---|---|
| **3 new intents** | Focus delegation → `focus-delegation`; Live-region status → `live-region-status`; Windowed collection → `windowed-collection` |
| **5 extended intents** | Dismissal & focus return → `anchor` (`dismissal` axis); Async lifecycle → `loader` (`filtering`/`loadingMore`); Accessible truncation → `typography` (`truncation` axis); Clearable value → `input` (`clear` affordance); Grouping → `selection` (`grouping` axis) |
| **5 already existed** | Anchored surface + Edge-aware placement → `anchor`; Selection model → `selection`; Type-ahead seek → `type-ahead`; Validation surface → `validation` |

Also done:
- **Composition manifest** — the `droplist` block (`src/_data/blocks.json` + `block-descriptions/droplist.njk`) declares a `composesIntents` manifest of all 9 composed intents, with a variant matrix (menu-button / custom-select / multi-select / combobox / native) and keyboard contract.
- **Bidirectional navigation** — each composed intent's page lists `droplist` under "Implementing & Composing Blocks"; the droplist page links back to every intent.
- **Glossary** — added terms: Virtual Focus, Selection Follows Focus, Live Region, Windowing, Set Size / Position in Set, Truncation, Clearable Value, Option Group.
- **Validated** — `check:standards` passes (0 errors); full `vitest` suite green; pages render on the dev server.

### 🔶 Not done / open

- **No runnable implementation.** Every intent above is a *contract/spec* only. `droplist` is `status: draft` with no `sourcePath` — there is no Frontier UI component, no tests for actual dropdown behavior, nothing a user can run. The standard describes the "what"; the "how" is unbuilt.
- **Per-intent research gaps** still open (carried in each intent's `researchGaps`):
  - `focus-delegation`: spatial/D-pad navigation overlap with `interaction`; reconcile `selectionFollowsFocus` with `selection.immediacy`; 2-D grid cell mechanics.
  - `windowed-collection`: virtualization *threshold* heuristic; find-in-page (Ctrl+F) breaking on non-rendered items.
  - `live-region-status`: announcement debounce/coalescing; reconcile with `feedback`/`message` severity transport.
  - `anchor`: top-layer escape handoff (Popover API vs. Web Portals).
- **Async pagination beyond load-more** (cursor vs. offset, "load earlier", windowing + async combined) — noted but not specified.
- **Two paradigms are thin extensions, not standalone intents** — Clearable value and Grouping live as an affordance/axis on `input`/`selection` by design; if they need richer contracts later they may warrant promotion.
- **Report findings ≠ implemented behavior.** The summary table and theme sections below are a verified *research catalog*. Items in them are reflected in intent specs where a paradigm owns them, but the report itself is not a conformance checklist against any built component.
- **Other components not harvested** — the same paradigm-extraction has only been run on the dropdown family; modal, data table, date picker, etc. would grow the shared library.

---

## Summary table

| Behavior | Recommended UX | Accessibility / standard reference | Priority |
|---|---|---|---|
| Control choice: 2 options | Use a radio button group, not a dropdown | Carbon Dropdown Usage; NN/g | High |
| Control choice: <7 options | Use radio buttons / checkboxes | CMS Design System; NN/g | High |
| Control choice: ~7–15 options + limited space | Use a dropdown, sparingly | CMS Design System | High |
| Control choice: >15 options | Use a filterable text input that suggests options (combobox) | CMS Design System | High |
| Familiar data (states, countries, birthdate) | Let users type; avoid long dropdowns | NN/g; Baymard | High |
| Native vs custom | Prefer native `<select>` for form-based / mobile experiences | Carbon; Baymard; CSS-Tricks | High |
| Listbox roles | Container `role=listbox`; items `role=option`; selection via `aria-selected`/`aria-checked` | W3C APG Listbox; MDN | High |
| Listbox arrow keys | Down/Up move focus between options | W3C APG Listbox | High |
| Listbox Home/End | Jump to first/last; strongly recommended for >5 options | W3C APG Listbox | Medium |
| Type-ahead | Typing a char moves focus to next matching item; recommended for all, esp. >7 options | W3C APG Listbox | High |
| Keyboard navigation generally | Support keyboard input within dropdowns | NN/g; WCAG 2.1.1 (A) | High |
| Tab vs arrows | Tab/Shift+Tab move *between* components; arrows move *within*; options reached by arrows, not Tab | W3C APG Keyboard Interface; Combobox | High |
| Focus-management strategy | Roving `tabindex` (0/-1) OR `aria-activedescendant` if container role supports it | W3C APG Keyboard Interface | High |
| Menu button roles | `role=button` + `aria-haspopup="menu\|true"` + `aria-expanded` true/false; optional `aria-controls` | W3C APG Menu Button | High |
| Menu button activation | Enter/Space opens menu and focuses first item | W3C APG Menu Button | High |
| Custom select (listbox-pattern dropdown) | Button `aria-haspopup="listbox"` + `aria-controls`; `aria-expanded`; full keyboard model (open/close/cycle/jump/typeahead/select, Esc retains value) | CMS Design System | High |
| Combobox: when to use | Constrained input (value from a set) OR suggested input (arbitrary value, suggestions help) | W3C APG Combobox | High |
| Combobox autocomplete modes | None / list+manual / list+automatic / inline | W3C APG Combobox | Medium |
| Combobox focus | DOM focus stays on input; AT focus moves in popup via `aria-activedescendant` | W3C APG Combobox | High |
| Select-only combobox roles | `role=combobox` on div + `aria-expanded`/`aria-controls`/`aria-labelledby`/`aria-activedescendant`; popup `role=listbox` > `role=option` + `aria-selected` | W3C APG combobox-select-only example | High |
| Active-option scrolling | JS scrolls the `aria-activedescendant` option into view on change | W3C APG combobox-select-only example | High |
| Combobox closed-state arrows | Down opens without moving focus/selection; Up/Home/End open and move visual focus to first/last | W3C APG combobox-select-only example | Medium |
| Combobox open-state commit | Enter/Space set value + close; Tab sets value + close + advance; Esc closes + returns focus; arrow nav alone doesn't change value | W3C APG combobox-select-only example | High |
| Visible label | Always provide a visible label; never substitute the placeholder/default option | CMS Design System; W3C WAI; WCAG 3.3.2 | High |
| Placeholder content | Never put important info in placeholder text (it disappears on selection) | Carbon; Deque; WCAG 3.3.2/4.1.2 | High |
| Default selection | Use a good default when most users pick one option; else a descriptive placeholder ("- Select a state -") | CMS Design System; NN/g | Medium |
| Unavailable options | Gray out (disable) rather than remove, to keep spatial consistency/learnability | NN/g; Smashing Magazine | Medium |
| Default placement | Open `bottom-start`; flip to top when clipped, choosing the best-fitting side | Floating UI `flip()` | High |
| Edge-aware sizing | Cap `max-height` to available viewport space; list scrolls internally instead of overflowing | Floating UI `size()`; APG scrollable listbox | High |
| Stay-in-view shifting | Shift along the edge to stay visible, but `limitShift()` so it never detaches from the trigger | Floating UI `shift()` + `limitShift()` | High |
| Width matching | Listbox `min-width` ≥ trigger width | Floating UI `size()`; CSS `anchor-size()` | Medium |
| Clipping escape | Use `position: fixed` (or Popover top layer) inside `overflow:hidden`/transformed ancestors | Floating UI strategy | Medium |
| Declarative anchoring | Tether popup to trigger with CSS anchor positioning (no JS) | MDN CSS anchor positioning | Medium |
| Declarative flip | `position-try-fallbacks: flip-block, flip-inline` flips natively near edges | MDN `position-try-fallbacks` | High |
| Auto-hide orphaned popup | `position-visibility: anchors-visible` hides popup when trigger scrolls away | MDN `position-visibility` | Medium |
| Scroll active option into view | On each arrow move, `scrollIntoView({block:'nearest'})` the active option (AT focus isn't auto-scrolled) | APG select-only combobox | High |
| Page navigation | PageUp/PageDown move active option ~10 at a time on long lists | APG select-only combobox | Medium |
| Virtualized list semantics | Set `aria-setsize` (full count) + `aria-posinset` (absolute index+1) on every rendered option | react-window #808; APG | High |
| Virtualized focus persistence | Never unmount the focused/active option while scrolled out of the window | React Aria Virtualizer | High |
| Multi-select capability | `aria-multiselectable="true"` on the `role=listbox` | W3C APG Listbox | High |
| Multi-select toggle model | Arrows move focus only; Space toggles the focused option (decoupled) | W3C APG Listbox | High |
| Multi-select range keys | Shift+Arrow extend, Shift+Space to anchor, Ctrl+Shift+Home/End, Ctrl/Cmd+A select-all | W3C APG Listbox (optional) | Medium |
| Multi-select state attr | Use `aria-selected` OR `aria-checked` consistently (not both); set `false` on unselected options | W3C APG; MDN listbox role | High |
| Prefer checkboxes | For small sets, a visible checkbox group beats a multi-select dropdown; render checkboxes inside if used | USWDS Select guidance | High |
| Grouping (native) | `<optgroup label>` (required label, no nesting); `<legend>` for stylable heading in customizable select | MDN `<optgroup>` | High |
| Grouping (ARIA) | `role=group` + `aria-labelledby` → visible heading; headings aren't focusable options | W3C APG grouped listbox | High |
| Loading/searching status | Announce "Loading…"/"Searching…" via `role=status` / `aria-live=polite` (not spinner alone) | MDN status role | High |
| Live region pre-exists | Render the empty `aria-live` `aria-atomic` region on load; populate on events | Orange a11y; react-aria | High |
| Result count announced | Write "{n} results available" + "{label} {i} of {n}" to the live region | Orange a11y autocomplete | High |
| No-results state | Announce explicit "No results found" text, not just a visual empty message | MUI Autocomplete | High |
| Distinct state strings | Separate localizable strings for loading vs. empty; don't reuse one generic message | MUI Autocomplete | Medium |
| Debounced async | Debounce ~200–300ms; cancel stale responses; disable client filtering when filtering server-side | MUI Autocomplete | High |
| Loading phase model | Model `idle\|loading\|filtering\|loadingMore\|error`, not one boolean; inline progress row for load-more | React Aria useComboBox | Medium |
| `aria-expanded` during async | True whenever any popup is shown (incl. loading/empty); false only when fully closed | W3C APG combobox autocomplete-list | High |
| Error identification | Flag errored field + describe error in text (color/icon alone insufficient) | WCAG 3.3.1 (A) | High |
| Error suggestion | Where the fix is known, suggest it in the error text | WCAG 3.3.3 (AA) | Medium |
| Programmatic validity | Toggle `aria-invalid` on validation result; not on untouched required field; link via `aria-describedby`/`aria-errormessage` | MDN aria-invalid | High |
| Disabled state | Both visual + programmatic; disabled options stay visible, `aria-disabled`, skipped by arrows | React Aria ComboBox | Medium |
| Escape semantics | Two-stage: 1st Esc closes popup (focus returns to input), 2nd Esc (popup closed) optionally clears | W3C APG combobox | High |
| Clear (X) affordance | Show only when a value exists; accessible name "Clear"; focus returns to input after clearing | React Aria; MUI Autocomplete | High |
| Clear vs Escape decoupled | Keep persistent X separate from Escape; default Escape = close, opt-in clear-on-Escape | MUI Autocomplete | Medium |
| Truncation method | CSS `text-overflow: ellipsis`; keep ≥4 meaningful chars; never mid-grapheme hard cut | PatternFly; NN/g | Medium |
| Truncation recovery | Always offer full text (tooltip/`title` for <150 chars; expand for longer) | PatternFly; NN/g tooltips | High |
| Front-load labels | Put distinguishing words first so they survive truncation | NN/g scanning research | Medium |
| Label in Name | Keep full text as element text content; don't override with unrelated `aria-label` | WCAG 2.5.3 (A) | Medium |

---

## Findings by theme

### 1. When to use a dropdown vs. another control (control selection)

This is the most consequential and most strongly corroborated theme. Treat the dropdown as a last resort, sized by option count and data familiarity:

- **2 options → radio group.** "It is best practice not to use a dropdown if there are two options to choose from. In this case, use a radio button group instead." (Carbon; corroborated by NN/g). *[Confidence: High]*
- **Roughly <7 → radios/checkboxes; ~7–15 with limited space → dropdown, used sparingly; >15 → filterable text input that suggests options.** The CMS Design System spells out these exact tiers; VA.gov, GOV.UK, Baymard, and Luke Wroblewski ("Dropdowns Should be the UI of Last Resort") all endorse the directional guidance. The numeric cutoffs are a useful heuristic, not universal (NN/g cites 5+). *[Confidence: High, with hedged thresholds]*
- **Avoid dropdowns when typing is faster**, especially for highly familiar data: states, countries, and birthdate components (day/month/year). Such data is "hardwired into users' fingers." (NN/g; Baymard). *[Confidence: High]*
- **Native `<select>` over custom for form-based/mobile experiences**, because it "works more easily when submitting data and is also easier to use on a mobile platform" (it triggers the OS-native picker). Baymard found ~31% of custom dropdowns have significant usability issues. (Carbon; Baymard; CSS-Tricks). *[Confidence: High]*

### 2. ARIA roles & states per variant (the accessibility contract)

- **Listbox:** container `role=listbox`, each item `role=option`, selection indicated by `aria-selected` *or* `aria-checked` (not both on the same listbox; convention is `aria-selected` for single-select, `aria-checked` for multi-select). (W3C APG Listbox; MDN). *[Confidence: High]*
- **Menu button:** trigger has `role=button`, `aria-haspopup` = `"menu"` or `"true"`, `aria-expanded` toggled true/false, optional `aria-controls` → menu id. (A native `<button>` satisfies the role implicitly.) (W3C APG Menu Button). *[Confidence: High]*
- **Custom select (listbox-pattern dropdown):** button carries `aria-haspopup="listbox"` + `aria-controls` → listbox id; `aria-expanded` reflects open state; list has `role=listbox`. (CMS Design System). *[Confidence: High]*
- **Select-only combobox:** `role=combobox` on a div with `aria-expanded`, `aria-controls`, `aria-labelledby`, and `aria-activedescendant` → the visually focused option; popup is `role=listbox` with `role=option` children and `aria-selected="true"` on the selected option. Note the deliberate split: `aria-activedescendant` = highlighted/focused option vs. `aria-selected` = the chosen value. (W3C APG combobox-select-only example). *[Confidence: High]*
- **Combobox use cases:** (a) constrained — value must be one of a predefined set; (b) suggested — arbitrary value allowed but suggestions help. Four autocomplete behaviors: none, list+manual selection, list+automatic selection, inline. (W3C APG Combobox). *[Confidence: High; modes Medium]*

### 3. Keyboard interaction model

- **Tab moves between components; arrows move within.** Dropdown options are navigated by arrow keys, *not* Tab — the popup and its descendants are excluded from the page Tab sequence. (W3C APG Keyboard Interface; Combobox; corroborated by MDN). *[Confidence: High]*
- **Listbox:** Down/Up move focus between options; Home/End jump to first/last (strongly recommended for >5 options); type-ahead moves focus to the next item starting with the typed character (recommended for all listboxes, especially >7 options). (W3C APG Listbox). *[Confidence: High]*
- **Menu button:** Enter/Space open the menu and focus the first item. (W3C APG Menu Button). *[Confidence: High]*
- **Custom listbox-pattern select:** Space/Enter/Down/Up/Alt+Down/Alt+Up open; Esc closes and *retains* the current value, returning focus to the combobox; Up/Down cycle options; Home/End jump; type-ahead highlights the first match; Enter/Space select and close. (CMS Design System). *[Confidence: High]*
- **Select-only combobox, closed:** Down opens without moving focus or changing selection; Up/Home/End open and move visual focus to the first/last option. **Open:** Enter/Space set the value to the focused option and close; Tab sets value, closes, and advances focus; Esc closes and returns visual focus to the combobox; **arrow navigation alone does not change the value** (in this select-only variant). (W3C APG combobox-select-only example). *[Confidence: High]*
- **General principle:** dropdowns must support keyboard input for navigation — a usability point (NN/g) and a WCAG 2.1.1 Level A requirement. *[Confidence: High]*

### 4. Focus management

- **Two valid strategies for composite widgets:** roving `tabindex` (focused element `tabindex=0`, all others `tabindex=-1`) *or* `aria-activedescendant` when the container role supports it. (W3C APG Keyboard Interface). *[Confidence: High]*
- **For comboboxes specifically:** keep DOM focus on the combobox input and move assistive-technology focus within the popup via `aria-activedescendant` (rather than moving DOM focus into the popup). Standard for listbox/grid/tree popups; the dialog popup is the documented exception where DOM focus does move in. (W3C APG Combobox). *[Confidence: High]*
- **Scrolling:** when a keyboard event changes the active option, JavaScript must scroll the `aria-activedescendant` option into view — essential for browser-zoom users. (W3C APG combobox-select-only example). *[Confidence: High]*

### 5. Labels, defaults, placeholders, and option availability (content rules)

- **Always show a visible label; never use the placeholder/default option as the label** (e.g., don't drop the "State" label and rely on a default "Select a state"). The HTML/WHATWG standard, W3C WAI, NN/g, and WCAG 3.3.2 all agree the `placeholder` attribute is not a label substitute. (CMS Design System + standards). *[Confidence: High]*
- **Never put important information in placeholder text** — it vanishes once an option is selected; reserve it for label or persistent helper text. (Carbon; Deque; WCAG 3.3.2/4.1.2). *[Confidence: High]*
- **Default selection:** when most users will or should pick a particular option, preselect it; otherwise use a descriptive placeholder like "- Select a state -" as the selected default. Caution against *bad* presumptive defaults that cause accidental submission. (CMS Design System; NN/g). *[Confidence: Medium]*
- **Unavailable options:** gray out (disable) rather than remove, to preserve spatial consistency and learnability. Two qualifications: (a) *hide/remove* when the option can never be available (permissions/security); (b) prefer `aria-disabled` over a hard `disabled` attribute so screen readers still announce it. (NN/g; Smashing Magazine; APG/MDN). *[Confidence: Medium, qualified]*

### 6. Positioning, anchoring, edge handling, and long-list rendering

How the surface is placed and sized is a distinct concern from what it contains — and it is almost entirely reusable across menus, popovers, tooltips, and date pickers.

- **Default placement + flip.** Open `bottom-start`; enable collision flipping so a trigger near the viewport bottom flips the listbox above instead of being clipped. Floating UI's `flip()` checks main + cross axis and uses a `bestFit` fallback (largest-fitting side) rather than always reverting. (Floating UI). *[Confidence: High]*
- **Shift to stay in view, but don't detach.** `shift({padding})` nudges a wide menu horizontally to stay on-screen; wrap with `limitShift()` so it never visually detaches from its trigger. Use ~8px padding so it never touches the edge. (Floating UI). *[Confidence: High]*
- **Edge-aware sizing.** `size()` exposes `availableHeight`/`availableWidth`; set `max-height` to available space with `overflow:auto` so a long list scrolls *inside* the popup instead of overflowing the viewport, and set `min-width` to the trigger width so the popup is never narrower than its control. (Floating UI). *[Confidence: High]*
- **Clipping escape.** Use `position: fixed` for popups inside `overflow:hidden` or transformed ancestors (else they get clipped); prefer `absolute` otherwise for performance — or sidestep entirely with the Popover API top layer. (Floating UI). *[Confidence: Medium]*
- **Declarative anchoring (no JS).** CSS anchor positioning tethers the popup to its trigger via `anchor-name`/`position-anchor` + `position-area`, auto-updating on scroll/resize. `position-try-fallbacks: flip-block, flip-inline` flips natively near edges; `position-try-order: most-height` opens toward the roomier side; `position-visibility: anchors-visible` auto-hides an orphaned popup when its trigger scrolls away; `anchor-size(width)` matches popup width to trigger — all without JS. (MDN). *[Confidence: Medium — newer baseline]*
- **Scroll the active option into view.** Because AT virtual focus (`aria-activedescendant`) is *not* auto-scrolled by the browser the way real focus is, you must `scrollIntoView({block:'nearest'})` the active option on each arrow move — critical for zoomed-in users. Support PageUp/PageDown (~10 at a time) and Home/End on long lists. (W3C APG select-only combobox). *[Confidence: High]*
- **Virtualization (windowing) for very long lists.** When rendering only a visible window, the DOM no longer reflects the true list, so each rendered option must carry `aria-setsize` (full count) and `aria-posinset` (absolute index+1) so AT announces "item 42 of 5000"; and the **focused/active option must never be unmounted** while scrolled out of the window, or focus and `aria-activedescendant` break. (react-window #808; React Aria Virtualizer). *[Confidence: High]*

### 7. Multi-select and grouping

- **Declare the capability.** `aria-multiselectable="true"` on the `role=listbox` is what tells AT multiple options can be chosen — visible checkboxes alone don't convey it. (W3C APG). *[Confidence: High]*
- **Decoupled toggle model (safe default).** Arrow keys move focus only; Space toggles the focused option — a checkbox-list mental model that prevents accidental selection changes while navigating. React Aria calls this `selectionBehavior: 'toggle'` and recommends it as the baseline, ideally with a visible checkbox per option. (W3C APG; React Aria). *[Confidence: High]*
- **Optional power-user range keys.** Shift+Up/Down extend, Shift+Space selects to the anchor, Ctrl+Shift+Home/End select to an edge, Ctrl/Cmd+A selects all. Ship these for large multi-selects; mirror Cmd on macOS. The alternative `'replace'` behavior (native OS list semantics: click replaces, Shift range, Ctrl/Cmd toggle) is undiscoverable without modifier keys — reserve it for desktop data tables and fall back to toggle on touch. (W3C APG; React Aria). *[Confidence: Medium]*
- **State attribute discipline.** Use `aria-selected` *or* `aria-checked`, never both on the same listbox; convention is `aria-selected` for single-select, `aria-checked` (with visible checkboxes) for multi-select. In a multi-select, set `aria-selected="false"` on *every* selectable-but-unchosen option, not just `true` on chosen ones; omit it entirely on non-selectable separators. (W3C APG; MDN). *[Confidence: High]*
- **Prefer checkboxes for small sets.** USWDS explicitly warns users often don't understand how to multi-select from a `<select>` — use a visible checkbox group when space allows, and render explicit checkboxes inside a multi-select dropdown when you do use one. (USWDS). *[Confidence: High]*
- **Grouping.** Native-first: `<optgroup label="…">` (label is required and is what AT announces; no nesting); in the customizable-select model a `<legend>` child gives a stylable heading. Custom ARIA: wrap each group's options in `role="group"` with `aria-labelledby` → a *visible* heading; group headings are not focusable options. (MDN; W3C APG). *[Confidence: High]*

### 8. Async, loading, empty, and error/validation states

- **Announce status textually, not just visually.** Surface "Loading…"/"Searching…" in a `role="status"` (implicit `aria-live="polite"` + `aria-atomic="true"`) region — a spinner alone is invisible to screen readers. The live region must already exist (empty) in the DOM on load so AT registers it; populate it on events; don't move focus to it. (MDN; Orange a11y). *[Confidence: High]*
- **Announce result counts and emptiness.** Write "{n} results available" on each settled filter and "{label} {i} of {n}" as the user arrows through options; expose an explicit "No results found" string (MUI defaults to "No options") rather than a purely visual empty state. Use distinct, localizable strings for loading vs. empty — don't reuse one generic message. (Orange a11y; MUI; React Aria). *[Confidence: High]*
- **Debounce and de-stale async (incl. pagination).** Debounce server-side filtering ~200–300ms after the last keystroke, cancel/ignore stale in-flight responses, and disable built-in client filtering when the server already filters (else results double-filter). Model loading as an enum — `idle | loading | filtering | loadingMore | error` — not one boolean; for **infinite-scroll / load-more pagination** show an inline progress row at the list end with an `aria-label` so it's announced. (MUI; React Aria useAsyncList). *[Confidence: High; phase-model Medium]*
- **Keep `aria-expanded` honest during async.** It must be `true` whenever *any* popup is shown — including a loading spinner or "no results" message — and `false` only when the popup is fully closed. Don't leave it `true` while the popup is hidden mid-fetch, or flip it `false` if you keep a loading popup open. (W3C APG). *[Confidence: High]*
- **Validation.** WCAG 3.3.1 (A) requires the errored field be identified *and* the error described in text (color/icon alone fails); 3.3.3 (AA) asks you to suggest the fix where known. Programmatically, toggle `aria-invalid` on the validation *result* (not on an untouched required field), and link the message via `aria-describedby` / `aria-errormessage`. Disabled state must be both visual and programmatic; disabled options stay visible, `aria-disabled`, and skipped by arrow navigation. (WCAG; MDN; React Aria). *[Confidence: High]*

### 9. Clearability and truncation

- **Escape is two-stage, not combined.** First Escape dismisses the open popup and returns focus to the combobox; a *second* Escape (popup already closed) optionally clears the input. APG marks clear-on-Escape **optional** — the mandatory behavior is dismiss-popup + focus-return. Note design systems disagree: Carbon's Escape clears *and* closes in one press, so pick one model, document it, and stay consistent. (W3C APG; Carbon). *[Confidence: High]*
- **Clear (X) affordance.** APG doesn't standardize it — it's a design-system concern. Show it only when a value exists (hide on empty to avoid a no-op control), give it an explicit accessible name "Clear" (icon-only buttons have none), keep it keyboard-reachable, and return focus to the input after clearing so the user can re-type. Keep the persistent X decoupled from Escape (MUI's `clearOnEscape` is opt-in so Escape stays "close"). (React Aria; MUI). *[Confidence: High]*
- **Truncation.** Truncate visually with CSS `text-overflow: ellipsis` (not mid-grapheme character chopping); keep ≥4 meaningful characters. **Always** provide a way to read the full string — a `title`/tooltip for short labels (<~150 chars), an expand affordance for longer. Front-load the distinguishing words so they survive the cut (NN/g scanning research). Keep the full text as the element's text content rather than overriding with an unrelated `aria-label`, so WCAG 2.5.3 Label-in-Name holds for voice control. (PatternFly; NN/g; WCAG). *[Confidence: High]*

---

## Cross-cutting paradigms (candidate composable intents)

The real payoff of studying a dropdown is that almost none of its hard parts are *about* dropdowns. Each is a general capability the dropdown merely composes — and each is a candidate to be raised as a standalone **intent/standard** that menus, popovers, tooltips, comboboxes, date pickers, command palettes, and data tables would all reuse. A dropdown is then a *composition* of these, not a monolith.

| Paradigm | What it owns | Dropdown uses it for | Other components that compose it |
|---|---|---|---|
| **Anchored surface** | Tether a transient surface to an anchor in the top layer; update on scroll/resize | Listbox positioned to the trigger | Menu, popover, tooltip, date picker, autocomplete, hovercard |
| **Edge-aware placement** | Flip / shift / resize a surface against the viewport; best-fit side; auto-hide when anchor leaves | Flip-up near bottom, cap height, match width | Any floating surface |
| **Dismissal & focus return** | Esc / outside-click / scroll-away semantics; *where focus goes* on close; layered/stacked dismissal order | Close listbox, return focus to trigger/input | Modal, sheet, menu, popover, combobox |
| **Focus delegation** | Roving `tabindex` vs. virtual focus (`aria-activedescendant`); arrows-within / Tab-between | Move highlight through options without losing input focus | Listbox, menu, tree, grid, toolbar, tabs, radio group |
| **Type-ahead seek** | Jump to an item by typing a prefix within a collection | Seek option by first letters | Menu, tree, table, native select |
| **Windowed collection** | Render only the visible window while preserving `setsize`/`posinset` and never unmounting the focused item | Virtualize huge option lists | Long table, infinite feed, tree, transfer list |
| **Async collection lifecycle** | `idle/loading/filtering/loadingMore/error` model; debounce; de-stale; live-region status; empty/no-results | Async-filtered combobox, load-more lists | Search, infinite scroll, data grid, async picker |
| **Selection model** | Single vs. multi; highlight-vs-commit; toggle vs. replace; range keys; `aria-selected`/`aria-checked` discipline | Pick one or many options | Menu (checkbox items), table row selection, file list, tag input |
| **Live-region status** | Announce loading / count / no-results / error politely from a pre-existing region | "{n} results", "No results found" | Search, async forms, validation, toasts |
| **Validation surface** | Identify errored field + describe in text; `aria-invalid`/`aria-errormessage`; suggest fix | Required/invalid selection | Every form control |
| **Clearable value** | Conditional X with accessible name; focus-return; decoupled from Esc | Clear the chosen option | Search input, text field, tag input, filters |
| **Accessible truncation** | Ellipsis without mid-grapheme cuts; full-text recovery; Label-in-Name; front-loaded labels | Long option/value labels | Table cells, breadcrumbs, tabs, chips, nav |
| **Grouping** | Labeled sub-groups within a collection (`optgroup` / `role=group`) | Grouped options | Menu sections, command palette, nav, faceted lists |

**How to read this for the standard.** The strongest promotion candidates — broad reuse, stable accessibility contracts, clean boundaries — are **Anchored surface**, **Edge-aware placement**, **Dismissal & focus return**, **Focus delegation**, **Type-ahead seek**, **Selection model**, **Live-region status**, and **Windowed collection**. These are genuinely cross-component and each has a primary-source contract (W3C APG / WCAG / CSS WG) to anchor a spec to. **Validation surface**, **Clearable value**, **Accessible truncation**, and **Grouping** are also reusable but sit closer to "form-field" and "text-rendering" families — they may already belong to other intents in this repo and should be cross-linked rather than re-specified. A dropdown standard then becomes a thin *composition manifest* — "a Dropdown is an Anchored, Edge-aware surface with a Listbox Selection model, Focus delegation, Type-ahead, and (optionally) an Async collection lifecycle" — instead of restating each behavior.

### Materialization status (intents)

As these paradigms get promoted, they materialize as real intents in `src/_data/intents.json` (catalog at `/intents/`):

| Paradigm | Intent | Status |
|---|---|---|
| Focus delegation | [`/intents/focus-delegation/`](../src/_data/intents.json) | ✅ materialized (keystone) |
| Anchored surface + Edge-aware placement | `/intents/anchor/` | ✅ existing (placement/collision) |
| Dismissal & focus return | `/intents/anchor/` (`dismissal` axis) | ✅ added |
| Selection model | `/intents/selection/` | ✅ existing |
| Type-ahead seek | `/intents/type-ahead/` | ✅ existing |
| Live-region status | `/intents/live-region-status/` | ✅ materialized |
| Windowed collection | `/intents/windowed-collection/` | ✅ materialized |
| Async collection lifecycle | `/intents/loader/` (`filtering`/`loadingMore`) | ✅ extended |
| Accessible truncation | `/intents/typography/` (`truncation` axis) | ✅ extended |
| Validation surface | `/intents/validation/` | ✅ existing |
| Clearable value | `/intents/input/` (`clear` affordance) | ✅ extended |
| Grouping | `/intents/selection/` (`grouping` axis) | ✅ extended |

---

## Caveats and time-sensitivity

- **Numeric thresholds are heuristics, not laws.** The 2 / <7 / 7–15 / >15 tiers come from CMS Design System and are corroborated directionally, but other authorities use different exact cutoffs (NN/g says 5+). Use them as guidance, sized to your content and space.
- **"Disable vs. remove" is a default, not an absolute,** and the accessible implementation (`aria-disabled` vs. hard `disabled`) matters; the verification vote on this claim was 2-1.
- **Native `<select>` customization is evolving.** CSS-customizable native `<select>` (Chrome 135+, the `appearance: base-select` direction) strengthens the native-first preference but is not yet broadly available cross-browser; revisit as support matures.
- **The "select-only" combobox keyboard model is variant-specific.** The general APG combobox pattern also defines an optional "selection follows focus" mode where arrow navigation *does* change the value — so the "arrow nav alone doesn't change value" rule is scoped to the select-only example, not all comboboxes.
- **A few CMS pages timed out on direct fetch** during verification and were confirmed via search-engine extraction plus corroborating sources; verbatim matches give high confidence the quotes are genuine.
- **CSS anchor positioning is newer baseline.** The declarative positioning/flip/sizing primitives (sections 6) are well-specified but cross-browser support lags the JS approach (Floating UI); treat the CSS path as progressive enhancement and keep a JS fallback today.
- **Async phase/loadingMore details** lean on design-system docs (MUI, React Aria) rather than a single normative spec; the *direction* is well-corroborated but exact debounce values (~200–300ms) are conventions, not standards.

## Open questions (remaining)

The four major gaps from the first pass are now covered (sections 6–9). What's left is repo-specific synthesis rather than research:

1. **Which cross-cutting paradigms get promoted to standalone intents** vs. cross-linked to existing form-field/text families (see the promotion guidance above)?
2. **Does any existing intent in this repo already own** Validation surface, Clearable value, Accessible truncation, or Grouping — and should the dropdown compose those rather than re-specify them?
3. **Async pagination beyond load-more** (cursor vs. offset, "load earlier", windowing + async together) — a deeper combined paradigm if the standard needs it.
