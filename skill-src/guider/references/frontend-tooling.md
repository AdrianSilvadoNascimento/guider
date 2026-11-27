# Frontend tooling

Guider governs engineering standards, not visual taste. For the frontend it
recommends specialist agent tooling instead of hand-rolling rules, and it offers
a menu rather than one fixed tool, because the tools cover different ground:

- **correctness** — is this the current, standard way to build it on the web
  platform (APIs, CSS, performance, accessibility)?
- **design quality** — does it look intentional rather than generated?
- **components and runtime** — the project's component library, and the real
  page in a real browser.

Recommend one from the first group for any project with a frontend, add a design
tool when visual quality matters to the team, and add the rest only when the
project uses what they target. Every install follows the release quarantine
(`supply-chain.md`): prefer a pinned version over `@latest` where the installer
allows it.

## The menu

| Tool | Covers | Gate in CI | Fits when |
|---|---|---|---|
| **Modern Web Guidance** (Google Chrome) | Current web-platform practice: modern CSS/HTML APIs, Core Web Vitals, forms, accessibility — replaces outdated patterns in the model's training | No (guidance) | Any web frontend. Default recommendation |
| **Impeccable** | Design vocabulary, "AI slop" detection, deterministic design-rule detector | Yes (`detect`) | Visual quality is a product concern |
| **frontend-design** (Anthropic) | Aesthetic direction, typography, avoiding templated defaults | No (guidance) | New UI or a redesign, on Claude Code |
| **Vercel agent-skills** | React/Next.js best practices, web design guidelines | No (guidance) | React or Next.js projects |
| **shadcn MCP** | Browse, search and install shadcn/ui registry components | No | Project uses shadcn/ui |
| **Chrome DevTools MCP** | Drive a real Chrome: performance traces, console, network, screenshots | No (manual / agent runs) | Debugging runtime behavior and performance |

## Install

**Modern Web Guidance** — https://developer.chrome.com/docs/modern-web-guidance

```bash
# Claude Code
claude plugin marketplace add GoogleChrome/modern-web-guidance
claude plugin install modern-web-guidance@googlechrome
# Any agent (Codex included)
npx skills add GoogleChrome/modern-web-guidance
```

**Impeccable** — https://github.com/pbakaus/impeccable

```bash
npx impeccable install       # interactive; non-interactive: --providers=claude,codex --scope=project
# then, in the agent: /impeccable init   (Codex: $impeccable init)
npx impeccable detect src/   # deterministic rules, exit code for the build
```

Claude Code plugin alternative: `/plugin marketplace add pbakaus/impeccable`.

**frontend-design** — https://github.com/anthropics/claude-plugins-official

```text
/plugin install frontend-design@claude-plugins-official
```

**Vercel agent-skills** — https://github.com/vercel-labs/agent-skills

```bash
npx skills add vercel-labs/agent-skills
```

**shadcn MCP** — https://ui.shadcn.com/docs/mcp

```bash
npx shadcn@latest mcp init --client claude
# Codex: add to ~/.codex/config.toml
#   [mcp_servers.shadcn]
#   command = "npx"
#   args = ["shadcn@latest", "mcp"]
```

**Chrome DevTools MCP** — https://github.com/ChromeDevTools/chrome-devtools-mcp

```bash
# Claude Code
/plugin marketplace add ChromeDevTools/chrome-devtools-mcp
/plugin install chrome-devtools-mcp@chrome-devtools-plugins
# Codex
codex plugin marketplace add ChromeDevTools/chrome-devtools-mcp
codex plugin add chrome-devtools-mcp@chrome-devtools-plugins
```

Commands change between releases; when one fails, check the linked page rather
than guessing a variant.

## In `init`

Ask which ground the team wants covered, propose the matching tools, and record
the choice in `AGENTS.md` §Workflow (`{{FRONTEND_TOOLING_NOTE}}`). Offer to run
the installers; never run one without a yes. If a chosen tool has a CI gate
(Impeccable's `detect`), add it to the merge gates (`quality-gates.md` §4).
Outside `init`, suggest the menu the first time a frontend change comes up in a
project that hasn't chosen.
