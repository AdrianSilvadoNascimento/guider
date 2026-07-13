# CI automation — running `/guider audit` on every PR (optional)

Guider works two ways, and neither is "more correct" than the other — pick per
project:

- **Standalone.** Run `/guider init`, `/guider audit`, `/guider fix`, `/guider
  spec` interactively inside a Claude Code session, whenever you want them.
  This is the whole skill; nothing in this file is required to use it. See the
  skill's `README.md`, "How to install it", for the two ways to get the skill
  itself into a session (org Plugin with GitHub auto-sync, or a manual
  `.skill` upload).
- **CI-automated.** A GitHub Actions job runs `/guider audit` on every PR and
  posts the findings as a comment automatically — nobody has to remember to
  run it. This file documents that mode: what it needs, what it doesn't, and
  the one thing that changes if your plugin's marketplace repo is private.

Offer the CI-automated mode during `/guider init` (Phase 3 asks; Phase 5
scaffolds it if the user opts in — see `init-flow.md`). It can also be added
by hand at any time by following this file directly.

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

That's the entire requirement. Nothing else is universal — the rest of this
file covers one conditional case (a private marketplace repo) that most
projects won't hit.

## Filling the template

Use `assets/templates/guider-audit.yml.tmpl`. It needs four answers from the
interview (Phase 3 of `init-flow.md`):

1. **Which auth secret** — `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`.
   Keep only the matching `with:` line in the template; delete the other.
2. **The plugin's marketplace source** — the GitHub repo URL and marketplace
   name this Claude Code session actually loaded `guider` from (check
   `.claude-plugin/marketplace.json` in that repo for the `name` field if
   unsure — it's the `{{MARKETPLACE_NAME}}` half of `plugins:
   "guider@{{MARKETPLACE_NAME}}"`). This is very likely the same repo the user
   just installed the skill from (`README.md`, "How to install it", Option A).
3. **Does this repo have bot-opened PRs?** If yes, name the bot account and
   keep the `allowed_bots` line; if no (the common case), delete that line
   entirely rather than commenting it out.
4. **Where do this project's other workflows live?** — usually
   `.github/workflows/`, but confirm rather than assume.

Write the filled file, then stop — same as every other `init` gate: propose
the secret-creation command, don't run it.

## If your marketplace repo is private

`claude-code-action`'s `plugin_marketplaces` input does a plain `git clone` of
that URL at job runtime. A **public** repo just works — nothing more to do. A
**private** one needs its own credentials, because the workflow's default
`GITHUB_TOKEN` is scoped only to the repo the workflow lives in, never to a
different repo — even a private one in the same org.

This is a real but narrow case (a team maintaining its own private fork of the
plugin, mid-review before publishing it, say) — don't scaffold it by default;
only reach for it if the interview confirms the marketplace repo is actually
private. When it applies, the standard fix is a scoped GitHub App installation
token, generated fresh in the job and handed to git via a URL rewrite so
`claude-code-action`'s internal clone picks it up transparently without
needing to know any of this exists:

```yaml
- name: Create marketplace token (private marketplace repo)
  id: marketplace-token
  uses: actions/create-github-app-token@v3
  with:
    app-id: "{{GITHUB_APP_ID}}"
    private-key: ${{ secrets.GITHUB_APP_PRIVATE_KEY }} # name the secret whatever you like; update this reference to match
    owner: "{{MARKETPLACE_OWNER}}"
    repositories: "{{MARKETPLACE_REPO_NAME}}"

- name: Let git use that token for github.com clones (the marketplace fetch)
  run: git config --global url."https://x-access-token:${{ steps.marketplace-token.outputs.token }}@github.com/".insteadOf "https://github.com/"
```

Insert these two steps between `checkout` and the `claude-code-action` step.
Requires a GitHub App already installed with read access to the marketplace
repo, and its private key added as one more repo secret (same
propose-don't-run rule as above). Once the marketplace repo goes public, strip
these two steps back out — they stop doing anything useful and are just
complexity to maintain.

## Per-CI-provider note

This specific automated mode is GitHub Actions-only — `claude-code-action` is
a GitHub Action. On another CI provider, the standalone mode (run the
`/guider` commands interactively, or script the Claude Code CLI directly in
whatever job runner you have) still works fine; only the "auto-comment on
every PR via this exact plugin action" convenience is GitHub-specific.
