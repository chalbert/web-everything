/**
 * @file blocks/renderers/module-service/authorModeSource.ts
 * @description Author-mode source projection (#818, placement ruled by #954) — the build-time emitter
 * that runs the existing transform core `serve()` over the canonical `<component>` definitions and
 * produces the per-case × per-form idiomatic source as committed data.
 *
 * Per #954 (Fork 1 = A, data-emit): WE runs `serve()` at build time and **commits** the
 * `{code, language, lossy, diagnostics}` output as JSON; the FUI workbench's author-mode panel reads
 * that data and renders the output tabs. Only rendered text + diagnostics cross the #700 seam — FUI
 * never imports `serve()`/`moduleService`. This module is the WE half: a pure projection over the
 * `componentCases` fixtures (the same one-way lowering fixtures the conformance suite uses), emitted
 * to `src/_data/authorModeSource.json` by `scripts/gen-author-mode-source.mjs` and guarded against
 * drift by a vitest test — the same generate-and-freeze idiom as the MaaS golden vectors (#506).
 *
 * No new IR, no new framework serializers: this rides exactly the `ServeForm` set `serve()` already
 * emits (`declarative | wc-class | html | jsx | functional`). The genuinely-new idiomatic
 * Vue/Svelte/Angular emitters and the Option-C emit-IR (#939) are deliberately out of scope.
 */
import { serve, FORMS, type ServeForm } from './moduleService';
import { componentCases } from '../component/__fixtures__/component-cases';

/** One served form for one case — the exact `{code, language, lossy, diagnostics}` shape #954 commits. */
export interface AuthorModeForm {
  form: ServeForm;
  /** Human label for the tab (from the FORMS catalog). */
  label: string;
  /** Highlighting / content hint. */
  language: 'html' | 'javascript' | 'jsx';
  /** The emitted idiomatic source. */
  code: string;
  /** True when `serve()` could not honour the form faithfully — the "flag, don't fake" signal. */
  lossy: boolean;
  /** Per-form diagnostics; surfaced beside the tab so a subset-boundary gap is shown, never hidden. */
  diagnostics: string[];
}

/** The author-mode source for one `<component>` definition, across every form `serve()` emits. */
export interface AuthorModeCase {
  id: string;
  name: string;
  title: string;
  /** The authored `<component>…</component>` definition this was projected from. */
  definition: string;
  forms: AuthorModeForm[];
}

/** The committed artifact: a provenance header + the per-case projection. */
export interface AuthorModeSourceArtifact {
  /** Records that this data is a `serve()` projection — the #954 build-emit, never hand-authored. */
  generatedBy: string;
  cases: AuthorModeCase[];
}

/** Project one definition across every `ServeForm` via the existing transform core. Pure. */
export function projectCaseForms(definition: string): AuthorModeForm[] {
  return FORMS.map((descriptor) => {
    const result = serve(definition, { form: descriptor.id });
    return {
      form: descriptor.id,
      label: descriptor.label,
      language: result.language,
      code: result.code,
      lossy: result.lossy,
      diagnostics: result.diagnostics,
    };
  });
}

/** Build the full author-mode source artifact from the canonical component-case fixtures. Pure. */
export function buildAuthorModeSource(): AuthorModeSourceArtifact {
  return {
    generatedBy: 'serve() — blocks/renderers/module-service/moduleService.ts (#818/#954)',
    cases: componentCases.map((c) => ({
      id: c.id,
      name: c.def.match(/<component[^>]*\bname="([^"]+)"/)?.[1] ?? c.id,
      title: c.title,
      definition: c.def,
      forms: projectCaseForms(c.def),
    })),
  };
}

/** Deterministic serialization (stable key order, trailing newline) for a byte-stable committed file. */
export function serialize(artifact: AuthorModeSourceArtifact): string {
  return JSON.stringify(artifact, null, 2) + '\n';
}
