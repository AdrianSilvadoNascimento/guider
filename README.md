# guider

CLI to install and update Claude skills. The CLI is published to the **public
npm registry** and the `guider` skill is distributed as a **public GitHub
release asset** — no token required to install.

## Usage

```bash
# Install a skill (prompts: global vs. current project)
npx @adriansilvadonascimento/guider skills install guider

# Skip the prompt with an explicit location
npx @adriansilvadonascimento/guider skills install guider --global    # ~/.claude/skills/user
npx @adriansilvadonascimento/guider skills install guider --project   # ./.claude/skills

# Pin to a specific release tag
npx @adriansilvadonascimento/guider skills install guider --tag v1.0.0

# Verify the download against a SHA-256 digest
npx @adriansilvadonascimento/guider skills install guider --sha256 <hex>

# Update a skill (re-fetches latest, or --tag <tag> to pin)
npx @adriansilvadonascimento/guider skills update guider

# Update all installed skills
npx @adriansilvadonascimento/guider skills update

# List installed skills
npx @adriansilvadonascimento/guider skills list

# Install from a direct .skill URL (bypasses the registry)
npx @adriansilvadonascimento/guider skills install guider --url https://example.com/guider.skill
```

When no location flag is given, `install` asks whether to install **globally**
(`~/.claude/skills/user/`, for every project) or into the **current project**
(`./.claude/skills/`). In a non-interactive shell (CI, pipes) it defaults to
global so nothing hangs. Use `--global`, `--project`, or `--dir <path>` to choose
explicitly.

The installer downloads the public release asset through the GitHub API, refuses
any archive whose entries would extract outside the target directory (zip-slip
protection), and — when `--sha256` is supplied — aborts on a checksum mismatch.

Public GitHub API calls are anonymous and rate-limited. If you hit the limit (or
want to install from a private fork), pass a token with `--token`, or export
`$GITHUB_TOKEN` / `$GH_TOKEN`.

## Adding a skill to the registry

Edit `lib/skills/registry.js` and add a `name → { repo, asset }` entry pointing
at the GitHub repo that publishes the skill as a release asset. The CLI looks up
the release via the API (`latest` by default, or a tag via `--tag`) and
downloads the matching asset.

## Releasing a new skill version

The installer downloads the `guider.skill` asset **attached to the release** —
so every release tag must carry that asset, or `install`/`update` fails with
"Release <tag> has no asset named guider.skill".

```bash
# 1. Rebuild the .skill from skill-src/ (prints its sha256)
npm run build

# 2. Attach it to the release (create the release first if needed)
gh release upload v1.0.1 dist/guider.skill --repo AdrianSilvadoNascimento/guider --clobber

# or create the release and attach in one step:
gh release create v1.0.1 dist/guider.skill --repo AdrianSilvadoNascimento/guider --title v1.0.1
```

`update` automatically serves the newest release — no code change needed.
Consumers who want reproducible installs can pin with `--tag` and `--sha256`
(use the digest printed by `npm run build`).

## Publishing the CLI (maintainers)

The package targets the public npm registry (`publishConfig.access` is already
`public`).

```bash
npm login          # once, with your npmjs.com account
npm publish        # publishes @adriansilvadonascimento/guider publicly
```

Bump `version` in `package.json` before each publish.

## Development

```bash
npm install      # install deps (incl. eslint)
npm run lint     # eslint
npm test         # node --test
```

## License

MIT — see [LICENSE](LICENSE).
