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
`pom.xml`, `Gemfile`, `composer.json`, etc.), and an existing `CLAUDE.md`.

- **Brownfield** (code already exists): go to Phase 2.
- **Greenfield** (empty or near-empty): skip the inventory. Ask the user what
  they're about to build, the stack they intend, and team size, then jump to
  Phase 3 using their answers as the "stack." Greenfield standards are
  aspirations; brownfield standards are descriptions of reality plus a few
  upgrades. Be honest about which you're writing.

If a non-Guider `CLAUDE.md` already exists, read it fully — you'll merge into
it, not replace it.

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

**Frontend**
- Is there a frontend? If so, propose installing **Impeccable** for design
  quality (see `references/quality-gates.md` for the command).

Keep a running summary of decisions. When the open questions are answered, move
on — don't pad the interview.

---

## Phase 4 — Confirm the plan

Before writing anything, lay out exactly what you'll create or change:

- which docs (`CLAUDE.md`, `ARCHITECTURE.md`, `APPLICATION.md`, any extras) and
  the headline content of each;
- which gates you'll scaffold (formatter/linter config, pre-commit hooks,
  secret scan, CI workflow) and which already exist and will be left alone;
- the Karpathy merge into `CLAUDE.md`;
- the recommended managed services (Upstash for cache, Trigger.dev for workers,
  Pusher for realtime) where they fit, and the Impeccable recommendation.

Get a yes. This is the last cheap moment to redirect.

---

## Phase 5 — Generate docs and scaffold gates

Now write, using the templates in `assets/templates/`. Rules:

1. **Fill, don't stub.** Replace every placeholder with a real answer from the
   scan or interview. If a section genuinely doesn't apply (no frontend, no
   state machines), remove it rather than leaving a `TODO`.
2. **`CLAUDE.md` stays short.** Karpathy principles, the project's hard rules,
   and a pointer table to the sibling docs. Detail lives in the siblings.
3. **Merge the Karpathy principles.** Prefer fetching the canonical file the
   way its repo documents it, then appending under a clearly attributed
   heading:
   ```bash
   # canonical source: https://github.com/multica-ai/andrej-karpathy-skills
   curl -fsSL https://github.com/multica-ai/andrej-karpathy-skills/raw/refs/heads/main/CLAUDE.md \
     >> CLAUDE.md
   ```
   If there's no network access, use the bundled paraphrase in
   `assets/karpathy-principles.md` instead, with the same attribution. When a
   `CLAUDE.md` already exists, merge these in as a section — don't duplicate or
   clobber the user's existing content.
4. **Split arch/flows out.** Put bounded contexts, layering, folder patterns,
   state machines, and data-integrity decisions in `ARCHITECTURE.md`; put the
   product/domain/flows narrative in `APPLICATION.md`; leave pointers in
   `CLAUDE.md`.
5. **Scaffold gates surgically** (see `references/quality-gates.md` for the
   per-stack specifics). Only add what's missing; edit existing configs in
   place with a visible diff. Never install dependencies or run hooks during
   `init` — propose the install commands and let the user run them.
6. **Recommend Impeccable** if there's a frontend, and offer to run its
   installer.
7. **Recommend the runtime infrastructure** where the interview surfaced a need
   (`infrastructure.md`): Upstash Redis for a cache-aside layer, Trigger.dev for
   background workers, Pusher for realtime updates. Record the choice (and any
   existing alternative the project already uses) in `ARCHITECTURE.md` with its
   TTL / retry / idempotency / missed-message policy. Don't provision or install
   anything — name the next step for the user.

Finish with a short summary: the files created/edited, the commands the user
should run to activate the gates (install hooks, enable CI), and the one or two
follow-ups worth doing next. Then stop — don't keep generating.
