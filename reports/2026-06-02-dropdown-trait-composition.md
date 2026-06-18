# Authoring a Droplist in HTML: From Intent Markup to Composed Traits

**Date:** 2026-06-02
**Status (2026-06-03):** Partially graduated. The terminology table, "three faces of a trait", "from markup to traits" mapping, and "droplist substrate" definition now live on the [Droplist block](/blocks/droplist/); the Step 1 (single dropdown) markup is on the [Dropdown block](/blocks/dropdown/). The "Autocomplete in detail" section remains here as seed content for the [autocomplete block](/backlog/035-autocomplete-block/) backlog item; the open contracts in §"Open questions" are tracked in [droplist-composition-open-contracts](/backlog/023-droplist-composition-open-contracts/).
**Original status:** Design exploration — step 1 (interface only, no runnable implementation yet)
**Builds on:** [`we:reports/2026-06-01-dropdown-ux-behaviors.md`](./2026-06-01-dropdown-ux-behaviors.md) — "Cross-cutting paradigms", and the `droplist` composition manifest (`we:src/_includes/block-descriptions/droplist.njk`).
**Real idioms it leans on:** `type-ahead` behavior (`fui:blocks/type-ahead/TypeAheadBehavior.ts`), Plateau's `composite-widget` attribute (`we:plateau/src/blocks/attributes/CompositeWidget.ts`), the injector chain (`customContexts:*`), and the `with*` traits in `blocks/resource-loader/traits/`.

---

## What this document is

The dropdown research concluded that a "dropdown" is not one component but a **composition** of ~9 general paradigms, each already materialized as a standalone intent. The `droplist` block records *that*. What it does not show is **how an app author actually builds one** — and that question is answered in HTML, not in a JavaScript constructor.

So this walkthrough starts from the markup ("intent coding") and works *down* to the traits:

> **You author a droplist declaratively in HTML.** That markup resolves to a set of composable traits — and a trait reaches the page through one of three surfaces: a **component** (custom element), a **behavior** (custom attribute), or a **provider** imported through DI (the injector chain). The HTML author never calls `withSelection()`; they write `<ul role="listbox" composite-widget>` and a provider, and *that* is what activates the trait.

The deliverable is the **interface and the walkthrough**, not an implementation. No Frontier UI component is built. The goal is to pressure-test whether the dropdown intents compose cleanly *through the real authoring surfaces this ecosystem already uses* before committing to build anything.

### Terminology (corrected)

The earlier draft of this doc — and the current `we:droplist.njk` — use "dropdown" loosely to mean the whole family. Tightening it, per how the team actually uses the words:

| Term | Meaning |
|---|---|
| **Droplist** | The **abstract** family / contract for *any* list-based selection surface — the substrate that a dropdown, autocomplete, multi-dropdown, menu-button, and native `<select>` all conform to. Not itself a shippable widget. |
| **Dropdown** | One **concrete** member of the droplist family — single-select, button-triggered, non-filtering. |
| **Autocomplete** | A concrete droplist member — editable input, filterable. |
| **Multi-dropdown** | A concrete droplist member — `multiple` selection. |

> 🔧 **Doc fix flagged:** `we:src/_includes/block-descriptions/droplist.njk` opens with *"A 'dropdown' is not one behavior but a composition…"* — that sentence should say **droplist**. The block is the abstract family; the dropdown is one instance of it. (Not done in this pass — see [Open questions](#open-questions).)

---

## The three faces of a trait

A **trait** is the unit of composed behavior — a `with[Capability]` factory that applies DOM/ARIA/CSS/keyboard wiring and returns a handle that can undo it (the `resource-loader` contract, reused verbatim):

```typescript
interface TraitHandle { cleanup: () => void; }       // undo everything the trait touched
type Trait = (target: Element, opts?: object) => TraitHandle;
```

But the app author never writes that call. A trait surfaces in HTML as one of three things — and each already has a precedent in the repos:

| Face | What it is | When a trait takes this face | Real precedent |
|---|---|---|---|
| **Component** | A custom element that owns a subtree | The trait needs to own structure/children (the popup surface, the option template) | `<route-view>` (`we:blocks/router/elements/RouteViewElement.ts`) |
| **Behavior** | A custom attribute stacked on semantic HTML | The trait enhances an element you already have; multiple stack on one node | `<ul role="listbox" type-ahead>`; `<… composite-widget>` |
| **Provider** | A value/service set on the injector chain, consumed down-tree | The trait is config or a shared service many nodes read (intent profile, positioning strategy, the announcer) | `injector.set('customContexts:loaderIntent', …)` |

The decision rule is the repo's own (`we:docs/agent/architecture.md`: *"Behaviors are implementations: custom attributes attach functionality"*; components own subtrees; injector providers feed config/services down the tree). Most dropdown traits are **behaviors**, two own structure as **components**, and three are best delivered as **providers**.

---

## Usage: what an app developer writes

Before the substrate, the payoff. An app developer building a profile form never touches a trait, a behavior, or an injector — they drop in the concrete components and read values. This is the whole point of the abstraction: the composition is invisible at the call site.

```html
<form id="profile">
  <!-- Dropdown: single-select, preselected -->
  <drop-list name="country" label="Country" value="au">
    <option value="ar">Argentina</option>
    <option value="au">Australia</option>
    <option value="br">Brazil</option>
  </drop-list>

  <!-- Autocomplete: editable, async-filtered from a URL -->
  <auto-complete name="city" label="City" src="/api/cities?q="></auto-complete>

  <!-- Multi-dropdown: same element, one attribute -->
  <drop-list name="interests" label="Interests" multiple>
    <option value="design">Design</option>
    <option value="eng">Engineering</option>
    <option value="ops">Operations</option>
  </drop-list>

  <button type="submit">Save</button>
</form>
```

It behaves like any form control, because the components are **form-associated** (`static formAssociated = true` on the underlying attribute):

```javascript
const form = document.querySelector('#profile');

// Read like a native control
form.elements.country.value;        // "au"
form.elements.interests.values;     // ["design", "ops"]

// One event for any selection change
form.addEventListener('selectionchange', (e) => {
  console.log(e.target.name, '→', e.detail.value);
});

// Or don't read at all — values flow into native submission:
new FormData(form).get('country');  // "au"
```

That is the entire surface an app developer sees: three tags, a `value`/`values` getter, a `selectionchange` event, and native form submission. No mention of anchoring, focus delegation, live regions, or traits. Everything below exists to make *this* snippet work — and to make the same paradigms reusable by every other widget.

> The `value`/`values`/`selectionchange`/`formAssociated` surface above is the **concrete-component contract**. The rest of this document is how that contract is *satisfied* by composing traits — not new API the app developer learns.

---

## Intent coding: the markup

The clearest test is to author each concrete droplist member declaratively, climbing off the native baseline. Each step is real, shippable markup.

### Step 0 — Native dropdown (zero custom traits)

```html
<label for="country">Country</label>
<select id="country" name="country">
  <option value="ar">Argentina</option>
  <option value="au">Australia</option>
  <option value="br">Brazil</option>
</select>
```

The browser owns placement, focus, keyboard, type-ahead, selection — everything. This is the **native-first default**; you climb off it only when a requirement (custom rendering, filtering, multi-select chips) rules native out. The droplist family's job is to make the climb *additive*, not a rewrite.

### Step 1 — Dropdown (custom single-select)

The substrate is plain semantic HTML — a trigger and a listbox — with **behaviors stacked on** and an **intent provider** above. Nothing here is dropdown-specific markup; it's ARIA roles plus attributes that each name a paradigm:

```html
<!-- the intent profile is provided once, up the tree (see "Where intent comes from") -->
<div customContexts:droplistIntent="single">

  <button id="country-trigger" aria-haspopup="listbox" aria-expanded="false"
          anchor="country-surface">
    Country
  </button>

  <!-- focus-delegation + selection (split behaviors); type-ahead = seek by typing -->
  <ul id="country-surface" role="listbox"
      focus-delegation="role=listbox;orientation=vertical"
      selection
      type-ahead
      anchored="bottom-start;flip;resize"
      hidden>
    <li role="option" composite-descendant data-value="ar">Argentina</li>
    <li role="option" composite-descendant data-value="au">Australia</li>
    <li role="option" composite-descendant data-value="br">Brazil</li>
  </ul>

</div>
```

Read it as a composition of named paradigms:

- `focus-delegation` — **Focus Delegation** (real behavior, `fui:FocusDelegation.ts`): one tab stop, arrow-within, Home/End, type-ahead seek, `aria-activedescendant`. Owns *movement* only.
- `selection` — **Selection** (real behavior, `fui:Selection.ts`): `aria-selected`, Enter/Space commit, and `selectionFollowsFocus` (default `true` for single-select) — implemented by listening to the `activedescendantchange` event `focus-delegation` emits, so the two never reference each other. (`composite-widget` remains available as a one-attribute bundle that composes both.)
- `type-ahead` — **Type-Ahead** (this behavior already exists): seek option by typed prefix. Configurable via `type-ahead-reset`, `type-ahead-match`, `type-ahead-wrap`.
- `anchor` / `anchored` — **Anchor**: the trigger binds to its surface; the surface declares placement + collision. Dismissal & focus-return ride along.
- `customContexts:droplistIntent` — the **provider** that the behaviors read to resolve their dimension values.

For the common case, that skeleton is packaged behind one convenience element that *desugars to exactly the above* in its `connectedCallback`:

```html
<drop-list name="country" label="Country">
  <option value="ar">Argentina</option>
  <option value="au">Australia</option>
  <option value="br">Brazil</option>
</drop-list>
```

`<drop-list>` is the **component face** of the droplist substrate — convenience, not new behavior. The two forms are interchangeable; pick the raw skeleton when you need full control, the element when you don't.

### Step 2 — Multi-dropdown (flip one dimension)

Same substrate. One attribute value changes — exactly as native does with `<select multiple>`:

```html
<ul role="listbox"
    focus-delegation="role=listbox"
    selection="multiSelectable;selectionFollowsFocus=false"
    type-ahead anchored="bottom-start;flip;resize">
  …
</ul>

<!-- or the convenience element: -->
<drop-list name="tags" label="Tags" multiple>…</drop-list>
```

`multiSelectable` switches `selection` to the decoupled toggle model (`aria-multiselectable`; Space toggles the focused option), and `selectionFollowsFocus=false` stops auto-commit so arrows move focus only — while `focus-delegation` is **completely unchanged**. Single→multi is a one-attribute flip on the *selection* behavior alone. That clean isolation — the focus behavior doesn't even know selection became multiple — is the experiment's strongest evidence that Selection was correctly factored out of "dropdown".

### Step 3 — Autocomplete (editable + filterable)

Autocomplete is the richest member, and the one that most repays a careful look — because composing it surfaces a distinction the dropdown hid. It gets its own detailed section below.

```html
<div customContexts:droplistIntent="single;editable;filter=async">

  <!-- INPUT-SIDE: owns DOM focus, the text, and the query -->
  <input id="city-input" role="combobox"
         aria-controls="city-surface"
         aria-activedescendant=""                 ← points INTO the listbox (set on the input)
         aria-expanded="false"
         anchor="city-surface"
         filter="async"                           ← reads THIS input's text, narrows the listbox
         clearable>                               ← the "Clear" affordance

  <!-- LISTBOX-SIDE: owns the collection and the active item -->
  <ul id="city-surface" role="listbox"
      focus-delegation="strategy=virtual;controller=city-input"   ← focus host is the input, not here
      selection="selectionFollowsFocus=false"
      anchored="bottom-start;flip;resize"
      live-status                                 ← "{n} results", "No results found"
      windowed                                    ← optional: virtualize large result sets
      hidden>
    <!-- options are injected by `filter`, not authored -->
  </ul>

</div>

<!-- convenience element: -->
<auto-complete name="city" label="City" src="/api/cities?q="></auto-complete>
```

---

## Autocomplete in detail

Autocomplete looks heavy, but it decomposes cleanly once two things are clear. (Both were under-specified in the Step 3 sketch above until this section; the markup above is the corrected form.)

### The idea that unlocks it: focus host ≠ collection

In the **dropdown** (Step 1), one element played two roles: the `<ul role="listbox">` was *both* the focus host (it had `tabindex=0` and received keydown) *and* the collection holding the options. `fui:FocusDelegation.ts` quietly assumes that — it attaches keydown to `this.target`, sets `this.target.tabIndex = 0`, and puts `aria-activedescendant` on `this.target`.

**Autocomplete breaks that assumption.** DOM focus must stay on the `<input>` so typing is never interrupted — so the input is the *focus host*, while the `<ul>` is still the *collection*. They are now two different elements. That single separation is the whole story of how autocomplete differs; everything else follows from it.

So the behaviors split onto two elements by the role they serve:

> **Input-side = text & query** (`filter`, `clearable`). **Listbox-side = collection & active item** (`focus-delegation`, `selection`, `anchor`, `live-status`, `windowed`).

### What `controller` does to FocusDelegation

The `controller=city-input` value is a small generalization the current `fui:FocusDelegation.ts` does **not** have yet — and trying to compose autocomplete is exactly what surfaces the need for it. When a controller is set, three things change versus the dropdown:

| | Dropdown (host = collection) | Autocomplete (`controller` set) |
|---|---|---|
| keydown listener attaches to | the listbox (`this.target`) | the **input** (controller) |
| `aria-activedescendant` is set on | the listbox | the **input** (the focused element) |
| `tabindex=0` goes on | the listbox | **nothing** — the input is already focusable |

It's the *same* trait, just told "your focus host is over there." `focus-delegation` on the listbox listens for ArrowDown coming from the input, moves the active option in the listbox, and writes `aria-activedescendant` back onto the input. The cleanest finding from the exercise: FocusDelegation conflated "collection container" and "focus host," and autocomplete is the case that pulls them apart. Adding `controller` is the obvious next prototype (small, and it's the riskiest piece).

### The other swap: type-ahead → filter

In the **dropdown**, printable keystrokes drive `type-ahead` — type "par" and the active item *jumps* to "Paris." In the **autocomplete**, the same keystrokes drive `filter` — type "par" and the list *narrows*. Both consume printable keys, so **they are mutually exclusive**: you compose one or the other, selected by `editable`. So "autocomplete = dropdown with `editable`" precisely means *swap type-ahead for filter, and move the focus host from the listbox to the input.* Focus, selection, and anchor are otherwise unchanged.

### `filter` is itself a small composition

`filter` doesn't reinvent async — it **composes two providers** that already exist:

- It consumes the **loader** intent (`customContexts:loaderIntent`) for the `filtering` lifecycle: debounce (~250ms), enter a loading state, cancel stale in-flight responses, render results. (Client mode — `filter="client"` — skips the async parts and just hides non-matching options.)
- After each settle it pushes a message to **live-status**: "7 results available" / "No results found."

So `filter` is a thin orchestrator over loader + live-status, not a monolith. `live-status` owns the announcer region; `filter` and `focus-delegation` are just two callers — filter announces counts on settle, focus announces "Paris, 2 of 7" on each active move.

### Trace: typing "par", arrow, enter

1. Focus enters the input → **anchor** opens the surface, `aria-expanded="true"`.
2. **filter** hears `input` events, debounces, enters loader **`filtering`**, calls the source, de-stales, injects `<li role="option">`s into the listbox.
3. **focus-delegation** re-reads the descendants (sets `aria-setsize`/`aria-posinset`); active stays unset — editable lists don't auto-highlight.
4. **live-status** announces "7 results available."
5. User presses **ArrowDown** — keydown fires *on the input*; focus-delegation (listening on the controller) moves the active option and writes `aria-activedescendant` on the input. `selectionFollowsFocus=false`, so nothing commits yet — just a preview.
6. User presses **Enter** — keydown on the input; **selection** reads the active item (via the input's `aria-activedescendant`), commits it, fires `selectionchange`/`itemactivate`.
7. The `<auto-complete>` glue hears `selectionchange` → writes "Paris" into the input value, **anchor** dismisses the surface, focus stays on the input, and **clearable** now shows the X (value non-empty).

Step 7's glue — "on commit, set the input's text and close" — is the only genuinely autocomplete-specific logic, and it's a handful of lines in the concrete component, not a trait.

> **Status:** mostly proposed. `focus-delegation`/`selection` are real but assume host == collection (the `controller` param is the concrete next tweak); `type-ahead` is real but the wrong tool here; `filter`, `clearable`, `live-status`, loader-as-provider, and `windowed` are unbuilt. The most informative next prototype is adding `controller` to `FocusDelegation` and proving virtual focus across an input → listbox pair.

---

## From markup to traits

Every attribute / element / provider above is the surface of exactly one intent's trait. The full map:

| Intent | Trait (`with*`) | HTML surface | Markup | Status |
|---|---|---|---|---|
| [Anchor](/intents/anchor/) | `withAnchoredSurface` | **behavior** (binding) + **provider** (positioning strategy / Floating UI adapter) | `anchor="…"` / `anchored="bottom-start;flip"` | proposed; anchor intent exists |
| [Focus Delegation](/intents/focus-delegation/) | `withFocusDelegation` | **behavior** | `focus-delegation="orientation=vertical"` | **real, split** (`fui:FocusDelegation.ts`) |
| [Selection](/intents/selection/) | `withSelection` | **behavior** | `selection="multiSelectable"` | **real, split** (`fui:Selection.ts`) |
| [Type-Ahead](/intents/type-ahead/) | `withTypeAhead` | **behavior** | `type-ahead` | **real** (`fui:TypeAheadBehavior.ts`) |
| [Input](/intents/input/) | `withClearable` | **behavior** | `clearable` | proposed |
| [Live Region Status](/intents/live-region-status/) | `withLiveStatus` | **provider** (one announcer per app) + behavior trigger | `live-status` + `customContexts:announcer` | proposed |
| [Windowed Collection](/intents/windowed-collection/) | `withWindowing` | **behavior** on the listbox | `windowed` | proposed |
| [Loader](/intents/loader/) | `withAsyncOptions` | **provider** (`loaderIntent`) + behavior | `filter="async"` + `customContexts:loaderIntent` | provider mechanism **real** |
| [Typography](/intents/typography/) | `withTruncation` | **behavior** (or CSS layer) on options | `truncate` | proposed |

The desugaring inside the convenience element is just trait composition over the substrate — structurally identical to `loader.load(promise, [traitA, traitB])`. The element reads its resolved intent and *applies the behaviors* (sets the attributes / instantiates the trait), rather than re-implementing any of them:

```typescript
// <drop-list> connectedCallback (sketch)
const intent = resolveDroplistIntent(this);          // preset attrs ⊕ injected profile ⊕ defaults
const surface = this.#buildSkeleton();               // trigger + role=listbox + <li role=option>

// each line below is the COMPONENT applying one trait's behavior-face:
surface.setAttribute('focus-delegation', focusValue(intent));                // withFocusDelegation
surface.setAttribute('selection', selectionValue(intent));                   // withSelection
surface.setAttribute('anchored', anchoredValue(intent));                     // withAnchoredSurface

if (intent.editable) {
  // Editable: the INPUT is the focus host, and typing FILTERS instead of seeking.
  surface.setAttribute('focus-delegation', `${focusValue(intent)};controller=${this.#input.id}`);
  this.#input.toggleAttribute('clearable', true);                            // withClearable
  this.#input.setAttribute('filter', intent.filter);                         // withAsyncOptions / client filter
  surface.toggleAttribute('live-status', true);                             // withLiveStatus
} else {
  surface.toggleAttribute('type-ahead', true);                              // withTypeAhead (seek, not filter)
}

if (intent.windowed) surface.toggleAttribute('windowed', true);              // withWindowing
if (intent.truncate) surface.toggleAttribute('truncate', true);             // withTruncation
```

Note the `editable` branch: it is the whole dropdown→autocomplete delta in code — `type-ahead` is swapped for `filter`, the focus host moves to the input via `controller`, and `clearable` + `live-status` come along. Everything else is identical. (`composite-widget` could replace the `focus-delegation` + `selection` pair as a one-attribute bundle; the split form is shown for clarity.)

The component is a *thin assembler*. All nine behaviors are owned by intents that menus, trees, grids, comboboxes, and date pickers reuse — the component just selects which to stamp.

---

## The droplist substrate

Pulling it together, the **droplist** abstraction is precisely:

1. a **semantic skeleton** — a trigger (button *or* combobox input) + a `role=listbox`/`menu` surface + an option collection;
2. a **stack of behaviors** on that skeleton, each the behavior-face of one intent's trait;
3. an **intent profile injected** above it, that the behaviors read to resolve dimension values;
4. optionally, **service providers** (positioning strategy, announcer, loader intent) consumed via DI.

The concrete members are presets over this substrate:

| Concrete component | = droplist substrate with… |
|---|---|
| **Dropdown** | `single`, button trigger |
| **Multi-dropdown** | `multiSelectable`, button trigger |
| **Autocomplete** | `single`/`multiple` + `editable` + `filter` + `clearable` + `live-status` |
| **Menu-button** | `roving` focus, `independent` selection (no persisted value) |
| **Native** | the `<select>` baseline — zero behaviors |

No member is a distinct code path; each is a different point in the same dimension space, expressed as different attribute values.

### Where the intent profile comes from

Following the `loaderIntent` precedent, the profile resolves from the **injector chain**, not just per-element attributes. An app declares a house droplist policy once on the injector root, and individual instances override:

```javascript
import InjectorRoot from '/plugs/webinjectors/InjectorRoot.ts';

const injector = InjectorRoot.getInjectorRootOf(document).ensureInjector(appRoot);
injector.set('customContexts:droplistIntent', {
  focus: 'virtual',           // every custom droplist in this app uses virtual focus…
  collision: 'flip;shift',    // …flips near edges…
  truncate: true,             // …and truncates long labels.
});
```

A single line makes "every dropdown here is virtual-focus, edge-aware, truncating" an app-level policy — and any one `<drop-list>` can still override via its own attributes. This is the same resolution order Resource Loader already uses (injected intent ⊕ call-site override ⊕ `DEFAULT_INTENT`).

---

## Open questions

The seams the HTML walkthrough exposed — to resolve *before* building any trait:

1. **Split `composite-widget` into `focus-delegation` + `selection`? — Prototyped ✅.** Plateau folded both into `we:CompositeWidget.ts`. The split was built as two independent behaviors — `we:plateau/src/blocks/attributes/FocusDelegation.ts` and `fui:Selection.ts` — that coordinate **only** through the DOM (`aria-activedescendant`/`aria-current`) and the `activedescendantchange` event; neither references the other. A green test (`we:__tests__/FocusDelegationSelection.split.test.ts`, 14 cases) proves each works standalone *and* that stacking both reproduces the old bundle (init-follows-focus, single-select arrowing, multi-select decoupling). Two findings fell out of the experiment: (a) the keyboard model **partitions cleanly** — arrows/Home/End/type-ahead-seek belong to focus, Enter/Space-commit to selection, with *no key handled by both* (Space is excluded from type-ahead so selection owns it); (b) **activation order is load-bearing** — `selection` must connect before `focus`, so its `activedescendantchange` listener is live when `focus` stamps the initial active item (this is open question #5, observed for real). **Recommendation:** keep `composite-widget` as a thin *bundle* that composes the two (single source of truth), not duplicated logic. That collapse + retiring the bundle's (already-red, internals-coupled) test is the remaining step — not yet done.

2. **Anchor: behavior, provider, or both?** Placement binding (`anchor="surface-id"`) is a behavior, but the *positioning strategy* (JS Floating UI vs. CSS anchor positioning) is a swappable service better delivered as a DI provider / adapter. The split between "bind these two elements" and "compute the position" needs a clean line.

3. **The convenience element's name and granularity.** Is it one `<drop-list>` with dimension attributes (`multiple`, `filter`), or distinct `<auto-complete>` / `<multi-select>` tags? Native uses one `<select multiple>`; the team's instinct may differ. Naming is a real decision, not a detail.

4. **Inter-trait invariants.** `withWindowing` must not unmount the option `composite-widget` marks active; `withAsyncOptions` and `withLiveStatus` both write status. Through-the-DOM coordination needs an enforced contract (e.g. the option collection guarantees "active option always mounted"), not an implicit handshake.

5. **Behavior activation order.** `anchored` must build the surface before `composite-widget` wires `aria-activedescendant` onto it. With behaviors that's connection-order-dependent; the substrate (or the `<drop-list>` assembler) must guarantee order, not leave it to attribute position.

6. **First prototype target.** `withAnchoredSurface` is the highest-leverage, most-reused candidate (menu/popover/tooltip/datepicker all need it) and the one paradigm with *no* existing behavior yet (`type-ahead` and `composite-widget` already exist). Building it against a real Frontier UI surface — or first formalizing the substrate's `DropdownContext`/`TraitHandle` contract as a project-owned **Protocol** — is the fork in the road.

7. **Doc fix.** Correct the "dropdown" → "droplist" wording in `we:droplist.njk` (flagged above) so the abstract-family vs. concrete-member distinction holds across the standard.
```
