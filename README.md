# guider

CLI to install and update Claude skills.

## Usage

```bash
# Install a skill
npx @docsales/guider skills install guider

# Pin to a specific release tag
npx @docsales/guider skills install guider --tag v1.2.0

# Verify the download against a SHA-256 digest
npx @docsales/guider skills install guider --sha256 <hex>

# Update a skill (re-fetches latest, or --tag <tag> to pin)
npx @docsales/guider skills update guider

# Update all installed skills
npx @docsales/guider skills update

# List installed skills
npx @docsales/guider skills list

# Install from a direct .skill URL (no registry needed)
npx @docsales/guider skills install guider --url https://github.com/docsales/guider/releases/latest/download/guider.skill
```

Skills install to `~/.claude/skills/user/` by default. Override with `--dir <path>`.

The installer refuses any archive whose entries would extract outside the
target directory (zip-slip protection) and, when `--sha256` is supplied,
aborts on a checksum mismatch.

## Adding a skill to the registry

Edit `lib/skills/registry.js` and add a `name → { repo, asset }` entry pointing
at the GitHub repo that publishes the skill as a release asset. The download
URL is templated from there (`latest` by default, or a tag via `--tag`).

## Releasing a new skill version

1. Rebuild the `.skill` file from the skill source.
2. Create a GitHub Release and attach the `.skill` file as an asset.
3. Because the registry points at `releases/latest/download/`, `update`
   automatically serves the newest release — no code change needed. Consumers
   who want reproducible installs can pin with `--tag` and `--sha256`.

## Development

```bash
npm install      # install deps (incl. eslint)
npm run lint     # eslint
npm test         # node --test
```
