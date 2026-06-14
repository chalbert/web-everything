/**
 * @file blocks/renderers/module-service/generation/languageBackend.ts
 * @description The generation-adapter language-backend interface — the seam every per-language MaaS
 * origin generator implements (backlog #547, slice 1 of #507, ratified in #463 fork a).
 *
 * #463 ratified a **deterministic** generation adapter: a per-language backend derives an idiomatic,
 * native MaaS origin from the neutral serve-path IR ({@link file://../servePathIR.ts}, #505), with NO AI
 * in the generation path — same IR in, byte-identical source out (AI operates only at adapter-*development*
 * time, improving the rules/templates against a regression corpus, #551). This file holds the contract
 * that makes that possible across languages: a {@link LanguageBackend} is a pure
 * `(ServePathIR) => GeneratedOrigin`.
 *
 * The architectural line #463 drew — and this interface codifies — is the **deterministic-core /
 * HTTP-shell split**:
 *
 *   - The **core** ({@link GeneratedOrigin.core}) is the byte-determining, language-neutral payload of
 *     the contract rendered into the target language: the base path + route grammar, the hash/pin
 *     pattern, the cache policy, the header vocabulary, the status codes, the media types, the query
 *     params, and the response table. Two backends for two languages emit *the same information* here —
 *     only the surface syntax differs. This is what the #506 conformance vectors assert against.
 *   - The **shell** ({@link GeneratedOrigin.shell}) is the runtime/HTTP wrapper: the idiomatic request
 *     handler that wires the core's routing table to the language's native HTTP types, with explicit
 *     **injection seams** for the parts the IR deliberately does NOT specify (content-hash identity,
 *     definition resolution, the transform) — exactly the seams the JS reference origin
 *     ({@link file://../fetchHandler.ts}) already injects as `resolve`/`resolver`. The shell is where a
 *     language earns its idiom; the core is where every language must agree.
 *
 * A backend never reaches outside the IR for byte-determining content, and never consults the clock or a
 * random source — those would break determinism and are the engine's enforced invariant
 * ({@link file://./generate.ts}).
 */
import type { ServePathIR } from '../servePathIR';

/** One emitted source file: its idiomatic filename, the language it is written in, and its bytes. */
export interface GeneratedModule {
  /** The idiomatic on-disk filename for the target language (e.g. `origin.core.js`, `OriginCore.cs`). */
  readonly filename: string;
  /** The target language id — matches the producing {@link LanguageBackend.id}. */
  readonly language: string;
  /** The emitted source. Deterministic for a given IR; ends with a trailing newline (POSIX text). */
  readonly source: string;
}

/**
 * A complete generated origin for one language: the neutral {@link GeneratedModule.core core} plus the
 * idiomatic HTTP {@link GeneratedModule.shell shell}. The split is structural, not cosmetic — a
 * conformance gate (#506) reads the core; a runtime deploys the shell.
 */
export interface GeneratedOrigin {
  /** The producing backend id (`javascript`, `csharp`, …). */
  readonly backend: string;
  /** Language-neutral, byte-determining contract rendered into the target language. */
  readonly core: GeneratedModule;
  /** The idiomatic HTTP handler that wires {@link core} to native request/response types. */
  readonly shell: GeneratedModule;
}

/**
 * A per-language MaaS origin generator. The single extension point of the generation adapter: adding a
 * target language (#548 .NET, then Java) is adding one `LanguageBackend`. Implementations MUST be pure
 * and deterministic — `emit(ir)` called twice with the same IR returns byte-identical sources (the
 * engine enforces this, {@link file://./generate.ts}).
 */
export interface LanguageBackend {
  /** Stable language id, e.g. `javascript`. Stamped into {@link GeneratedOrigin.backend}. */
  readonly id: string;
  /** Project the neutral IR to an idiomatic origin (core + shell) in this backend's language. */
  readonly emit: (ir: ServePathIR) => GeneratedOrigin;
}
