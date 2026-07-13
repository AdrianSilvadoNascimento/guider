# CI automation — running `/guider audit` on every PR (optional)

Guider works two ways, and neither is "more correct" than the other — pick per
project:

- **Standalone.** Run `/guider init`, `/guider audit`, `/guider fix`, `/guider
  spec` interactively inside a Claude Code session, whenever you want them.
  This is the whole skill; nothing in this file is required to use it. Install
  the skill with the CLI — `npx @adrianfsf/guider skills install guider` (see
  the project `README.md` / `docs/installation.md`).
- **CI-automated.** A GitHub Actions job runs `/guider audit` on every PR and
  posts the findings as a comment automatically — nobody has to remember to
  run it. This file documents that mode: what it needs and what it doesn't.

Offer the CI-automated mode during `/guider init` (Phase 3 asks; Phase 5
scaffolds it if the user opts in — see `init-flow.md`). It can also be added
by hand at any time by following this file directly.

## How the workflow loads guider — no marketplace, no plugin

The template installs the skill the exact same way a human does: with the
public CLI, straight from npm, into the checked-out workspace.

```yaml
- name: Install the guider skill
  run: npx -y @adrianfsf/guider@latest skills install guider --project
```

`--project` drops it in `./.claude/skills/guider`, and `claude-code-action`
discovers project skills there automatically — so the job's `prompt: /guider
audit` just works. There is no Claude Code plugin, no marketplace repo, and no
extra credential for the skill itself: the release asset is public, so the
install is anonymous. (Pin `@adrianfsf/guider@<version>` instead of `@latest`
if you want reproducible CI.)

## What it needs — exactly one secret, nothing else

The workflow uses `anthropics/claude-code-action`, which needs ONE of:

- `ANTHROPIC_API_KEY` — an API key from [console.anthropic.com](https://console.anthropic.com).
- `CLAUDE_CODE_OAUTH_TOKEN` — for Claude Pro/Max subscribers, generated locally
  via `claude setup-token`. No separate API billing.

Either one goes in the repo's **Settings → Secrets and variables → Actions →
New repository secret**, under whichever name matches the auth line the
template kept (see below). Propose the exact command for the user to run
themselves — never ask for the raw secret value in chat, and never run the
`gh secret set`/equivalent command with the value already filled in:

```bash
gh secret set ANTHROPIC_API_KEY --repo <owner>/<repo>
# — or, for the OAuth token —
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <owner>/<repo>
```

That's the entire requirement — the skill install needs no secret at all.

The workflow requests only `contents: read` and `pull-requests: write`: it can
read the diff and post a comment, and physically cannot push a commit or edit a
file. `id-token: write` is **not** needed (the action authenticates via a
GitHub App, not OIDC) — don't grant it.

## Filling the template

Use `assets/templates/guider-audit.yml.tmpl`. It needs three answers from the
interview (Phase 3 of `init-flow.md`):

1. **Which auth secret** — `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`.
   Keep only the matching `with:` line in the template; delete the other.
2. **Does this repo have bot-opened PRs?** If yes, name the bot account and
   keep the `allowed_bots` line; if no (the common case), delete that line
   entirely rather than commenting it out.
3. **Where do this project's other workflows live?** — usually
   `.github/workflows/`, but confirm rather than assume.

Write the filled file, then stop — same as every other `init` gate: propose
the secret-creation command, don't run it.

## Per-CI-provider note

This specific automated mode is GitHub Actions-only — `claude-code-action` is
a GitHub Action. On another CI provider, the standalone mode (run the
`/guider` commands interactively, or script the Claude Code CLI directly in
whatever job runner you have — installing the skill the same way, with the
`@adrianfsf/guider` CLI) still works fine; only the "auto-comment on every PR
via this exact action" convenience is GitHub-specific.
