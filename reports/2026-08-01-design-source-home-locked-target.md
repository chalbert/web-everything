# Productized design-source home + locked in-code target reference — decision prep (#2801)

**Point:** Prepared decision #2801 to Definition of Ready — four forks with bold, adversarially-attacked
defaults, grounded in a published `/research/` prior-art survey; `preparedDate` set so readiness tags it
`✓ ready to ratify`. Not ruled — prepare only.

---

## Question

The UI-Fidelity Gate (RRFC) locks every UI story to a registry-anchored, content-hashed design target so a
perceptual-distance oracle holds (INVARIANT A). Today that target is a throwaway claude.ai artifact link.
Decision #2801 sets the *productized* form: (1) the canonical stored form of a locked target, (2) how an
external source (Figma) is imported and frozen into it, (3) where the versioning surface lives / how a version
maps to `registryId@vN` + `contentHash`, (4) whether interactions become checkable.

## Recommendation (each fork's bold default, post-review)

1. **Stored form** — the **in-code artifact is the sole content-hashed canon**; a rendered baseline is a
   non-canonical, tolerance-compared product-repo artifact for the *advisory* perceptual layer — never a hashed
   co-anchor (a render is not byte-deterministic), never in WE.
2. **Import → freeze** — **normalize every source into one source-agnostic in-code artifact + provenance, and
   also archive the raw native payload** (opaque, non-canonical) for lossless offline re-normalization; Figma is
   a swappable importer that pins `?version` and freezes the bytes.
3. **Version-minting authority** — the minting **mechanism** (id scheme + hash rule + append-only ledger +
   token-over-hash) is a **minter-agnostic WE contract** any client calls; the design-studio #2676 is one
   minter-client (the human versioning UI folds there, product-internal, but does not own the identity).
4. **Interactions** — **cut on assertability**: gate deterministic post-interaction states (focus / `aria-*`
   flips / loading-error) now via the boolean floor; motion/timing stays advisory.

`preparedDate` set; **not ruled** — ratification is `/next decision`'s job.

## Key Findings

- **The cross-industry pattern is freeze-to-an-in-repo artifact** (design-token JSON, or a committed accepted
  image) that is content-keyed and diffed by a threshold oracle — never point the oracle at a live URL.
- **Figma** gives a real pin (`?version=<id>` on `/v1/files` and `/v1/images`), but its render URLs are
  ephemeral (~30-day CDN expiry) so you must download the bytes; `FILE_VERSION_UPDATE` is the low-noise
  drift-notification trigger. Dev Mode extracts visual props only; Code Connect maps design→your code.
- **DTCG** (W3C Design Tokens, first stable v1 Oct 2025) + Style Dictionary v4 are the strongest "design decision
  as a diffable, versioned, in-repo JSON artifact" model.
- **Chromatic/Percy** prove accept-to-promote locked baselines but keep identity server-side; `jest-image-snapshot`
  (committed baselines) is closer to our in-code, content-hashed design. Content-addressing (Git blob / lockfile
  `integrity`) is the immutability primitive — our target is the design-world lockfile entry.
- **Oracle:** a *cryptographic* content-hash locks the mock's identity; a *perceptual* metric (pixelmatch YIQ /
  SSIM `>0.99`) supplies the tolerance floor (advisory under ratified oracle-tightness B). pHash is a pre-filter
  only.
- **Interactions:** Figma prototypes are advisory (no assertable-contract API); Storybook `play` functions are
  the enforceable prior art — transcribe deterministic post-event states into real assertions.
- **Review reshaped two forks.** An adversarial skeptic + a fresh-context two-confusion screen (both mandated by
  the prepare method) flipped the original framings of Fork 3 and Fork 4: the screen flagged "where the
  versioning UI lives" as an impl/prioritization question (re-layered to "who owns the minting *contract*" — a
  WE concern), and flagged "interactions advisory vs gated" as timing (re-derived to a merit-based
  assertability cut). Fork 1's baseline PNG was corrected from "deterministic hashed co-anchor" (a render is not
  byte-stable) to a non-canonical advisory-layer artifact; Fork 2 gained the raw-payload archive for lossless
  re-normalization.

## Files Created/Modified

| File | Action |
|---|---|
| `we:backlog/2801-productized-design-source-home-locked-in-code-target-referen.md` | Rewritten to the prepared-decision shape (4 forks, glance table, classification, `preparedDate`) |
| `we:src/_data/researchTopics/design-source-home-locked-target.json` | New research registry entry |
| `we:src/_includes/research-descriptions/design-source-home-locked-target.njk` | New research write-up |
| `we:reports/2026-08-01-design-source-home-locked-target.md` | This report |
