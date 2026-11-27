import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "../skill-src/guider/assets/graph.mjs");

function project(files) {
  const root = mkdtempSync(join(tmpdir(), "graph-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8" });
}

function json(root, ...args) {
  const result = run(root, ...args, "--json");
  return { status: result.status, value: JSON.parse(result.stdout) };
}

const APP = {
  "tsconfig.json": '{ // comment\n "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }',
  "src/domain/order.ts": 'import { db } from "../infra/db";\nexport const order = db;\n',
  "src/infra/db.ts": 'import pg from "pg";\nexport const db = pg;\n',
  "src/http/routes.ts": 'import { order } from "@/domain/order";\nimport "./side-effect.js";\n',
  "src/http/side-effect.ts": "export {};\n",
  "test/routes.test.ts": 'import "../src/http/routes";\n',
  "node_modules/pg/index.js": "module.exports = {};\n",
};

test("build resolves relative, alias and .js-suffixed TS imports, and skips node_modules", () => {
  const root = project(APP);
  assert.equal(run(root, "build").status, 0);
  const { value } = json(root, "impact", "src/infra/db.ts");
  assert.deepEqual(value.direct, ["src/domain/order.ts"]);
  assert.deepEqual(value.transitive, ["src/domain/order.ts", "src/http/routes.ts", "test/routes.test.ts"]);
  assert.deepEqual(value.tests, ["test/routes.test.ts"]);
  assert.deepEqual(json(root, "impact", "src/http/side-effect.ts").value.direct, ["src/http/routes.ts"]);
});

test("cycles finds a loop and exits 1", () => {
  const root = project({ "a.js": 'import "./b.js";\n', "b.js": 'require("./a");\n', "c.js": "" });
  run(root, "build");
  const { status, value } = json(root, "cycles");
  assert.equal(status, 1);
  assert.deepEqual(value, [["a.js", "b.js"]]);
});

test("layers reports rule and bounded-context violations", () => {
  const root = project({
    ...APP,
    "src/billing/index.ts": "export {};\n",
    "src/billing/internal.ts": "export {};\n",
    "src/deals/deal.ts": 'import "../billing/internal";\nimport "../billing";\n',
    ".guider-graph.json": JSON.stringify({
      rules: [{ from: "src/domain/", disallow: ["src/infra/"] }],
      contexts: ["src/billing/", "src/deals/"],
    }),
  });
  run(root, "build");
  const { status, value } = json(root, "layers");
  assert.equal(status, 1);
  assert.deepEqual(value.map((violation) => `${violation.from}>${violation.to}`).sort(), [
    "src/deals/deal.ts>src/billing/internal.ts",
    "src/domain/order.ts>src/infra/db.ts",
  ]);
});

test("python imports resolve, including relative and from-package submodules", () => {
  const root = project({
    "app/__init__.py": "",
    "app/models.py": "import os\n",
    "app/services/__init__.py": "",
    "app/services/billing.py": "from ..models import Order\nfrom app import models\n",
    "main.py": "from app.services import billing\nimport app.models\n",
  });
  run(root, "build");
  const { value } = json(root, "impact", "app/models.py");
  assert.deepEqual(value.transitive, ["app/services/billing.py", "main.py"]);
});

test("refresh re-parses only changed files and picks up new ones", () => {
  const root = project({ "a.js": "export {};\n", "b.js": 'import "./a.js";\n' });
  run(root, "build");
  assert.match(run(root, "refresh").stdout, /0 re-parsed/);
  writeFileSync(join(root, "b.js"), 'import "./a.js";\nimport "./c.js";\n');
  assert.match(run(root, "refresh", "b.js").stdout, /1 re-parsed/);
  writeFileSync(join(root, "c.js"), "export {};\n");
  run(root, "refresh");
  assert.deepEqual(json(root, "impact", "c.js").value.direct, ["b.js"]);
});

test("summary reports hubs and a graphify-out graph when present", () => {
  const root = project({
    ...APP,
    "graphify-out/graph.json": JSON.stringify({ nodes: [1, 2, 3], links: [1] }),
    "graphify-out/GRAPH_REPORT.md": "# report\n",
  });
  run(root, "build");
  const { value } = json(root, "summary");
  assert.equal(value.files, 5);
  assert.equal(value.graphify.nodes, 3);
  assert.match(run(root, "summary", "--brief").stdout, /Semantic graph: graphify-out\/GRAPH_REPORT\.md/);
});
