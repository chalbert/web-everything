/**
 * `<validation-error-summary>` (#1114, webvalidation completion #1090) — the GOV.UK error-summary element.
 *
 * A form-level aggregate that listens to the slice-2 `validation.control.*` stable-id events (#1111)
 * bubbling up from the `<validity-merge-field>` controls under it: `became-invalid` adds the field's
 * verbatim blocking message, `became-valid` removes it. It renders a `role="alert"` list **DOM-ordered**
 * (entries appear in the order their fields appear in the document, via the pure {@link ErrorSummaryModel}),
 * each entry a link to its errored field; activating an entry focuses that field. On a submit-blocked
 * signal the summary moves focus to itself (the GOV.UK "focus on blocked" rule).
 *
 * Non-invasive: patches no global, registered through the element registry like its siblings (the runtime
 * surface is the element, not a plug global, #606). The aggregation/ordering logic lives in the pure
 * `error-summary/` model so it is unit-tested without the DOM.
 */
import { ErrorSummaryModel } from '../../error-summary/index.js';
import type { ErrorSummaryEntry } from '../../error-summary/index.js';

interface BecameInvalidDetail {
  merged?: { messages?: { source: string; message: string }[]; blocking?: string | null };
}

/** `CSS.escape` with a conservative fallback for environments that lack it (e.g. older test DOMs). */
function cssEscape(id: string): string {
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(id);
  return id.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

export default class ValidationErrorSummary extends HTMLElement {
  readonly #model = new ErrorSummaryModel();
  #list: HTMLOListElement | null = null;
  /** The node the listeners are bound to (the form/root scope, since fields are siblings, not children). */
  #listenTarget: EventTarget | null = null;

  connectedCallback(): void {
    this.setAttribute('role', 'alert');
    this.setAttribute('aria-live', 'assertive');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
    this.#render();
    // Listen at the scope (nearest form, else the root) — the fields are SIBLINGS of this summary, so a
    // bubbling control event passes through the form/root, not through this element (#1111).
    this.#listenTarget = this.#scope();
    this.#listenTarget.addEventListener('validation.control.became-invalid', this.#onBecameInvalid as EventListener);
    this.#listenTarget.addEventListener('validation.control.became-valid', this.#onBecameValid as EventListener);
    // The form-level submit-blocked signal moves focus here (GOV.UK focus-on-blocked).
    this.#listenTarget.addEventListener('validation.form.submit-blocked', this.#onSubmitBlocked as EventListener);
  }

  disconnectedCallback(): void {
    const t = this.#listenTarget;
    if (!t) return;
    t.removeEventListener('validation.control.became-invalid', this.#onBecameInvalid as EventListener);
    t.removeEventListener('validation.control.became-valid', this.#onBecameValid as EventListener);
    t.removeEventListener('validation.form.submit-blocked', this.#onSubmitBlocked as EventListener);
    this.#listenTarget = null;
  }

  /** The current aggregated entries in DOM order (read scope = nearest form, else this element's root). */
  get entries(): ReadonlyArray<ErrorSummaryEntry> {
    return this.#model.ordered(this.#scope());
  }

  /** Programmatically move focus to the summary (the focus-on-blocked behaviour, also callable by a form). */
  focusSummary(): void {
    this.focus();
  }

  // ── Event handlers ───────────────────────────────────────────────────────────

  readonly #onBecameInvalid = (event: CustomEvent<BecameInvalidDetail>): void => {
    const field = event.target as HTMLElement | null;
    if (!field) return;
    const fieldId = this.#fieldIdOf(field);
    const message = event.detail?.merged?.messages?.[0]?.message ?? 'This field is invalid.';
    this.#model.set({ fieldId, message, targetId: fieldId, label: this.#labelOf(field) });
    this.#render();
  };

  readonly #onBecameValid = (event: CustomEvent): void => {
    const field = event.target as HTMLElement | null;
    if (!field) return;
    if (this.#model.clear(this.#fieldIdOf(field))) this.#render();
  };

  readonly #onSubmitBlocked = (): void => {
    if (this.#model.hasErrors) this.focusSummary();
  };

  // ── Rendering ────────────────────────────────────────────────────────────────

  #scope(): ParentNode {
    return this.closest('form') ?? (this.getRootNode() as ParentNode) ?? this;
  }

  /** Resolve a field's stable id, assigning one if absent so the summary can link to it. */
  #fieldIdOf(field: HTMLElement): string {
    if (!field.id) field.id = `vmf-${Math.random().toString(36).slice(2)}`;
    return field.id;
  }

  /** The field's accessible label, for the entry text — falls back to the message at render time. */
  #labelOf(field: HTMLElement): string | undefined {
    const labelled = field.getAttribute('aria-label');
    if (labelled) return labelled;
    const control = field.querySelector('input, select, textarea');
    const id = control?.id;
    if (id) {
      const label = (field.closest('form') ?? document).querySelector(`label[for="${id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }
    return undefined;
  }

  #render(): void {
    const entries = this.#model.ordered(this.#scope());
    this.hidden = entries.length === 0;
    if (!this.#list) {
      this.#list = document.createElement('ol');
      this.#list.className = 'error-summary-list';
      this.append(this.#list);
    }
    this.#list.replaceChildren(
      ...entries.map((e) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${e.targetId}`;
        a.textContent = e.label ? `${e.label}: ${e.message}` : e.message;
        // Activating an entry focuses the linked field (GOV.UK "entries link to fields").
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const target = this.#scope().querySelector(`#${cssEscape(e.targetId)}`) as HTMLElement | null;
          // Prefer focusing the inner form control; fall back to the field wrapper. Inner LAST so it wins.
          const control = target?.querySelector('input, select, textarea') as HTMLElement | null;
          if (control) control.focus();
          else target?.focus?.();
        });
        li.append(a);
        return li;
      }),
    );
  }
}
