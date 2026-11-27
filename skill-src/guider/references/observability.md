# Observability

A system you can't see fails twice: once when it breaks, and again while you
work out what broke. Guider's default is a small, standard setup — errors,
product events, traces and structured logs — wired once and then kept honest by
the audit. As with `infrastructure.md`: recommend a managed service with a
generous free tier, don't hand-roll one, and record whatever the project already
uses. Free-tier limits change; link the pricing page in the project docs.

## The four signals

| Signal | Answers | Default recommendation | Alternatives |
|---|---|---|---|
| **Errors** | What broke, for whom, with which stack and release | Sentry | Rollbar, Bugsnag, Highlight, Honeybadger |
| **Product analytics** | What users do; funnels, retention, feature adoption | PostHog (also session replay and feature flags) | Amplitude, Mixpanel, Plausible (privacy-first web analytics) |
| **Traces & metrics** | Where time goes across services, DB and external calls | OpenTelemetry SDK → any OTLP backend (Grafana Cloud, Honeycomb, Sentry, Datadog) | Vendor agents (lock-in) |
| **Logs** | What happened, in order, with context | Structured JSON logs (pino, structlog, zap…) shipped to the same backend | Plain `console.log` (not acceptable in services) |

Start with errors and structured logs — they pay off on day one. Add analytics
when product decisions need data, and tracing when there is more than one
service or a latency problem nobody can locate.

## Rules

- **Instrument once, centrally.** SDK initialization lives in one module per
  runtime (server, client, worker), loaded first. No ad-hoc `Sentry.init` in
  feature code.
- **Errors are reported, not swallowed.** A `catch` either handles the error,
  rethrows, or reports it with context (`conventions.md` §Error handling). The
  framework's global error boundary/handler reports everything that escapes.
- **Release and environment on every event.** Tag events with the release (git
  SHA or version) and environment, and upload source maps in the build, so a
  stack trace points at real code.
- **Correlate.** One request/trace ID flows through logs, errors and traces, and
  into background jobs (`infrastructure.md`).
- **Structured logs.** Key-value fields, a level, a message that doesn't
  interpolate data into text. Log events, not variable dumps.
- **Privacy by configuration.** Scrub passwords, tokens, auth headers, cookies
  and unneeded PII in the SDK's `beforeSend`/processor and in the logger's
  redaction list — not by trusting each call site (`security.md` §Logging).
  Mask inputs in session replay. Respect consent where the law requires it
  (analytics and replay are usually consent-gated in the EU/UK/Brazil).
- **Keys from env.** DSNs and project keys come from environment variables; the
  public (browser) key is the only one that may ship to the client.
- **Event names are constants.** Analytics event names and property keys live in
  one module (`conventions.md` §Enums) — a typo'd event name is a silent hole in
  a funnel.
- **Health and alerts.** A `/health` (liveness) and, where useful, `/ready`
  (dependencies) endpoint; an uptime check on the public URL; an alert on error
  rate and on failed background jobs. An alert nobody receives is not an alert —
  route it to a channel someone watches.
- **Sample deliberately.** Keep 100% of errors; sample traces and replays to a
  rate the free tier and the budget allow, and write the rate down.

## Setup sketch

```bash
# Errors — the wizard detects the framework and wires source maps
npx @sentry/wizard@latest -i <framework>     # nextjs, sveltekit, remix, …
# Product analytics
npm install posthog-js posthog-node          # or the framework integration
# Traces
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

Propose these commands; don't run them during `init` (`quality-gates.md`), and
pin versions that satisfy the release quarantine (`supply-chain.md`).

## What `/guider init` records

In `ARCHITECTURE.md` §Observability: the tool per signal (or "none yet"), where
each SDK is initialized, the scrubbing/redaction config, sample rates, the
health endpoints, and where alerts go.

## What `/guider audit` checks

- No error reporting in a deployed service, or SDK initialized in more than one
  place — `medium`.
- A `catch` that neither handles, rethrows nor reports — already in
  `conventions.md`; here, also an unhandled-rejection/global handler missing.
- No scrubbing config while user data flows through events or logs — `high`
  (it's a privacy leak, `security.md`).
- Analytics event names as scattered string literals — `low`, `safe`.
- No release tag / source maps, so production stack traces are unreadable — `low`.
- Background jobs whose failures alert no one — `medium`.
