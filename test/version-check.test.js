import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isNewer, notifyFromCache, refreshCache } from "../lib/version-check.js";

const pkg = { name: "@adrianfsf/guider", version: "1.2.0" };

// The notifier is disabled under CI / NO_UPDATE_NOTIFIER; clear them so the
// assertions exercise the real path regardless of the host environment.
let savedEnv;
beforeEach(() => {
  savedEnv = { CI: process.env.CI, NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER };
  delete process.env.CI;
  delete process.env.NO_UPDATE_NOTIFIER;
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function tmpCache() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "guider-vc-")), "cache.json");
}

function collector() {
  const lines = [];
  return { out: { write: (s) => lines.push(s) }, text: () => lines.join("") };
}

test("isNewer compares dotted versions and ignores prerelease", () => {
  assert.equal(isNewer("1.2.0", "1.1.0"), true);
  assert.equal(isNewer("1.10.0", "1.9.0"), true);
  assert.equal(isNewer("1.2.1", "1.2.0"), true);
  assert.equal(isNewer("1.2.0", "1.2.0"), false);
  assert.equal(isNewer("1.1.0", "1.2.0"), false);
  assert.equal(isNewer("1.2.0-beta.1", "1.2.0"), false);
});

test("notifyFromCache prints when the cache knows a newer version", () => {
  const cacheFile = tmpCache();
  fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: Date.now(), latest: "1.5.0" }));
  const { out, text } = collector();
  notifyFromCache(pkg, { cacheFile, out });
  assert.match(text(), /Update available/);
  assert.match(text(), /1\.2\.0/);
  assert.match(text(), /1\.5\.0/);
  assert.match(text(), /npm i -g @adrianfsf\/guider@latest/);
});

test("notifyFromCache stays silent when up to date or cache missing", () => {
  const cacheFile = tmpCache();
  fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: Date.now(), latest: "1.2.0" }));
  const a = collector();
  notifyFromCache(pkg, { cacheFile, out: a.out });
  assert.equal(a.text(), "");

  const missing = collector();
  notifyFromCache(pkg, { cacheFile: tmpCache() + ".nope", out: missing.out });
  assert.equal(missing.text(), "");
});

test("notifyFromCache respects NO_UPDATE_NOTIFIER", () => {
  process.env.NO_UPDATE_NOTIFIER = "1";
  const cacheFile = tmpCache();
  fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: Date.now(), latest: "9.9.9" }));
  const { out, text } = collector();
  notifyFromCache(pkg, { cacheFile, out });
  assert.equal(text(), "");
});

test("refreshCache writes the latest version from the registry", async () => {
  const cacheFile = tmpCache();
  const fetchImpl = async () =>
    new Response(JSON.stringify({ "dist-tags": { latest: "1.4.2" } }), { status: 200 });
  await refreshCache(pkg, { cacheFile, fetchImpl });
  const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  assert.equal(cache.latest, "1.4.2");
  assert.ok(typeof cache.lastCheck === "number");
});

test("refreshCache skips the fetch when the cache is still fresh", async () => {
  const cacheFile = tmpCache();
  fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: Date.now(), latest: "1.3.0" }));
  let called = false;
  await refreshCache(pkg, { cacheFile, fetchImpl: async () => { called = true; return new Response("{}"); } });
  assert.equal(called, false);
  assert.equal(JSON.parse(fs.readFileSync(cacheFile, "utf8")).latest, "1.3.0");
});

test("refreshCache swallows fetch errors", async () => {
  const cacheFile = tmpCache() + ".nope";
  await refreshCache(pkg, { cacheFile, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(fs.existsSync(cacheFile), false); // nothing written, no throw
});
