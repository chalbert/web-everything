// @webeverything/contracts/reproduction-parity — the reproduction-parity protocol's pure-contract surface
// (#1227, charter #1225 / epic #1226). Type-only re-export (zero runtime emit) of the canonical contract
// module. This is the thin verdict/delta contract the Plateau vision-judgment service emits and the WE
// project ingests for reproduction-conformance — WE never renders FUI nor runs the judge (#475 no-leakage),
// it consumes outputs only. The FUI/Plateau→WE arrow imports it exactly like `./analytics` / `./guard`.
export type * from '../reproduction-parity/contract';
