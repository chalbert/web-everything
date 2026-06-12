const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Build-time `see` (#236): load the sample project's *own* ESLint + Oxlint configs
// (fixtures stand in for "the tools you already use"), run them through the adapter-
// normalization hub, and expose the unified comparative model to /validation-rules/.
// The project keeps no reference to the hub — this only reads the incumbents' config files.
module.exports = async function () {
  const dir = path.join(__dirname, '../../scripts/validation-normalize');
  const { see } = await import(pathToFileURL(path.join(dir, 'index.mjs')).href);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'fixtures', f), 'utf8'));

  return see({
    eslint: read('eslintrc.json'),
    oxlint: read('oxlintrc.json'),
  });
};
