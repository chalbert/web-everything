/** Titles are display text; item identity and kind remain at the front for machine readers. */
export const MACHINE_TITLE_LIMIT = 70;

export function cleanTitle(value) {
  return String(value ?? '').replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    // `#` is dropped: delivery/open-PR extractors read every `#NNN` in a title as an item id.
    .replace(/[`$<>\\#]/g, '').replace(/\s+/g, ' ').trim();
}

/** Best effort metadata only: failure must not bypass the prepare diff/isolation guard. */
export function readMainCard(item, git) {
  try {
    const paths = git(['ls-tree', '-r', '--name-only', 'origin/main', '--', 'backlog/'])
      .trim().split('\n').filter((p) => p.startsWith(`backlog/${item}-`) && p.endsWith('.md'));
    if (paths.length !== 1) return null;
    const raw = git(['show', `origin/main:${paths[0]}`]);
    const title = /^#\s+(.+)$/m.exec(raw)?.[1];
    return title ? { title, raw } : null;
  } catch { return null; }
}

export function machinePrTitle({ repo = 'WE', item, kind, card }) {
  const prefix = `${repo} #${item}: `;
  const fallback = { prepare: 'prepare item — Design/MVP/Test plan/Proof plan/Follow-ups',
    build: 'delivery build', 'gate-fix': 'gate-failure fix',
    prevention: 'file the prevention guard(s) owed by an independent review' }[kind];
  let subject = cleanTitle(card?.title);
  // Matched on the raw title: cleanTitle drops the `#` this pattern anchors on.
  const guarded = /^File the prevention guard\(s\) owed by (\S+)#(\d+)'s independent review$/i
    .exec(String(card?.title ?? '').replace(/\s+/g, ' ').trim());
  if (guarded) {
    const guard = /^\d+\.\s+(?:`[^`]+`\s*—\s*)?(.+)$/m.exec(card.raw ?? '')?.[1];
    subject = `PR ${guarded[2]} — ${cleanTitle(guard) || 'review guards'}`;
  }
  const title = prefix + (subject ? `${kind} — ${subject}` : fallback);
  const chars = Array.from(title);
  return chars.length <= MACHINE_TITLE_LIMIT ? title : chars.slice(0, MACHINE_TITLE_LIMIT - 1).join('').trimEnd() + '…';
}
