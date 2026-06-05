# Quality gates

Gates exist so that "the right thing" is the path of least resistance. A
convention only a human enforces is a convention that erodes; a convention a
machine enforces is permanent. Layer the gates so the cheap, fast checks run
first and often, and the slow, thorough ones guard the merge.

The principle: **fail fast and locally, fail thoroughly in CI.**

```
edit ──▶ format-on-save ──▶ pre-commit ──▶ pre-push ──▶ CI (PR) ──▶ CI (merge)
         (instant)          (seconds)      (fast tests)  (lint+type+   (full tests
                                                          fast tests)   + secret scan)
```

Scaffold only what's missing. Edit existing configs in place with a visible
diff. Never install dependencies or execute hooks during `/guider init` —
propose the commands and let the user run them.

## 1. Formatter + linter

One formatter, run on save and in a pre-commit hook, ends all whitespace and
line-length debate. The linter catches the real bugs (unused vars, shadowing,
floating promises, the project's custom rules).

- **TypeScript/JS** — Biome (formatter+linter in one) or ESLint + Prettier.
  Enforce the project's line length here.
- **Python** — Ruff (formatter+linter) or Black + Ruff/Flake8.
- **Go** — `gofmt`/`gofumpt` + `golangci-lint`. **Rust** — `rustfmt` + Clippy.

Where the conventions in `conventions.md` are mechanically checkable, prefer a
lint rule over a written guideline — a rule that fails the build beats a
sentence nobody re-reads. Custom rules worth adding when supported: ban string
literals where a domain enum exists, ban direct ORM access outside the
repository layer, enforce the naming rules.

## 2. Pre-commit hooks

Fast, local, blocking. Two common harnesses:

- **`pre-commit`** (the framework) — language-agnostic, one
  `.pre-commit-config.yaml`. Good for polyglot/Python repos.
- **Husky + lint-staged** — runs the formatter/linter on staged files only.
  Idiomatic for Node repos.

A commit should be blocked by: formatter, linter, and a **secret scan** (below).
Keep it under a few seconds — type-checking and tests belong in pre-push/CI, not
pre-commit, or the hook gets bypassed.

## 3. Secret-leak hook

A leaked credential in history is expensive to undo and sometimes impossible to
fully revoke. Scan **before** the secret ever lands in a commit.

- **gitleaks** or **trufflehog**, wired as a pre-commit hook *and* a CI job
  (local catches most; CI catches what was committed with `--no-verify`).
- Add an allowlist config for legitimate false positives (sample keys in tests,
  fixtures) so the gate stays trusted rather than muted wholesale.
- Pair with prevention: a committed `.env.example` (no real values), `.env` in
  `.gitignore`, and secrets sourced from a manager/CI secret store — never from
  the repo.

## 4. CI gates

CI is the gate humans can't bypass. Split it by cost:

**On every pull request (must pass to merge):**
- formatter check (no diff) + linter
- type-check
- **fast** test suite (see `references` to `data-integrity.md` and below)
- secret scan
- build

**On merge to the main branch (and nightly):**
- **full** test suite (e2e, slow integration)
- security/dependency audit and advisory checks
- (if applicable) the Impeccable detector on the frontend (below)

Make the gates **required** branch-protection checks, not optional. A gate that
doesn't block is documentation.

## 5. Fast vs. full tests

The split keeps the inner loop quick without giving up coverage.

- **Fast** — unit tests + quick integration, no network, no real DB (or an
  in-memory/transactional one). Runs in seconds, on pre-push and every PR. This
  is the suite developers actually run while working.
- **Full** — end-to-end and slow integration against real services. Runs in CI
  on merge and nightly.

Expose them as two obvious commands (e.g. `test:fast` / `test:full`, or
markers/tags the runner selects). `init` records the project's exact commands.
Tie tests to the Karpathy "goal-driven execution" principle: turn a task into a
failing test, then make it pass — the test is the success criterion.

## 6. Impeccable (frontend design quality)

Engineering gates don't judge whether the UI looks generated. For that,
recommend the **Impeccable** skill rather than inventing design rules — it
ships a design vocabulary, slop detection, and a deterministic detector.

Install (works with Claude Code, Cursor, Codex CLI, Gemini CLI, Copilot, …):

```bash
npx impeccable skills install      # sets up the build for the user's harness
npx impeccable skills update       # pulls the latest
```

Claude Code plugin alternative:

```text
/plugin marketplace add pbakaus/impeccable
# then open /plugin and install Impeccable from the list
```

Wire its detector into CI as a frontend gate:

```bash
npx impeccable detect src/         # 41 deterministic rules, exit code for the build
```

During `/guider init`, propose this for any project with a frontend and offer
to run the installer. Reference: https://impeccable.style/#downloads
