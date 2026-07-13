# Maintainers

## Adding a skill to the registry

Edit [`lib/skills/registry.js`](../lib/skills/registry.js) and add a
`name → { repo, asset }` entry pointing at the GitHub repo that publishes the
skill as a release asset. The CLI looks up the release via the API (`latest` by
default, or a tag via `--tag`) and downloads the matching asset.

```js
export const REGISTRY = {
  guider: { repo: "AdrianSilvadoNascimento/guider", asset: "guider.skill" },
};
```

## Releasing a new skill version

The installer downloads the `guider.skill` asset **attached to the release** — so
every release tag must carry that asset, or `install`/`update` fails with
`Release <tag> has no asset named guider.skill`.

```bash
# 1. Rebuild the .skill from skill-src/ (prints its sha256)
npm run build

# 2. Create the release and attach the asset
gh release create v1.1.0 dist/guider.skill \
  --repo AdrianSilvadoNascimento/guider --title v1.1.0

# …or attach to an existing release
gh release upload v1.1.0 dist/guider.skill \
  --repo AdrianSilvadoNascimento/guider --clobber
```

`update` automatically serves the newest release — no code change needed.
Consumers who want reproducible installs can pin with `--tag` and `--sha256`
(use the digest printed by `npm run build`).

## Publishing the CLI

The package targets the public npm registry (`publishConfig.access` is already
`public`).

```bash
npm login          # once, with your npmjs.com account
npm publish        # publishes @adrianfsf/guider publicly
```

Bump `version` in `package.json` before each publish.
