# SEO and discoverability

Only for a frontend with public pages meant to be found — a marketing site, docs,
a store, public profiles. An app behind a login doesn't need this; skip the whole
doc there, except `robots` rules that keep private routes out of indexes.

The principle: **search engines and link previews read what the server sends.**
Content, titles and metadata must be in the HTML response (server-rendered or
pre-rendered), not assembled later by client JavaScript.

## Rules

- **Rendering.** Public pages are SSR, SSG or pre-rendered. A client-only SPA
  route is invisible to many crawlers and to every link-preview bot.
- **One source for metadata.** Use the framework's metadata API (Next.js
  `metadata`/`generateMetadata`, Nuxt `useSeoMeta`, SvelteKit `<svelte:head>`,
  Astro layouts) through one helper with site-wide defaults; pages override only
  what differs.
- **Every indexable page has**: a unique `<title>` (~60 chars) and
  `meta description` (~155 chars), a canonical URL, `lang` on `<html>`, one `h1`,
  and Open Graph + Twitter card tags with an absolute image URL (1200×630).
- **Crawl control.** `robots.txt` and a generated `sitemap.xml` (from the routes
  or the CMS, never hand-maintained); `noindex` on search results, filters,
  staging, previews and authenticated areas. Staging must never be indexable.
- **Structured data.** JSON-LD for the page type (Organization, Product, Article,
  BreadcrumbList, FAQ) generated from the same data the page renders — never a
  hand-written copy that drifts.
- **URLs.** Stable, lowercase, hyphenated, no session IDs; old URLs 301 to new
  ones; one canonical host (www or apex, https).
- **Performance is ranking.** Core Web Vitals (LCP, INP, CLS) at "good" —
  image sizing and modern formats, font loading, no layout shift. Modern Web
  Guidance covers the techniques (`frontend-tooling.md`).
- **Accessibility overlaps.** Alt text, semantic headings and link text help
  both screen readers and crawlers.
- **i18n.** Localized pages declare `hreflang` alternates, each with its own
  canonical.

## Gate

Lighthouse CI on the main public routes, with budgets that fail the build:

```bash
npm install -D @lhci/cli
npx lhci autorun --collect.url=http://localhost:3000/ --assert.preset=lighthouse:recommended
```

Start with `seo` and `accessibility` categories at ≥ 0.9 as errors and
`performance` as a warning; tighten once green. Propose the install; don't run
it during `init`.

## What `/guider init` records

Which routes are public and indexable, the metadata helper's location, the
sitemap/robots source, the canonical host, and the Lighthouse budget — in
`ARCHITECTURE.md` (a `docs/SEO.md` only if it outgrows a section).

## What `/guider audit` checks

- Public routes rendered client-only, or with no title/description/canonical —
  `medium`.
- Missing or hand-maintained `sitemap.xml`; no `robots.txt`; staging or preview
  deployments indexable — `medium` (indexable staging is `high` if it exposes
  data).
- Duplicate titles/descriptions across routes; OG image missing or relative — `low`.
- JSON-LD written by hand beside the data it describes — `low`.
- No Lighthouse/CWV gate on a public site — `low`.
