# Agent hooks

Docs tell the agent the rules; git hooks catch a violation at commit time, after
the work is done. Agent hooks sit in between: the agent's harness runs them at
fixed points of the session, so a rule is enforced *while* the agent works — the
same "machines enforce it" stance as `quality-gates.md`, one step earlier.

Claude Code and Codex use the same model: JSON on stdin, exit code 2 plus stderr
to block or send feedback, stdout from `SessionStart` added to the context. So
one set of scripts serves both.

## The hooks

| Script | Event | What it does | Blocks? |
|---|---|---|---|
| `session-start.mjs` | `SessionStart` | Prints the `## Hard rules` section of `AGENTS.md` and the one-line code-graph summary (`code-graph.md`) | No |
| `pre-tool-guard.mjs` | `PreToolUse` | Refuses writes to secret files (`.env*` except `.env.example`, keys, certs); refuses adding a package when that package manager has no release quarantine configured (`supply-chain.md`) | Yes |
| `post-edit.mjs` | `PostToolUse` on edits | Runs the per-file lint command and, for Markdown, `check-docs.mjs`; failures go back to the agent to fix now. Refreshes the code graph. Warns on security sinks in the written text (`security.md`) | Lint/docs failures only |

All are dependency-free Node (≥ 18), local-only (no network), and **fail open**:
an internal error lets the tool call through rather than wedging the session.
The security warning is advisory because a regex can't tell a sanitized value
from a raw one; the audit and review decide.

## Install (by `/guider init`)

1. Copy `assets/hooks/` to `scripts/guider-hooks/` (beside `check-docs.mjs` and
   `graph.mjs`, which the hooks call when present).
2. **Claude Code** — merge `assets/templates/claude-settings.json.tmpl` into
   `.claude/settings.json` (shared with the team; `settings.local.json` is for
   personal overrides). Merge into existing `hooks` arrays — never replace them —
   and show the diff.
3. **Codex** — write `assets/templates/codex-hooks.json.tmpl` to
   `.codex/hooks.json`. Codex runs project hooks only after the user trusts them
   (`/hooks`); say so. Its commands use paths relative to the project root.
4. Optional `.guider-hooks.json` at the project root:

```json
{
  "lint": "npx eslint --no-warn-ignored {file}",
  "lintTimeoutSeconds": 20,
  "scriptsDir": "scripts",
  "secretFiles": true,
  "quarantine": true,
  "securityWarnings": true
}
```

`lint` is the project's fastest per-file check (`{file}` is replaced, quoted):
`npx eslint {file}`, `npx biome check {file}`, `ruff check {file}`. Keep it
under a few seconds — it runs after every edit. A lint that times out is
skipped, not reported as a failure, and the whole hook stays inside a 25-second
budget. Leave type-checking and tests to
the git hooks and CI. Each guard can be switched off with `false`.

## Cost

Each hook is one short Node process: tens of milliseconds, plus the lint
command. `session-start` adds the hard rules (capped at 3,000 characters) once
per session. Matchers keep the edit hooks off unrelated tool calls in Claude
Code; Codex hooks run on every tool call, and the scripts exit at once when
there's nothing to check.

## Turning them off

Remove the entries from `.claude/settings.json` / `.codex/hooks.json`, or set
the guard to `false` in `.guider-hooks.json`. Claude Code also has
`disableAllHooks` for a session. A guard that blocks legitimate work is a bug in
the guard — fix the pattern rather than training people to disable it.
