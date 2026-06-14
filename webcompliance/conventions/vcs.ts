/**
 * @file webcompliance/conventions/vcs.ts
 * @description Platform-default VCS convention vocabulary — backlog #579 (cluster B of #562's surfaced
 *   follow-on work). The fix-loop / bot must know what VCS conventions to follow when it opens a PR —
 *   branch naming, commit-message format, PR shape. Per the conventions-as-compliance ruling (#436/#437)
 *   **Web Everything never mandates a convention**, and per config-extends-platform-default the **default
 *   vocabulary is defined by the platform config**, which a project's config `extends`/overrides.
 *
 *   So this file carries the *default* vocabulary as data ({@link platformDefaultVcsConventions}) and the
 *   resolve seam ({@link resolveVcsConventions}, the same baseline ⊕ overrides / nearest-wins layering as
 *   {@link ../gate.resolvePolicy}). The fix-loop / bot is a **pure consumer**: it reads the project's
 *   *resolved* conventions and conforms — it never invents or hardcodes one. The validators
 *   ({@link checkBranchName} et al.) are how webcompliance *enforces* conformance and how the bot
 *   self-checks what it is about to emit.
 *
 *   Shape is already ruled (platform-default + project-customizable + compliance-enforced + bot-consumed);
 *   this is the build, not a fresh fork. Pairs with the bot-PR-mechanics decision (#578), which *reads*
 *   this vocabulary.
 */

/** Branch-naming convention. */
export interface BranchConvention {
  /** Token pattern the bot names a branch with — `{type}` and `{slug}` are interpolated. */
  readonly pattern: string;
  /** Allowed change types (the `{type}` slot). */
  readonly types: readonly string[];
  /** The default base branch a PR targets. */
  readonly base: string;
}

/** Commit-message convention. */
export interface CommitConvention {
  /** `'conventional'` ⇒ Conventional Commits (`type(scope): subject`); `'plain'` ⇒ free-form subject. */
  readonly format: 'conventional' | 'plain';
  /** Allowed commit types (Conventional Commits vocabulary the project may trim/extend). */
  readonly types: readonly string[];
  /** Require a trace/failure back-reference in the body (e.g. the failing check or trace id the fix addresses). */
  readonly requireTraceRef: boolean;
  /** The bot trailer appended to every bot commit (the `Co-Authored-By` line), or `null` to omit it. */
  readonly coAuthoredBy: string | null;
  /** Max subject line length (Conventional Commits / git convention). */
  readonly maxSubjectLength: number;
}

/** Pull-request shape convention. */
export interface PullRequestConvention {
  /** Title format — usually mirrors the commit format. */
  readonly titleFormat: 'conventional' | 'plain';
  /** Require the PR body to back-reference the failure/trace the change addresses. */
  readonly requireBackReference: boolean;
  /** Labels the bot applies to its PRs. */
  readonly labels: readonly string[];
}

/** The full VCS convention vocabulary the fix-loop / bot conforms to. */
export interface VcsConventionVocabulary {
  readonly branch: BranchConvention;
  readonly commit: CommitConvention;
  readonly pullRequest: PullRequestConvention;
}

/**
 * The platform-default VCS convention vocabulary — the baseline a project policy `extends`. It is a
 * *default*, never a mandate: a project overrides any slice via {@link resolveVcsConventions}. Chosen to
 * mirror this repo's own observed conventions (Conventional Commits, `type/slug` branches, a bot
 * `Co-Authored-By` trailer, trace-referencing bodies) so the bot's out-of-the-box behaviour matches the
 * platform without configuration.
 */
export const platformDefaultVcsConventions: VcsConventionVocabulary = {
  branch: {
    pattern: '{type}/{slug}',
    types: ['feat', 'fix', 'docs', 'chore', 'refactor', 'test'],
    base: 'main',
  },
  commit: {
    format: 'conventional',
    types: ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'build', 'ci', 'perf'],
    requireTraceRef: true,
    coAuthoredBy: 'Co-Authored-By: fix-loop bot <bot@webeverything.dev>',
    maxSubjectLength: 72,
  },
  pullRequest: {
    titleFormat: 'conventional',
    requireBackReference: true,
    labels: ['automated', 'fix-loop'],
  },
};

/** A project's partial override — every field is optional and replaces the platform default at that key. */
export interface VcsConventionOverride {
  readonly branch?: Partial<BranchConvention>;
  readonly commit?: Partial<CommitConvention>;
  readonly pullRequest?: Partial<PullRequestConvention>;
}

/**
 * Resolve a project's convention override against the platform default — baseline ⊕ override, nearest
 * wins, per sub-vocabulary (the same layering as {@link ../gate.resolvePolicy}). A project authors only its
 * deltas; an absent override returns the platform default unchanged.
 */
export function resolveVcsConventions(override?: VcsConventionOverride): VcsConventionVocabulary {
  const base = platformDefaultVcsConventions;
  if (!override) return base;
  return {
    branch: { ...base.branch, ...override.branch },
    commit: { ...base.commit, ...override.commit },
    pullRequest: { ...base.pullRequest, ...override.pullRequest },
  };
}

// ---------------------------------------------------------------------------------------------------
// Validators — how webcompliance enforces conformance and the bot self-checks what it emits
// ---------------------------------------------------------------------------------------------------

/** A conformance check result against the resolved conventions. */
export interface ConventionCheck {
  readonly ok: boolean;
  /** Human-readable violations (empty when `ok`). */
  readonly violations: readonly string[];
}

const ok: ConventionCheck = { ok: true, violations: [] };
const fail = (...violations: string[]): ConventionCheck => ({ ok: false, violations });

/** Does a branch name conform — `{type}/{slug}` with an allowed type and a non-empty slug? */
export function checkBranchName(name: string, conv: VcsConventionVocabulary): ConventionCheck {
  if (conv.branch.pattern !== '{type}/{slug}') {
    // Only the default token pattern is structurally validated; a custom pattern is checked by presence.
    return name.trim() === '' ? fail('branch name is empty') : ok;
  }
  const slash = name.indexOf('/');
  if (slash <= 0 || slash === name.length - 1) {
    return fail(`branch "${name}" must match {type}/{slug}`);
  }
  const type = name.slice(0, slash);
  if (!conv.branch.types.includes(type)) {
    return fail(`branch type "${type}" is not one of [${conv.branch.types.join(', ')}]`);
  }
  return ok;
}

/** Conventional-commits subject parse: `type(scope)?: subject`. */
const CONVENTIONAL_SUBJECT = /^([a-z]+)(\([^)]+\))?!?: .+$/;

/**
 * Does a commit message conform to the resolved commit convention — subject format + type + length, the
 * `Co-Authored-By` trailer, and the trace back-reference (when required)?
 */
export function checkCommitMessage(message: string, conv: VcsConventionVocabulary): ConventionCheck {
  const violations: string[] = [];
  const lines = message.split('\n');
  const subject = lines[0] ?? '';

  if (conv.commit.format === 'conventional') {
    const m = CONVENTIONAL_SUBJECT.exec(subject);
    if (!m) {
      violations.push(`subject "${subject}" is not Conventional Commits (type(scope)?: subject)`);
    } else if (!conv.commit.types.includes(m[1])) {
      violations.push(`commit type "${m[1]}" is not one of [${conv.commit.types.join(', ')}]`);
    }
  }
  if (subject.length > conv.commit.maxSubjectLength) {
    violations.push(`subject is ${subject.length} chars > max ${conv.commit.maxSubjectLength}`);
  }
  if (conv.commit.coAuthoredBy && !message.includes(conv.commit.coAuthoredBy)) {
    violations.push('missing the required Co-Authored-By bot trailer');
  }
  if (conv.commit.requireTraceRef && !/#\d+|trace[:/-]/i.test(message)) {
    violations.push('missing a trace/failure back-reference (e.g. #NNN or a trace id)');
  }
  return violations.length === 0 ? ok : fail(...violations);
}

/** Does a PR (title + body) conform — title format + the required back-reference? */
export function checkPullRequest(
  pr: { title: string; body: string },
  conv: VcsConventionVocabulary,
): ConventionCheck {
  const violations: string[] = [];
  if (conv.pullRequest.titleFormat === 'conventional' && !CONVENTIONAL_SUBJECT.test(pr.title)) {
    violations.push(`PR title "${pr.title}" is not Conventional Commits`);
  }
  if (conv.pullRequest.requireBackReference && !/#\d+|trace[:/-]/i.test(pr.body)) {
    violations.push('PR body is missing a failure/trace back-reference');
  }
  return violations.length === 0 ? ok : fail(...violations);
}
