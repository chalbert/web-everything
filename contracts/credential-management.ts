// @webeverything/contracts/credential-management — the Credential-Management protocol's pure-contract
// surface (#1022/#1060/#1061). Type-only re-export (zero runtime emit) of the canonical contract module;
// the runtime impl (native provider + customCredentials registry) is FUI's. This is the FUI→WE arrow the
// credential-management runtime imports, exactly like `./guard` and `./analytics`.
export type * from '../identity/contract';
