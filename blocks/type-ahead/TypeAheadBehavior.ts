/**
 * @file TypeAheadBehavior.ts
 * @description Keyboard type-ahead navigation for listboxes, menus, selects,
 * and trees. Buffers printable keystrokes, moves focus to the matching item,
 * and resets the buffer after an idle timeout. Moves focus — never filters.
 *
 * Proof-of-concept implementation of the Type-Ahead standard
 * (intents.json#type-ahead, blocks.json#type-ahead).
 *
 * @example
 * ```html
 * <ul role="listbox" type-ahead>
 *   <li role="option" tabindex="-1">Argentina</li>
 *   <li role="option" tabindex="-1">Australia</li>
 *   <li role="option" tabindex="-1">Brazil</li>
 * </ul>
 * ```
 */

import CustomAttribute, {
  type CustomAttributeOptions,
} from '../../plugs/webbehaviors/CustomAttribute';
import type { TypeAheadMatching, TypeAheadOptions } from './types';

/** Selector for navigable items, by ARIA role or explicit opt-in marker. */
const ITEM_SELECTOR =
  '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="treeitem"],[data-type-ahead-item]';

const DEFAULT_MATCHING: TypeAheadMatching = 'prefix-then-cycle';
const DEFAULT_RESET_MS = 500;

/**
 * Type-ahead navigation behavior. Attaches to a container whose children are
 * the navigable items. Attribute: `type-ahead`.
 */
export default class TypeAheadBehavior extends CustomAttribute<
  CustomAttributeOptions & TypeAheadOptions
> {
  #buffer = '';
  #timer: ReturnType<typeof setTimeout> | null = null;
  #matching: TypeAheadMatching = DEFAULT_MATCHING;
  #resetMs = DEFAULT_RESET_MS;
  #wrap = true;
  #resolveLabel?: (item: Element) => string;

  connectedCallback(): void {
    if (!this.target) return;
    this.#readConfig();
    this.target.addEventListener('keydown', this.#handleKeydown);
  }

  disconnectedCallback(): void {
    this.target?.removeEventListener('keydown', this.#handleKeydown);
    this.#clearTimer();
    this.#buffer = '';
  }

  /** The current character buffer (lowercased). */
  get buffer(): string {
    return this.#buffer;
  }

  /** The active matching strategy. */
  get matching(): TypeAheadMatching {
    return this.#matching;
  }

  /** The idle timeout (ms) before the buffer resets. */
  get resetMs(): number {
    return this.#resetMs;
  }

  /** Whether focus wraps past the ends of the collection. */
  get wrap(): boolean {
    return this.#wrap;
  }

  // ── Config ─────────────────────────────────────────

  #readConfig(): void {
    const target = this.target;
    if (!target) return;

    // Programmatic options first, then declarative attributes override.
    this.#matching = this.options.matching ?? DEFAULT_MATCHING;
    this.#resetMs = this.options.resetMs ?? DEFAULT_RESET_MS;
    this.#wrap = this.options.wrap ?? true;
    this.#resolveLabel = this.options.label;

    const match = target.getAttribute('type-ahead-match');
    if (match === 'prefix' || match === 'cycle' || match === 'prefix-then-cycle') {
      this.#matching = match;
    }

    const reset = target.getAttribute('type-ahead-reset');
    if (reset !== null && reset !== '') {
      const ms = Number(reset);
      if (!Number.isNaN(ms) && ms >= 0) this.#resetMs = ms;
    }

    const wrap = target.getAttribute('type-ahead-wrap');
    if (wrap !== null) this.#wrap = !(wrap === 'false' || wrap === 'clamp');
  }

  // ── Keyboard ───────────────────────────────────────

  #handleKeydown = (event: KeyboardEvent): void => {
    // Leave shortcut chords and non-printable keys (Arrow/Enter/Tab/Escape) alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key.length !== 1) return;
    // Space starts no search; let the host widget use it for selection.
    if (key === ' ' && this.#buffer === '') return;

    this.#buffer += key.toLowerCase();
    this.#search();
    this.#scheduleReset();
  };

  // ── Matching ───────────────────────────────────────

  #search(): void {
    const items = this.#items();
    if (items.length === 0) return;

    const current = this.#currentIndex(items);
    const start = current < 0 ? 0 : current;

    let query = this.#buffer;
    let skipCurrent = false;

    if (this.#matching === 'cycle') {
      query = this.#buffer[0] ?? '';
      skipCurrent = true;
    } else if (
      this.#matching === 'prefix-then-cycle' &&
      this.#buffer.length > 1 &&
      this.#allSameChar(this.#buffer)
    ) {
      // Same key pressed repeatedly → cycle among same-initial items.
      query = this.#buffer[0];
      skipCurrent = true;
    }

    const matchIndex = this.#findMatch(items, query, start, skipCurrent);
    if (matchIndex >= 0) {
      this.#focusItem(items[matchIndex]);
      this.#dispatch('typeahead-match', { query: this.#buffer, matched: items[matchIndex] });
    } else {
      this.#dispatch('typeahead-nomatch', { query: this.#buffer });
    }
  }

  #findMatch(
    items: HTMLElement[],
    query: string,
    start: number,
    skipCurrent: boolean
  ): number {
    if (query === '') return -1;
    const n = items.length;
    const first = skipCurrent ? 1 : 0;
    const last = skipCurrent ? n : n - 1;
    for (let offset = first; offset <= last; offset++) {
      const raw = start + offset;
      if (!this.#wrap && raw >= n) break;
      const index = raw % n;
      if (this.#label(items[index]).startsWith(query)) return index;
    }
    return -1;
  }

  #allSameChar(value: string): boolean {
    return value.length > 0 && [...value].every((char) => char === value[0]);
  }

  // ── DOM helpers ────────────────────────────────────

  #items(): HTMLElement[] {
    if (!this.target) return [];
    return Array.from(this.target.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
      (el) =>
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-disabled') !== 'true' &&
        el.getAttribute('aria-hidden') !== 'true'
    );
  }

  #currentIndex(items: HTMLElement[]): number {
    const active = this.target?.ownerDocument.activeElement as HTMLElement | null;
    let index = active ? items.indexOf(active) : -1;
    if (index === -1) {
      const activeId = this.target?.getAttribute('aria-activedescendant');
      if (activeId) index = items.findIndex((item) => item.id === activeId);
    }
    return index;
  }

  #label(item: HTMLElement): string {
    let text = '';
    if (this.#resolveLabel) {
      text = this.#resolveLabel(item);
    } else {
      const ariaLabel = item.getAttribute('aria-label');
      if (ariaLabel) {
        text = ariaLabel;
      } else {
        const labelledBy = item.getAttribute('aria-labelledby');
        const referenced = labelledBy
          ? this.target?.ownerDocument.getElementById(labelledBy)
          : null;
        text = referenced?.textContent ?? item.textContent ?? '';
      }
    }
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  #focusItem(item: HTMLElement): void {
    // When the container drives selection via aria-activedescendant, keep it in
    // sync; otherwise move DOM focus. A Composite Widget's roving tabindex, when
    // present, owns the actual focus move — type-ahead only picks the target.
    const target = this.target;
    if (
      target &&
      (target.hasAttribute('aria-activedescendant') || target.getAttribute('role') === 'combobox') &&
      item.id
    ) {
      target.setAttribute('aria-activedescendant', item.id);
    }
    item.focus();
  }

  #dispatch(type: string, detail: Record<string, unknown>): void {
    this.target?.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }

  // ── Reset timer ────────────────────────────────────

  #scheduleReset(): void {
    this.#clearTimer();
    this.#timer = setTimeout(() => {
      const cleared = this.#buffer;
      this.#buffer = '';
      this.#timer = null;
      if (cleared) this.#dispatch('typeahead-reset', { query: cleared });
    }, this.#resetMs);
  }

  #clearTimer(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
