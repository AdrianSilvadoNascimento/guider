# The `guider` skill

Guider makes one promise: **a codebase should be easy to do the right thing in
and hard to do the wrong thing in.** It writes the project's standards down where
the agent reads them, wires machines to enforce them (linters, hooks, CI), and
holds the line on every change.

Guider is **agent-neutral** — it targets both Claude and Codex / ChatGPT, which
read the same skill format and the same generated docs.

## Subcommands

| Command | What it does |
|---|---|
| `/guider init` | One-time onboarding interview. Studies the repo, interviews you about what it can't infer, then writes the standards down and scaffolds the gates. |
| `/guider audit` | Read-only pass that finds where the codebase contradicts its own standards and prints a precise, risk-tagged findings report. |
| `/guider fix` | Consumes the audit's findings and applies them — safe/mechanical fixes automatically, risky ones with confirmation. Run it after an `audit` in the same session. |
| `/guider spec` | Scaffolds or improves the API's OpenAPI/Swagger docs so the spec is generated from code and drift-gated in CI. |

Beyond the subcommands, once a project has Guider-authored standards the skill
applies them to **every** change: descriptive names, surgical diffs, enums over
string literals, DTO boundaries, transactions around critical writes, and so on.

`/guider audit` can also run unattended: `init` offers an *optional* GitHub
Actions mode that comments the audit automatically on every PR, so nobody has
to remember to run it by hand. It's entirely opt-in and needs exactly one
repo secret (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`) — standalone use
of the subcommands needs none of it. See `references/ci-automation.md`.

## What it enforces, and how

| Area | In short | Reference |
|---|---|---|
| Application security | IDOR/authorization, injection, sessions, exploitable races; always high severity, confirmed before fixing, shipped with a negative test | `references/security.md` |
| Release quarantine | Dependencies, skills and plugins are adopted only after 7 days public (negotiable, minimum 1); configured per package manager and update bot | `references/supply-chain.md` |
| Agent hooks | Claude Code and Codex hooks: hard rules at session start, secret-file and unquarantined-install guard, per-edit lint/docs gate and security-sink warnings | `references/agent-hooks.md` |
| Code graph | Zero-dependency import graph (`impact`, `cycles`, `layers`) so audits and fixes scope by blast radius; reads graphify output when present | `references/code-graph.md` |
| Observability & SEO | Errors, analytics, traces and logs (Sentry, PostHog, OpenTelemetry); server-rendered metadata, sitemap and a Lighthouse budget for public sites | `references/observability.md`, `references/seo.md` |
| Frontend tooling | A menu, not a lock-in: Modern Web Guidance, Impeccable, frontend-design, Vercel agent-skills, shadcn MCP, Chrome DevTools MCP | `references/frontend-tooling.md` |
| Token economy | Lean always-loaded docs, the code graph, and the caveman plugin for terse agent replies | `SKILL.md` §Token economy |

All references live under [`skill-src/guider/references/`](../skill-src/guider/references/).

## The documents Guider maintains

Guider keeps a short, tool-neutral entry point and routes detail into siblings,
so the always-loaded context stays cheap and each doc has one job:

- **`AGENTS.md`** — the canonical, agent-neutral entry point and **single source
  of truth**: behavioral principles, the project's hard rules, and a pointer
  table to the docs below. Codex / ChatGPT and most agents read it natively.
- **`CLAUDE.md`** — a thin Claude Code entry point that **imports** `AGENTS.md`
  (`@AGENTS.md`) so Claude loads the same standards. No duplicated rules.
- **`ARCHITECTURE.md`** — bounded contexts, layering, folders, state machines,
  data-integrity decisions (RLS/encryption).
- **`APPLICATION.md`** — what the product *is*: domains, key flows, integrations,
  environments.
- **`docs/README.md`** — the index: which doc owns which topic.
- When the project wants them: **`BACKLOG.md`** (open items only),
  **`docs/DECISIONS.md`** (the why behind rules), **`docs/PRINCIPLES.md`**
  (invariants that cost an incident) and one **`docs/<DOMAIN>.md`** per area.

Every doc has a size budget (`AGENTS.md`: 150 lines; domain docs: 40,000
characters), holds only the current state, and states each fact once; the
others point to it. The full standard is
[`skill-src/guider/references/docs-standard.md`](../skill-src/guider/references/docs-standard.md),
and `assets/check-docs.mjs` can enforce the budgets in the project's pre-commit
hook.

The rule is: **`AGENTS.md` points, the siblings explain, and `CLAUDE.md` just
imports `AGENTS.md`.** Standards live in exactly one place per topic — never
copied into both entry points.

> Already keep everything in a full `CLAUDE.md`? `init` can keep that as the
> canonical file and add a thin `AGENTS.md` pointing at it instead — either
> direction works, as long as the rules live in one file.

## Source & authoring

The skill's source lives in [`skill-src/guider/`](../skill-src/guider/):
`SKILL.md`, `references/` (loaded on demand), `assets/templates/`, and the
scripts `init` copies into projects (`assets/check-docs.mjs`, `assets/graph.mjs`,
`assets/hooks/`). See
[maintainers.md](maintainers.md) for building and releasing new versions.
