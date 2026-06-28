// @webeverything/contracts/intl — the Intl-formatting protocol's pure-contract surface (#1020 protocol;
// #1054 contract slice). Type-only re-export (zero runtime emit) of the canonical contract module; the
// runtime impl — the native-first default provider (#1055) and the `customIntl` swap registry — is FUI's
// (statute #1282, relocated in #1914). This is the FUI→WE arrow over which the standard resolves: the FUI
// runtime imports `CustomIntlProvider`/`IntlLocales` from here, exactly like `./webpolicy` and `./guard`.
export type * from '../intl/contract';
