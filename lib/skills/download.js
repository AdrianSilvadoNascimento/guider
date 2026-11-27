// Resolve a GitHub token from the flag or the usual env vars.
export function resolveToken(optToken) {
  return (
    optToken ||
    process.env.GUIDER_GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    null
  );
}

function authHeaders(token, accept) {
  const headers = { Accept: accept, "User-Agent": "guider-cli" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isGitHubHost(urlString) {
  try {
    return /(^|\.)github\.com$/.test(new URL(urlString).hostname);
  } catch {
    return false;
  }
}

// Release quarantine: a freshly published release is not trusted until it has
// been public for a while, so a compromised or broken publish is usually caught
// and pulled before it reaches anyone. 7 days by default; 1 day is the floor
// unless the caller explicitly opts out with --allow-fresh.
export const DEFAULT_QUARANTINE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Turn the CLI flags / env into a number of days. --allow-fresh disables it.
export function resolveQuarantineDays({ quarantineDays, allowFresh } = {}, env = process.env) {
  if (allowFresh) return 0;
  const raw = quarantineDays ?? (env.GUIDER_QUARANTINE_DAYS || undefined) ?? DEFAULT_QUARANTINE_DAYS;
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`Invalid quarantine "${raw}" — expected a number of days.`);
  }
  if (days < 1) {
    throw new Error(`Quarantine of ${raw} day(s) is below the 1-day floor. Pass --allow-fresh to skip it.`);
  }
  return days;
}

function ageDays(release, now) {
  return (now - Date.parse(release.published_at)) / DAY_MS;
}

// Pick the newest stable release that has cleared the quarantine window.
export function pickQuarantinedRelease(releases, days, now = Date.now()) {
  return releases
    .filter((r) => !r.draft && !r.prerelease && r.published_at && ageDays(r, now) >= days)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
}

async function fetchReleaseJson(url, repo, ref, token) {
  const res = await fetch(url, { headers: authHeaders(token, "application/vnd.github+json") });
  if (res.status === 404) {
    throw new Error(
      `Release not found for ${repo} (${ref}). If the repo is private, provide a token ` +
      `via --token or $GITHUB_TOKEN / $GH_TOKEN.`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`HTTP ${res.status} — token rejected reading ${repo}. Needs read access to repo contents.`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} — could not read release metadata for ${repo}.`);
  return res.json();
}

// Resolve which release to install, honouring the quarantine window.
async function resolveRelease({ repo, tag }, token, days, now) {
  const api = `https://api.github.com/repos/${repo}/releases`;

  if (tag) {
    const release = await fetchReleaseJson(`${api}/tags/${encodeURIComponent(tag)}`, repo, `tags/${tag}`, token);
    if (days > 0 && release.published_at && ageDays(release, now) < days) {
      const hours = Math.max(0, Math.floor((now - Date.parse(release.published_at)) / 3600000));
      const age = hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)} days`;
      throw new Error(
        `Release ${release.tag_name ?? tag} was published ${age} ago, inside the ${days}-day quarantine. ` +
        `Wait, lower --quarantine-days (minimum 1), or pass --allow-fresh.`,
      );
    }
    return release;
  }

  if (days === 0) return fetchReleaseJson(`${api}/latest`, repo, "latest", token);

  const releases = await fetchReleaseJson(`${api}?per_page=30`, repo, "list", token);
  const release = pickQuarantinedRelease(Array.isArray(releases) ? releases : [], days, now);
  if (!release) {
    throw new Error(
      `No stable release of ${repo} has been public for ${days} day(s) yet. ` +
      `Wait, lower --quarantine-days (minimum 1), or pass --allow-fresh.`,
    );
  }
  return release;
}

// Download a skill archive described by registry.resolve(), returning a Buffer.
// Private repos are reached through the GitHub API so a token unlocks them.
// `quarantineDays` (already resolved) gates GitHub releases; a --url has no
// publish date, so the caller warns instead.
export async function download(source, token, { quarantineDays = DEFAULT_QUARANTINE_DAYS, now = Date.now() } = {}) {
  if (source.kind === "url") {
    // Only forward the token to GitHub hosts so we never leak it elsewhere.
    const headers = authHeaders(isGitHubHost(source.url) ? token : null, "application/octet-stream");
    const res = await fetch(source.url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} — could not download from ${source.url}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // GitHub release: pick the release via the API, then pull the asset by id.
  const { asset, tag } = source;
  const release = await resolveRelease(source, token, quarantineDays, now);
  const match = (release.assets || []).find((a) => a.name === asset);
  if (!match) {
    throw new Error(`Release ${release.tag_name ?? tag ?? "latest"} has no asset named "${asset}".`);
  }

  // The asset API url 302-redirects to storage; fetch follows it and drops the
  // Authorization header on the cross-origin hop (so storage doesn't reject it).
  const assetRes = await fetch(match.url, { headers: authHeaders(token, "application/octet-stream") });
  if (!assetRes.ok) throw new Error(`HTTP ${assetRes.status} — could not download asset "${asset}".`);
  return Buffer.from(await assetRes.arrayBuffer());
}
