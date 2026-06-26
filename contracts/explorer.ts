// @webeverything/contracts/explorer — the explorer result/output interchange contract (#1769, minted by #1747).
// Type-only re-export (zero runtime emit) of the canonical contract module. WE owns ONLY this SARIF 2.1.0-
// compatible shape (+ the structural validator / serializer / JSON schema / reference projector in the runtime
// sibling `explorer/schema.ts`); the explorer engine that PRODUCES output is a closed Plateau product (#1467/
// #1747), and a third-party tool or CI READS this without depending on it. The plateau/FUI→WE arrow imports it
// exactly like `./repro-bundle`.
export type * from '../explorer/contract';
