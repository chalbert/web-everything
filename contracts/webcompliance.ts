// @webeverything/contracts/webcompliance — Web Compliance's pure-contract surface (#436 policy/rule model +
// the #437/#438/#439 gate/waiver/audit result types). Type-only re-export (zero runtime emit) of the
// canonical contract module; the runtime impl — the gate runner, waiver machinery, and audit mapping — is
// FUI's (statute #1282, relocated by the #1294 cascade). This is the FUI→WE arrow over which the standard
// resolves: the FUI engine imports these types, exactly like `./webpolicy` and `./guard`.
export type * from '../webcompliance/contract';
