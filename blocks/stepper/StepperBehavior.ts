/**
 * StepperBehavior — reference runtime for the draft `stepper` block (#053): the Wizard / multi-step-form
 * flow. Realizes the navigation intent's `structure: linear` value (sibling of Tabs/`lateral` and
 * Router/`hierarchical`): a fixed sequence of steps shown one at a time, with **locked progression**
 * (advance one step at a time; jump back only to completed steps; advancing past an invalid step is
 * blocked) as the default that distinguishes a Wizard from Tabs.
 *
 * Thin layer over panel switching (only the current step is shown) + a progression gate. Owns the linear
 * sequencing, the locked-progression rule, the `aria-current="step"` model, and the Step N of M
 * announcement. Emits `step-change` / `step-advance-blocked` / `flow-complete`.
 */

export type Progression = 'locked' | 'free';

export interface StepperOptions {
  /** Selector for the step content panels within the host. */
  stepSelector?: string;
  /** Selector for the step indicators (the ordered list items). */
  indicatorSelector?: string;
  /** `locked` (default) = one-at-a-time, gated; `free` = any step anytime (withFreeStepNavigation). */
  progression?: Progression;
  /** The progression gate (withStepValidation): may the user leave `fromIndex`? Default: always. */
  canAdvance?: (fromIndex: number) => boolean;
  /** Indices that may be skipped without blocking completion (withOptionalSteps). */
  optional?: number[];
  /** A polite live region for the "Step N of M" announcement. */
  liveRegion?: HTMLElement;
  /** Human label for a step, used in the announcement. */
  stepLabel?: (index: number) => string;
}

const evt = (name: string, detail: unknown, cancelable = false): CustomEvent =>
  new CustomEvent(name, { detail, bubbles: true, cancelable });

export class StepperBehavior {
  private readonly steps: HTMLElement[];
  private readonly indicators: HTMLElement[];
  private readonly progression: Progression;
  private readonly canAdvance: (i: number) => boolean;
  private readonly completed = new Set<number>();
  private index = 0;

  constructor(private readonly host: HTMLElement, private readonly opts: StepperOptions = {}) {
    this.steps = Array.from(host.querySelectorAll<HTMLElement>(opts.stepSelector ?? '[data-step]'));
    this.indicators = Array.from(host.querySelectorAll<HTMLElement>(opts.indicatorSelector ?? '[data-step-indicator]'));
    this.progression = opts.progression ?? 'locked';
    this.canAdvance = opts.canAdvance ?? (() => true);

    // Delegated controls: --step-next / --step-prev / --step-show (data attributes; native buttons).
    host.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-step-next],[data-step-prev],[data-step-show]');
      if (!t || !host.contains(t)) return;
      if (t.hasAttribute('data-step-next')) this.next(t);
      else if (t.hasAttribute('data-step-prev')) this.prev(t);
      else this.goTo(Number(t.getAttribute('data-step-show')), t);
    });
    this.render();
  }

  get count(): number { return this.steps.length; }
  get currentIndex(): number { return this.index; }

  /** Advance one step (gated in locked mode). Completing the last step finishes the flow. */
  next(trigger: HTMLElement | null = null): boolean {
    if (this.progression === 'locked' && !this.canAdvance(this.index)) {
      this.host.dispatchEvent(evt('step-advance-blocked', { step: this.index, reason: 'invalid' }));
      return false;
    }
    this.completed.add(this.index);
    if (this.index >= this.count - 1) {
      return this.host.dispatchEvent(evt('flow-complete', { steps: this.count }, true));
    }
    return this.show(this.index + 1, trigger);
  }

  /** Go back one step (always allowed). */
  prev(trigger: HTMLElement | null = null): boolean {
    return this.index > 0 ? this.show(this.index - 1, trigger) : false;
  }

  /** Jump to a step — locked mode allows only already-completed steps (or the current). */
  goTo(target: number, trigger: HTMLElement | null = null): boolean {
    if (Number.isNaN(target) || target < 0 || target >= this.count) return false;
    if (this.progression === 'locked' && target > this.index && !this.completed.has(target - 1)) {
      this.host.dispatchEvent(evt('step-advance-blocked', { step: this.index, reason: 'locked' }));
      return false;
    }
    return this.show(target, trigger);
  }

  private show(target: number, trigger: HTMLElement | null): boolean {
    const from = this.index;
    this.index = target;
    this.render();
    return this.host.dispatchEvent(evt('step-change', { from, to: target, trigger }, true));
  }

  /** Whether a step is reachable for the indicator's aria-disabled / focusability. */
  private reachable(i: number): boolean {
    return this.progression === 'free' || i <= this.index || this.completed.has(i - 1);
  }

  private render(): void {
    this.steps.forEach((panel, i) => {
      const active = i === this.index;
      panel.hidden = !active;
      panel.setAttribute('role', 'region');
      if (active) panel.setAttribute('aria-current', 'step'); else panel.removeAttribute('aria-current');
    });
    this.indicators.forEach((ind, i) => {
      if (i === this.index) ind.setAttribute('aria-current', 'step'); else ind.removeAttribute('aria-current');
      ind.toggleAttribute('aria-disabled', !this.reachable(i));
      if ('tabIndex' in ind) (ind as HTMLElement).tabIndex = this.reachable(i) ? 0 : -1;
    });
    const label = this.opts.stepLabel?.(this.index);
    const msg = `Step ${this.index + 1} of ${this.count}${label ? `: ${label}` : ''}`;
    this.host.setAttribute('aria-label', msg);
    if (this.opts.liveRegion) this.opts.liveRegion.textContent = msg;
  }
}

/** No custom element in the reference — the behavior is consumed directly. Kept for symmetry. */
export function registerStepper(): void {
  /* intentionally empty */
}
