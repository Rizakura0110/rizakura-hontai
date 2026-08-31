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

## rizakura-hontai and Daymark planning boundaries

- Name the shared foundation and portal `rizakura-hontai`. Keep Tech Inbox and Daymark as product names. The pre-existing `Rizakura0110/rizakura-me` repository is unrelated and must not be modified as part of this migration.
- For Phase 18 onward, use `docs/rizakura-hontai-design.md` and `docs/rizakura-hontai-roadmap.md` alongside the latest user instructions.
- Prepare the shared foundation, portal, and repository integration first. Daymark feature behavior and UI must be designed with the owner immediately before feature implementation at the start of Phase 21.
- Through Phase 20, use only non-sensitive connectivity stubs for Daymark integration. Do not pre-build habit forms, domain API contracts, business tables, migrations, or achievement/aggregation rules from earlier draft ideas.
- Resolve Daymark repository visibility and package distribution before the external operations in Phase 20; unanswered visibility questions do not block Phase 18/19 foundation work.
