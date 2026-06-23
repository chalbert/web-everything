// @webeverything/contracts/permissions — webpermissions' declared role / permission-scope model, the
// pure-contract surface (#1699; ruled by #178 + #379). Type-only re-export (zero runtime emit) of the
// canonical contract module. WE owns ONLY this declared model (roles, permission scopes, the affordances
// each scope gates); the runtime authorization gate + the dev-browser RACI lens (#1636) consume it. The
// FUI/plateau→WE arrow imports it exactly like `./credential-management` (its webidentity sibling).
export type * from '../permissions/contract';
