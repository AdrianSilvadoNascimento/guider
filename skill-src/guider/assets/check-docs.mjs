#!/usr/bin/env node
// check-docs.mjs — copied into the project by `/guider init` (see references/docs-standard.md §7).
// Dependency-free (Node >= 18). Fails on budget and line-length violations; warns on patterns
// that usually mean history or line-number pointers leaked into a reference doc.
//
// Usage:  node scripts/check-docs.mjs            # checks every doc listed in the budgets
//         node scripts/check-docs.mjs a.md b.md  # checks only these (e.g. from lint-staged)
// Config: optional `.guider-docs.json` at the repo root overrides any key of DEFAULTS
//         (`budgets` is merged per path, so it only needs the paths it changes).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DEFAULTS = {
  maxLineLength: 120,
  // Path (or directory prefix ending in "/") → { lines } or { chars }; null = no budget.
  // The most specific (longest) matching key wins.
  budgets: {
    "AGENTS.md": { lines: 150 },
    "CLAUDE.md": { lines: 20 },
    "PRODUCT.md": { lines: 80 },
    "APPLICATION.md": { chars: 25000 },
    "ARCHITECTURE.md": { chars: 40000 },
    "DESIGN.md": { chars: 30000 },
    "BACKLOG.md": { lines: 300 },
    "docs/README.md": { lines: 150 },
    "docs/specs/": null, // in-flight designs: no budget
    "docs/plans/": null,
    "docs/": { chars: 40000 },
  },
  // Warn-only. Tune to the docs language at init.
  warnPatterns: [
    { re: "\\b(until|before|since) \\d{4}-\\d{2}-\\d{2}\\b", why: "history in a reference doc" },
    { re: "\\b(até|antes de|desde) \\d{4}-\\d{2}-\\d{2}\\b", why: "history in a reference doc" },
    { re: "\\b(this|nesta) (session|sessão)\\b", why: "history in a reference doc" },
    { re: "\\.(ts|tsx|js|mjs|py|go|rb|sql):\\d+\\b", why: "line-number pointer (use file + symbol)" },
  ],
};

const root = process.cwd();
const configPath = join(root, ".guider-docs.json");
const overrides = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
const config = {
  ...DEFAULTS,
  ...overrides,
  budgets: { ...DEFAULTS.budgets, ...overrides.budgets },
};

function budgetFor(path) {
  const [key] = Object.keys(config.budgets)
    .filter((candidate) => (candidate.endsWith("/") ? path.startsWith(candidate) : path === candidate))
    .sort((left, right) => right.length - left.length);
  return key === undefined ? undefined : config.budgets[key];
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listMarkdown(full);
    return name.endsWith(".md") ? [full] : [];
  });
}

function defaultTargets() {
  const topLevel = Object.keys(config.budgets).filter((key) => !key.endsWith("/"));
  const docs = listMarkdown(join(root, "docs")).map((full) => relative(root, full));
  return [...new Set([...topLevel, ...docs])].filter((path) => existsSync(join(root, path)));
}

const targets = process.argv.length > 2
  ? process.argv.slice(2).map((path) => relative(root, join(root, path)))
  : defaultTargets();

const errors = [];
const warnings = [];

for (const path of targets) {
  if (!path.endsWith(".md")) continue;
  const text = readFileSync(join(root, path), "utf8");
  const lines = text.split("\n");
  const budget = budgetFor(path);

  if (budget?.lines && lines.length > budget.lines) {
    errors.push(`${path}: ${lines.length} lines (budget ${budget.lines}) — split, don't squeeze`);
  }
  if (budget?.chars && text.length > budget.chars) {
    errors.push(`${path}: ${text.length} chars (budget ${budget.chars}) — split, don't squeeze`);
  }

  let inFence = false;
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (inFence) return;
    const lineNumber = index + 1;
    // Table rows can't wrap in Markdown; the rule for them is "short cells" (docs-standard §2.5).
    if (line.length > config.maxLineLength && !line.trimStart().startsWith("|")) {
      errors.push(`${path}:${lineNumber}: ${line.length} chars (max ${config.maxLineLength})`);
    }
    for (const pattern of config.warnPatterns) {
      if (new RegExp(pattern.re, "i").test(line)) {
        warnings.push(`${path}:${lineNumber}: ${pattern.why}`);
      }
    }
  });
}

for (const warning of warnings) console.warn(`warn  ${warning}`);
for (const error of errors) console.error(`error ${error}`);
if (errors.length > 0) {
  console.error(`\ncheck-docs: ${errors.length} error(s). Budgets and rules: docs/README.md`);
  process.exit(1);
}
console.log(`check-docs: ${targets.length} doc(s) ok, ${warnings.length} warning(s)`);
