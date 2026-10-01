// Shared by the CommonJS backlog loader and the ESM standards checks.
// Keep the authored reference intact; strip only the local repo locus for path reads.
function normalizeRelatedReport(path) {
  return path.replace(/^we:/, '');
}

function relatedReportRefs(items) {
  return new Set(items.map((item) => item.relatedReport).filter(Boolean)
    .map((path) => normalizeRelatedReport(path).replace(/^reports\//, '')));
}

module.exports = { normalizeRelatedReport, relatedReportRefs };
