# guider

A CLI that installs and updates coding-agent **skills** — for **Claude** and
**Codex / ChatGPT** — plus the `guider` skill itself, which establishes and
enforces a codebase's engineering standards.

Both agents read the same `SKILL.md` format, so a skill installs into either
without conversion. The CLI is published to the public npm registry and the
`guider` skill ships as a public GitHub release asset — **no token required**.

## Quick start

```bash
# Install the guider skill for Claude (prompts: global vs. current project)
npx @adriansilvadonascimento/guider skills install guider

# …or for Codex / ChatGPT (~/.codex/skills or ./.agents/skills)
npx @adriansilvadonascimento/guider skills install guider --codex
```

Then, in your agent, run `/guider init` to onboard the skill to your project.

## What the guider skill does

Guider makes a codebase easy to do the right thing in and hard to do the wrong
thing in — it writes standards into a tool-neutral `AGENTS.md` (imported by
`CLAUDE.md`), wires linters/hooks/CI to enforce them, and holds the line on every
change. Four subcommands: `/guider init`, `/guider audit`, `/guider fix`,
`/guider spec`. See [docs/skill.md](docs/skill.md).

## Documentation

| Guide | What's inside |
|---|---|
| [docs/installation.md](docs/installation.md) | Full `install` / `update` / `list` usage, Claude vs. Codex targets, tokens, checksum verification |
| [docs/skill.md](docs/skill.md) | The `guider` skill: subcommands and the docs it generates (`AGENTS.md` / `CLAUDE.md`) |
| [docs/maintainers.md](docs/maintainers.md) | Releasing a skill version, publishing the CLI, adding a skill to the registry |
| [docs/development.md](docs/development.md) | Local setup, lint, test, build |

## License

MIT — see [LICENSE](LICENSE).
