# Documentation standard

Docs are part of the codebase, so they get the same treatment as code: one
source of truth per fact, a budget, and a gate. Without these, the docs an agent
reads on every task grow one "important" paragraph at a time until they cost
tens of thousands of tokens per read and contradict each other.

This file is the default contract for the docs Guider writes and audits. The
project's own `docs/README.md` (or `AGENTS.md`) can override any number here;
the project wins.

## 1. One doc, one question

| Doc | Answers | Holds | Never holds | Default budget |
|---|---|---|---|---|
| `AGENTS.md` | How do agents work here? | Hard rules, behavioral principles, a trigger-based routing table, workflow, end-of-task duties | Domain rules, technical detail, history | 150 lines |
| `CLAUDE.md` | — | `@AGENTS.md` and, if ever, strictly Claude-specific notes | Anything shared | 20 lines |
| `PRODUCT.md` | Why, and for whom? | Users, purpose, positioning, personality, anti-references, design principles | Screens, flows, technology | 80 lines |
| `APPLICATION.md` | What does the product do? | Domains, key flows, screens (what each shows), integrations (what, not how), environments, glossary | Function/table names beyond an anchor, calculation rules, state machines | 25,000 chars |
| `ARCHITECTURE.md` | How is the code shaped? | Stack, layering, folders, auth, schema (one line per table), state machines, runtime infrastructure, code conventions, structural decisions | Domain business rules, screen behavior, long debug playbooks | 40,000 chars |
| `DESIGN.md` | How is the UI built? | Product-level tokens, layout, product components and patterns, anti-patterns | What the brand/design-system package already says, money rules, changelog | 30,000 chars |
| `BACKLOG.md` | What is left to do? | Open items only, in the §4 format | Done items, analysis, counts, decisions, "won't do" | 300 lines |
| `docs/README.md` | Where is each thing? | Index + an "owner of each topic" table | Content | 150 lines |
| `docs/<DOMAIN>.md` | What exactly is rule X? | The canonical rules of ONE area | Other areas; the story of how the rule came to be | 40,000 chars |
| `docs/PRINCIPLES.md` | What must never happen again? | One entry per invariant: the rule + the incident that earned it | Rules with no incident behind them | 8 lines per entry |
| `docs/DECISIONS.md` | Why is it like this? | Decision log (§5) | Current state (that belongs to the owner doc) | 6 lines per entry |
| `docs/specs/*`, `docs/plans/*` | How will we build Y? | The design of an in-flight change | Rules still in force after it ships | — |

Create only the docs the project needs. A small repo may never earn
`DECISIONS.md` or a domain doc; don't scaffold empty ones.

**Over budget means split, never squeeze.** A domain doc past its budget becomes
`docs/<DOMAIN>/` with one file per section and an index. Measure with `wc -m`
(characters, not lines: one 4,000-character line counts as one line). The
40,000-character default is anchored on the size at which Claude Code stops
reading an on-demand instruction file in full on a 200K context window.

## 2. Writing rules (every doc)

1. **One fact, one place.** Before writing a rule, find its owner in
   `docs/README.md`. Everywhere else gets a pointer (`→ ARCHITECTURE.md
   §Payments`), never a copy.
2. **Current state, present tense.** "A batch pays only when…". Never "until
   2026-03-01 it was…", "fixed in this session", "before this PR". The past
   lives in git, `DECISIONS.md` or `PRINCIPLES.md`.
3. **Decisions become a short reference.** In the owner doc: the rule + `(D-042)`.
   Who, when and why live in entry D-042, not inside the rule.
4. **Code pointers are file + symbol**, never a line number.
5. **Paragraph ≤ 5 lines; line ≤ 120 characters** (table rows can't wrap, so
   they're exempt). A table cell longer than two sentences becomes its own
   section, pointed to from the table.
6. **Stable section names.** `§Name` pointers depend on them: renaming a section
   means grepping the old name in the same change.
7. **One language for docs**, chosen at `init`; identifiers stay in the code's
   language.
8. **No audit findings inside reference docs.** An open finding is a `BACKLOG.md`
   item; a resolved one is a rule in its owner doc.

## 3. Skeletons

Required sections, in order. A section that doesn't apply is removed, not left
empty. The templates in `assets/templates/` follow these.

- **`PRODUCT.md`**: Platform · Users · Purpose · Positioning · Personality ·
  Anti-references · Design principles · Accessibility
- **`APPLICATION.md`**: What it is · Domains (domain | what it does | owner doc) ·
  Key flows · Screens · External integrations (service | used for | owner doc) ·
  Environments · Glossary
- **`ARCHITECTURE.md`**: Stack · Layering · Folders · Auth · Bounded contexts ·
  Schema (table | purpose | owner doc) · State machines · Runtime infrastructure ·
  Data integrity · Conventions · Structural decisions (pointers to `DECISIONS.md`)
- **`docs/<DOMAIN>.md`**: Scope (what is and isn't here) · Rules (numbered,
  stable) · Invariants · Entry points · Tests that lock the rules

## 4. `BACKLOG.md`

Open items only. A finished item is deleted; git keeps the history.

```
## <Area>

- 🔥 **<Title, up to 8 words>** — <what is left, 1–2 lines>. → <spec or doc §> · <origin PR/issue>
```

- Priority: 🔥 high · ⏱ medium · 🌱 when there's time. No other status.
- An item is at most 3 lines. Needs more? The detail goes into a spec and the item
  points to it.
- An open question for the product owner is an item, marked `❓`, with the
  question in one line.
- "Decided not to do" is not backlog: it is a `DECISIONS.md` entry.

## 5. `docs/DECISIONS.md`

```
### D-042 · 2026-03-01 · <who decided>
**Decision:** <one sentence>
**Why:** <one or two sentences>
**Rule lives in:** <doc §section>
```

Numbers are sequential and never reused. A revoked decision stays and gains
`**Superseded by:** D-0NN`.

## 6. Lifecycle

| Event | What changes, in the SAME change |
|---|---|
| Rule added or changed | Its owner doc; `DECISIONS.md` when it was a product decision |
| Incident | A `PRINCIPLES.md` entry + the rule in its owner doc |
| Spec shipped | Rules still in force move to the owner doc; the spec gains `> Status: done — rules in <doc>` and stops being a source |
| Backlog item done | Item deleted |
| Section renamed or doc moved | Grep the old name; update `docs/README.md` |
| Entry file (`AGENTS.md`) | Only with the owner's explicit approval, if the project locked it at `init` |

## 7. Enforcement

Budgets and line length are checkable, so check them: `assets/check-docs.mjs` is a
dependency-free script the project can copy and wire into its pre-commit hook
(`quality-gates.md` §2). Duplication and history-in-reference-docs need judgment;
`/guider audit` covers those (`audit-flow.md`, **Documentation**).
