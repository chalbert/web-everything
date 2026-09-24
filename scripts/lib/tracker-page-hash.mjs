/**
 * @file scripts/lib/tracker-page-hash.mjs
 * @description The content hash of a rendered tracker page, and the one part of the page it must ignore: the STAMP.
 *   The compact page (`prototype-tracker-compact.mjs`) puts the branch tip and the render time in a single
 *   `<span class="stamp">` element. A page is the same page when only that element differs, so the hash strips it
 *   first — otherwise every render, and every commit that touched nothing the page shows, would look like new
 *   content and cause a republish. A leaf: `node:crypto` only.
 */
import { createHash } from 'node:crypto';

/** The stamp element. Kept in step with the markup in `prototype-tracker-compact.mjs` (a test renders two pages and compares). */
const STAMP_RE = /<span class="stamp">[\s\S]*?<\/span>/;

/** The page without its stamp: what a content hash covers. */
export const stripStamp = (html) => String(html ?? '').replace(STAMP_RE, '<span class="stamp"></span>');

/** The sha-256 (hex) of a page, ignoring its stamp. */
export const contentHash = (html) => createHash('sha256').update(stripStamp(html)).digest('hex');
