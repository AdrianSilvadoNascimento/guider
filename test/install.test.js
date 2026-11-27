import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { installSkill, RELEASE_MARKER } from "../lib/skills/install.js";

const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

function skillZip(body) {
  const zip = new AdmZip();
  zip.addFile("guider/SKILL.md", Buffer.from(body));
  return zip.toBuffer();
}

// Serve a release list where the newest release is still in quarantine.
function mockReleases() {
  const realFetch = globalThis.fetch;
  const releases = [
    { tag_name: "v2.0.0", published_at: ago(1), assets: [{ name: "guider.skill", url: "https://api.github.com/a/2" }] },
    { tag_name: "v1.4.0", published_at: ago(20), assets: [{ name: "guider.skill", url: "https://api.github.com/a/1" }] },
  ];
  globalThis.fetch = async (url) => {
    if (url.includes("/releases?per_page=30")) return new Response(JSON.stringify(releases), { status: 200 });
    if (url.endsWith("/a/2")) return new Response(skillZip("v2"), { status: 200 });
    if (url.endsWith("/a/1")) return new Response(skillZip("v1.4"), { status: 200 });
    return new Response("", { status: 404 });
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

test("install records the release, and a quarantined update never downgrades a newer copy", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guider-install-"));
  const restore = mockReleases();
  try {
    await installSkill("guider", { dir });
    const skill = path.join(dir, "guider");
    assert.equal(JSON.parse(fs.readFileSync(path.join(skill, RELEASE_MARKER), "utf8")).tag, "v1.4.0");

    // Simulate a newer copy installed earlier with --allow-fresh.
    fs.writeFileSync(path.join(skill, "SKILL.md"), "v2");
    fs.writeFileSync(path.join(skill, RELEASE_MARKER), JSON.stringify({ tag: "v2.0.0" }));
    await installSkill("guider", { dir });
    assert.equal(fs.readFileSync(path.join(skill, "SKILL.md"), "utf8"), "v2");
  } finally {
    restore();
  }
});
