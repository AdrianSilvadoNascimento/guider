# `/guider init` — onboarding flow

The goal of `init` is to end with a project whose standards are written down
and machine-enforced, tailored to *this* codebase rather than a generic
template. The interview matters more than the scan: the scan tells you what the
code *is*, the interview tells you what the team *intends*. Don't skip it, and
don't dump a wall of questions — ask in small, pointed rounds, the way a sharp
teammate would when pairing with you on day one.

Work through five phases in order. Don't write any project file until Phase 5.

---

## Phase 1 — Greenfield or brownfield?

Look before you ask. Check for source files, a VCS history, a manifest
(`package.json`, `pyproject.toml`/`requirements.txt`, `go.mod`, `Cargo.toml`,
`pom.xml`, `Gemfile`, `composer.json`, etc.), and an existing `AGENTS.md` or
`CLAUDE.md`.

- **Brownfield** (code already exists): go to Phase 2.
- **Greenfield** (empty or near-empty): skip the inventory. Ask the user what
  they're about to build, the stack they intend, and team size, then jump to
  Phase 3 using their answers as the "stack." Greenfield standards are
  aspirations; brownfield standards are descriptions of reality plus a few
  upgrades. Be honest about which you're writing.

If a non-Guider `AGENTS.md` or `CLAUDE.md` already exists, read it fully —
you'll merge into it, not replace it.

---

## Phase 2 — Inventory the codebase (brownfield)

Read, don't guess. Gather the facts that the docs and gates will depend on. Use
read-only commands; never run a build, install, or migration during `init`.

Things to determine, with where to look:

- **Languages & runtimes** — manifests, lockfiles, version files
  (`.nvmrc`, `.python-version`, `go.mod`), `Dockerfile`s.
- **Monorepo or single package** — `apps/`, `packages/`, workspace fields,
  `turbo.json`/`nx.json`/`pnpm-workspace.yaml`. Map the workspaces.
- **Frameworks** — backend (NestJS, Express, FastAPI, Django, Rails, Spring…)
  and frontend (Next, Remix, Vue, SvelteKit…).
- **Data layer** — ORM/queries (Prisma, TypeORM, Drizzle, SQLAlchemy,
  ActiveRecord), the DB engine, migrations, and whether Row-Level Security
  exists. For Postgres, grep migrations for `ENABLE ROW LEVEL SECURITY` /
  `CREATE POLICY`. Note any encryption (column encryption, KMS, `pgcrypto`).
- **Cache & workers** — is there a cache (Redis/Upstash/Memcached client, env
  vars like `*_REDIS_*`) and a cache-aside helper? Is there a job
  queue/background worker (BullMQ, Trigger.dev, Inngest, Celery, Sidekiq, a
  cloud queue)? Note how retries and idempotency are currently handled, if at
  all.
- **Realtime** — is there a realtime/WebSocket layer (Pusher, Ably, Socket.io,
  Supabase Realtime)? Grep for `pusher`, `socket.io`, `ably`, channel/event
  name strings. Note whether channel/event names are constants or magic
  strings, and whether private channels are authed server-side.
- **API documentation** — is there an HTTP API, and is its OpenAPI/Swagger spec
  generated from the code (a generator dependency like `@nestjs/swagger`,
  `springdoc`, `drf-spectacular`, `fastapi`'s built-in, `swagger-jsdoc`/
  `zod-to-openapi`), served at a route, exported as a file, and drift-gated in
  CI? Note whether it's generated-from-code or a hand-written spec that can drift
  (see `api-docs.md`).
- **Observability** (`observability.md`) — error reporting, analytics, tracing
  and logging SDKs already present (`@sentry/*`, `posthog-*`,
  `@opentelemetry/*`, pino/winston/structlog), where they're initialized, and
  any health endpoints.
- **SEO** (`seo.md`, public frontends only) — rendering mode per public route,
  metadata API usage, `robots.txt`/sitemap, JSON-LD.
- **Supply chain** (`supply-chain.md`) — package managers and their versions,
  lockfiles, Renovate/Dependabot config, and any release-age/cooldown setting
  already present.
- **Security posture** (`security.md`) — how authorization is done today (a
  policy module, guards/middleware, scoped repositories, RLS, or ad hoc checks in
  handlers); auth provider/library; whether the app is multi-tenant; public vs.
  authenticated vs. admin routes; raw SQL, shell calls and HTML-injection sinks;
  LLM features with tool access. Note the gaps; don't audit them yet.
- **Existing quality tooling** — formatter/linter configs (`.eslintrc*`,
  `biome.json`, `ruff.toml`, `.prettierrc`, `.editorconfig`), `.pre-commit-config.yaml`
  or Husky/lint-staged, secret scanners (`.gitleaks.toml`, trufflehog config),
  and CI workflows (`.github/workflows`, `.gitlab-ci.yml`, etc.).
- **Tests** — framework(s), where tests live, and whether there's already any
  fast/slow split. Note the line length the formatter currently enforces.
- **Domain shape** — top-level folders under `src/`; do they look like
  technical layers (`controllers/`, `models/`) or bounded contexts
  (`billing/`, `deals/`)? Are there enums, and is there a translation/label map
  for them?

Produce a short written **inventory report** for the user: stack, structure,
what gates already exist, and the gaps. This report is also what makes the
interview targeted — only ask about what you couldn't read.

---

## Phase 3 — Interview the user (the grill)

Ask only what the scan left open, in rounds of one to three related questions.
Prefer tappable choices over open prose when the answer is a small set. Confirm
inferences rather than re-asking them ("I see Ruff with line length 88 — keep
that as the project standard?").

Cover these, skipping any the scan already answered:

**Standards & style**
- Line length, if not already enforced by a formatter.
- Naming strictness: is renaming cryptic identifiers (`err`→`error`,
  `d`→`data`) in-scope a *required fix* on touched code, or advisory?
- Language for the generated docs (default: match the repo's existing
  comments/README language).

**Docs** (`docs-standard.md`) — brownfield: measure the existing docs first
(`wc -m`, longest line) and show the numbers against the default budgets.
- Beyond the core set (`AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`,
  `APPLICATION.md`, `docs/README.md`), which docs does the project want: a
  `BACKLOG.md`, a decision log (`docs/DECISIONS.md`), `docs/PRINCIPLES.md`,
  one doc per domain? Don't offer what the project's size doesn't earn.
- Keep the default budgets and the 120-character line, or adjust?
- Lock the entry file? Some owners want `AGENTS.md` changed only with their
  explicit approval — agents propose, never apply. If yes, who approves?
- Wire `check-docs.mjs` into the pre-commit hook?

**Domain & architecture**
- What are the core domains/bounded contexts, in the user's words? (Confirm or
  correct what you inferred from folders.)
- Any workflow that's really a **state machine** (an order, a deal, a
  subscription moving through statuses)? These get documented explicitly;
  ad-hoc status strings scattered across the code are exactly what Guider
  exists to prevent.
- Which **enums** are user-facing, and is there a label/translation map? If
  not, where should one live?

**Data integrity & concurrency**
- Which operations are **critical and must be idempotent** (uploads, payments,
  OCR/generation, anything triggered by a webhook or a retry)?
- Where do **concurrent writes** happen that need a transaction or a lock?
- Is there sensitive data needing **encryption** or **RLS**, and is multi-tenant
  isolation a requirement?
- External APIs that need **retry-with-backoff** and **TTL caching**.

**Observability** (`observability.md`)
- Which signals are wanted now: errors (Sentry by default), product analytics
  (PostHog), traces (OpenTelemetry), structured logs? Recommend errors + logs at
  minimum for anything deployed.
- Where do alerts go, and who watches them? Any consent requirement for
  analytics or session replay?

**SEO** (`seo.md`) — only if there's a public, indexable frontend
- Which routes should be indexed, and which must never be?
- Canonical host; add a Lighthouse CI gate with budgets?

**Supply chain** (`supply-chain.md`)
- Release quarantine: keep the 7-day default, or lower it (minimum 1 day)?
  Applies to dependencies, update bots, skills and plugins alike.
- Who approves a bypass for an urgent security fix, and where is it recorded?

**Security** (`security.md`) — confirm the scan, ask only what it couldn't show
- Who owns what: user, tenant, org? Which roles exist, and where should the
  authorization check live (one policy module is the default recommendation)?
- Which routes are public, and which are admin-only?
- Multi-tenant? If yes, is database-enforced isolation (RLS) wanted
  (`data-integrity.md`)?
- Any operation on money, credits, stock or quotas that a user could race?
- LLM features that read user or fetched content and can call tools?

**Caching & workers**
- Are there expensive or hot reads worth a **cache-aside** layer? If there's no
  cache yet and one would help, recommend **Upstash Redis** (serverless, REST
  *or* Redis protocol, generous free tier) — see `infrastructure.md`. Confirm
  the TTL strategy.
- Is there slow or retry-prone work (OCR, processing, report generation,
  webhook handling) that should move **off the request path** into a worker? If
  there's no queue yet, recommend **Trigger.dev** (code-first, no execution
  timeouts, retries + observability built in, free tier and self-hostable).
  Capture which tasks, and confirm they'll be idempotent.
- Do clients need **live updates** (notifications, presence, live dashboards,
  "job done")? If so and there's no realtime layer, recommend **Pusher
  Channels** (hosted WebSocket pub/sub, broad SDK support, free Sandbox) — see
  `infrastructure.md`. Confirm channel/event names will be constants (not magic
  strings) and that the client reconciles against the source after missed
  messages.

**Gates & tests**
- Confirm the **fast vs. full** test split: what should run on every
  commit/push (fast: unit + quick integration) vs. only in CI (full: e2e + slow
  integration)?
- Secret-leak scanning: confirm adding it if absent.
- CI provider, if not detected.

**CI automation (optional)** — only ask if the CI provider is GitHub Actions
(this specific mode is GitHub-specific; see `ci-automation.md`)
- Want `/guider audit` to run automatically on every PR and post the findings
  as a comment, instead of (or in addition to) running it by hand? If yes,
  gather the four things `ci-automation.md`'s template needs: which auth
  secret they'll use (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`),
  whether this repo has bot-opened PRs (and if so, the bot's name), where
  its other workflows live, and which model should run the audit (a
  diff-scoped convention check — recommend the cost-effective tier in
  whichever model family they're on, since it runs on every PR; leave it
  unset rather than guessing if they have no preference). (The workflow
  installs `guider` itself from the public CLI — no marketplace or plugin to
  configure.) If no, skip the rest of this round entirely — it's opt-in, not
  a default.

**Code graph** (`code-graph.md`)
- Copy `graph.mjs` and build the structural graph (default yes — it is free and
  derived). Which layering rules and bounded contexts, already confirmed above,
  should become machine-checked boundaries in `.guider-graph.json`?
- Large repo, or lots of docs/specs beside the code? Offer graphify for a
  semantic graph (optional; its install follows the release quarantine).

**API documentation**
- If there's an HTTP API and no generated OpenAPI spec (or a hand-written one
  that can drift), propose setting it up the Guider way: generated from the code
  and its validation schemas, served at a route, exported as a file, and
  drift-gated in CI (see `api-docs.md`). Confirm where the spec should live and
  whether the docs route needs auth. `/guider spec` can scaffold or improve this.

**Frontend**
- Is there a frontend? If so, which ground should agent tooling cover —
  platform correctness, design quality, the component library, runtime
  debugging? Propose from the menu in `frontend-tooling.md` (Modern Web Guidance
  by default, plus a design tool such as Impeccable or frontend-design when
  visual quality matters).

Keep a running summary of decisions. When the open questions are answered, move
on — don't pad the interview.

---

## Phase 4 — Confirm the plan

Before writing anything, lay out exactly what you'll create or change:

- which docs (`AGENTS.md` + its thin `CLAUDE.md` importer, `ARCHITECTURE.md`,
  `APPLICATION.md`, `docs/README.md`, any extras chosen in the Docs round) and
  the headline content of each; for brownfield docs over budget, what moves
  where (a relocation plan, not a rewrite);
- which gates you'll scaffold (formatter/linter config, pre-commit hooks,
  secret scan, CI workflow) and which already exist and will be left alone;
- whether you're adding the optional CI-automated `/guider audit` workflow
  (`ci-automation.md`), if the user opted in;
- the Karpathy merge into `AGENTS.md`;
- the observability signals and SEO setup agreed (`observability.md`, `seo.md`),
  as proposed install commands, not installs;
- the recommended managed services (Upstash for cache, Trigger.dev for workers,
  Pusher for realtime) where they fit, and the chosen frontend tooling.

Get a yes. This is the last cheap moment to redirect.

---

## Phase 5 — Generate docs and scaffold gates

Now write, using the templates in `assets/templates/`. Rules:

1. **Fill, don't stub.** Replace every placeholder with a real answer from the
   scan or interview. If a section genuinely doesn't apply (no frontend, no
   state machines), remove it rather than leaving a `TODO`.
2. **`AGENTS.md` is the canonical entry point; write it as a router.** The
   project's hard rules, the condensed Karpathy principles, and a "before you
   touch X, read Y" routing table — by trigger, not by doc name, because an
   agent only opens a doc it knows it needs. Detail lives in the siblings;
   150 lines is the budget (`docs-standard.md`). If the user locked the entry
   file, write the lock as a hard rule. Then write a **thin `CLAUDE.md`** that
   imports it (from `assets/templates/CLAUDE.md.tmpl`) — it must contain
   `@AGENTS.md` and no duplicated rules, so Claude Code loads the same standards
   while Codex / ChatGPT reads `AGENTS.md` natively. One source of truth, two
   entry points.
3. **If the pointer model still doesn't fit the budget, extract further —
   never `@import` your way out of it.** A long list of hard-won invariants is
   the usual culprit: each one earns its place (cutting one feels like losing
   safety, not trimming fat), so the canonical file can stay oversized even
   after every other section already points elsewhere.
   - Move the list itself, verbatim, into a dedicated companion doc (e.g.
     `PRINCIPLES.md`). This is a relocation, not a deletion — verify a
     before/after count so nothing goes missing in the move.
   - Replace it in the canonical file with a scannable index: one identifier
     per item, grouped by area, no restated prose. This only reads well when
     identifiers are already descriptive slugs (`no-cross-currency-settle`,
     not `RULE-042`) — the identifier IS the summary. Keep a short paraphrase
     per line instead if the project uses opaque IDs.
   - Don't reach for `@file` imports to fix a size problem — Claude Code and
     similar tools inline the imported file into every session's context, so
     an import moves bytes between files without shrinking what's actually
     loaded. It solves a *files* problem, not a *budget* problem.
   - Measure the real result instead of forcing a number. If the practical
     floor (irreducible safety-critical content + the leanest honest index)
     lands above the target, say so with the real measurements and let the
     user choose between accepting it or cutting something concrete.
4. **Merge the Karpathy principles into `AGENTS.md`, condensed** — one line
   per principle, in the docs language, attributed and linked to the source.
   The entry file is read on every task, so the full upstream text doesn't
   belong there; fetch it only to check the condensed form is still faithful,
   or save it to a companion doc (e.g. `docs/KARPATHY.md`) if the user wants
   the full text:
   ```bash
   # canonical source: https://github.com/multica-ai/andrej-karpathy-skills
   curl -fsSL https://github.com/multica-ai/andrej-karpathy-skills/raw/refs/heads/main/CLAUDE.md \
     > docs/KARPATHY.md
   ```
   Offline, condense the bundled paraphrase in `assets/karpathy-principles.md`
   (its headings are the four lines), with the same attribution. When an
   `AGENTS.md` (or a full `CLAUDE.md`) already exists, merge these in as a
   section — don't duplicate or clobber the user's existing content. If the
   project already keeps its standards in a full `CLAUDE.md`, you may keep that
   as the canonical file and add a thin `AGENTS.md` pointing at it instead —
   either direction is fine as long as the rules live in exactly one file.
5. **Split arch/flows out.** Put bounded contexts, layering, folder patterns,
   state machines, and data-integrity decisions in `ARCHITECTURE.md`; put the
   product/domain/flows narrative in `APPLICATION.md`; leave pointers in
   `AGENTS.md`. Each fact goes to exactly one owner doc (`docs-standard.md` §1);
   a flow in `APPLICATION.md` points to its guarantees, it doesn't restate them.
   Write `docs/README.md` from `docs-README.md.tmpl` (the owner-of-each-topic
   table), plus whichever of `BACKLOG.md` / `docs/DECISIONS.md` the user chose.
   Brownfield docs over budget: relocate sections to their owner, verbatim,
   with a before/after character count so nothing goes missing — trimming
   prose is a separate, user-approved step. If the user wanted the docs gate,
   copy `assets/check-docs.mjs` to the project's scripts folder, write any
   budget the user changed to `.guider-docs.json`, and add the script to the
   pre-commit hook (`quality-gates.md` §2).
6. **Scaffold gates surgically** (see `references/quality-gates.md` for the
   per-stack specifics). Only add what's missing; edit existing configs in
   place with a visible diff. Never install dependencies or run hooks during
   `init` — propose the install commands and let the user run them.
7. **Recommend the chosen frontend tooling** (`frontend-tooling.md`) if there's
   a frontend, and offer to run the installers.
8. **Configure the release quarantine** (`supply-chain.md`): write the
   release-age key for each package manager and update bot in use, edited in
   place with a diff; add the hard rule to `AGENTS.md`. Flag any tool too old to
   honor the key rather than writing a setting it ignores.
9. **Install the code graph** if accepted (`code-graph.md`): copy
   `assets/graph.mjs` next to `check-docs.mjs`, write `.guider-graph.json` with
   only the boundaries the user confirmed, add `.guider/` to `.gitignore`. The
   first `build` is read-only on source files — run it and show the summary.
10. **Record the security model** in `ARCHITECTURE.md` §Security (`security.md`
   "What `/guider init` records") and add its two hard rules to `AGENTS.md`.
   Point at `/security-review` per change and a periodic whole-repo security
   audit; Guider's own audit covers the rules, not a penetration test.
11. **Record the API-docs decisions** if there's an HTTP API (`api-docs.md`): the
   tool generating the spec, where the spec file lives, the served docs route and
   its auth, and the drift-gate command — written into `ARCHITECTURE.md` /
   `APPLICATION.md`. Scaffold the gate if the user agreed; otherwise point them at
   `/guider spec`. Don't install the generator — propose the command.
12. **Record observability and SEO** (`observability.md`, `seo.md`): the chosen
   tools, init location, scrubbing config, sample rates, health endpoints and
   alert routing in `ARCHITECTURE.md`; for public frontends, the metadata helper,
   sitemap/robots source and the Lighthouse budget. Scaffold the Lighthouse CI
   gate if agreed; propose SDK install commands, don't run them.
13. **Recommend the runtime infrastructure** where the interview surfaced a need
   (`infrastructure.md`): Upstash Redis for a cache-aside layer, Trigger.dev for
   background workers, Pusher for realtime updates. Record the choice (and any
   existing alternative the project already uses) in `ARCHITECTURE.md` with its
   TTL / retry / idempotency / missed-message policy. Don't provision or install
   anything — name the next step for the user.
14. **Scaffold the CI-automated audit workflow** only if the user opted in
   (`ci-automation.md`). Fill `assets/templates/guider-audit.yml.tmpl` from the
   interview answers and write it to the project's workflow directory — keep
   only the one auth line (`anthropic_api_key` or `claude_code_oauth_token`)
   that matches their answer, delete the `allowed_bots` line entirely if
   they have no bot-opened PRs, and set `--model` to their answer (or drop
   the line entirely if they had no preference — don't guess). The workflow
   installs the skill from the public CLI, so there's nothing else to wire.
   Propose the secret-creation command; never run it or ask for the raw value.

Finish with a short summary: the files created/edited, the commands the user
should run to activate the gates (install hooks, enable CI, add the secret if
step 14 applied), and the one or two follow-ups worth doing next. Then stop —
don't keep generating.
