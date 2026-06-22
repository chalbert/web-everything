---
kind: story
size: 5
parent: "1552"
status: resolved
blockedBy: ["1580"]
locus: plateau-app
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/judge-corpus/corpusStore.ts"
tags: []
---

# Trainable-judge corpus store — Plateau-owned, repointable label/embedding store

Persist the trainable-judge corpus (#1580 schema) as a Plateau-owned, repointable store behind the JudgeModel seam (#1553 Fork 3: Plateau owns the impl, WE owns only the contract). Holds {label rows + a re-derivable embedding cache keyed by (encoder-id, frame)} — embeddings are a cache, never the asset. v1 may co-locate on disk next to the explorer's Plateau-side orchestration tier for operational simplicity, but stays owned-by + exposed-through the Plateau vision capability (#1073/#475/#490) via the #475 stand-in→repoint pattern — locality is not ownership. Per we:docs/agent/platform-decisions.md#trainable-judge.

## Progress (resolved 2026-06-22, batch-2026-06-22-1580-1579-1030-1564)

Cascade-freed by #1580 (the corpus contract) resolving this batch. Built the Plateau-owned store as a
headless core (the #1562 "headless core + thin shell" pattern; consumers #1583 learning / #1584 eval don't
exist yet, so no speculative HTTP shell — YAGNI):

- **`plateau:src/judge-corpus/corpusStore.ts`** — `CorpusStore implements JudgeCorpus` (the repointable seam,
  #1553 Fork 3). Persists `CorpusRecord`s (the WE #1580 schema, consumed as **`import type`** — compile-erased,
  no runtime dep on WE, #1282) one per-entry file (#1145), with `putRecord`/`getRecord`/`listRecords({split})`/
  `removeRecord`; the train/benchmark split is filtered here so #1582 reads it train-disjoint. The
  **embedding cache** (`getEmbedding`/`putEmbedding`/`clearEmbeddings`) lives under a separate subtree keyed
  `(encoderId, frameHash)` (`EmbeddingCacheKey`) — `clearEmbeddings(encoderId?)` drops it wholesale, proving
  the **zero-data-loss encoder swap** (re-derive from the asset; the cache is never the asset). Unsafe keys
  (path-escape) rejected.
- **`plateau:tsconfig.json`** — added the `@webeverything/contracts/trainable-judge` path (type-only; no vite
  alias needed since the contract is all types — no runtime import is even possible, so no dev-server touch).

`locus: plateau-app` added (was missing). **Tests:** `plateau:src/judge-corpus/corpusStore.test.ts` (10) —
record CRUD/validation/persistence/split-filter + embedding cache round-trip/keying/clear-without-asset-loss.
Full plateau suite **352 pass** (+10); my files clean under project `tsc`. Frees #1583 (learning) — itself an
ML-mechanism slice (k-NN/probe), not a clean batch item.
