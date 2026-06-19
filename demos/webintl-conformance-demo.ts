/**
 * Web Intl conformance demo (#1056, slice C of #1020) — the runnable proof of the `CustomIntlProvider`
 * contract (#1054) in a real browser.
 *
 * The contract is type-only (`we:intl/contract.ts`); the Intl.* runtime provider + the `customIntl` swap
 * registry are impl and live in FUI. So this demo supplies its **own** in-demo provider — a thin wrapper
 * over the platform `Intl.*` constructors — to prove the contract is realizable: one provider hands back
 * `Intl.Collator` / `DateTimeFormat` / `NumberFormat` / `RelativeTimeFormat` for a requested locale. The
 * conformance section asserts each contract invariant live across locales; `setPlaygroundReady` reports the
 * pass count the e2e smoke reads.
 */
import type { CustomIntlProvider, IntlLocales } from '/intl/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** An in-demo Intl provider: a thin pass-through to the platform `Intl.*` constructors per the contract. */
class DemoIntlProvider implements CustomIntlProvider {
  getCollator(locales?: IntlLocales, options?: Intl.CollatorOptions): Intl.Collator {
    return new Intl.Collator(locales as string | string[] | undefined, options);
  }
  getDateTimeFormat(locales?: IntlLocales, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(locales as string | string[] | undefined, options);
  }
  getNumberFormat(locales?: IntlLocales, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    return new Intl.NumberFormat(locales as string | string[] | undefined, options);
  }
  getRelativeTimeFormat(
    locales?: IntlLocales,
    options?: Intl.RelativeTimeFormatOptions,
  ): Intl.RelativeTimeFormat {
    return new Intl.RelativeTimeFormat(locales as string | string[] | undefined, options);
  }
}

const provider = new DemoIntlProvider();

interface Check {
  title: string;
  run: () => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'getCollator sorts locale-aware (German treats ä near a)',
    run: () => {
      const sorted = ['z', 'ä', 'a'].sort(provider.getCollator('de').compare);
      return sorted[0] === 'a' && sorted[1] === 'ä' && sorted[2] === 'z';
    },
  },
  {
    title: 'getCollator with sensitivity:base makes a == á (accent-insensitive)',
    run: () => provider.getCollator('en', { sensitivity: 'base' }).compare('a', 'á') === 0,
  },
  {
    title: 'getDateTimeFormat formats a date for the requested locale',
    run: () => {
      const date = new Date(Date.UTC(2026, 0, 15));
      const enUS = provider.getDateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(date);
      const deDE = provider.getDateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' }).format(date);
      return enUS === 'January' && deDE === 'Januar';
    },
  },
  {
    title: 'getNumberFormat formats currency per locale',
    run: () => {
      const usd = provider.getNumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1234.5);
      return usd.includes('$') && usd.includes('1,234.50');
    },
  },
  {
    title: 'getRelativeTimeFormat formats a relative time',
    run: () => provider.getRelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day') === 'yesterday',
  },
  {
    title: 'a fresh formatter is returned per call (no shared mutable state)',
    run: () => provider.getNumberFormat('en') !== provider.getNumberFormat('en'),
  },
];

function runConformance(host: HTMLElement): number {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.run();
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card wi-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'wi-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webintl contract invariants hold`;
  return pass;
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'wi-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — CustomIntlProvider contract'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

main();
