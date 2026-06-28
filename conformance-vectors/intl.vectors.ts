/**
 * intl conformance-vector suite (#1917, cascade #1294) — the Intl-formatting protocol's behavioral corpus.
 * Slice 2 of the intl relocation: WE owns the build-agnostic vectors, FUI owns the runtime provider
 * (`fui:intl`, relocated #1914) + the binding (`fui:intl/intlConformance.ts`) that drives it; the neutral
 * runner lives in `plateau:src/conformance-engine/conformanceVectors.ts`.
 *
 * intl is a **synchronous** (clock-free) standard whose conformance output is **not a verdict** (#1294
 * non-engine). Per the #1816 matcher ruling it classifies onto WE's two suite shapes and tags each `expect`
 * key with *how* it is compared — never raw formatted strings, which drift with the host's ICU/CLDR build:
 *  - **`resolved-options/parts-structure`** for the three formatters (Number / DateTime / RelativeTime):
 *    assert the `formatToParts` part **type sequence** (an equivalence class over the literal glyphs), so a
 *    conformant provider is judged on structure, not on whether the host renders `$` vs `US$` or `,` vs `.`.
 *  - **`predicate`** for `Intl.Collator`, which has no `formatToParts`: assert the **sign** of `compare()`
 *    (sort order), the only stable observable of collation across ICU builds.
 *
 * The vectors judge only what the binding exposes (`partTypes`, `sign`) — never a provider internal. A
 * provider is conformant if it produces these observations, however it is built (the #506/#899 golden-vectors
 * model). The contract it judges stays WE's `@webeverything/contracts/intl`.
 */
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/intl';

export const intlSuite: ConformanceVectorSuite = {
  standard: 'intl',
  contract: CONTRACT,
  vectors: [
    {
      // NumberFormat currency: the part-TYPE sequence ($1,234.50 → currency·integer·group·integer·decimal·
      // fraction) is ICU-stable even though the literal separators/symbol are not — the parts-structure proof.
      id: 'intl/number/currency-parts-structure',
      contract: CONTRACT,
      description: 'NumberFormat currency style emits the canonical currency part-type sequence.',
      steps: [
        { do: 'getNumberFormat', locales: 'en-US', options: { style: 'currency', currency: 'USD' } },
        { do: 'formatToParts', value: 1234.5 },
      ],
      expect: {
        partTypes: ['currency', 'integer', 'group', 'integer', 'decimal', 'fraction'],
        matchers: { partTypes: 'resolved-options/parts-structure' },
      },
      observeVia: ['partTypes'],
    },
    {
      // DateTimeFormat: a short date in a fixed UTC zone yields a stable month·day·year part order
      // (the literals between them — space, comma — are the drift the parts-structure matcher abstracts over).
      id: 'intl/datetime/short-date-parts-structure',
      contract: CONTRACT,
      description: 'DateTimeFormat (year/month/day, UTC) emits the month·day·year part-type sequence for en-US.',
      steps: [
        { do: 'getDateTimeFormat', locales: 'en-US', options: { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' } },
        { do: 'formatToParts', value: 1767312000000 },
      ],
      expect: {
        partTypes: ['month', 'literal', 'day', 'literal', 'year'],
        matchers: { partTypes: 'resolved-options/parts-structure' },
      },
      observeVia: ['partTypes'],
    },
    {
      // RelativeTimeFormat numeric:always: -1 day → an integer part + a literal ("1 day ago"); the
      // numeric:auto wording ("yesterday") is host-CLDR text, so the structural proof uses the always form.
      id: 'intl/relativetime/numeric-always-parts-structure',
      contract: CONTRACT,
      description: 'RelativeTimeFormat (numeric:always) emits an integer + literal part sequence for -1 day.',
      steps: [
        { do: 'getRelativeTimeFormat', locales: 'en-US', options: { numeric: 'always' } },
        { do: 'formatToParts', value: -1, unit: 'day' },
      ],
      expect: {
        partTypes: ['integer', 'literal'],
        matchers: { partTypes: 'resolved-options/parts-structure' },
      },
      observeVia: ['partTypes'],
    },
    {
      // Collator (default): apple sorts before banana — the sign of compare() is the only ICU-stable
      // observable, so collation is judged by predicate (sign/order), not by a returned string.
      id: 'intl/collator/default-order-sign',
      contract: CONTRACT,
      description: 'Collator default order: compare("apple","banana") is negative (apple sorts first).',
      steps: [
        { do: 'getCollator', locales: 'en-US', options: {} },
        { do: 'compare', a: 'apple', b: 'banana' },
      ],
      expect: { sign: -1, matchers: { sign: 'predicate' } },
      observeVia: ['sign'],
    },
    {
      // Collator numeric:true honors numeric ordering — "item2" < "item10" (2 < 10), the inverse of the
      // default lexical order ("item10" < "item2"), proving the option reaches the resolved formatter.
      id: 'intl/collator/numeric-option-sign',
      contract: CONTRACT,
      description: 'Collator numeric:true sorts "item2" before "item10" (numeric, not lexical).',
      steps: [
        { do: 'getCollator', locales: 'en-US', options: { numeric: true } },
        { do: 'compare', a: 'item2', b: 'item10' },
      ],
      expect: { sign: -1, matchers: { sign: 'predicate' } },
      observeVia: ['sign'],
    },
  ],
};

export default intlSuite;
