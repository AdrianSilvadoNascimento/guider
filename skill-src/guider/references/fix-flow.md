# `/guider fix` — apply the audit's resolutions

`fix` is the second half of the audit pair (see `audit-flow.md`). It takes the
findings `/guider audit` produced and **applies every resolution** — precisely,
surgically, and in the right order — so the codebase stops contradicting its own
standards. Safe, mechanical fixes apply automatically; the risky ones pause for a
yes before they touch anything.

The contract with the user is "apply all the resolutions correctly," with the
emphasis on *correctly*. A fix that's applied carelessly is worse than a finding
left open, because it lands in the diff with the user's implicit trust. Hold the
prime directive and the surgical-changes principle from `SKILL.md` the whole way
through: minimal diffs, no scope creep, no "while I'm here" improvements.

---

## Phase 1 — Locate the analysis

`fix` works from a `/guider audit` report. Get one:

- **Use the most recent audit in the conversation.** The handoff is
  in-conversation — read the latest report's findings (id, location, rule,
  resolution, risk) and act on those exact items.
- **No audit in context?** Run an audit pass first (follow `audit-flow.md` end to
  end), present the findings, then continue here. Don't ask the user to re-run a
  command you can run yourself — but do show them the findings before you start
  changing files.
- **Scope** carries over: if the audit was scoped to a subtree, fix that subtree.
  The user can narrow further (`/guider fix DATA-*`, `/guider fix apps/api`); honor
  it.

---

## Phase 2 — Apply, gated by risk class

Each finding carries a `risk` field from the audit. That field — not your
judgment in the moment — decides whether you pause.

**`safe` (mechanical, behavior-preserving) — apply automatically.**
Renames, enum/constant extraction, magic-string→constant, adding a deliberate
TTL, mapping an entity to a response DTO, wiring a dependency through DI. Apply
these one finding at a time:

- Make the **smallest edit** that resolves the finding. Don't reformat
  surrounding lines, don't rename neighbours that weren't flagged.
- **Match the surrounding code** — its naming, its imports, its existing helpers.
  If the resolution names an existing helper/enum/constant, use it; don't invent a
  parallel one.
- For a pattern that repeats (a cryptic name used across a file), fix all
  occurrences **within the flagged scope**, and no further.

**`risky` — confirm before applying.**
DB migrations, RLS policies, behavior-changing transaction wrapping, schema
changes, encryption. For each, show the user the exact change you intend (the
diff or the migration SQL) and what it affects, and get a yes before writing.
Batch related risky changes into one confirmation when they're genuinely one
decision; otherwise confirm them individually. Never auto-apply a `risky`
finding, even a small-looking one.

**When a resolution is wrong on a closer read, skip it.** The audit reasoned from
patterns; you're now looking at the actual code. If applying a finding would break
behavior, duplicate an existing abstraction, or the "violation" turns out
justified in context, **do not force it** — skip it and record why for the
summary. A correct skip beats a confident wrong edit.

Work area by area so related edits land together and the diff reads coherently.

---

## Phase 3 — Verify

Mechanical edits at scale introduce mechanical mistakes. After applying, run the
project's gates — the ones documented in its `AGENTS.md` / `quality-gates.md`:
formatter check, linter, type-check, and the **fast** test suite. Don't run the
full/e2e suite unless the user asks; that's a CI-weight gate.

Report what passed and what failed. If a fix broke a gate, fix the fix (or revert
that single finding and flag it) — don't leave the tree red. Tie this back to the
Karpathy goal-driven principle: the passing gate is the success criterion for the
change.

---

## Closing the loop — record generalized rules durably

A finding that came from "Census, not incident" (`audit-flow.md`) or was
absorbed from an external source (Phase 0 there) is, by definition,
medium/high severity — and represents more than the instances just fixed:
it's a rule the project didn't have written down before. Once its
resolutions are applied (including any `risky` ones the user approved),
record the generalization as its own `safe` action (per `audit-flow.md`'s
Phase 3 risk taxonomy) in the project's own contract docs:

- If the project's `AGENTS.md` (or a `CLAUDE.md` that imports it, or a
  sibling like `ARCHITECTURE.md`) already keeps a running list of hard-won
  rules/invariants, add one entry there in the same voice and format the
  existing entries use — cite the concrete incident that surfaced it and
  state the general rule, the same way the existing entries do.
- If no such section exists yet, don't invent a new doc format for one
  finding; add a short "Lessons" section to `ARCHITECTURE.md` (or wherever
  `/guider init` would have put it) and note that future entries should
  accumulate there.
- Low-severity findings that only got a lightweight sweep note (not a full
  census) don't get a durable entry — this is for the real, medium/high
  rules, not every observation.

The payoff: the next `/guider audit` reads this doc in its own Phase 1 ("read
the project's own docs") — so a rule learned once, from any source, is
checked for automatically from then on, instead of relying on someone
remembering to re-flag it.

---

## Phase 4 — Summary

Close with a clear ledger:

- **Applied** — which findings (by id), grouped by area.
- **Gated** — which `risky` findings the user approved vs. declined.
- **Skipped** — which findings you chose not to apply, each with the one-line
  reason.
- **Verification** — gate/test results.
- **Follow-ups** — anything that needs human attention (a migration to run, a
  branch-protection setting to flip, a residual finding that needs design).

Then stop. Don't keep hunting for new issues — that's the next `/guider audit`.
