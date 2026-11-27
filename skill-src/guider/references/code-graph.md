# Code graph

An agent that re-reads a whole repository for every audit or fix spends most of
its tokens rediscovering structure that hasn't changed. Guider keeps that
structure in a small, derived file instead, so the agent asks the graph first
and opens only the files it points at.

Two graphs, two jobs:

| Graph | What it knows | Built by | Cost |
|---|---|---|---|
| **Structural** — `.guider/graph.json` | Which file imports which; cycles; boundary violations; hubs | `assets/graph.mjs` (zero-dependency, Node ≥ 18) | Milliseconds; incremental by content hash |
| **Semantic** — `graphify-out/` | Concepts, communities and rationale across code, docs and media | [graphify](https://github.com/safishamsi/graphify) (optional) | An LLM pass; rebuild occasionally |

The structural graph is the default because it is free, deterministic and safe
to rebuild on every edit. graphify is a recommendation for larger codebases or
mixed code/doc corpora; when `graphify-out/` exists, `graph.mjs summary` points
to its report and the audit reads it.

## The script

`init` copies `assets/graph.mjs` to the project's scripts folder (next to
`check-docs.mjs`) and adds `.guider/` to `.gitignore` — the graph is derived,
never committed.

```bash
node scripts/graph.mjs build                 # incremental: re-parses only changed files
node scripts/graph.mjs refresh src/a.ts      # just these files (used by the post-edit hook)
node scripts/graph.mjs impact src/a.ts       # direct + transitive dependents, and the tests among them
node scripts/graph.mjs cycles                # import cycles — exit 1 if any
node scripts/graph.mjs layers                # boundary-rule violations — exit 1 if any
node scripts/graph.mjs summary --brief       # one line, for the session-start hook
```

Every command takes `--json`. It parses JS/TS (ESM, CommonJS, dynamic imports,
`tsconfig` path aliases, `.js`-suffixed TS imports, Vue/Svelte files) and Python
(absolute, relative, `from pkg import module`). Other languages are not parsed;
the audit falls back to reading folders for them.

## Boundaries as data

`ARCHITECTURE.md` describes the layering and bounded contexts in prose; the
machine-checkable part goes in `.guider-graph.json`, written by `init` from the
same interview answers:

```json
{
  "ignore": ["src/generated/"],
  "rules": [{ "from": "src/domain/", "disallow": ["src/http/", "src/infra/"] }],
  "contexts": ["src/billing/", "src/deals/"]
}
```

- **rules** — a path prefix may not import another prefix (domain never imports
  infrastructure; UI never imports the data layer).
- **contexts** — a file in one bounded context may import another context only
  through that context's `index.*` (its public surface).

Only record a boundary the project has actually chosen (`architecture.md`: no
boundary before the domain earns it). With no config, `layers` reports nothing.
`cycles` and `layers` can run as a CI gate once the existing violations are
fixed or deliberately ignored.

## How the flows use it

- **`audit`** — build or refresh first. Start with `summary`: hubs (the
  most-imported files) are where a convention break spreads furthest, so scan
  them first; every cycle and `layers` violation is a finding (`architecture.md`).
  For a diff-scoped audit, run `impact` on the changed files and audit the
  changed files plus their direct dependents, not the whole repo. Security: trace
  public route files to the data layer and check that a guard or policy sits on
  every path (`security.md`). If `graphify-out/GRAPH_REPORT.md` exists, read it
  for the domain map before naming bounded-context findings.
- **`fix`** — before editing a file, run `impact` on it: the dependents are the
  blast radius, and the tests it lists are the ones to run after the change.
- **Normal work** — the session-start hook prints the one-line summary; before
  changing a hub, run `impact` (`agent-hooks.md`).

## Recommending graphify

Offer it in `init` when the repo is large (thousands of files), mixes code with
substantial docs/specs, or the team wants to query "why" questions across them.
Its install pulls a package, so it follows the release quarantine
(`supply-chain.md`):

```bash
uv tool install graphifyy          # or: pipx install graphifyy
graphify install                   # Claude Code; Codex: graphify install --platform codex
```

Its output (`graphify-out/`) is derived too; recommend ignoring it in git unless
the team wants to share the report.
