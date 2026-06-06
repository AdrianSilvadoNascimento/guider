# `/guider audit` — audit an existing codebase against its standards

`audit` answers one question precisely: **where does this codebase contradict
the standards it claims to hold?** It is the read-only half of a pair —
`/guider audit` finds the inconsistencies, `/guider fix` resolves them (see
`fix-flow.md`). The two talk through the conversation: `audit` prints a
structured findings report, and `fix` consumes that same report. Nothing is
written to disk during an audit.

The audit's value is in being *precise*, not exhaustive. A report full of
stylistic nitpicks trains the user to ignore it. Every finding must be a real
violation of a real rule, anchored to a `file:line`, with a resolution concrete
enough that `fix` can apply it without re-deciding anything.

## The prime directive still governs

Re-read the prime directive in `SKILL.md` before flagging anything. Two failure
modes to avoid:

- **Don't flag simplicity.** A two-line helper duplicated once, a `(data) => …`
  callback, a local `any` with a comment explaining why — these are not
  findings. Guidelines bend to simplicity for genuinely small/one-off code.
- **Don't prescribe premature structure.** Never file a finding that says "add a
  bounded context" or "model this as a state machine" unless the domain
  *already* shows the pressure that earns it (see `architecture.md`). A premature
  boundary is a worse outcome than the thing you're flagging.

If you would not interrupt a change to enforce a rule during normal work, it is
not severe enough to be a `high` finding here.

## Read-only — always

An audit observes; it never changes anything. Do **not** edit files, run a
build, install dependencies, run migrations, or execute hooks. Use only
read-only inspection (read, grep, list). All remediation belongs to `/guider
fix`, and even there the risky changes are gated.

## Scope

By default, audit the whole repository. Accept an optional path or glob —
`/guider audit apps/api/src` or `/guider audit "**/*.service.ts"` — to scope to a
subtree, which is the right move for large repos or a focused review. If the repo
is large and no scope was given, say what you're covering (and what you're
skipping, e.g. generated code, vendored deps, `node_modules`) rather than
silently sampling.

---

## Phase 1 — Establish the contract

You can't audit against standards you haven't read. Before scanning:

1. **Read the project's own docs.** If a Guider-authored `CLAUDE.md` exists, read
   it and its siblings (`ARCHITECTURE.md`, `APPLICATION.md`, any `TESTING.md` /
   `SECURITY.md`). **The project's documented choices are the contract** and
   override the Guider defaults everywhere they speak — its line length, its
   folder convention, which tables have RLS, which operations are idempotent, its
   enum/label-map location, its fast/full test commands.
2. **Fall back to defaults for the gaps.** Where the docs are silent, audit
   against the Guider defaults in `conventions.md`, `data-integrity.md`,
   `infrastructure.md`, `architecture.md`, and `quality-gates.md`.
3. **If there's no Guider `CLAUDE.md` at all**, say so plainly: you're auditing
   against generic defaults, the results will be noisier, and `/guider init`
   would make every future audit sharper. Offer it, then proceed against
   defaults anyway — a useful audit doesn't require init first.

Note which rules came from the project (cite the doc) versus the defaults — it
tells the user which findings are "you broke your own rule" (high signal) versus
"here's a convention you might adopt" (advisory).

---

## Phase 2 — Scan by area

Walk the areas below. Each maps to an existing reference; load it when you scan
that area so you're checking against the real rule, not a paraphrase. For each
area, the recurring violations to grep for and reason about:

**Naming** (`conventions.md`)
- Single-letter / cryptic identifiers (`err`, `res`, `doc`, `acc`, `prev`, `d`).
- `map`/`filter`/`find`/`forEach`/`reduce` callbacks not using the singular of
  the collection (`files.map(f => …)`), including socket/event handlers.

**Enums over string literals** (`conventions.md`)
- Raw string literals in conditionals/comparisons where a domain enum or named
  constant exists or should (`status === 'approved'`).
- Raw enum keys shown to a user without going through a label/translation map.

**Layering, DTO boundaries, DRY** (`conventions.md`)
- ORM / query-builder / raw SQL touched outside the repository layer.
- ORM entities returned straight to a client instead of mapped to a response DTO.
- Services `new`-ing their collaborators instead of dependency injection.
- A shared type duplicated across packages instead of one source of truth.
- A required (non-nullable) dependency that the docs say is optional.

**Error handling & typing** (`conventions.md`)
- Swallowed errors — empty `catch {}`, a `catch` that neither logs-with-context
  nor propagates nor returns a typed failure.
- Unjustified escape hatches (`any`, untyped `dict`, `interface{}`) with no
  explaining comment.

**Data integrity & concurrency** (`data-integrity.md`)
- Multi-row writes, or read-then-write sequences, not wrapped in a transaction.
- Critical/retriable operations (uploads, payments, OCR/generation, webhook
  handlers) with no idempotency key/guard.
- Tenant-scoped tables relying on `WHERE` filters instead of RLS, where the docs
  say isolation matters.
- External API calls with no retry/backoff; a swallowed timeout.

**Runtime infrastructure** (`infrastructure.md`)
- Cache entries set with no TTL; cache updated in place on write instead of
  invalidated.
- Channel/event names as magic strings rather than constants in one place.
- Realtime/client state treated as canonical instead of reconciled against the
  server.
- Secrets sourced from the repo (committed `.env` with real values, hard-coded
  keys) instead of a manager.

**Architecture** (`architecture.md`)
- The same status string compared across many files — a de-facto state machine
  whose transitions live only in people's heads. (Flag the scatter; recommend
  centralizing. Don't prescribe a boundary the domain hasn't earned.)

**API documentation** (`api-docs.md`)
- Public HTTP endpoints missing from the OpenAPI spec entirely.
- Endpoints with incomplete responses (only the 200 documented; no error shapes).
- The spec documenting an ORM/persistence entity instead of the response DTO
  (the DTO-boundary rule, seen from the doc side).
- A hand-written spec maintained beside the code, or a committed spec that has
  drifted from what the code generates.
- No CI drift gate enforcing that the spec stays in sync.

**Quality gates** (`quality-gates.md`)
- Missing or unenforced formatter/linter, pre-commit hook, secret scan, or CI
  gate; gates that exist but aren't required branch-protection checks.
- No fast/full test split, or the project's documented `test:fast`/`test:full`
  commands don't exist.

This list is the recurring set, not a ceiling — file anything that genuinely
contradicts the contract.

---

## Phase 3 — Shape each finding

Every finding carries exactly these fields, so `fix` can act on it mechanically:

- **id** — short and stable, e.g. `NAMING-1`, `DATA-3`. Group by area prefix.
- **area** — which area above (and thus which reference).
- **severity** — `high` (a guarantee is actually at risk: integrity, security,
  a broken-its-own-rule contract violation), `medium` (a real convention
  violation with limited blast radius), `low` (advisory / consistency).
- **location** — `file:line` (a range or several lines if the pattern repeats;
  list representative occurrences plus a count rather than 200 lines).
- **rule** — the one-line rule it violates, citing its source (the project doc,
  or the default reference).
- **resolution** — the precise change to make, concrete enough to apply without
  re-deciding. Name the helper/enum/constant to use if one already exists.
- **risk** — `safe` for mechanical, behavior-preserving edits (renames, enum
  extraction, adding a TTL, magic-string→constant, DTO mapping, DI wiring), or
  `risky` for anything touching a DB migration, RLS policy, behavior-changing
  transaction wrapping, schema, or encryption. **This field decides how `fix`
  treats the finding** — `fix` applies `safe` automatically and pauses on
  `risky` — so classify deliberately.

---

## Phase 4 — Report

Print the findings to the conversation, grouped by area, with each field above.
Lead with a one-paragraph summary: total findings, the count by severity, and
the count by risk class (`safe` vs `risky`) — that breakdown previews exactly how
much `/guider fix` will apply automatically versus gate.

Close by telling the user they can run **`/guider fix`** to apply the
resolutions (safe ones automatically, risky ones with confirmation), or scope it.
If the audit found nothing, say so cleanly — a clean audit is a real result, not
a failure to look hard enough. Then stop; don't start fixing.
