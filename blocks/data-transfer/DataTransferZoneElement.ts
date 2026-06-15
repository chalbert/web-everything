/**
 * @file blocks/data-transfer/DataTransferZoneElement.ts
 * @description The `<data-transfer-zone>` custom element — the runtime block that
 * implements the Data-Transfer Intent (#007). It collapses three native sources of a
 * `DataTransfer` payload — drag-and-drop, clipboard paste, and `<input type=file>` —
 * into ONE normalized `receive` event, enforces a declared `accepts` contract
 * (dispatching `reject` for anything that fails), exposes the copy-vs-move flow as the
 * drag `dropEffect`, and (for the emit half) writes a typed payload onto an outgoing
 * drag via {@link DataTransferZoneElement.setEmitPayload}.
 *
 * Native-first: it leans entirely on the platform `DataTransfer`/`DragEvent`/
 * `ClipboardEvent` APIs and a real `<input type=file>` for the keyboard/a11y path —
 * no library, no synthetic drag model.
 *
 * Default tag name: data-transfer-zone
 *
 * @example
 * ```html
 * <data-transfer-zone accepts="files" accept-types="image/*" max-size="5242880" effect="copy">
 *   Drop images here, paste, or choose a file.
 * </data-transfer-zone>
 * ```
 */

import {
  DEFAULT_ACCEPT,
  EMIT_EVENT,
  RECEIVE_EVENT,
  REJECT_EVENT,
  type AcceptSpec,
  type Acceptance,
  type EmitDetail,
  type NormalizedItem,
  type PayloadKind,
  type ReceiveDetail,
  type RejectDetail,
  type TransferEffect,
  type TransferFlow,
} from './types';
import { evaluateAccept, normalizeDataTransfer, normalizeFileList } from './normalize';

const PAYLOAD_KINDS: PayloadKind[] = ['text', 'rich', 'files', 'items'];

export default class DataTransferZoneElement extends HTMLElement {
  static observedAttributes = ['accepts', 'accept-types', 'max-size', 'flow', 'effect', 'acceptance'];

  #fileInput: HTMLInputElement | null = null;
  #trigger: HTMLButtonElement | null = null;
  #dragDepth = 0;
  #built = false;
  #emitItems: NormalizedItem[] = [];

  // ---- Parsed configuration (derived from attributes) ----

  get flow(): TransferFlow {
    const v = this.getAttribute('flow');
    return v === 'emit' || v === 'both' ? v : 'receive';
  }

  get effect(): TransferEffect {
    return this.getAttribute('effect') === 'move' ? 'move' : 'copy';
  }

  /** The declared accept contract, read from attributes (defaults to the most-permissive `any`). */
  get acceptSpec(): AcceptSpec {
    const acceptsAttr = this.getAttribute('accepts');
    const typesAttr = this.getAttribute('accept-types');
    const maxAttr = this.getAttribute('max-size');
    const explicitAcceptance = this.getAttribute('acceptance') as Acceptance | null;

    const kinds = (acceptsAttr ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is PayloadKind => (PAYLOAD_KINDS as string[]).includes(s));
    const types = (typesAttr ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const maxSize = maxAttr != null && maxAttr !== '' ? Number(maxAttr) : null;

    // A zone is `declared` the moment it states any constraint; else it falls back to the default.
    const acceptance: Acceptance =
      explicitAcceptance === 'declared' || explicitAcceptance === 'any'
        ? explicitAcceptance
        : kinds.length || types.length || maxSize != null
          ? 'declared'
          : DEFAULT_ACCEPT.acceptance;

    return { acceptance, kinds, types, maxSize: Number.isFinite(maxSize as number) ? maxSize : null };
  }

  // ---- Lifecycle ----

  connectedCallback(): void {
    if (!this.#built) this.#build();
    this.#bind();
    this.#reflectA11y();
  }

  disconnectedCallback(): void {
    this.#unbind();
  }

  attributeChangedCallback(): void {
    if (this.#built) this.#reflectA11y();
  }

  #build(): void {
    this.#built = true;
    // The keyboard/a11y affordance: a real button that opens a hidden, multiple file input.
    // Drag-drop and paste are pointer/clipboard sugar on top of this always-present path.
    this.#fileInput = document.createElement('input');
    this.#fileInput.type = 'file';
    this.#fileInput.multiple = true;
    this.#fileInput.hidden = true;
    this.#fileInput.setAttribute('aria-hidden', 'true');
    this.#fileInput.tabIndex = -1;

    this.#trigger = document.createElement('button');
    this.#trigger.type = 'button';
    this.#trigger.className = 'data-transfer-zone__trigger';
    this.#trigger.textContent = this.getAttribute('trigger-label') ?? 'Choose files';

    this.append(this.#trigger, this.#fileInput);
  }

  #bind(): void {
    if (this.flow !== 'emit') {
      this.addEventListener('dragenter', this.#onDragEnter);
      this.addEventListener('dragover', this.#onDragOver);
      this.addEventListener('dragleave', this.#onDragLeave);
      this.addEventListener('drop', this.#onDrop);
      this.addEventListener('paste', this.#onPaste);
      this.#trigger?.addEventListener('click', this.#onTriggerClick);
      this.#fileInput?.addEventListener('change', this.#onFileChange);
    }
    if (this.flow !== 'receive') {
      this.setAttribute('draggable', 'true');
      this.addEventListener('dragstart', this.#onDragStart);
      this.addEventListener('copy', this.#onCopy);
    }
  }

  #unbind(): void {
    this.removeEventListener('dragenter', this.#onDragEnter);
    this.removeEventListener('dragover', this.#onDragOver);
    this.removeEventListener('dragleave', this.#onDragLeave);
    this.removeEventListener('drop', this.#onDrop);
    this.removeEventListener('paste', this.#onPaste);
    this.removeEventListener('dragstart', this.#onDragStart);
    this.removeEventListener('copy', this.#onCopy);
    this.#trigger?.removeEventListener('click', this.#onTriggerClick);
    this.#fileInput?.removeEventListener('change', this.#onFileChange);
  }

  #reflectA11y(): void {
    if (this.flow !== 'emit') {
      if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
      if (!this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
        this.setAttribute('aria-label', 'File drop zone — drag, paste, or choose files');
      }
    }
  }

  // ---- Emit half (public API) ----

  /** Queue the payload this zone writes onto an outgoing drag/copy (the `emit` flow). */
  setEmitPayload(items: NormalizedItem[]): void {
    this.#emitItems = items;
  }

  // ---- Receive handlers ----

  #onDragEnter = (e: DragEvent): void => {
    e.preventDefault();
    this.#dragDepth += 1;
    this.toggleAttribute('data-drag-over', true);
  };

  #onDragOver = (e: DragEvent): void => {
    // Must preventDefault to become a valid drop target; mirror the configured effect.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = this.effect;
  };

  #onDragLeave = (): void => {
    this.#dragDepth = Math.max(0, this.#dragDepth - 1);
    if (this.#dragDepth === 0) this.toggleAttribute('data-drag-over', false);
  };

  #onDrop = (e: DragEvent): void => {
    e.preventDefault();
    this.#dragDepth = 0;
    this.toggleAttribute('data-drag-over', false);
    if (e.dataTransfer) this.#ingest(normalizeDataTransfer(e.dataTransfer, 'drop'));
  };

  #onPaste = (e: ClipboardEvent): void => {
    if (!e.clipboardData) return;
    e.preventDefault();
    this.#ingest(normalizeDataTransfer(e.clipboardData, 'paste'));
  };

  #onTriggerClick = (): void => {
    this.#fileInput?.click();
  };

  #onFileChange = (): void => {
    const files = this.#fileInput?.files;
    if (files && files.length) {
      this.#ingest(normalizeFileList(files));
      // Reset so picking the same file again still fires.
      if (this.#fileInput) this.#fileInput.value = '';
    }
  };

  /** The single funnel: every source lands here, is checked, and fires `receive` or `reject`. */
  #ingest(payload: ReturnType<typeof normalizeFileList>): void {
    const { accepted, reasons } = evaluateAccept(payload, this.acceptSpec);
    if (accepted) {
      this.dispatchEvent(
        new CustomEvent<ReceiveDetail>(RECEIVE_EVENT, {
          detail: { payload, effect: this.effect },
          bubbles: true,
          cancelable: true,
        }),
      );
    } else {
      this.dispatchEvent(
        new CustomEvent<RejectDetail>(REJECT_EVENT, {
          detail: { payload, reasons },
          bubbles: true,
          cancelable: false,
        }),
      );
    }
  }

  // ---- Emit handlers ----

  #onDragStart = (e: DragEvent): void => {
    if (!e.dataTransfer || !this.#emitItems.length) return;
    this.#writePayload(e.dataTransfer);
    e.dataTransfer.effectAllowed = this.effect === 'move' ? 'move' : 'copy';
    this.dispatchEvent(
      new CustomEvent<EmitDetail>(EMIT_EVENT, {
        detail: { items: this.#emitItems, effect: this.effect },
        bubbles: true,
      }),
    );
  };

  #onCopy = (e: ClipboardEvent): void => {
    if (!e.clipboardData || !this.#emitItems.length) return;
    e.preventDefault();
    this.#writePayload(e.clipboardData);
    this.dispatchEvent(
      new CustomEvent<EmitDetail>(EMIT_EVENT, { detail: { items: this.#emitItems, effect: 'copy' }, bubbles: true }),
    );
  };

  #writePayload(dt: DataTransfer): void {
    for (const item of this.#emitItems) {
      if (item.text != null) dt.setData(item.type, item.text);
    }
  }
}
