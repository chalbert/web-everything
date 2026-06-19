/**
 * Credential-Management protocol — the **pure-contract half** (#1022, slice #1060).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/credential-management` entry (#872/#874) that FUI depends on (the FUI→WE
 * arrow), superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`.
 * The runtime half — the native passthrough default provider, the mock conformance provider, and the
 * `customCredentials` registry — is impl and lives in FUI; only the contract crosses the seam (npm scope
 * mirrors layer).
 *
 * The native anchor is the browser's `navigator.credentials` (Credential Management API). The platform
 * lacks a **swap seam** so an app can route credential requests to a passkey engine (SimpleWebAuthn), a
 * FedCM/Digital-Credentials flow, or a password manager through one contract, by family. This is a
 * genuine Protocol — independent ceremony engines conform to one `CustomCredentialProvider` (a real
 * provider seam, per the Project/Protocol bar; ruled by #496, thin UX intent shipped as #482).
 *
 * Three rulings are encoded here, not redecided downstream:
 *  - **One provider per family, registry-resolved** (Fork 1-A, #483) — not a monolithic family-branching
 *    provider and not per-family contracts. A request lists the families it will accept; the dispatcher
 *    fans to their providers.
 *  - **`acquire` is async and trust-crossing.** Acquiring a credential crosses a trust boundary (an
 *    RP/IdP round-trip), and a session is **revocable** — `subscribe` lets a provider signal that a
 *    grant must be re-mediated (mirrors the Guard seam, #288).
 *  - **The native anchor is the whole Credential Management API**: the member set maps 1:1 to
 *    `get` / `create`+`store` / `preventSilentAccess` (the protocol rename
 *    `credential-acquisition → credential-management`, #496).
 *
 * Out of scope for this foundation contract (the project's open questions, decided downstream): whether
 * `CredentialRequest` carries RP/IdP config inline or resolves it lazily per origin; how a multi-family
 * request whose providers disagree resolves; whether `session-mediation` needs a per-surface override for
 * embedded contexts. The result shape below is kept thin to leave that room.
 */

/** A teardown returned by `subscribe`, called to stop listening for invalidation. */
export type Cleanup = () => void;

/** The credential families a request can target — one request, many families. */
export type CredentialFamily = 'passkey' | 'federated' | 'digital' | 'password';

/**
 * The operation a request performs, mapping 1:1 to the native API:
 *  - `credential-request`    → `navigator.credentials.get()`
 *  - `credential-enrollment` → `navigator.credentials.create()` / `store()`
 *  - `session-mediation`     → `navigator.credentials.preventSilentAccess()`
 */
export type CredentialMember = 'credential-request' | 'credential-enrollment' | 'session-mediation';

/**
 * The mediation requirement for a request — the native `CredentialMediationRequirement` enum, surfaced
 * by the #482 intent.
 */
export type CredentialMediation = 'silent' | 'optional' | 'conditional' | 'required';

/** A normalized credential request — the requesting surface lists the families it will accept. */
export interface CredentialRequest {
  member: CredentialMember;
  /** The families this surface will accept; the dispatcher fans to their providers. */
  credentials: CredentialFamily[];
  /** Native mediation enum (from the #482 intent). */
  mediation?: CredentialMediation;
}

/**
 * The result of an `acquire`. Kept thin (the richer shape is a downstream open question): the family
 * that answered, the native `Credential` (or `null` when none was produced), and a status so a multi-
 * family dispatch can tell a decline from an unavailable provider apart.
 */
export interface CredentialResult {
  /** Which family produced the result. */
  family: CredentialFamily;
  /** The acquired native credential, or `null` when the ceremony produced none. */
  credential: Credential | null;
  /** `fulfilled` — a credential (or an intended `null` for session-mediation); `declined` — user/RP
   *  declined; `unavailable` — no provider served this family/member. */
  status: 'fulfilled' | 'declined' | 'unavailable';
}

/**
 * A credential provider — the swappable seam, the ONLY lock. One provider serves one or more families;
 * concrete providers (native passthrough, SimpleWebAuthn, a FedCM flow) are impl and live in FUI, held
 * in the `customCredentials` registry per family and resolved through the injector chain.
 */
export interface CustomCredentialProvider {
  /** Which families this provider serves. */
  readonly families: CredentialFamily[];
  /** Whether this provider serves a given family+member (FedCM/digital are request-only; passkey/password also enroll). */
  supports(family: CredentialFamily, member: CredentialMember): boolean;
  /** Acquire a credential — async, trust-crossing (an RP/IdP round-trip). */
  acquire(request: CredentialRequest): Promise<CredentialResult>;
  /** Revocable: signal that a session was invalidated and must be re-mediated. Optional. */
  subscribe?(onInvalidate: () => void): Cleanup;
}
