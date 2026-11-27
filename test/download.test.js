import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "../lib/skills/registry.js";
import { resolveToken, download, resolveQuarantineDays, pickQuarantinedRelease } from "../lib/skills/download.js";

test("registry.resolve returns a url descriptor for --url", () => {
  assert.deepEqual(
    resolve("anything", { url: "http://x/y.skill" }),
    { kind: "url", url: "http://x/y.skill" },
  );
});

test("registry.resolve returns a github descriptor for known skills", () => {
  assert.deepEqual(resolve("guider", {}), {
    kind: "github",
    repo: "AdrianSilvadoNascimento/guider",
    asset: "guider.skill",
    tag: undefined,
  });
  assert.equal(resolve("guider", { tag: "v1.0.0" }).tag, "v1.0.0");
});

test("registry.resolve throws for unknown skills", () => {
  assert.throws(() => resolve("nope", {}), /Unknown skill/);
});

test("resolveToken prefers the explicit flag", () => {
  assert.equal(resolveToken("flagtok"), "flagtok");
});

test("download(github) hits the API with auth and returns the asset bytes", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, auth: opts?.headers?.Authorization });
    if (url.startsWith("https://api.github.com/repos/AdrianSilvadoNascimento/guider/releases/latest")) {
      return new Response(
        JSON.stringify({
          tag_name: "v1.0.0",
          assets: [{ name: "guider.skill", url: "https://api.github.com/repos/AdrianSilvadoNascimento/guider/releases/assets/1" }],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/assets/1")) {
      return new Response(Buffer.from("ZIPBYTES"), { status: 200 });
    }
    return new Response("nope", { status: 404 });
  };
  try {
    const buf = await download(
      { kind: "github", repo: "AdrianSilvadoNascimento/guider", asset: "guider.skill" },
      "tok123",
      { quarantineDays: 0 },
    );
    assert.equal(buf.toString(), "ZIPBYTES");
    assert.equal(calls[0].auth, "Bearer tok123");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("download(github) explains a private-repo 404", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    await assert.rejects(
      () => download({ kind: "github", repo: "AdrianSilvadoNascimento/guider", asset: "guider.skill" }, null),
      /Release not found/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-27T00:00:00Z");
const ago = (days) => new Date(NOW - days * DAY).toISOString();
const asset = (id) => [{ name: "guider.skill", url: `https://api.github.com/repos/o/r/releases/assets/${id}` }];

// Serve a release list, single tags, and asset bytes from an in-memory table.
function mockGitHub(releases) {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/releases?per_page=30")) return new Response(JSON.stringify(releases), { status: 200 });
    const tag = url.match(/\/releases\/tags\/([^/]+)$/)?.[1];
    if (tag) {
      const r = releases.find((x) => x.tag_name === decodeURIComponent(tag));
      return r ? new Response(JSON.stringify(r), { status: 200 }) : new Response("", { status: 404 });
    }
    const id = url.match(/\/assets\/(\d+)$/)?.[1];
    if (id) return new Response(Buffer.from(`ASSET${id}`), { status: 200 });
    return new Response("", { status: 404 });
  };
  return { calls, restore: () => { globalThis.fetch = realFetch; } };
}

const RELEASES = [
  { tag_name: "v1.5.0", published_at: ago(0.5), assets: asset(5) },
  { tag_name: "v1.4.1-rc.1", prerelease: true, published_at: ago(9), assets: asset(41) },
  { tag_name: "v1.4.0", published_at: ago(10), assets: asset(4) },
  { tag_name: "v1.3.0", published_at: ago(40), assets: asset(3) },
];
const SRC = { kind: "github", repo: "o/r", asset: "guider.skill" };

test("resolveQuarantineDays defaults to 7, enforces the 1-day floor, and --allow-fresh skips it", () => {
  assert.equal(resolveQuarantineDays({}, {}), 7);
  assert.equal(resolveQuarantineDays({ quarantineDays: "3" }, {}), 3);
  assert.equal(resolveQuarantineDays({}, { GUIDER_QUARANTINE_DAYS: "2" }), 2);
  assert.equal(resolveQuarantineDays({}, { GUIDER_QUARANTINE_DAYS: "" }), 7);
  assert.equal(resolveQuarantineDays({ allowFresh: true, quarantineDays: "0" }, {}), 0);
  assert.throws(() => resolveQuarantineDays({ quarantineDays: "0" }, {}), /1-day floor/);
  assert.throws(() => resolveQuarantineDays({ quarantineDays: "abc" }, {}), /Invalid quarantine/);
});

test("pickQuarantinedRelease takes the newest stable release outside the window", () => {
  assert.equal(pickQuarantinedRelease(RELEASES, 7, NOW).tag_name, "v1.4.0");
  assert.equal(pickQuarantinedRelease(RELEASES, 30, NOW).tag_name, "v1.3.0");
  assert.equal(pickQuarantinedRelease(RELEASES, 60, NOW), undefined);
});

test("download skips a release still in quarantine", async () => {
  const gh = mockGitHub(RELEASES);
  try {
    const buf = await download(SRC, null, { quarantineDays: 7, now: NOW });
    assert.equal(buf.toString(), "ASSET4");
  } finally {
    gh.restore();
  }
});

test("download fails when no release has cleared the window", async () => {
  const gh = mockGitHub(RELEASES);
  try {
    await assert.rejects(() => download(SRC, null, { quarantineDays: 60, now: NOW }), /No stable release/);
  } finally {
    gh.restore();
  }
});

test("download refuses a pinned tag inside the window, accepts it with the window off", async () => {
  const gh = mockGitHub(RELEASES);
  try {
    await assert.rejects(
      () => download({ ...SRC, tag: "v1.5.0" }, null, { quarantineDays: 7, now: NOW }),
      /inside the 7-day quarantine/,
    );
    const buf = await download({ ...SRC, tag: "v1.5.0" }, null, { quarantineDays: 0, now: NOW });
    assert.equal(buf.toString(), "ASSET5");
    const old = await download({ ...SRC, tag: "v1.3.0" }, null, { quarantineDays: 7, now: NOW });
    assert.equal(old.toString(), "ASSET3");
  } finally {
    gh.restore();
  }
});

test("pickQuarantinedRelease skips releases without the asset", () => {
  const releases = [
    { tag_name: "v1.4.0-cli", published_at: ago(10), assets: [] },
    { tag_name: "v1.3.0", published_at: ago(40), assets: asset(3) },
  ];
  assert.equal(pickQuarantinedRelease(releases, 7, NOW, "guider.skill").tag_name, "v1.3.0");
});

test("download refuses a pinned tag with no publish date unless the window is off", async () => {
  const gh = mockGitHub([{ tag_name: "v9.0.0", published_at: null, assets: asset(9) }]);
  try {
    await assert.rejects(() => download({ ...SRC, tag: "v9.0.0" }, null, { quarantineDays: 7, now: NOW }), /no publish date/);
    const buf = await download({ ...SRC, tag: "v9.0.0" }, null, { quarantineDays: 0, now: NOW });
    assert.equal(buf.toString(), "ASSET9");
  } finally {
    gh.restore();
  }
});
