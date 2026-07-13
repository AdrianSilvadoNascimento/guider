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

**"Whole repository" means every file, not just the ones shaped like
`conventions.md`'s examples.** It's tempting to scan the files that look like the
areas below — services, controllers, components — and skip the rest because
they don't fit a familiar pattern. That's exactly how real defects hide. Unless
explicitly scoped away, also read:

- **Migrations / schema / seed SQL** — idempotency, destructive statements
  without a guard, a column added in code but never in the migration.
- **Scripts, one-off tooling, `Makefile`/CI YAML** — the same conventions apply
  to a script that runs in prod as to application code.
- **Data snapshots, fixtures, backups checked into the repo** (`*.json`,
  `*.csv` dumps) — a stale snapshot, or one that reveals a fix never
  generalized (see "Census, not incident" below).
- **Planning/incident docs** (`docs/*.md`, `PLAN*.md`, postmortems) — these
  often *state* a rule was generalized while the linked remediation only
  touched the named instances. Read the remediation, not just the prose.
- **If the project persists state in a database**, treat the live data itself
  as something to audit, not just the code that writes it — see "Census, not
  incident."

Don't let "audit the whole repository" quietly narrow to "audit the files that
look auditable."

## Census, not incident

Bound this before applying it: it's for **medium/high severity** findings — a
real invariant violation, a broken-its-own-rule contract violation — not every
stylistic or advisory pattern. A low-severity nit that happens to repeat twice
doesn't earn a full-repo grep or a whole-table scan; note that other instances
likely exist and move on. This is a bigger flashlight for real problems, not a
mandate to boil the ocean on every finding.

The common way a real finding under-delivers: it correctly diagnoses a *class*
of problem and states the general rule in prose — then the actual check (or,
downstream, the fix) only touches the specific instance(s) that surfaced it.
The rule reads as generalized; the remediation reads as one-off.

For a medium/high finding that describes a pattern (not a one-off typo):

- **Attempt the sweep before filing the finding.** Code pattern → grep/search
  the **entire** scope (see above) for other occurrences of the same shape,
  not only the file(s) where it was first spotted. Data pattern → run a
  **read-only** query across the **whole** table/collection for the
  invariant, not just the rows a known incident already named.
- **Report the delta**: "N total instances found (M already known from the
  reported incident, N−M new)."
- Only mark a finding "incomplete (not swept)" when the read-only tooling to
  do the sweep genuinely isn't available in this session — never as a
  substitute for a grep/query you could have run.
- Dead data left by removed code (a legacy marker, an orphaned enum/`source`
  value) is not an exemption — rows carrying it still count toward a census
  sweep for a currently-live invariant; don't treat "this came from an old
  code path" as "already handled."
- If the sweep is a full-table scan against a large or live production
  database, bound it (a row-count check first, a `LIMIT`/sample, a read
  replica if one exists) or flag the cost and confirm before running it —
  read-only doesn't mean free.

This is inspection only — sweeping means searching and querying, never
writing.

---

## Phase 0 — absorb findings from elsewhere (optional)

`/guider audit` doesn't have to start from a blank scan. The user may hand it
findings that came from somewhere else — a pasted incident writeup, another
agent's investigation, a `/code-review` or `/security-review` pass, a
production bug report. Treat each one exactly like a self-found violation, not
a fait accompli to rubber-stamp:

1. **Establish the contract first** (Phase 1) if you haven't already —
   restating a finding as a rule means citing the convention it breaks, which
   requires knowing what the project's docs (or the defaults) actually say.
2. **Restate it as a rule**, the same way any other finding cites the
   convention it breaks (Phase 3's `rule` field). If the source already
   generalized it, use that generalization; if it only described the specific
   instance, generalize it yourself.
3. **Sweep for it** (see "Census, not incident" above, same severity bar) —
   the point of folding an external finding in is to check whether it's
   actually contained to the reported instance(s) or wider.
4. **Fold it into the same structured report** as Phase 3 shapes below, so
   `/guider fix` can act on it identically to anything the audit found on its
   own — no separate track, no special-casing.

This is also how a codebase's contract grows over time: an issue found once,
by any means, becomes a rule the *next* audit checks for automatically (see
`fix-flow.md`'s recording step) — instead of being refought each time it
resurfaces under a new name.

---

## Phase 1 — Establish the contract

You can't audit against standards you haven't read. Before scanning:

1. **Read the project's own docs.** If Guider-authored standards exist
   (`AGENTS.md`, or a `CLAUDE.md` that imports it), read them and their siblings
   (`ARCHITECTURE.md`, `APPLICATION.md`, any `TESTING.md` /
   `SECURITY.md`). **The project's documented choices are the contract** and
   override the Guider defaults everywhere they speak — its line length, its
   folder convention, which tables have RLS, which operations are idempotent, its
   enum/label-map location, its fast/full test commands.
2. **Fall back to defaults for the gaps.** Where the docs are silent, audit
   against the Guider defaults in `conventions.md`, `data-integrity.md`,
   `infrastructure.md`, `architecture.md`, and `quality-gates.md`.
3. **If there are no Guider standards at all** (no `AGENTS.md` / `CLAUDE.md`),
   say so plainly: you're auditing
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
- A documented data invariant (a column that must never be null, an entity
  that must have exactly one related X, two states that must never coexist)
  checked only against the rows a known incident named, never swept against
  the full table — see "Census, not incident."
- Dead data left behind by removed code — an enum value, a `source`/`type`
  marker, a column a since-deleted function used to populate — that a reader
  could mistake for still-live behavior.

**Migrations, scripts & data artifacts** (`data-integrity.md`, "Census, not incident" above)
- A migration or seed script held to a looser standard than application
  code — no idempotency guard, a destructive statement with no safety check.
- A plan/incident doc whose prose generalizes a rule but whose linked
  remediation only ever touches the originally-named instance(s) — the
  incident-vs-census gap itself.
- A data snapshot/fixture/backup checked into the repo that's stale, or that
  documents a fix which was never swept against the rest of the table.

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
  extraction, adding a TTL, magic-string→constant, DTO mapping, DI wiring,
  recording a generalized rule in the project's contract docs — see
  `fix-flow.md`'s "Closing the loop"), or `risky` for anything touching a DB
  migration, RLS policy, behavior-changing transaction wrapping, schema, or
  encryption. **This field decides how `fix` treats the finding** — `fix`
  applies `safe` automatically and pauses on `risky` — so classify deliberately.

For a finding shaped by "Census, not incident," put the sweep result in
**location** (e.g. "src/lib/foo.ts:42, and 11 more — see list" or "23 rows
beyond the 4 named in the incident, `users` table") rather than inventing a
new field — the shape stays the same for every finding, whether self-found or
absorbed via Phase 0.

---

## Phase 4 — Report

Print the findings to the conversation, grouped by area, with each field above.
Lead with a one-paragraph summary: total findings, the count by severity, and
the count by risk class (`safe` vs `risky`) — that breakdown previews exactly how
much `/guider fix` will apply automatically versus gate.

For any finding shaped by "Census, not incident" or absorbed via Phase 0,
state what was swept — the query/grep and its scope — and the resulting
count, not just the finding itself. That's the evidence the sweep actually
happened rather than being asserted.

Close by telling the user they can run **`/guider fix`** to apply the
resolutions (safe ones automatically, risky ones with confirmation), or scope it.
If the audit found nothing, say so cleanly — a clean audit is a real result, not
a failure to look hard enough. Then stop; don't start fixing.
