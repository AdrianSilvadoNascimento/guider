import fs from "fs";
import os from "os";
import path from "path";
import chalk from "chalk";

// A best-effort "a newer version is on npm" nudge. It never blocks the command:
// the notice is printed from a local cache (no network), and the cache is
// refreshed at most once a day with a short, swallow-all-errors fetch. Set
// NO_UPDATE_NOTIFIER or CI to turn it off entirely.

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day
const FETCH_TIMEOUT_MS = 1500;
const REGISTRY = "https://registry.npmjs.org";
const DEFAULT_CACHE = path.join(os.tmpdir(), "guider-update-check.json");

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

// Print the nudge if the cache already knows of a newer version. Instant — no
// network. Writes to stderr so stdout stays clean for piping.
export function notifyFromCache(pkg, { cacheFile = DEFAULT_CACHE, out = process.stderr } = {}) {
  if (disabled()) return;
  const cache = readCache(cacheFile);
  if (!cache?.latest || !isNewer(cache.latest, pkg.version)) return;

  const cmd = `npm i -g ${pkg.name}@latest`;
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
    try {
      const res = await fetchImpl(`${REGISTRY}/${pkg.name.replace("/", "%2F")}`, {
        headers: { Accept: "application/vnd.npm.install-v1+json", "User-Agent": "guider-cli" },
        signal: ctrl.signal,
      });
      if (res.ok) latest = (await res.json())?.["dist-tags"]?.latest;
    } finally {
      clearTimeout(timer);
    }
    if (latest) {
      fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: Date.now(), latest }));
    }
  } catch {
    // offline / slow / aborted / unwritable cache — ignore and retry next run.
  }
}
