# Assembler recipe-emit format & home — prior-art survey for #652

**Date**: 2026-06-15
**Point**: The shadcn/ui distribution model reshapes #652 Fork 1 from "markup vs CEM vs bespoke JSON" (a false trichotomy) into one forced invariant — plain markup + declarative wiring as the ejectable payload — plus coexisting, already-settled additional emit targets; Fork 2's home stays a standalone devtools surface reading shared registries read-only.
**Plan file**: (decision-prep for `backlog/652`; no `plans/` file)
**Research page**: `/research/ejectable-composition-recipes/`

---

## Question

`/prepare 652` — bring the assembler-shape decision to Definition of Ready. Two coupled forks gate the
whole #646 epic (it cannot be sliced until they settle):

1. **Recipe-emit format** — what a preset emits when an author ejects (the item offered markup-only /
   CEM-aligned / bespoke recipe schema).
2. **Home + shared-registry relationship** to the #623–627 Web Docs catalog pipeline.

#609 ratified only the *principle* (the assembler is a deferred build; the ejectable recipe it emits *is*
the standard, no runtime framework — *minimize-lock-in* + *impl-is-not-a-standard*) and left the concrete
format and home open.

## Recommendation

- **Fork 1 → A, but reshaped to a forced invariant.** The ejectable payload is **plain HTML markup + WE
  declarative wiring attributes** — the only option that is literally "the standard, ejected," forced by
  #609's constraints + native-first + the dominant industry model. The survey's load-bearing finding is
  that the item's three options sit on **three different layers that coexist**, not three rival payloads:
  - **payload** (owned artifact) = plain markup+wiring;
  - **API descriptor** (optional export) = CEM, *already* WE's component-API-metadata protocol per #626 —
    describes the result's API surface, never the wiring;
  - **distribution wrapper** (preset storage / input side) = a `registry-item`-shaped manifest carrying the
    payload — the same artifact that answers Fork 2's shared-registry question.
  The only genuinely **rejected** branch is a bespoke project-facing recipe JSON handed to the author
  *instead of* markup (the lock-in *minimize-lock-in* refuses; shadcn proves it unnecessary — the wrapper
  *carries* plain code, it does not replace it).
- **Fork 2 → A.** A **standalone devtools surface that reads the shared registries read-only**
  (`workbenchFeatures.json` / `workbenchTools.json` for feature vocabulary; a new WE-owned preset registry
  in the shadcn `registry-item` shape for the presets themselves). Keeps the catalog/authoring split clean
  (bias-toward-separation; one-capability-many-consumers). B (a mode inside the Web Docs surface #627)
  couples an authoring tool's lifecycle to the served product; C (own rival registry) guarantees the drift
  the epic warns against.

## Key Findings

| Source | What it emits | Lesson |
|---|---|---|
| **shadcn/ui** | Plain source files + a thin `registry-item.json` (`{name, type:"registry:block", files:[{path,content}], registryDependencies}`) | The owned artifact is *plain code*; the manifest is a *distribution wrapper around* it, not a rival schema. Splits Fork 1's options onto two layers. |
| **Webstudio / Webflow / Builder.io** | Clean, host-anywhere HTML/CSS/JS | Eject-to-plain-platform-code is the mainstream zero-lock-in answer for an *assembler*, not just a library. |
| **Custom Elements Manifest** | Declarative component-*API* JSON | A descriptor of the surface, never the composition wiring → an additional export (already WE's protocol, #626), not the recipe. |
| **Web Components / Lit** | Framework-agnostic custom elements | Reinforces #609's no-runtime-framework invariant. |
| **Storybook CSF / web-types** | Story / IDE-completion descriptors | Ingest sources (#624/#426), not eject targets. |

Research-reshapes-the-forks effect (per the prep rubric): Fork 1 went from a 3-way format choice to a
**forced invariant + support-all additional targets**; the genuine residual (the distribution wrapper)
folded into Fork 2 as a sub-decision (preset-registry shape).

## Files Created/Modified

| File | Action |
|---|---|
| `src/_includes/research-descriptions/ejectable-composition-recipes.njk` | Created — research write-up |
| `src/_data/researchTopics.json` | Added `ejectable-composition-recipes` topic entry |
| `backlog/652-…md` | Rewritten to prepared-fork shape; `preparedDate: 2026-06-15` |
| `reports/2026-06-15-assembler-recipe-emit-prior-art.md` | This report |

## Sources

- [Why shadcn/ui is Different — Vercel Academy](https://vercel.com/academy/shadcn-ui/why-shadcn-ui-is-different)
- [registry-item.json — shadcn/ui](https://ui.shadcn.com/docs/registry/registry-item-json)
- [registry.json — shadcn/ui](https://ui.shadcn.com/docs/registry/registry-json)
- [Top No-Code Tools to Export Clean Code](https://www.nocodefinder.com/blog-posts/no-code-tools-export-code)
- [lit.dev — minimize lock-in](https://lit.dev/)
