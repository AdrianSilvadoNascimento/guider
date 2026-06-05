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

// Download a skill archive described by registry.resolve(), returning a Buffer.
// Private repos are reached through the GitHub API so a token unlocks them.
export async function download(source, token) {
  if (source.kind === "url") {
    // Only forward the token to GitHub hosts so we never leak it elsewhere.
    const headers = authHeaders(isGitHubHost(source.url) ? token : null, "application/octet-stream");
    const res = await fetch(source.url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} — could not download from ${source.url}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // GitHub release: look up the release via the API, then pull the asset by id.
  const { repo, asset, tag } = source;
  const ref = tag ? `tags/${encodeURIComponent(tag)}` : "latest";
  const relUrl = `https://api.github.com/repos/${repo}/releases/${ref}`;

  const relRes = await fetch(relUrl, { headers: authHeaders(token, "application/vnd.github+json") });
  if (relRes.status === 404) {
    throw new Error(
      `Release not found for ${repo} (${ref}). If the repo is private, provide a token ` +
      `via --token or $GITHUB_TOKEN / $GH_TOKEN.`,
    );
  }
  if (relRes.status === 401 || relRes.status === 403) {
    throw new Error(`HTTP ${relRes.status} — token rejected reading ${repo}. Needs read access to repo contents.`);
  }
  if (!relRes.ok) throw new Error(`HTTP ${relRes.status} — could not read release metadata for ${repo}.`);

  const release = await relRes.json();
  const match = (release.assets || []).find((a) => a.name === asset);
  if (!match) {
    throw new Error(`Release ${release.tag_name ?? ref} has no asset named "${asset}".`);
  }

  // The asset API url 302-redirects to storage; fetch follows it and drops the
  // Authorization header on the cross-origin hop (so storage doesn't reject it).
  const assetRes = await fetch(match.url, { headers: authHeaders(token, "application/octet-stream") });
  if (!assetRes.ok) throw new Error(`HTTP ${assetRes.status} — could not download asset "${asset}".`);
  return Buffer.from(await assetRes.arrayBuffer());
}
