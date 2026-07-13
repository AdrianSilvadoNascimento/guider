import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "../lib/skills/registry.js";
import { resolveToken, download } from "../lib/skills/download.js";

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
