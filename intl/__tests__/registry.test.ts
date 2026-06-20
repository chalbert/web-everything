/**
 * Intl-formatting protocol standalone model (#1020/#1055): the dependency-free
 * `CustomIntlProviderRegistry` (single active provider, native-first default) + the `NativeIntlProvider`
 * that delegates to the platform `Intl.*`. The runtime `customIntl` plug fulfils the same surface as a
 * core `CustomRegistry`; this pins the contract the plug must not drift from. Mirrors
 * `reliability/__tests__/registry.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomIntlProviderRegistry,
  NativeIntlProvider,
  nativeIntlProvider,
  createDefaultRegistry,
  type CustomIntlProvider,
  type IntlLocales,
} from '../index.js';

/** A custom provider double that records the locales it was asked for (proves the swap took effect). */
class RecordingProvider implements CustomIntlProvider {
  readonly name = 'recording';
  readonly seen: IntlLocales[] = [];
  getCollator(locales?: IntlLocales): Intl.Collator {
    this.seen.push(locales);
    return new Intl.Collator(locales);
  }
  getDateTimeFormat(locales?: IntlLocales): Intl.DateTimeFormat {
    this.seen.push(locales);
    return new Intl.DateTimeFormat(locales);
  }
  getNumberFormat(locales?: IntlLocales): Intl.NumberFormat {
    this.seen.push(locales);
    return new Intl.NumberFormat(locales);
  }
  getRelativeTimeFormat(locales?: IntlLocales): Intl.RelativeTimeFormat {
    this.seen.push(locales);
    return new Intl.RelativeTimeFormat(locales);
  }
}

describe('NativeIntlProvider (native-first default)', () => {
  it('is named "native"', () => {
    expect(new NativeIntlProvider().name).toBe('native');
  });

  it('delegates each method to the matching platform Intl.* constructor', () => {
    const p = new NativeIntlProvider();
    expect(p.getCollator('en')).toBeInstanceOf(Intl.Collator);
    expect(p.getDateTimeFormat('en')).toBeInstanceOf(Intl.DateTimeFormat);
    expect(p.getNumberFormat('en')).toBeInstanceOf(Intl.NumberFormat);
    expect(p.getRelativeTimeFormat('en')).toBeInstanceOf(Intl.RelativeTimeFormat);
  });

  it('produces formatters whose output equals the native one (verbatim delegation)', () => {
    const p = new NativeIntlProvider();
    expect(p.getNumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.5)).toBe(
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.5),
    );
    expect(p.getRelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day')).toBe(
      new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day'),
    );
  });

  it('returns a fresh formatter per call (factory, not value)', () => {
    const p = new NativeIntlProvider();
    expect(p.getCollator('en')).not.toBe(p.getCollator('en'));
  });

  it('exports a shared singleton native provider', () => {
    expect(nativeIntlProvider.name).toBe('native');
  });
});

describe('CustomIntlProviderRegistry (single active provider)', () => {
  it('has the customIntl localName', () => {
    expect(new CustomIntlProviderRegistry().localName).toBe('customIntl');
  });

  it('resolves to the native-first default before any set()', () => {
    expect(new CustomIntlProviderRegistry().current().name).toBe('native');
  });

  it('createDefaultRegistry() is seeded with the native default', () => {
    expect(createDefaultRegistry().current().name).toBe('native');
  });

  it('set() installs a custom provider as the active one', () => {
    const reg = new CustomIntlProviderRegistry();
    const custom = new RecordingProvider();
    reg.set(custom);
    expect(reg.current()).toBe(custom);
  });

  it('set() routes every formatter through the active custom provider', () => {
    const reg = new CustomIntlProviderRegistry();
    const custom = new RecordingProvider();
    reg.set(custom);
    reg.current().getCollator('fr');
    reg.current().getDateTimeFormat('fr');
    reg.current().getNumberFormat('fr');
    reg.current().getRelativeTimeFormat('fr');
    expect(custom.seen).toEqual(['fr', 'fr', 'fr', 'fr']);
  });

  it('the most recent set() wins outright (single active provider, not a chain)', () => {
    const reg = new CustomIntlProviderRegistry();
    const a = new RecordingProvider();
    const b = new RecordingProvider();
    reg.set(a);
    reg.set(b);
    expect(reg.current()).toBe(b);
  });

  it('reset() drops the custom provider back to the native default', () => {
    const reg = new CustomIntlProviderRegistry();
    reg.set(new RecordingProvider());
    reg.reset();
    expect(reg.current().name).toBe('native');
  });
});
