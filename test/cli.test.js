import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "guider.js");

// Build a tiny valid .skill archive in memory.
function buildSkill() {
  const zip = new AdmZip();
  zip.addFile(
    "guider/SKILL.md",
    Buffer.from("---\nname: guider\ndescription: >-\n  A folded multi-line\n  description.\n---\nbody\n"),
  );
  return zip.toBuffer();
}

const skillBuffer = buildSkill();
let server;
let baseUrl;
let tmpDir;

function run(args, options = {}) {
  return new Promise((resolve) => {
    execFile("node", [CLI, ...args], options, (err, stdout, stderr) => {
      resolve({ code: err?.code ?? 0, stdout, stderr });
    });
  });
}

before(async () => {
  server = http.createServer((req, res) => res.end(skillBuffer));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}/guider.skill`;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guider-test-"));
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("install extracts the skill folder", async () => {
  const { code } = await run(["skills", "install", "guider", "--dir", tmpDir, "--url", baseUrl]);
  assert.equal(code, 0);
  assert.ok(fs.existsSync(path.join(tmpDir, "guider", "SKILL.md")));
});

test("--project installs into the current project's .claude/skills", async () => {
  const projDir = fs.mkdtempSync(path.join(os.tmpdir(), "guider-proj-"));
  try {
    const { code } = await run(
      ["skills", "install", "guider", "--project", "--url", baseUrl],
      { cwd: projDir },
    );
    assert.equal(code, 0);
    assert.ok(fs.existsSync(path.join(projDir, ".claude", "skills", "guider", "SKILL.md")));
  } finally {
    fs.rmSync(projDir, { recursive: true, force: true });
  }
});

test("list reads the folded block-scalar description", async () => {
  const { code, stdout } = await run(["skills", "list", "--dir", tmpDir]);
  assert.equal(code, 0);
  assert.match(stdout, /guider/);
  assert.match(stdout, /A folded multi-line description\./);
});

test("install rejects a checksum mismatch", async () => {
  const { code, stderr } = await run([
    "skills", "install", "guider", "--dir", tmpDir, "--url", baseUrl,
    "--sha256", "0".repeat(64),
  ]);
  assert.equal(code, 1);
  assert.match(stderr, /Checksum mismatch/);
});

test("install accepts a correct checksum", async () => {
  const digest = crypto.createHash("sha256").update(skillBuffer).digest("hex");
  const { code } = await run([
    "skills", "install", "guider", "--dir", tmpDir, "--url", baseUrl, "--sha256", digest,
  ]);
  assert.equal(code, 0);
});
