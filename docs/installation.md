# Installing & updating skills

The CLI manages skills for two agents. Both read the same `SKILL.md` format, so
the only difference is the destination directory.

| Tool | Global (all projects) | Project (current repo) |
|---|---|---|
| **Claude** (default) | `~/.claude/skills/user` | `./.claude/skills` |
| **Codex / ChatGPT** (`--codex`) | `~/.codex/skills` | `./.agents/skills` |

## Install

```bash
# Install a skill (prompts: global vs. current project)
npx @adrianfsf/guider skills install guider

# Target Codex / ChatGPT instead of Claude
npx @adrianfsf/guider skills install guider --codex

# Skip the prompt with an explicit location
npx @adrianfsf/guider skills install guider --global
npx @adrianfsf/guider skills install guider --project
npx @adrianfsf/guider skills install guider --codex --project

# Explicit target directory (overrides --global/--project)
npx @adrianfsf/guider skills install guider --dir ./somewhere/skills

# Pin to a specific release tag
npx @adrianfsf/guider skills install guider --tag v1.0.0

# Verify the download against a SHA-256 digest
npx @adrianfsf/guider skills install guider --sha256 <hex>

# Install from a direct .skill URL (bypasses the registry)
npx @adrianfsf/guider skills install guider --url https://example.com/guider.skill
```

When no location flag is given, `install` asks whether to install **globally**
or into the **current project**. In a non-interactive shell (CI, pipes) it
defaults to global so nothing hangs.

## Update

```bash
# Update one skill to its latest release (or --tag <tag> to pin)
npx @adrianfsf/guider skills update guider

# Update every installed skill known to the registry
npx @adrianfsf/guider skills update

# Update the Codex copy, or a project copy
npx @adrianfsf/guider skills update guider --codex
npx @adrianfsf/guider skills update guider --project
```

## List

```bash
npx @adrianfsf/guider skills list            # Claude, global
npx @adrianfsf/guider skills list --project  # current project
npx @adrianfsf/guider skills list --codex    # Codex / ChatGPT
```

## Tokens & rate limits

Public installs are anonymous and don't need a token. The GitHub API rate-limits
anonymous requests, so if you hit the limit — or you're installing from a private
fork — pass a token:

```bash
npx @adrianfsf/guider skills install guider --token ghp_xxx
# or export it (also accepts $GH_TOKEN)
export GITHUB_TOKEN=ghp_xxx
```

## Safety

The installer downloads the release asset through the GitHub API, refuses any
archive whose entries would extract outside the target directory (zip-slip
protection), and — when `--sha256` is supplied — aborts on a checksum mismatch.
