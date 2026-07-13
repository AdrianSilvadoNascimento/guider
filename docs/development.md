# Development

```bash
npm install      # install deps (incl. eslint)
npm run lint     # eslint
npm test         # node --test
npm run build    # build dist/guider.skill from skill-src/ (prints its sha256)
```

## Layout

| Path | What's there |
|---|---|
| `bin/guider.js` | CLI entry point (commander) — `skills install/update/list` |
| `lib/skills/` | `install`, `update`, `list`, `download`, `registry`, `safe-extract` |
| `lib/utils.js` | Per-tool skill directories (Claude / Codex) and target resolution |
| `scripts/build-skill.js` | Packs `skill-src/guider/` into `dist/guider.skill` |
| `skill-src/guider/` | The skill source: `SKILL.md`, `references/`, `assets/templates/` |
| `test/` | `node --test` suites for the CLI, targets, download, and safe-extract |

## Adding a new install target

Skill destinations are defined in [`lib/utils.js`](../lib/utils.js) under
`TOOLS`. Each tool maps to a global directory and a project-directory function;
`toolFromOpts` picks the tool from CLI flags. Add an entry there and wire a flag
in [`bin/guider.js`](../bin/guider.js) to support another agent.

## Tests

Run the full suite with `npm test`. New behavior should come with a test —
`test/target.test.js` covers directory resolution, `test/cli.test.js` drives the
CLI end-to-end against a local HTTP server serving a tiny in-memory `.skill`.
