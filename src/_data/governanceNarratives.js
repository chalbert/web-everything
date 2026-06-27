// The `governanceNarratives` 11ty global — the Fork 2 (#1792 → (b)) per-file routing of the repo-root
// governance *narrative* docs to /governance/<id>/ (#1828).
//
// DEV_GUIDE.md, SELF-DRIVEN-PROJECT-DRAFT.md and CLA.md are human-read narrative (instructional / draft /
// legal), not the machine-cited statute that goes to /rules/. They also sit outside the 11ty input dir, so
// they had no URL. #1792 Fork 2 ratified routing them to /governance/ by genre — rendered under the
// existing narrative page. src/governance-narratives.njk paginates this; src/governance.njk links them.
const { renderRootDoc } = require('../../scripts/lib/rules-loader.cjs');

const NARRATIVES = [
  { id: 'dev-guide', file: 'DEV_GUIDE.md', title: 'Development Guide', kind: 'Instructional' },
  { id: 'self-driven-project', file: 'SELF-DRIVEN-PROJECT-DRAFT.md', title: 'Self-Driven Project (draft)', kind: 'Draft' },
  { id: 'cla', file: 'CLA.md', title: 'Contributor License Agreement', kind: 'Legal' },
];

module.exports = () => NARRATIVES.map((n) => ({ ...renderRootDoc(n), kind: n.kind }));
