import fs from "fs";
import os from "os";
import path from "path";
import chalk from "chalk";
import { DEFAULT_QUARANTINE_DAYS, resolveQuarantineDays } from "./skills/download.js";

// A best-effort "a newer version is on npm" nudge. It never blocks the command:
// the notice is printed from a local cache (no network), and the cache is
// refreshed at most once a day with a short, swallow-all-errors fetch. Set
// NO_UPDATE_NOTIFIER or CI to turn it off entirely. Like skill installs, it
// only suggests a version that has cleared the release quarantine.

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day
const FETCH_TIMEOUT_MS = 1500;
const REGISTRY = "https://registry.npmjs.org";
const DEFAULT_CACHE = path.join(os.tmpdir(), "guider-update-check.json");
const DAY_MS = 24 * 60 * 60 * 1000;

function quarantineDays() {
  try {
    return resolveQuarantineDays();
  } catch {
    return DEFAULT_QUARANTINE_DAYS;
  }
}

function disabled() {
  return Boolean(process.env.NO_UPDATE_NOTIFIER || process.env.CI);
}

function readCache(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// Compare dotted numeric versions; true when `a` is newer than `b`. Prerelease
// suffixes are stripped — good enough for a simple update nudge.
export function isNewer(a, b) {
  const parse = (v) => String(v).split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((av[i] ?? 0) !== (bv[i] ?? 0)) return (av[i] ?? 0) > (bv[i] ?? 0);
  }
  return false;
}

// The newest stable version published at least `days` ago, never past the
// `latest` dist-tag. Without a `time` map, fall back to `latest`.
export function latestAged(doc, days, now = Date.now()) {
  const latest = doc?.["dist-tags"]?.latest;
  const time = doc?.time;
  if (!time || days === 0) return latest;
  let best;
  for (const [version, published] of Object.entries(time)) {
    if (version === "created" || version === "modified" || version.includes("-")) continue;
    // `time` keeps unpublished versions; never suggest one that's gone or deprecated.
    if (doc.versions && (!doc.versions[version] || doc.versions[version].deprecated)) continue;
    if (now - Date.parse(published) < days * DAY_MS) continue;
    if (latest && isNewer(version, latest)) continue;
    if (!best || isNewer(version, best)) best = version;
  }
  return best;
}

// Print the nudge if the cache already knows of a newer version. Instant — no
// network. Writes to stderr so stdout stays clean for piping.
export function notifyFromCache(pkg, { cacheFile = DEFAULT_CACHE, out = process.stderr } = {}) {
  if (disabled()) return;
  const cache = readCache(cacheFile);
  if (!cache?.latest || !isNewer(cache.latest, pkg.version)) return;

  const cmd = `npm i -g ${pkg.name}@${cache.latest}`;
  out.write(
    "\n" +
    chalk.yellow(`Update available: ${chalk.dim(pkg.version)} → ${chalk.green(cache.latest)}`) + "\n" +
    chalk.dim(`Run ${chalk.cyan(cmd)} to update the CLI.`) + "\n\n",
  );
}

// Refresh the cached "latest" from npm, bounded so it never hangs. Best-effort:
// offline, slow, or error → silently try again next run. Meant to run at the end
// of a command; the fetched version shows on the *next* invocation.
export async function refreshCache(pkg, { cacheFile = DEFAULT_CACHE, fetchImpl = fetch } = {}) {
  if (disabled()) return;
  const cache = readCache(cacheFile);
  if (cache && Date.now() - (cache.lastCheck ?? 0) < CHECK_INTERVAL_MS) return;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let latest;
    let fetched = false;
    try {
      const res = await fetchImpl(`${REGISTRY}/${pkg.name.replace("/", "%2F")}`, {
        // The full document carries the per-version publish `time` map.
        headers: { Accept: "application/json", "User-Agent": "guider-cli" },
        signal: ctrl.signal,
      });
      if (res.ok) {
        latest = latestAged(await res.json(), quarantineDays());
        fetched = true;
      }
    } finally {
      clearTimeout(timer);
    }
    if (fetched) {
      // Record the check even when nothing has cleared the quarantine yet, so
      // the registry is hit once a day, not on every command.
      fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: Date.now(), latest: latest ?? null }));
    }
  } catch {
    // offline / slow / aborted / unwritable cache — ignore and retry next run.
  }
}
