<div align="center">

<img src="docs/assets/hero.gif" alt="guider — easy to do the right thing, hard to do the wrong one. Works with Claude and Codex / ChatGPT." width="100%" />

[![npm](https://img.shields.io/npm/v/@adrianfsf/guider?color=7c9cff&label=npm)](https://www.npmjs.com/package/@adrianfsf/guider)
[![CI](https://github.com/AdrianSilvadoNascimento/guider/actions/workflows/ci.yml/badge.svg)](https://github.com/AdrianSilvadoNascimento/guider/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-36d6a6)](LICENSE)
![Agents](https://img.shields.io/badge/agents-Claude%20%7C%20Codex%20%2F%20ChatGPT-d97757)

**One skill that writes your engineering standards down, wires machines to enforce them,<br/>and holds the line on every change your coding agent makes.**

</div>

---

## Install or update in one line

> [!IMPORTANT]
> **Use this command for both first install and updates.** It pins the CLI version,
> so `npx` can't reuse an old cached copy, and `--allow-fresh` takes the newest
> release right away instead of waiting out the 7-day [release quarantine](docs/installation.md#release-quarantine).
> `skills update` alone can keep you on an older version for those reasons.

```bash
npx @adrianfsf/guider@2.0.0 skills install guider <agent> <location> --allow-fresh
```

Pick one flag from each group:

| Group | Flag | Installs to |
|---|---|---|
| `<agent>` | `--claude` | Claude Code |
| | `--codex` | Codex / ChatGPT |
| `<location>` | `--project` | This repository only (`./.claude/skills` or `./.agents/skills`) |
| | `--global` | Every project on this machine (`~/.claude/skills/user` or `~/.codex/skills`) |

Copy-paste examples:

```bash
# Claude Code, this project only
npx @adrianfsf/guider@2.0.0 skills install guider --claude --project --allow-fresh

# Claude Code, all projects
npx @adrianfsf/guider@2.0.0 skills install guider --claude --global --allow-fresh

# Codex / ChatGPT, this project only
npx @adrianfsf/guider@2.0.0 skills install guider --codex --project --allow-fresh
```

Running it again over an existing install replaces it with that release. Leave
out the flags and the CLI asks which agent and where. No token is needed.

<div align="center">
<img src="docs/assets/install.gif" alt="Terminal demo: the install command runs, guider v2.0.0 installs into ./.claude/skills/guider, then /guider init is run in the agent." width="820" />
</div>

Then, inside your agent, onboard the project:

```text
/guider init
```

---

## What you get

Guider makes a codebase **easy to do the right thing in and hard to do the wrong
thing in.** The same `SKILL.md` works in Claude and Codex / ChatGPT, with no conversion.

| Command | What it does |
|---|---|
| **`/guider init`** | Studies the repo, interviews you about what it can't infer, writes the standards down and scaffolds the gates (linters, hooks, CI). |
| **`/guider audit`** | Read-only pass. Finds where the code contradicts its own standards and prints a risk-tagged report. |
| **`/guider fix`** | Applies the audit's findings: safe fixes automatically, risky ones after you confirm. |
| **`/guider spec`** | Generates or improves OpenAPI / Swagger docs from code and gates drift in CI. |

### New in v2

- **Agent hooks.** Rules are enforced *while the agent works* in Claude Code and Codex, not only at review time.
- **Security first.** IDOR, injection, sessions and races are always high severity and ship with a negative test.
- **Code graph.** Impact, cycle and layer analysis scope every audit and fix by blast radius.
- **7-day release quarantine.** New dependency, skill and plugin versions wait a week before adoption.

### The docs it maintains

- **`AGENTS.md`** is the single source of truth, readable by any agent.
- **`CLAUDE.md`** is a thin entry point that imports `AGENTS.md`, so rules are never duplicated.
- **`ARCHITECTURE.md`**, **`APPLICATION.md`** and **`docs/README.md`** hold the detail, one topic each.

Full details: [docs/skill.md](docs/skill.md).

---

## Documentation

| Guide | What's inside |
|---|---|
| [docs/installation.md](docs/installation.md) | All `install` / `update` / `list` flags, release quarantine, tokens, checksum verification |
| [docs/skill.md](docs/skill.md) | The `guider` skill: subcommands, enforced areas, generated docs |
| [docs/maintainers.md](docs/maintainers.md) | Releasing a skill version, publishing the CLI, adding a skill to the registry |
| [docs/development.md](docs/development.md) | Local setup, lint, test, build, regenerating the README animations |

## License

MIT — see [LICENSE](LICENSE).
