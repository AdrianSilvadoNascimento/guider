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

Cutting a release means shipping **two** artifacts from the same commit: the
`guider.skill` asset attached to the GitHub release (the installer downloads it
by that exact name — a release without it fails every `install`/`update` with
`Release <tag> has no asset named guider.skill`) and the `@adrianfsf/guider`
package on npm.

`.github/workflows/release.yml` does both. It runs on a pushed `v*` tag:

```bash
# 1. Bump `version` in package.json — through a PR; main requires one
git checkout -b release/v1.3.0
npm version 1.3.0 --no-git-tag-version
git commit -am "chore(release): v1.3.0" && git push -u origin release/v1.3.0
gh pr create --fill && gh pr merge --squash

# 2. Tag the merge commit — this is what launches the pipeline
git checkout main && git pull
git tag v1.3.0 && git push origin v1.3.0
```

The workflow then refuses to go on if the tag and `package.json` disagree, runs
lint + tests, rebuilds the `.skill`, creates the release with generated notes
(plus the artifact's sha256 as a copy-pasteable pinning command), and publishes
to npm with provenance.

It is safe to re-run: an existing release gets its asset replaced rather than
duplicated, and a version already on npm is skipped instead of failing the job.

`update` automatically serves the newest release — no code change needed.

### One-time setup

The npm publish step needs an **`NPM_TOKEN`** repository secret (an npmjs.com
*automation* token, so 2FA doesn't block it):

```bash
gh secret set NPM_TOKEN --repo AdrianSilvadoNascimento/guider
```

### Releasing by hand

Only needed if the workflow is unavailable:

```bash
npm run build                                    # prints the sha256
gh release create v1.3.0 dist/guider.skill --title v1.3.0
npm publish                                      # after `npm login`
```
