/**
 * @file scripts/lib/priority-markers.mjs
 * @description The one marker the `priority-sync` operation puts on a line it added, in place of the one-sentence
 *   reason, and that `check-priority` warns about until a worker replaces it. A pure leaf, so both the operation's
 *   declaration (which may import nothing that can act) and the gate can share ONE spelling.
 */

/** A NEW `## Priority order` line carries this in place of its "why": the operation never writes prose. */
export const UNWRITTEN_WHY = 'why: (unwritten)';
