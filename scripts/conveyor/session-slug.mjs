/** Pure session-name minting and parsing for the constellation. */
import { repoSlugTag, repoKeyForSlugTag } from '../lib/constellation-repos.mjs';

export const PR_KINDS = ['review', 'fix', 'ci-heal'];
export const ITEM_KINDS = ['conveyor', 'prepare', 'prepare-decision'];

export function mintSessionSlug({ kind, id, repo = 'we', attempt = '' }) {
  const itemKind = ITEM_KINDS.includes(kind);
  if (!itemKind && !PR_KINDS.includes(kind)) throw new Error(`session-slug: unknown kind ${kind}`);
  const tag = repoSlugTag(repo);
  if (tag === null) throw new Error(`session-slug: unknown repo ${repo}`);
  if (itemKind && repo !== 'we') throw new Error('session-slug: item kinds require repo we');
  if (!itemKind && attempt !== '') throw new Error('session-slug: PR kinds accept no attempt');
  if (!/^[a-z]?$/.test(attempt)) throw new Error('session-slug: attempt must be a single lowercase letter');
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error('session-slug: id must be a string or number');
  const value = String(id).trim();
  const numeric = /^\d+$/.test(value) && Number(value) > 0 && Number.isInteger(Number(value));
  if (!numeric && !(itemKind && /^x[a-z0-9]{6}$/.test(value))) throw new Error('session-slug: id must be a positive integer or an item hash');
  return `${kind}-${tag ? `${tag}-` : ''}${value}${attempt}`;
}

/** Hash item names are deliberately not reapable by number. */
export function parseSessionSlug(name) {
  const match = /^(review|fix|ci-heal|conveyor|prepare-decision|prepare)-(?:([a-z]+)-)?(\d+)([a-z]?)$/i.exec(String(name ?? ''));
  if (!match) return null;
  const [, rawKind, rawTag, id, rawAttempt] = match;
  const kind = rawKind.toLowerCase();
  const itemKind = ITEM_KINDS.includes(kind);
  const repo = repoKeyForSlugTag(rawTag?.toLowerCase());
  if (repo === null || (itemKind && rawTag !== undefined)) return null;
  return { kind, repo, id, attempt: rawAttempt.toLowerCase(), itemKind };
}
