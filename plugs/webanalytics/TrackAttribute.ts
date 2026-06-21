/**
 * @file webanalytics/TrackAttribute.ts
 * @description The `data-track` declarative telemetry-emission seam (#1475, ratified #1415) — the
 *   author-facing front of webanalytics. Putting `data-track="click:cta-clicked"` on any element binds
 *   that element's interaction to `resolve(customTrackers).track(event, properties)` — no script, no
 *   rendered surface. The behavior owns only the *binding* (which interaction → which event name +
 *   properties); the *delivery* is the resolved `CustomTracker` backend (#1012), and with no backend
 *   configured it degrades silently to {@link NoopTracker} (telemetry is advisory — "no sink" is a
 *   no-op, never an error).
 *
 *   **Home: Web Behaviors, not Web Directives.** Both are non-rendering annotation layers, but a
 *   directive is a *template/comment-structural* transform (`<!-- if -->`, multi-template slots) while
 *   this binds an *element's runtime interaction* to a side effect — the `CustomAttribute` shape (an
 *   "is-driven-by-interaction" capability on a host), exactly like every other behavior. So it ships as
 *   a `CustomAttribute` in the analytics plug (next to the tracker it calls), interaction-driven, which
 *   means it honours the `inert` dead-zone for free (it goes dormant via {@link deactivatedCallback}).
 *
 *   Grammar — `data-track="[interaction:]eventName"`:
 *   - `data-track="cta-clicked"` — default interaction `click`.
 *   - `data-track="submit:signup-submitted"` — on the element's `submit`.
 *   - `data-track="view:hero-seen"` — once, when the element first enters the viewport.
 *   - `data-track="focus:field-focused"` — on `focusin`.
 *   - `data-track="custom:thing-happened"` + `data-track-on="my-event"` — on a named custom DOM event.
 *   - `data-track-props='{"plan":"pro"}'` — static properties merged into the tracked event.
 */

import CustomAttribute from '../webbehaviors/CustomAttribute';
import InjectorRoot from '../webinjectors/InjectorRoot';
import CustomTrackerRegistry from './CustomTrackerRegistry';
import { NoopTracker, type CustomTracker, type AnalyticsProperties } from '../../analytics/provider.js';

declare global {
  interface Window {
    customTrackers?: CustomTrackerRegistry;
  }
}

/** The interaction families a `data-track` binding can listen for. */
export type TrackInteraction = 'click' | 'submit' | 'view' | 'focus' | 'custom';

const KNOWN_INTERACTIONS: readonly TrackInteraction[] = ['click', 'submit', 'view', 'focus', 'custom'];

/** The DOM-event name each non-`view`/`custom` interaction binds to. */
const INTERACTION_EVENT: Record<Exclude<TrackInteraction, 'view' | 'custom'>, string> = {
  click: 'click',
  submit: 'submit',
  focus: 'focusin',
};

/** Shared silent fallback used when no `customTrackers` registry is in scope (degrade, never throw). */
const noopTracker = new NoopTracker();

/** Parsed `data-track` value: the interaction to bind and the event name to emit. */
interface ParsedBinding {
  interaction: TrackInteraction;
  event: string;
}

/** Parse `[interaction:]eventName`. An unknown/absent interaction prefix defaults to `click`. */
function parseBinding(value: string): ParsedBinding | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const sep = trimmed.indexOf(':');
  if (sep === -1) return { interaction: 'click', event: trimmed };
  const prefix = trimmed.slice(0, sep).trim() as TrackInteraction;
  const event = trimmed.slice(sep + 1).trim();
  if (!event) return null;
  if (!KNOWN_INTERACTIONS.includes(prefix)) return { interaction: 'click', event: trimmed };
  return { interaction: prefix, event };
}

/**
 * The `data-track` behavior. Interaction-driven (the default surface) ⇒ activates on connect, goes
 * dormant inside an `inert` subtree, and tears down on disconnect — the registry drives those
 * transitions through {@link activatedCallback} / {@link deactivatedCallback}.
 */
export default class TrackAttribute extends CustomAttribute {
  /** Re-bind when the declaration changes. */
  static observedAttributes = ['data-track', 'data-track-on', 'data-track-props'];

  /** Teardown for whatever listener/observer this binding installed. */
  #teardown: (() => void) | null = null;

  /** Resolve the tracker for this host: nearest injector scope, then the global, then a silent no-op. */
  #resolveTracker(): CustomTracker {
    const host = this.ownerElement;
    if (host) {
      const scoped = InjectorRoot.getProviderOf(host, 'customTrackers');
      if (scoped instanceof CustomTrackerRegistry) return scoped.resolve();
      const global = typeof window !== 'undefined' ? window.customTrackers : undefined;
      if (global instanceof CustomTrackerRegistry) return global.resolve();
    }
    return noopTracker; // no sink configured — degrade silently (#1003 native-first floor)
  }

  /** Read the static `data-track-props` JSON, if any (malformed JSON is ignored — telemetry never throws). */
  #properties(): AnalyticsProperties | undefined {
    const raw = this.ownerElement?.getAttribute('data-track-props');
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as AnalyticsProperties) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Deliver the configured event through the resolved backend. */
  #emit(event: string): void {
    this.#resolveTracker().track(event, this.#properties());
  }

  activatedCallback(): void {
    const host = this.ownerElement;
    if (!host) return;
    const binding = parseBinding(this.value);
    if (!binding) return;
    const { interaction, event } = binding;

    if (interaction === 'view') {
      if (typeof IntersectionObserver === 'undefined') {
        // No observation available — fire the impression immediately (better than dropping it).
        this.#emit(event);
        return;
      }
      const observer = new IntersectionObserver((entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#emit(event);
            obs.disconnect(); // one-shot impression
          }
        }
      });
      observer.observe(host);
      this.#teardown = () => observer.disconnect();
      return;
    }

    const domEvent =
      interaction === 'custom'
        ? host.getAttribute('data-track-on')?.trim() || ''
        : INTERACTION_EVENT[interaction];
    if (!domEvent) return; // `custom` with no `data-track-on` — nothing to bind

    const handler = () => this.#emit(event);
    host.addEventListener(domEvent, handler);
    this.#teardown = () => host.removeEventListener(domEvent, handler);
  }

  deactivatedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }

  attributeChangedCallback(): void {
    // Re-bind on any declaration change, but only while activated (dormant hosts re-read on re-activation).
    if (this.#teardown) {
      this.deactivatedCallback();
      this.activatedCallback();
    }
  }
}
