# skills-to-the-moon

[Translations: Chinese](README.zh-CN.md)

Self-hosted feedback loops for Agent skills: report corrections, monitor usage, open upgrade PRs, and sync skills locally.

`skills-to-the-moon` helps teams turn everyday Agent mistakes into reviewed skill improvements. It records skill usage and correction feedback, keeps the evidence traceable, lets a scheduled Agent propose upgrades through pull requests, and gives local machines a repeatable way to pull merged skill updates.

Built in the open for teams turning real Agent corrections into shared skill upgrades. Field notes, edge cases, and focused patches make the loop sharper.

![Architecture overview](docs/assets/architecture.png)

## Table of Contents

- [Why It Exists](#why-it-exists)
- [How It Works](#how-it-works)
- [What You Get](#what-you-get)
- [Quick Start](#quick-start)
- [Automation Recipes](#automation-recipes)
- [Operating the Loop](#operating-the-loop)
- [API](#api)
- [Project Layout](#project-layout)
- [Development](#development)
- [Publishing to npm](#publishing-to-npm)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)

## Why It Exists

Agent skills get better when corrections are preserved, reviewed, and converted into examples or stable rules. This project keeps that loop explicit:

- collect feedback in the background without interrupting the user
- trace each correction to the skill name, workspace, tech stack, AI output, and user correction
- upgrade skills through pull requests instead of silent mutation
- let the skill repo owner approve what becomes permanent behavior
- sync merged skill updates locally with a recorded `last-seen` hash

## How It Works

1. **Runtime reporting**: a scoped `feedback-rules-${scope}` skill decides when a real business skill invocation or correction should be reported.
2. **Feedback server**: Fastify receives events, stores them in SQLite, renders dashboards, exports CSV, and tracks the latest upgrade pull request.
3. **Iteration Agent**: a scheduled cloud Agent reads feedback CSV, summarizes examples, updates `EXAMPLES.md` or `SKILL.md`, opens a pull request, and records pull request metadata.
4. **Owner review**: the skill repo owner reviews and merges the pull request.
5. **Local sync**: local automation checks `/api/latest-merge-request`, compares `head_commit_hash` with `.feedback-upgrades/<scope>.last-seen`, installs all repo skills, and records the hash only after a successful sync.

## What You Get

- Scoped feedback rules with packaged server addresses.
- Background skill invocation and correction reporting.
- A self-hosted Fastify + SQLite feedback server.
- Dashboard, admin page, CSV export, latest pull request metadata, and merged-pull-request cleanup controls.
- Prompt templates for scheduled iteration Agents and local upgrade-check Agents.
- `npx` commands for installing feedback rules and syncing merged skill upgrades.

## Quick Start

### Start the feedback server

```bash
pnpm install
pnpm run build

SKILLS_FEEDBACK_DB=./data/skills-feedback.sqlite \
SKILLS_FEEDBACK_ADMIN_TOKEN=change-me \
HOST=127.0.0.1 \
PORT=4321 \
pnpm start
```

Open:

```text
http://127.0.0.1:4321/
http://127.0.0.1:4321/admin
```

For development:

```bash
SKILLS_FEEDBACK_DB=./data/skills-feedback.sqlite \
SKILLS_FEEDBACK_ADMIN_TOKEN=change-me \
HOST=127.0.0.1 \
PORT=4321 \
pnpm run dev
```

The server can run on your machine or on a team dev server. Package the address that Agents can actually request into the feedback rules skill.

### Install scoped feedback rules

```bash
npx skills-to-the-moon install-feedback-rules \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --skills github-smoke-canary
```

During local development:

```bash
node bin/skills-to-the-moon.mjs install-feedback-rules \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --skills github-smoke-canary
```

This command:

- installs `feedback-rules-${scope}` into `~/.agents/skills`
- appends a Feedback preauthorization block to `~/.codex/AGENTS.md`
- records the authorized scope, server address, and reportable skills
- tells the Agent not to probe the server before requesting an approved feedback call from outside the sandbox

### Sync merged skill upgrades

```bash
npx skills-to-the-moon sync-upgrades \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --repo Ryan2128/skills-to-the-moon \
  --ref main
```

During local development:

```bash
node bin/skills-to-the-moon.mjs sync-upgrades \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --source-dir /path/to/skills-to-the-moon
```

Sync behavior:

- reads `GET /api/latest-merge-request`
- skips if the latest `head_commit_hash` is already recorded
- refuses to sync unmerged pull requests
- installs every skill under `skills/*`
- writes `~/.agents/skills/.feedback-upgrades/<scope>.last-seen` after a successful sync

## Automation Recipes

### Iteration Agent

Use [`docs/automation-templates/iteration-agent-prompt.md`](docs/automation-templates/iteration-agent-prompt.md).

This scheduled Agent pulls feedback CSV, decides whether the current cycle is a small iteration or a major review cycle, updates examples or stable skill rules, opens a pull request, and records metadata back to the feedback server.

### Local Upgrade Checker

Use [`docs/automation-templates/local-upgrade-check-agent-prompt.md`](docs/automation-templates/local-upgrade-check-agent-prompt.md).

This local Agent checks the latest pull request metadata, compares the stored `last-seen` hash, runs `sync-upgrades` for merged upgrades, and never writes `last-seen` before sync succeeds.

## Operating the Loop

### Cleanup after merge

Use `/admin` after the owner merges an upgrade pull request.

- Only merged pull requests can be cleaned up.
- Pull request titles should record the covered feedback ID range.
- Small iteration pull requests can keep their source reports for later review.
- Major review-cycle pull requests can physically delete the covered reports after merge.

### Multiple feedback services

Install one `feedback-rules-${scope}` package per feedback service. Each package carries its own scope, server address, and reportable skill list, so only corrections for the matching skill scope are reported to that service.

The MVP assumes one skill repository per deployment. Use separate scopes or separate deployments when different feedback tools should stay isolated.

## API

```text
POST  /api/skill-invocations
POST  /api/feedback
GET   /api/feedback.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
GET   /api/latest-merge-request
POST  /api/merge-requests
PATCH /api/merge-requests/:id/status
POST  /api/admin/merge-requests/:id/purge
```

## Project Layout

```text
bin/                         CLI entrypoint
src/server/                  Fastify server, SQLite repositories, web pages
templates/feedback-rules/    Dynamic feedback-rules-${scope} template
skills/                      Regular skills managed by this repo
docs/automation-templates/   Agent prompt templates
docs/superpowers/            Design and implementation notes
tests/                       API, domain, CLI, web, and skill tests
```

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
pnpm run validate:feedback-skill
```

## Publishing to npm

Before publishing:

```bash
pnpm test
pnpm run typecheck
pnpm run build
pnpm run validate:feedback-skill
npm pack --dry-run
```

Check that the tarball includes `bin/`, `scripts/`, `templates/`, `skills/`, `docs/`, `dist/`, `README.md`, and `LICENSE`.

Publish:

```bash
npm login
npm publish
```

For updates:

```bash
npm version patch
npm publish
git push --follow-tags
```

Useful npm references:

- [Creating and publishing unscoped public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [`npm publish`](https://docs.npmjs.com/cli/v10/commands/npm-publish/)
- [`package.json` `bin`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#bin)

## Roadmap

This is an MVP. The server, scoped feedback rules, reporting endpoints, dashboard, pull request metadata, merged-pull-request admin controls, and local sync command are in place.

Next paths:

- **Proactive skill updates**: move beyond passive `sync-upgrades` checks toward an active update flow that can detect merged skill upgrades, run the right installer, record `last-seen`, and surface clear recovery steps when sync fails.
- **More Agent adapters**: support additional Agent runtimes, global instruction files, skill install locations, sandbox approval models, and reporting hooks without changing the core feedback server.
- **Release automation and provenance**: make npm publishing, package verification, and provenance checks repeatable.
- **Real-world feedback examples**: grow the example set from actual correction loops so skill upgrades stay grounded.

## Contributing

The most useful contributions usually come from real feedback loops.

Good patches tend to include:

- new correction examples for skills
- install and preauthorization fixes for different Agent environments
- deployment scripts for self-hosted feedback servers
- improvements to iteration, review, sync, and cleanup flows

Before opening a pull request:

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

A helpful pull request explains what changed, why it changed, how it was verified, and whether it affects feedback payloads, database schema, global `AGENTS.md`, or skill install paths.

## Security

This tool is designed for self-hosted use. It does not redact feedback by default.

Avoid exposing a demo server to untrusted networks. Do not include secrets, credentials, environment variables, browser data, or unrelated file contents in feedback payloads.

## License

MIT
