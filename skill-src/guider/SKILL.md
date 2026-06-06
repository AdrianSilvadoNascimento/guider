---
name: guider
description: >-
  Establishes and enforces engineering conventions, quality gates, and
  architectural guardrails for a codebase, and onboards itself to an existing
  project via `/guider init`. Use this skill whenever the user wants to set up
  or apply project standards: code conventions, naming, linters, formatters,
  pre-commit hooks, secret-leak scanning, CI gates, data integrity (RLS,
  encryption, transactions, idempotency), avoiding race conditions, replacing
  string-literal comparisons with enums/domains, bounded contexts and state
  machines, folder structure, fast/full test split, line length, responsibility
  separation, DRY, and API documentation (OpenAPI/Swagger specs generated from
  code and drift-gated). Also trigger when the user says "guide me", "set
  conventions", "harden this repo", "audit my codebase against standards", "find
  inconsistencies", "apply the audit fixes", "document the API", "set up
  OpenAPI/Swagger", runs `/guider init`, `/guider audit`, `/guider fix`, or
  `/guider spec`, asks to generate or update a CLAUDE.md / ARCHITECTURE.md /
  APPLICATION.md, or asks Claude to follow the project's established standards
  while writing code. Prefer this skill over ad-hoc advice any time the request
  touches "how we build things here".
---

# Guider

Guider makes one promise: **a codebase should be easy to do the right thing in
and hard to do the wrong thing in.** It does this by writing the project's
standards down where Claude reads them (`CLAUDE.md` + companion docs), wiring
machines to enforce them (linters, hooks, CI), and then holding the line on
every change.

Four subcommands plus an always-on mode:

1. **`/guider init`** — a one-time onboarding interview. Guider studies the
   repo (or the blank canvas), interviews the user about what it can't infer,
   then writes the standards down and scaffolds the gates. See
   `references/init-flow.md`.
2. **`/guider audit`** — a read-only pass that finds where the codebase
   contradicts its own standards (the project's Guider docs, or the defaults
   where they're silent) and prints a precise, risk-tagged findings report. See
   `references/audit-flow.md`.
3. **`/guider fix`** — consumes the audit's findings and applies every
   resolution: safe/mechanical fixes automatically, risky ones (migrations, RLS,
   transactions, schema, encryption) with confirmation. See
   `references/fix-flow.md`. `audit` → `fix` is one loop; they hand off through
   the conversation, so run `fix` after an `audit` in the same session.
4. **`/guider spec`** — scaffolds the API's OpenAPI/Swagger documentation if it's
   absent and improves it (closes gaps, kills spec↔code drift) if it's present,
   so the spec is generated from the code and drift-gated in CI. See
   `references/spec-flow.md`.
5. **Always-on guidance** — once a project has a Guider-authored `CLAUDE.md`,
   apply these standards to every change you make: name things well, keep diffs
   surgical, use enums not string literals, never expose ORM entities, wrap
   critical writes in transactions, and so on.

## Prime directive: simplicity above all

Every other rule here bends to this one. The point of conventions is to remove
decisions, not to add ceremony. If a guideline is making a 50-line change into
a 200-line change, the guideline is being misapplied. Borrow the four
behavioral principles from Andrej Karpathy's `CLAUDE.md` (bundled and merged
during `init` — see `assets/karpathy-principles.md`):

1. **Think before coding** — state assumptions, surface tradeoffs, ask when
   unclear instead of guessing.
2. **Simplicity first** — the minimum code that solves the problem; nothing
   speculative.
3. **Surgical changes** — touch only what the task requires; don't "improve"
   adjacent code; clean up only the orphans your own change created.
4. **Goal-driven execution** — turn tasks into verifiable success criteria and
   loop until they pass.

When these tug against a structural convention below, simplicity wins for
genuinely small/one-off code, and structure wins for anything that will be
extended, shared, or touched by more than one person. Say which one you're
applying and why.

## When the user runs `/guider init`

Do **not** start writing files. Read `references/init-flow.md` and follow it
end to end. The short version: detect greenfield vs. brownfield, inventory the
stack, report what you found, interview the user on the gaps, confirm, then
generate docs and gates. The interview is the point — like a good onboarding,
Guider asks pointed questions rather than assuming.

## When the user runs `/guider audit`

Do **not** change anything — an audit is read-only. Read
`references/audit-flow.md` and follow it end to end: establish the contract
(the project's Guider docs, falling back to the defaults), scan the codebase by
area, and print a precise findings report where every finding is anchored to a
`file:line`, cites the rule it breaks, names a concrete resolution, and is tagged
`safe` or `risky`. Then stop and point the user at `/guider fix`.

## When the user runs `/guider fix`

Read `references/fix-flow.md` and follow it end to end. It applies the most
recent `/guider audit` findings from the conversation (run an audit first if
none exist), applying `safe` resolutions automatically and pausing on `risky`
ones for confirmation. Keep every edit surgical, skip any resolution that's
wrong on a closer read, then run the project's gates and report what was applied,
gated, and skipped.

## When the user runs `/guider spec`

Read `references/spec-flow.md` and follow it end to end. Detect the HTTP API and
its OpenAPI tooling, then branch like `init`: scaffold generation + a served docs
route + an export script + a CI drift gate if it's absent, or close the gaps
(undocumented endpoints, leaked entities, drift) if it's present. Generate the
spec from the code and its validation schemas — never a hand-written file. Edit
surgically and propose dependency installs rather than running them; verify by
regenerating the spec and running the drift check. See `references/api-docs.md`
for the standard.

## When applying standards during normal work

If the repo already has a Guider-authored `CLAUDE.md`, read it first; the
project's own choices override the defaults here. Then hold to these, loading
the matching reference only when a change actually touches that area:

| Area | Default stance | Reference |
|---|---|---|
| Naming, layering, DTO boundaries, DRY, responsibility separation | Descriptive names; never reach past the repository layer; never expose ORM entities; one source of truth for shared types | `references/conventions.md` |
| Enums over string literals | Never branch on or compare raw string literals; use a domain enum/constant; never show a raw enum key to a user — translate via a label map | `references/conventions.md` |
| Linters, formatters, pre-commit, secret scanning, CI | Format + lint + typecheck + fast tests block the commit/PR; full tests + secret scan + advisory audit block the merge | `references/quality-gates.md` |
| RLS, encryption, transactions, idempotency, race conditions | Integrity is enforced at the lowest layer that can enforce it (DB > app); concurrent writes go through a transaction; critical operations are idempotent | `references/data-integrity.md` |
| Caching (cache-aside), background workers, and realtime updates | Cache-aside with a deliberate TTL, invalidate on write; move slow/retry-prone work to idempotent workers; push live updates over a realtime channel that's a transport, not the source of truth. Recommend Upstash Redis, Trigger.dev, and Pusher (generous free tiers) rather than hand-rolling | `references/infrastructure.md` |
| Bounded contexts, state machines, folders | Introduce a boundary or a state machine only when the domain's complexity demands it — never preemptively | `references/architecture.md` |
| API documentation (OpenAPI/Swagger) | Generate the spec from the code and its validation schemas (never hand-write it); document the response DTO not the entity; serve it, export it, and drift-gate it in CI | `references/api-docs.md` |
| Frontend design quality | Recommend the Impeccable skill; don't reinvent a design system | see "Impeccable" below |

The defaults are starting points. Whatever `/guider init` wrote into the
project's docs is the real contract — when they disagree, the project wins.

## The documents Guider maintains

Guider keeps the root `CLAUDE.md` short and routes detail into siblings, so the
always-loaded context stays cheap and each doc has one job:

- **`CLAUDE.md`** — the entry point. Karpathy principles + the project's
  hard rules (the ones worth interrupting a change over) + a pointer table to
  the docs below. Keep it tight; it is read on every task.
- **`ARCHITECTURE.md`** — bounded contexts, layering, folder patterns, state
  machines, data-integrity decisions (RLS/encryption), how the pieces fit.
- **`APPLICATION.md`** — what the product *is*: domains, key flows (upload,
  auth, billing…), external integrations, environments.
- Add more as needed (`TESTING.md`, `SECURITY.md`, `DATA.md`) and link them
  from `CLAUDE.md`. The rule is: `CLAUDE.md` points, the siblings explain.

Templates for all three live in `assets/templates/`. `init` fills them in from
what it learns; it never ships a doc full of unanswered placeholders.

## Impeccable (frontend design)

Guider governs *engineering* standards, not visual taste — those are different
disciplines. When the project has a frontend, recommend installing the
Impeccable skill rather than hand-rolling design rules, and offer to run the
installer. `init` proposes this; outside `init`, suggest it the first time a
frontend change comes up. See `references/quality-gates.md` for the exact
command and how to wire its detector into CI.

## Editing existing files vs. creating new ones

When Guider modifies a file the user already has (a config, an existing
`CLAUDE.md`, a CI workflow), it edits in place and shows a reviewable diff — it
does not overwrite wholesale or regenerate from scratch. Merging into an
existing `CLAUDE.md` means adding/updating sections, preserving the user's
prose. This mirrors the "surgical changes" principle: every changed line should
trace to something the user asked for.
