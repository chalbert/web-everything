/**
 * Error-summary model (#1114, webvalidation completion #1090) — the GOV.UK dual-model aggregation, pure
 * and DOM-free (spec njk:52,221). The runtime element (`plugs/webvalidation/ValidationErrorSummary.ts`)
 * consumes this verbatim, so the ordering + field-link rules have one home and cannot drift.
 *
 * The model owns: a per-field error entry registry keyed by a stable field id, **DOM-ordered** iteration
 * (entries surface in the order their fields appear in the document, not insertion order), and the
 * field-link target each entry points at. It is verbatim-parity by construction: an entry's `message` is
 * the field's own inline message, copied, never re-derived.
 */

/** One aggregated error entry — a field's id, its current blocking message, and the link target id. */
export interface ErrorSummaryEntry {
  /** Stable id of the errored field (the `<validity-merge-field>`/control id). */
  readonly fieldId: string;
  /** The verbatim inline message (copied from the field, never re-derived). */
  readonly message: string;
  /** The element id the summary entry links to (focuses on activation). Defaults to `fieldId`. */
  readonly targetId: string;
  /** Optional human label for the entry text (the field's accessible name); falls back to the message. */
  readonly label?: string;
}

/**
 * The pure aggregation model: a registry of field error entries with DOM-ordered read-out. The element
 * feeds it `set(fieldId, …)` on a `became-invalid`, `clear(fieldId)` on a `became-valid`, and reads
 * `ordered(rootEl)` to render the summary list. No DOM is held — `ordered` takes the live root so the
 * order always reflects the current document.
 */
export class ErrorSummaryModel {
  readonly #entries = new Map<string, ErrorSummaryEntry>();

  /** Record (or replace) a field's blocking error. */
  set(entry: ErrorSummaryEntry): void {
    this.#entries.set(entry.fieldId, { ...entry, targetId: entry.targetId || entry.fieldId });
  }

  /** Drop a field's error (it became valid). Returns whether an entry existed. */
  clear(fieldId: string): boolean {
    return this.#entries.delete(fieldId);
  }

  /** Whether any errors are currently aggregated. */
  get hasErrors(): boolean {
    return this.#entries.size > 0;
  }

  /** The raw entries in insertion order (rarely what you want — prefer {@link ordered}). */
  get entries(): ReadonlyArray<ErrorSummaryEntry> {
    return [...this.#entries.values()];
  }

  /**
   * The entries in **DOM order** — sorted by the document position of each entry's target element within
   * `root`. An entry whose target is not found in `root` sorts after the located ones (input-stable),
   * so a detached field never breaks the summary. This is the GOV.UK "ordered by DOM" rule.
   */
  ordered(root: ParentNode): ReadonlyArray<ErrorSummaryEntry> {
    const pos = new Map<string, number>();
    let i = 0;
    // Walk the root's elements once; record the first index at which each id appears.
    const all = root.querySelectorAll('[id]');
    all.forEach((el) => {
      const id = (el as HTMLElement).id;
      if (id && !pos.has(id)) pos.set(id, i++);
    });
    const NOT_FOUND = Number.MAX_SAFE_INTEGER;
    return [...this.#entries.values()].sort((a, b) => {
      const pa = pos.get(a.targetId) ?? NOT_FOUND;
      const pb = pos.get(b.targetId) ?? NOT_FOUND;
      return pa - pb;
    });
  }
}
