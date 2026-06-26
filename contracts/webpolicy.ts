// @webeverything/contracts/webpolicy — Web Policy's pure-contract surface (#406 DMN-aligned rule
// meta-schema; #1077 slice). Type-only re-export (zero runtime emit) of the canonical contract module;
// the runtime impl — the PDP/PEP enforcement engine (#408) and the #407 proof chain — is FUI's (statute
// #1282, relocated in #1799). This is the FUI→WE arrow over which the standard resolves: the FUI engine
// imports these types and the #406 interchange Protocol's core schemas are `PolicyRuleSet`/`Verdict`,
// exactly like `./dockable` and `./guard`.
export type * from '../webpolicy/contract';
