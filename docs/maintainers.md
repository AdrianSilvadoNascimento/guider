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

Do not create the release from the GitHub web UI. That creates the tag on
whatever commit `main` is at, usually before the version bump, so the workflow
stops at the version check and leaves behind a release with no `guider.skill`
asset — which `update` then serves as the latest release, breaking installs.

### One-time setup: npm trusted publishing

The publish step uses npm **trusted publishing** (OIDC), not a token. There is
no `NPM_TOKEN` secret to create or rotate. npm stopped accepting tokens that
publish directly without 2FA, so a token-based setup is no longer an option.

On npmjs.com, open `@adrianfsf/guider` → **Settings** → **Trusted Publisher** →
**GitHub Actions** and enter:

- Organization or user: `AdrianSilvadoNascimento`
- Repository: `guider`
- Workflow filename: `release.yml`
- Environment: leave empty

The trusted publisher is tied to the workflow filename: renaming
`release.yml` breaks publishing until the setting is updated to match.

### Re-releasing a tag

`workflow_dispatch` runs the workflow from the default branch against an
existing tag's code. That is the way to re-release a tag cut *before* a
pipeline fix landed — re-running the original failed run would just replay the
old, broken workflow.

```bash
gh workflow run Release -f tag=v1.3.0
```

### Releasing by hand

Only needed if the workflow is unavailable. Note that a manual publish gets no
provenance, and needs a real npm login:

```bash
npm run build                                    # prints the sha256
gh release create v1.3.0 dist/guider.skill --title v1.3.0
npm login && npm publish
```
