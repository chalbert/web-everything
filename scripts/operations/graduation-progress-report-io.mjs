/**
 * @file we:scripts/operations/graduation-progress-report-io.mjs
 * @description Scorecard and clock reader for graduation progress (#3690, #xd9xwtn).
 * Uses the existing store reader; all graduation arithmetic stays in the declaration.
 */
import { readStore } from '../conveyor/run-scorecard-store.mjs';

/** Store IO options and clock are injectable so tests never need the real store. */
export function createScorecardReader({ now = () => new Date().toISOString(), ...storeIo } = {}) {
  return () => {
    const { records } = readStore(storeIo);
    return { records, asOfIso: now() };
  };
}
