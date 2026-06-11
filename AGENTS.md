# skills-to-the-moon Agent Instructions

This file contains project-level Agent instructions for this repository. Follow higher-priority system, developer, and user instructions first, then use this file as the local default for work in this repo.

## Project Scope

- This repository is a self-hosted feedback loop tool for Agent skills.
- It contains the feedback server, CLI, feedback-rules template, user-defined skills, automation prompt templates, and documentation.
- The core loop is: report skill invocations and corrections -> store and monitor them in the server -> summarize them periodically -> open review pull requests -> sync merged skill upgrades locally.

## Language and Documentation

- User-facing conversation can follow the user's current language preference.
- `README.md` is the primary English README.
- `README.zh-CN.md` is the Chinese translation. When one README changes, check whether the other should be updated as well.
- External package copy, npm metadata, and English README prose should stay concise and natural. Avoid rigid sections such as "For users" and "For developers".
- New documentation should usually live under `docs/`. Automation prompt templates belong in `docs/automation-templates/`.

## Development Constraints

- Prefer existing project structure and patterns over new abstractions.
- Use `apply_patch` for manual file edits.
- Do not overwrite uncommitted user changes. Check `git status -sb` before committing.
- The required Node version is declared in `package.json` under `engines`.
- The package manager is `pnpm@10.18.3`.
- Do not remove the published `dist/` output. The npm server start command depends on `dist/src/server/index.js`.

## Verification

For code changes or release preparation, prefer:

```bash
pnpm test
pnpm run typecheck
pnpm run build
pnpm run validate:feedback-skill
npm_config_cache=/tmp/skills-to-the-moon-npm-cache npm pack --dry-run
```

For documentation-only changes, run at least:

```bash
git diff --check
npm_config_cache=/tmp/skills-to-the-moon-npm-cache npm pack --dry-run
```

After editing the English README, check that Chinese text was not accidentally left behind:

```bash
rg -n "[\\u4e00-\\u9fff]" README.md
```

## feedback-rules and Sync Flow

- `feedback-rules-${scope}` is a dynamically packaged system protocol skill. It does not participate in the feedback loop.
- Each feedback service should use its own scope, server address, and reportable skills list.
- Invocation reporting should run as a background default action and should not visibly interrupt the user.
- `sync-upgrades` stores the local processed hash at:

```text
~/.agents/skills/.feedback-upgrades/<scope>.last-seen
```

- `sync-upgrades --repo` clones the repository into a `skills-sync-repo-*` directory under the system temp directory. Normal completion cleans it up automatically. If the process is interrupted, the temp directory can remain.

## Git Habits

- Confirm the staged scope before committing. Only commit files related to the current task.
- Use English commit messages.
- Documentation commits can use messages such as:

```text
docs: ...
```

- Feature and bugfix commits can use messages such as:

```text
feat: ...
fix: ...
```

- If the user explicitly asks to push to `main`, commit and push directly. Otherwise, report the uncommitted changes after finishing.
