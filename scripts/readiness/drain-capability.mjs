/**
 * @file scripts/readiness/drain-capability.mjs
 * @description The durable drain CAPABILITY MARKER (#2387 F4 / #2393) — a versioned record, committed to
 *   `origin/main`, that advertises which drain-coordination capabilities are live on main.
 *
 * WHY (#2387 F4): overlap-stacking a serial batch is only SAFE once the drain enforces the proof-of-land gate
 * (#2393) — a stacked child must never land before its parent is proven landed, else the merge-base collapses
 * to pre-batch main and drags the parent's unreviewed code onto main under the child's number. So stacking
 * CANNOT ship before the gate. The producer (the batch skill, a LATER slice) reads this marker at authoring
 * time and STACKS ONLY when it advertises gate support; it defaults HARD to plain siblings on any read failure
 * or version mismatch — the conservative direction. The marker is read off `origin/main` (a durable, shared
 * record), never by probing a not-yet-running drain (which would run later against a possibly-different main).
 *
 * THIS SLICE (#2393) SHIPS THE MARKER + the reader; the drain gate it advertises lands in the same change. The
 * producer's consumption (`--base`, union-find on declared locus, stack-only-when-supported) is the later
 * `producer-overlap-stacking` slice. Committing the marker here is what makes step 5→6 of the epic's ship
 * order enforceable: a producer can confirm the gate is live on main before it ever stacks.
 *
 * PURE — no fs, no `Date`, no `process`. The CLI/producer owns the `git show origin/main:<path>` read at its
 * boundary and passes the text in (or injects a reader), so this module stays unit-testable.
 */

/**
 * The current proof-of-land gate version the drain enforces (#2393). BUMP this (and the marker JSON's
 * `gateVersion`) whenever the gate's SAFETY CONTRACT changes in a way a producer must re-confirm before it
 * relies on it — the producer requires `marker.gateVersion >= its required version` to stack. A monotonic
 * integer: a marker advertising an OLDER version than the producer needs reads as unsupported (stay siblings).
 */
export const GATE_VERSION = 1;

/** The marker's repo-relative path — a single committed JSON file the producer reads off `origin/main`. */
export const CAPABILITY_MARKER_PATH = 'scripts/readiness/drain-capability.json';

/**
 * Parse the capability marker's JSON text → `{ gateVersion }`, or `null` when it is absent / unparseable /
 * malformed. Pure and TOTAL: any non-object, missing/`NaN`/negative `gateVersion`, or JSON error → `null`, so
 * a corrupt marker can never read as "supported". A non-integer or negative version is rejected (the version
 * is a monotonic non-negative integer).
 * @param {string|null|undefined} text
 * @returns {{gateVersion:number}|null}
 */
export function parseCapabilityMarker(text) {
  if (!text || !String(text).trim()) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const gv = raw.gateVersion;
  if (!Number.isInteger(gv) || gv < 0) return null;
  return { gateVersion: gv };
}

/**
 * Does the marker advertise proof-of-land gate support at (at least) the `required` version? Pure. Defaults
 * HARD to `false` (stay siblings) on a null/malformed marker or a version BELOW what's required — the #2387 F4
 * conservative-by-construction contract: only a marker that positively proves `gateVersion >= required` lets a
 * producer stack.
 * @param {{gateVersion:number}|null} marker
 * @param {number} [required]  the minimum gate version the caller needs (default: the current {@link GATE_VERSION})
 * @returns {boolean}
 */
export function stackingSupported(marker, required = GATE_VERSION) {
  if (!marker || !Number.isInteger(marker.gateVersion)) return false;
  return marker.gateVersion >= required;
}

/**
 * Read the marker off `origin/main` and report whether stacking is supported. Pure aside from the injected
 * `readMainFile` (a `git show origin/main:<path>` runner) — so the git I/O lives at the caller's boundary and
 * this stays testable. A read that throws / returns empty (no marker on main, no origin ref) → `null` marker →
 * `supported:false` (the safe default). Returns `{ marker, supported }`.
 * @param {(path:string)=>string} readMainFile  returns the file's text on origin/main (throws/empty ⇒ absent)
 * @param {number} [required]
 * @returns {{marker:({gateVersion:number}|null), supported:boolean}}
 */
export function readCapabilityFromMain(readMainFile, required = GATE_VERSION) {
  let text = '';
  try { text = readMainFile(CAPABILITY_MARKER_PATH); } catch { text = ''; }
  const marker = parseCapabilityMarker(text);
  return { marker, supported: stackingSupported(marker, required) };
}
