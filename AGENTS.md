# Repository working agreements

## Phase completion workflow

- Work through `TECH_INBOX_CODEX_IMPLEMENTATION_GUIDE.md` one phase at a time while treating the user's latest request as authoritative.
- Do not mark a phase complete until its required format, lint, generated-type, TypeScript, test, build, dependency-audit, and relevant smoke checks pass.
- Before committing, review the complete phase diff, verify that generated/cache files remain ignored, and scan tracked content for secrets or credentials.
- At the end of every completed phase, commit all in-scope phase changes with a concise phase-specific message and push the current branch directly to the configured personal Git remote.
- Normal phase-end direct pushes are pre-authorized by the repository owner. Do not ask for confirmation each time when the remote, branch, and authentication are already configured.
- Never force-push, rewrite published history, bypass a failed quality gate, or include unrelated user changes in a phase commit.
- If the remote, target branch, credentials, or phase scope is missing or ambiguous, stop before the push and ask the user for the missing information.
- Git push authorization does not authorize Cloudflare deployment, resource creation, billing changes, database migration against remote data, or other external side effects.

## Project boundaries

- Keep tools, dependencies, caches, temporary files, test browsers, and generated artifacts inside `/Users/ryo/dev/webclip` as documented by the implementation guide.
- Preserve the pinned dependency and supply-chain rules in `pnpm-workspace.yaml` and `docs/dependency-baseline.md`.
- Do not commit `.dev.vars`, tokens, personal email allowlists, Cloudflare credentials, or other secrets.

## Cloudflare credential diagnosis: mandatory recurrence prevention

- The 2026-09-23 Toki deployment incident was a diagnosis error, not an expired current token. Read the incident and procedure in `docs/toki-operations.md` (API認証エラーの切り分け) before investigating another Cloudflare authentication failure.
- Never infer token expiration from HTTP 401 alone, or missing OS configuration from an empty sandboxed `launchctl getenv`. In this incident the inherited process environment was stale, its Account ID contained control characters, and sandboxed `launchctl` returned empty while the permitted non-sandboxed read returned valid current credentials.
- Check recent successful deployment logs and their credential source first, especially when the owner reports a same-day rotation/deployment. Distinguish inherited process variables, a Terminal's `export`, and OS-stored settings. If sandbox restrictions may affect the result, use the approved permission mechanism to verify the source; do not bypass restrictions or treat an inaccessible value as absent.
- Validate the latest available token with Cloudflare and confirm the account identity before requesting user work. Validate Account ID format strictly without guessing corrections. Pass verified credentials explicitly to the Wrangler child environment; never print values or place them in CLI arguments, tracked files, or shared logs.
- Do not ask the owner to rotate again, re-enter credentials, or restart the app until these checks establish why that action is necessary. A valid token with a permission/account mismatch requires diagnosing that mismatch, not assuming expiration. If still blocked, report the observed evidence, remaining uncertainty, and the specific missing action.

## rizakura-hontai and Daymark planning boundaries

- Name the shared foundation and portal `rizakura-hontai`. Keep Tech Inbox and Daymark as product names. The pre-existing `Rizakura0110/rizakura-me` repository is unrelated and must not be modified as part of this migration.
- For Phase 18 onward, use `docs/rizakura-hontai-design.md` and `docs/rizakura-hontai-roadmap.md` alongside the latest user instructions.
- Prepare the shared foundation, portal, and repository integration first. Daymark feature behavior and UI must be designed with the owner immediately before feature implementation at the start of Phase 21.
- Through Phase 20, use only non-sensitive connectivity stubs for Daymark integration. Do not pre-build habit forms, domain API contracts, business tables, migrations, or achievement/aggregation rules from earlier draft ideas.
- Daymark uses the approved public `Rizakura0110/daymark` repository as a commit-pinned Git submodule at `modules/daymark`, linked through pnpm workspace. Do not publish it to npm or request npm credentials. Preserve the registry dependency supply-chain policy.
- Commit and push tested Daymark changes before committing the foundation's updated submodule pointer. Never follow a moving branch automatically during build/deploy; review and test each combined revision.
- Tech Inbox uses the approved public `Rizakura0110/tech-inbox` repository as a commit-pinned Git submodule at `modules/tech-inbox`. Keep its independent lockfile/quality gate and the foundation's integration gate; do not publish it to npm or add an independent production deployment.
- Commit and push tested Tech Inbox changes before committing the foundation's updated gitlink. Keep shared runtime dependencies single-instance in test/build even when each product installs its own dependencies.
