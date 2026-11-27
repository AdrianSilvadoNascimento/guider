# Supply chain — release quarantine

Most malicious or broken package releases are found and pulled within hours to a
few days of publishing. A project that installs a version the minute it appears
takes that hit; a project that waits a few days usually never sees it. So Guider's
default is a **release quarantine**: a new version of a dependency, skill or
agent plugin is not adopted until it has been public for a minimum time.

- **Default: 7 days.** The project may lower it at `init`, never below **1 day**.
- **Applies to everything pulled in**: package dependencies, dependency-update
  bots, agent skills and plugins, MCP servers, CLI tools installed by script.
- **Exception: an urgent security fix.** Bypass the window for that one package,
  explicitly, and record why in `docs/DECISIONS.md` (or the PR description when
  there's no decision log). Never lower the global setting to let one package in.
- The window is enforced by configuration, not memory — set it in the package
  manager *and* the update bot, so neither a manual install nor an automated PR
  slips through.

## Per-tool settings (7 days)

Enable the one for each package manager the repo uses. Check the tool's
version: older versions ignore an unknown key silently.

| Tool | Where | Setting for 7 days | Unit | Per-package exception | Since |
|---|---|---|---|---|---|
| pnpm | `pnpm-workspace.yaml` | `minimumReleaseAge: 10080` | minutes | `minimumReleaseAgeExclude` | 10.16 (default 1 day since 11) |
| npm | `.npmrc` | `min-release-age=7` | days | `min-release-age-exclude` | 11.10 |
| Yarn (Berry) | `.yarnrc.yml` | `npmMinimalAgeGate: "7d"` | duration (bare number = minutes) | `npmPreapprovedPackages` | 4.10 |
| Bun | `bunfig.toml` `[install]` | `minimumReleaseAge = 604800` | seconds | `minimumReleaseAgeExcludes` | — |
| Deno | `deno.json` | `"minimumDependencyAge": "P7D"` | ISO 8601 / minutes | — | default 1 day since 2.9 |
| uv | `pyproject.toml` `[tool.uv]` / `uv.toml` | `exclude-newer = "7 days"` | duration or timestamp | `exclude-newer-package` | 0.9.17 (relative durations) |
| pip | CLI / `PIP_UPLOADED_PRIOR_TO` | `--uploaded-prior-to P7D` | whole days | — | 26.1 |
| Renovate | `renovate.json` | `"minimumReleaseAge": "7 days"` | duration | `packageRules` | security updates skip it |
| Dependabot | `.github/dependabot.yml`, per `updates` entry | `cooldown: { default-days: 7 }` | days | `cooldown.exclude` | security updates skip it |

Notes:
- npm: an absolute `before=<date>` also exists; when both are set at the same
  level, `before` wins. Prefer `min-release-age`.
- Dependabot: `semver-major-days` / `semver-minor-days` / `semver-patch-days`
  fall back to `default-days`; a longer window for majors is reasonable.
- Lockfiles still matter: the quarantine decides which version is *chosen*; the
  committed lockfile and `npm ci`/`--frozen-lockfile` decide that CI installs
  exactly that version.

## Skills, plugins and agent tooling

Agent skills and plugins run with the agent's permissions, so they deserve the
same window — arguably a stricter one.

- Guider's own CLI applies the quarantine: `guider skills install|update` takes
  the newest release public for ≥ 7 days (`--quarantine-days`, minimum 1;
  `--allow-fresh` to bypass deliberately).
- For other installers (`npx <tool>@latest`, `claude plugin install`,
  `npx skills add`, `uv tool install`), pin a version or tag that is at least as
  old as the window instead of `@latest`, when the installer allows it.
  When it doesn't, check the release date before installing.
- Re-check before updating, not only on first install.

## What `/guider init` records

- The window (default 7 days, minimum 1) and the exception process — as one hard
  rule in `AGENTS.md`, detail in `ARCHITECTURE.md` §Conventions or
  `docs/DECISIONS.md`.
- Which package managers and update bots are configured, and the exact keys
  written (show the diff; edit existing files in place).

## What `/guider audit` checks

- A package manager in use with no release-age setting, or a window below the
  project's agreed minimum — `safe` (adding config), severity `medium`.
- Renovate/Dependabot configured without a release-age/cooldown setting —
  `safe`, `medium`.
- Install commands in docs, scripts or CI that pull `@latest` of an agent
  skill/plugin or tool without a pinned version — `low`.
- No committed lockfile, or CI installing without the frozen/ci mode — `medium`.
