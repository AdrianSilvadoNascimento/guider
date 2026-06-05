# guider

CLI to install and update Claude skills. Published to **GitHub Packages** under
the private `docsales` org.

## Consumer setup (one time per machine)

Because both the CLI package and the skill repo are private, you need a GitHub
**Personal Access Token** with `read:packages` **and** repo `Contents: read`
(a classic token with `repo` + `read:packages`, or an equivalent fine-grained
token).

**1. Point the `@docsales` scope at GitHub Packages.** Add to `~/.npmrc` (or the
project `.npmrc`):

```ini
@docsales:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**2. Export the token** so npm (install) and the CLI (asset download) can read it:

```bash
export GITHUB_TOKEN=ghp_xxx   # also accepts $GH_TOKEN or --token
```

## Usage

```bash
# Install a skill (prompts: global vs. current project)
npx @docsales/guider skills install guider

# Skip the prompt with an explicit location
npx @docsales/guider skills install guider --global    # ~/.claude/skills/user
npx @docsales/guider skills install guider --project   # ./.claude/skills

# Pin to a specific release tag
npx @docsales/guider skills install guider --tag v1.0.0

# Verify the download against a SHA-256 digest
npx @docsales/guider skills install guider --sha256 <hex>

# Use an explicit token instead of the env var
npx @docsales/guider skills install guider --token ghp_xxx

# Update a skill (re-fetches latest, or --tag <tag> to pin)
npx @docsales/guider skills update guider

# Update all installed skills
npx @docsales/guider skills update

# List installed skills
npx @docsales/guider skills list

# Install from a direct .skill URL (bypasses the registry)
npx @docsales/guider skills install guider --url https://example.com/guider.skill
```

When no location flag is given, `install` asks whether to install **globally**
(`~/.claude/skills/user/`, for every project) or into the **current project**
(`./.claude/skills/`). In a non-interactive shell (CI, pipes) it defaults to
global so nothing hangs. Use `--global`, `--project`, or `--dir <path>` to choose
explicitly.

The installer reaches private release assets through the GitHub API (using your
token), refuses any archive whose entries would extract outside the target
directory (zip-slip protection), and — when `--sha256` is supplied — aborts on a
checksum mismatch.

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
gh release upload v1.0.1 dist/guider.skill --repo docsales/guider --clobber

# or create the release and attach in one step:
gh release create v1.0.1 dist/guider.skill --repo docsales/guider --title v1.0.1
```

`update` automatically serves the newest release — no code change needed.
Consumers who want reproducible installs can pin with `--tag` and `--sha256`
(use the digest printed by `npm run build`).

## Publishing the CLI (maintainers)

```bash
# authenticate npm to GitHub Packages (token needs write:packages)
npm publish        # publishConfig already targets npm.pkg.github.com
```

Bump `version` in `package.json` before each publish.

## Development

```bash
npm install      # install deps (incl. eslint)
npm run lint     # eslint
npm test         # node --test
```
