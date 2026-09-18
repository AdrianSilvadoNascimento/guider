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

### One-time setup: the `NPM_TOKEN` secret

The publish step authenticates with an npm token held as a repository secret.
Create the token on npmjs.com under **Access Tokens** — a *granular* token
scoped to `@adrianfsf/guider` with **Read and write**, or a classic
**Automation** token (that type is what bypasses 2FA on publish).

Then set it without the value ever touching your shell history; the command
prompts for it:

```bash
gh secret set NPM_TOKEN --repo AdrianSilvadoNascimento/guider
```

A granular token expires, so publishing will start failing on its expiry date —
re-run the same command with a fresh token to rotate it. The release workflow
checks the secret is present before it builds or releases anything, so a missing
or expired token fails the run immediately instead of halfway through.

npm also supports **trusted publishing** (OIDC), which removes the token
entirely and does not require an npm organization — the trusted publisher points
at the GitHub owner, repo and workflow filename. Worth migrating to when
convenient.

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
