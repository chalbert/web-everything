/**
 * @file scripts/backlog/scaffold.mjs
 * @description Pure helpers for allocating a new backlog id and rendering a check:standards-clean
 * item skeleton — the deterministic half of "capture a leftover as its own item" (close-out / batch
 * spin-off). The agent hand-picks the next `NNN` today (`ls backlog | sort | tail`) and hand-writes
 * frontmatter, which is both a tool round-trip and the immutable-NNN collision race. These functions
 * allocate the next free number and emit a skeleton with every field the validator requires, so the
 * agent only fills the digest + body. PURE — the CLI does the globbing and the write.
 */

/** Zero-pad a number to the repo's 3-digit `NNN` convention (`7` → `"007"`). */
export const pad3 = (n) => String(n).padStart(3, '0');

/**
 * The next free `NNN`, as a padded string: highest existing + 1 (never reuses a gap below the max, to
 * match "allocate highest + 1" — gap reuse is allowed by the rules but highest+1 is the safe default).
 * @param {string[]} existingNums  Every current item's `num` (e.g. `['001','002','254']`).
 */
export function nextNum(existingNums) {
  const max = existingNums.reduce((m, n) => Math.max(m, Number(n) || 0), 0);
  return pad3(max + 1);
}

/** kebab-case a free-text title into a slug (lowercase, spaces/punct → single dashes). */
export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/**
 * Render a backlog item skeleton. Emits only the fields the validator needs (`type`, `status`,
 * `workItem`, `size` when a story, `dateOpened`, optional `blockedBy`/`parent`), an H1 title, and a
 * one-line digest placeholder the caller is expected to replace. `check:standards` passes on the
 * skeleton (non-empty digest, valid sizing), but the digest is intentionally a TODO so it reads as
 * unfinished, not as a real summary.
 *
 * @param {{
 *   type: string, workItem: string, size?: number, slug: string, title: string,
 *   today: string, blockedBy?: string[], parent?: string, digest?: string,
 * }} spec
 * @returns {string} the file content
 */
export function renderItem(spec) {
  const { type, workItem, size, title, today, blockedBy = [], parent, digest } = spec;
  const fm = ['---', `type: ${type}`, `workItem: ${workItem}`];
  if (workItem === 'story' || (workItem === 'epic' && typeof size === 'number')) fm.push(`size: ${size}`);
  if (parent) fm.push(`parent: "${parent}"`);
  fm.push('status: open');
  if (blockedBy.length) fm.push(`blockedBy: [${blockedBy.map((n) => `"${n}"`).join(', ')}]`);
  fm.push(`dateOpened: "${today}"`, 'tags: []', '---', '');
  const lead = digest || 'TODO digest — one ≤100-word paragraph: what this item does and why (replace this line).';
  return `${fm.join('\n')}\n# ${title}\n\n${lead}\n`;
}
