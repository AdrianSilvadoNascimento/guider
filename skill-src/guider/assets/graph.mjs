#!/usr/bin/env node
// graph.mjs — copied into the project by `/guider init` (see references/code-graph.md).
// Dependency-free (Node >= 18). Builds a structural import graph of the repo into
// `.guider/graph.json` so audits and fixes can scope work by blast radius instead of
// re-reading the whole codebase. Re-parses only files whose content changed.
//
// Usage:  node scripts/graph.mjs build                 # full (incremental) rebuild
//         node scripts/graph.mjs refresh [files...]    # update only these files (all if none)
//         node scripts/graph.mjs impact <file...>      # who depends on these, and which tests
//         node scripts/graph.mjs cycles                # import cycles (exit 1 if any)
//         node scripts/graph.mjs layers                # boundary-rule violations (exit 1 if any)
//         node scripts/graph.mjs summary [--brief]     # size, hubs, cycles, violations, graphify
// Flags:  --json for machine-readable output.
// Config: optional `.guider-graph.json` at the repo root:
//   { "ignore": ["generated/"],
//     "rules": [{ "from": "src/domain/", "disallow": ["src/http/", "src/infra/"] }],
//     "contexts": ["src/billing/", "src/deals/"] }   // cross-context imports must hit <ctx>/index.*

import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";

const root = process.cwd();
const GRAPH_PATH = join(root, ".guider", "graph.json");
const CONFIG_PATH = join(root, ".guider-graph.json");
const SOURCE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".py"];
const JS_RESOLVE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"];
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", "coverage",
  "vendor", ".venv", "venv", "__pycache__", ".guider", "graphify-out", ".turbo", ".cache", "target",
]);
const TEST_RE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.py$/;

const config = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, "utf8")) : {};
const toPosix = (path) => path.split(sep).join("/");
const hash = (text) => createHash("sha1").update(text).digest("hex").slice(0, 16);

function isIgnored(path) {
  return (config.ignore ?? []).some((prefix) => path.startsWith(prefix));
}

function walk(dir = root, files = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const rel = toPosix(relative(root, full));
    if (isIgnored(rel)) continue;
    let stat;
    try {
      stat = lstatSync(full); // never follow links: a dangling one throws, a looping one never ends
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) walk(full, files);
    else if (SOURCE_EXT.some((ext) => name.endsWith(ext))) files.push(rel);
  }
  return files;
}

// tsconfig/jsconfig `paths` aliases, e.g. "@/*": ["./src/*"].
function loadAliases() {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    try {
      // Strip comments but keep strings intact ("src/*" contains a comment opener).
      const text = readFileSync(path, "utf8").replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "$1");
      const options = JSON.parse(text.replace(/,\s*([}\]])/g, "$1")).compilerOptions ?? {};
      const base = options.baseUrl ?? ".";
      return Object.entries(options.paths ?? {}).map(([pattern, targets]) => ({
        prefix: pattern.replace(/\*$/, ""),
        targets: targets.map((target) => posix.normalize(posix.join(base, target.replace(/\*$/, "")))),
      }));
    } catch {
      return [];
    }
  }
  return [];
}

const JS_IMPORT_RE =
  /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const PY_IMPORT_RE = /^\s*from\s+(\.*[\w.]*)\s+import\s+([\w*, ()]+)|^\s*import\s+([\w., ]+)/gm;

function resolveJs(fileSet, aliases, from, spec) {
  let bases = [];
  if (spec.startsWith(".")) bases = [posix.normalize(posix.join(posix.dirname(from), spec))];
  else {
    const alias = aliases.find((entry) => spec.startsWith(entry.prefix));
    if (!alias) return null;
    bases = alias.targets.map((target) => posix.normalize(posix.join(target, spec.slice(alias.prefix.length))));
  }
  for (const base of bases) {
    const stripped = base.replace(/\.(js|mjs|cjs|jsx)$/, ""); // TS ESM imports name the .js output
    const candidates = [
      base,
      ...JS_RESOLVE_EXT.map((ext) => stripped + ext),
      ...JS_RESOLVE_EXT.map((ext) => `${base}/index${ext}`),
    ];
    const hit = candidates.find((candidate) => fileSet.has(candidate));
    if (hit) return hit;
  }
  return null;
}

function resolvePy(fileSet, from, module, names) {
  let parts;
  if (module.startsWith(".")) {
    const dots = module.match(/^\.+/)[0].length;
    let dir = posix.dirname(from);
    for (let level = 1; level < dots; level++) dir = posix.dirname(dir);
    const rest = module.slice(dots);
    parts = [dir === "." ? "" : dir, ...(rest ? rest.split(".") : [])].filter(Boolean);
  } else parts = module.split(".");
  const base = parts.join("/");
  const tries = [];
  for (const prefix of ["", "src/"]) {
    // `from pkg import mod` may name a submodule; try it before the package itself.
    for (const name of names) tries.push(`${prefix}${base ? `${base}/` : ""}${name}.py`);
    tries.push(`${prefix}${base}.py`, `${prefix}${base}/__init__.py`);
  }
  return [...new Set(tries.filter((candidate) => fileSet.has(candidate)))].slice(0, names.length || 1);
}

function parseFile(path, text, fileSet, aliases) {
  const imports = new Set();
  const external = new Set();
  if (path.endsWith(".py")) {
    for (const match of text.matchAll(PY_IMPORT_RE)) {
      if (match[1] !== undefined) {
        const names = match[2].replace(/[()]/g, "").split(",").map((name) => name.trim().split(/\s+/)[0]);
        const hits = resolvePy(fileSet, path, match[1], names.filter((name) => name && name !== "*"));
        hits.forEach((hit) => imports.add(hit));
        if (!hits.length && !match[1].startsWith(".")) external.add(match[1].split(".")[0]);
      } else {
        for (const module of match[3].split(",").map((name) => name.trim().split(/\s+/)[0])) {
          const hits = resolvePy(fileSet, path, module, []);
          hits.forEach((hit) => imports.add(hit));
          if (!hits.length && module) external.add(module.split(".")[0]);
        }
      }
    }
  } else {
    for (const match of text.matchAll(JS_IMPORT_RE)) {
      const spec = match[1] ?? match[2] ?? match[3];
      const hit = resolveJs(fileSet, aliases, path, spec);
      if (hit) imports.add(hit);
      else if (!spec.startsWith(".")) {
        external.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
      }
    }
  }
  imports.delete(path);
  return { imports: [...imports].sort(), external: [...external].sort() };
}

function loadGraph() {
  return existsSync(GRAPH_PATH) ? JSON.parse(readFileSync(GRAPH_PATH, "utf8")) : null;
}

function saveGraph(graph) {
  mkdirSync(dirname(GRAPH_PATH), { recursive: true });
  writeFileSync(GRAPH_PATH, `${JSON.stringify(graph, null, 1)}\n`);
}

// Rebuild, reusing parse results for files whose content hash is unchanged.
// `only` limits re-parsing to those paths while the file set is unchanged.
function build(only) {
  const previous = loadGraph()?.files ?? {};
  const allFiles = walk();
  const fileSet = new Set(allFiles);
  const aliases = loadAliases();
  // An added or removed file changes how other imports resolve, so reuse nothing then.
  const setChanged =
    allFiles.length !== Object.keys(previous).length || allFiles.some((path) => !previous[path]);
  const files = {};
  let parsed = 0;
  for (const path of allFiles) {
    const old = setChanged ? undefined : previous[path];
    if (only && !only.has(path) && old) {
      files[path] = old;
      continue;
    }
    const text = readFileSync(join(root, path), "utf8");
    const digest = hash(text);
    if (old && old.hash === digest) {
      files[path] = old;
      continue;
    }
    files[path] = { hash: digest, ...parseFile(path, text, fileSet, aliases) };
    parsed++;
  }
  const graph = { version: 1, generatedAt: new Date().toISOString(), files };
  saveGraph(graph);
  return { graph, parsed };
}

function requireGraph() {
  return loadGraph() ?? build().graph;
}

function reverseEdges(files) {
  const importers = {};
  for (const [path, entry] of Object.entries(files)) {
    for (const target of entry.imports) (importers[target] ??= []).push(path);
  }
  return importers;
}

function impact(files, targets) {
  const importers = reverseEdges(files);
  const direct = new Set();
  const all = new Set();
  const queue = [...targets];
  while (queue.length) {
    const current = queue.shift();
    for (const importer of importers[current] ?? []) {
      if (targets.includes(importer) || all.has(importer)) continue;
      if (targets.includes(current)) direct.add(importer);
      all.add(importer);
      queue.push(importer);
    }
  }
  const sorted = [...all].sort();
  return { targets, direct: [...direct].sort(), transitive: sorted, tests: sorted.filter((path) => TEST_RE.test(path)) };
}

// Tarjan's strongly connected components, iterative so a deep import chain
// can't overflow the call stack. Any component with more than one file is a cycle.
function cycles(files) {
  let index = 0;
  const stack = [];
  const meta = new Map();
  const result = [];
  for (const start of Object.keys(files)) {
    if (meta.has(start)) continue;
    const work = [{ node: start, edge: 0 }];
    meta.set(start, { index, low: index, onStack: true });
    index++;
    stack.push(start);
    while (work.length) {
      const frame = work[work.length - 1];
      const info = meta.get(frame.node);
      const edges = files[frame.node]?.imports ?? [];
      if (frame.edge < edges.length) {
        const next = edges[frame.edge++];
        if (!meta.has(next)) {
          meta.set(next, { index, low: index, onStack: true });
          index++;
          stack.push(next);
          work.push({ node: next, edge: 0 });
        } else if (meta.get(next).onStack) {
          info.low = Math.min(info.low, meta.get(next).index);
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = meta.get(work[work.length - 1].node);
        parent.low = Math.min(parent.low, info.low);
      }
      if (info.low === info.index) {
        const component = [];
        let member;
        do {
          member = stack.pop();
          meta.get(member).onStack = false;
          component.push(member);
        } while (member !== frame.node);
        if (component.length > 1) result.push(component.sort());
      }
    }
  }
  return result;
}

function layers(files) {
  const violations = [];
  const contexts = config.contexts ?? [];
  const contextOf = (path) => contexts.find((prefix) => path.startsWith(prefix));
  for (const [from, entry] of Object.entries(files)) {
    for (const target of entry.imports) {
      for (const rule of config.rules ?? []) {
        if (!from.startsWith(rule.from)) continue;
        const banned = rule.disallow.find((prefix) => target.startsWith(prefix));
        if (banned) violations.push({ from, to: target, rule: `${rule.from} must not import ${banned}` });
      }
      const source = contextOf(from);
      const destination = contextOf(target);
      if (destination && source !== destination && !/^index\.[a-z]+$/.test(target.slice(destination.length))) {
        violations.push({ from, to: target, rule: `cross-context import must go through ${destination}index` });
      }
    }
  }
  return violations;
}

function graphifyInfo() {
  const dir = join(root, "graphify-out");
  if (!existsSync(dir)) return null;
  const info = { dir: "graphify-out/", report: existsSync(join(dir, "GRAPH_REPORT.md")) ? "graphify-out/GRAPH_REPORT.md" : null };
  try {
    const data = JSON.parse(readFileSync(join(dir, "graph.json"), "utf8"));
    info.nodes = (data.nodes ?? []).length;
    info.edges = (data.links ?? data.edges ?? []).length;
  } catch {
    // graph.json missing or in another shape — the report path is still useful.
  }
  return info;
}

function summary(files) {
  const importers = reverseEdges(files);
  const hubs = Object.entries(importers)
    .map(([path, list]) => ({ path, importers: list.length }))
    .sort((left, right) => right.importers - left.importers || left.path.localeCompare(right.path))
    .slice(0, 10);
  const edges = Object.values(files).reduce((total, entry) => total + entry.imports.length, 0);
  return {
    files: Object.keys(files).length,
    edges,
    hubs,
    cycles: cycles(files).length,
    violations: layers(files).length,
    graphify: graphifyInfo(),
  };
}

function printList(title, items) {
  console.log(`${title} (${items.length})`);
  for (const item of items) console.log(`  ${item}`);
}

const [command = "summary", ...rest] = process.argv.slice(2);
const json = rest.includes("--json");
const args = rest.filter((arg) => !arg.startsWith("--")).map((arg) => toPosix(arg).replace(/^\.\//, ""));
const emit = (value, human) => (json ? console.log(JSON.stringify(value, null, 2)) : human(value));

switch (command) {
  case "build":
  case "refresh": {
    const only = command === "refresh" && args.length ? new Set(args) : undefined;
    const { graph, parsed } = build(only);
    emit({ files: Object.keys(graph.files).length, parsed }, (value) =>
      console.log(`✓ graph: ${value.files} file(s), ${value.parsed} re-parsed → .guider/graph.json`));
    break;
  }
  case "impact": {
    if (!args.length) {
      console.error("usage: graph.mjs impact <file...>");
      process.exit(2);
    }
    const graph = requireGraph();
    const unknown = args.filter((path) => !graph.files[path]);
    if (unknown.length) console.error(`! not in graph (run build?): ${unknown.join(", ")}`);
    emit(impact(graph.files, args), (value) => {
      printList("direct dependents", value.direct);
      printList("all dependents", value.transitive);
      printList("tests to run", value.tests);
    });
    break;
  }
  case "cycles": {
    const found = cycles(requireGraph().files);
    emit(found, (value) => {
      if (!value.length) console.log("✓ no import cycles");
      value.forEach((component, position) => printList(`cycle ${position + 1}`, component));
    });
    process.exitCode = found.length ? 1 : 0;
    break;
  }
  case "layers": {
    const found = layers(requireGraph().files);
    emit(found, (value) => {
      if (!value.length) console.log("✓ no boundary violations");
      for (const violation of value) console.log(`✗ ${violation.from} → ${violation.to}: ${violation.rule}`);
    });
    process.exitCode = found.length ? 1 : 0;
    break;
  }
  case "summary": {
    const graph = loadGraph();
    if (!graph) {
      console.log("No .guider/graph.json yet — run `graph.mjs build`.");
      break;
    }
    const value = summary(graph.files);
    if (json) console.log(JSON.stringify(value, null, 2));
    else if (rest.includes("--brief")) {
      const hubs = value.hubs.slice(0, 5).map((hub) => `${hub.path} (${hub.importers})`).join(", ");
      console.log(
        `Code graph: ${value.files} files, ${value.edges} imports, ${value.cycles} cycle(s), ` +
        `${value.violations} boundary violation(s). Hubs: ${hubs || "none"}. ` +
        "Before editing a hub, run `node scripts/graph.mjs impact <file>`." +
        (value.graphify ? ` Semantic graph: ${value.graphify.report ?? value.graphify.dir}.` : ""),
      );
    } else {
      console.log(`files ${value.files} · imports ${value.edges} · cycles ${value.cycles} · violations ${value.violations}`);
      printList("most-imported files", value.hubs.map((hub) => `${hub.path} ← ${hub.importers}`));
      if (value.graphify) console.log(`graphify: ${JSON.stringify(value.graphify)}`);
    }
    break;
  }
  default:
    console.error(`unknown command "${command}" — build | refresh | impact | cycles | layers | summary`);
    process.exit(2);
}
