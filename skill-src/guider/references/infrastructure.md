# Runtime infrastructure (recommended managed services)

Three runtime concerns come up in almost every app once it leaves toy scale: a
**cache** in front of slow or expensive reads, a **worker** to run slow or
retry-prone work outside the request path, and a **realtime channel** to push
live updates to clients without them polling. Each has a characteristic failure
mode when done badly — a cache quietly serves stale data, a worker silently
runs twice, a realtime layer gets treated as a database it isn't — so all three
lean on the idempotency, TTL, and "server is the source of truth" rules in
`data-integrity.md`.

Guider's stance, as with Impeccable for frontend: don't hand-roll
infrastructure that a managed service does well with a generous free tier.
Recommend a strong default, but record whatever the project actually uses.
Free-tier numbers below are current at the time of writing — link the pricing
page in the project docs rather than treating any figure as permanent.

## Caching — the cache-aside pattern

Cache-aside (lazy loading) keeps the cache out of the write path, so a cache
outage degrades latency, not correctness:

```
read(key):
  hit  = cache.get(key)            # 1. ask the cache
  if hit: return hit               #    fast path
  value = source.load(key)         # 2. miss → load from the source of truth
  cache.set(key, value, ttl)       # 3. populate with a deliberate TTL
  return value

write(key, value):
  source.save(key, value)          # 1. write the source of truth first
  cache.delete(key)                # 2. invalidate (don't try to update in place)
```

Non-negotiables:

- **TTL always.** A cache entry with no expiry is a future stale-data bug. Pick
  the TTL deliberately and write down why in `ARCHITECTURE.md`.
- **Invalidate on write, don't update in place.** Deleting the key and letting
  the next read repopulate avoids a whole class of write-ordering races. If you
  must update in place, you're back in concurrency territory — use the gates in
  `data-integrity.md`.
- **Fail open for caches, not for correctness.** If the cache is unreachable,
  fall back to the source (and treat the cache client as an optional dependency
  per `conventions.md`). Never let a cache miss corrupt data.
- **Cache only what's worth it** — expensive reads, hot keys, derived data.
  Caching everything is its own kind of complexity (prime directive).

### Recommended: Upstash Redis

A serverless Redis with a genuinely generous free tier (≈256 MB storage and
~500K commands/month at the time of writing; check the current pricing page).
Why it fits Guider's bias toward simple, cheap, scales-to-zero infrastructure:

- **Two access modes.** Standard Redis protocol (RESP over TCP) for
  long-running servers/containers, **and** a REST/HTTP API for serverless and
  edge runtimes (Vercel, Cloudflare Workers) where you can't hold a TCP
  connection. Same database, pick per deployment target.
- **Scales to zero**, pay-per-request beyond the free tier — no idle instance
  cost for low-traffic projects.
- Drops straight into the cache-aside helper; also a natural home for rate
  limiters, sessions, and idempotency keys (see below).

Config note (echoing `conventions.md`): inject the Redis/Upstash client as an
**optional, nullable** dependency so the app still boots and serves when it's
absent. Source the URL/token from a secret manager, never the repo. Pricing and
docs: https://upstash.com

Upstash is the default recommendation, not a mandate — Redis (self-hosted),
Memcached, or an in-memory cache for a single instance are all fine if the
project already has one. Record the choice in `ARCHITECTURE.md`.

## Background workers — move slow/retry-prone work off the request path

Anything slow (OCR, video/image processing, report generation, large imports),
anything that calls a flaky external API, and anything triggered by a webhook
belongs in a worker, not in the HTTP handler. Two reasons: the request returns
fast, and the work gets a real retry/observability story instead of dying with
the request.

Worker rules:

- **Workers retry, so tasks must be idempotent.** This is the direct link to
  `data-integrity.md`: a task that runs twice (retry, redelivery, at-least-once
  queue) must produce the same result. Use an idempotency key, ideally stored
  in the same Redis you cache with.
- **Retry with exponential backoff + jitter**, capped attempts, and a
  dead-letter path for what never succeeds.
- **Make progress observable** — structured logs and run status, so a stuck job
  is visible, not a mystery.
- **Bound concurrency** so a burst of jobs can't exhaust a downstream API or
  the database connection pool.

### Recommended: Trigger.dev

A code-first background-jobs and workflow platform for TypeScript that fits the
"easy to install, generous free tier" bar:

- **No execution timeouts.** Tasks run in containers for as long as they need
  (seconds to hours), which sidesteps the hard timeout limits of serverless
  functions (Lambda, Vercel Functions) — the usual reason long jobs are painful
  to run there.
- **Batteries included:** automatic retries with configurable backoff, queues
  and concurrency control, scheduling, and built-in observability/logging — the
  worker rules above, provided rather than hand-built.
- **Generous free tier** (compute-credit based; see the pricing page) **and
  Apache-2.0 self-hostable** for unlimited runs if you'd rather own the
  infrastructure — so the recommendation never traps the project.
- Jobs are plain async TypeScript defined in code and version-controlled with
  the app, which suits the "workflows as code" and DI conventions here.

Install/docs: https://trigger.dev — start with the managed cloud free tier; the
self-hosted Docker option is the escape hatch.

As with caching, this is a default, not a mandate. A project already on BullMQ
(Redis-backed), a cloud queue (SQS, Cloud Tasks, QStash), Inngest, or a durable
workflow engine should keep it; record the choice and its retry/idempotency
policy in `ARCHITECTURE.md`.

## Realtime — pushing live updates to clients

When clients need to see changes as they happen — notifications, presence, a
live dashboard, collaborative state, "your upload finished" — push the update
over a realtime channel instead of making the client poll. The trap is treating
the realtime layer as more than a transport.

Realtime rules:

- **The server is the source of truth; realtime is a notification, not the
  data.** A pushed event says "something changed," and the client reconciles
  against the authoritative source. Never let client state become canonical
  because it arrived over a socket.
- **Design for missed messages.** Most hosted realtime is best-effort with no
  full replay — a client that was offline missed the event. On reconnect, the
  client must be able to fetch current state and catch up. Don't assume every
  subscriber received every message.
- **Channel and event names are not magic strings.** They're exactly the
  string literals the enum rule in `conventions.md` bans — define them as
  constants/enums in one place so a typo can't silently break a subscription.
- **Authorize on the server.** Private and presence channels are authenticated
  by your backend signing the subscription; the client never holds the secret.
  Source keys from the manager, never the repo (per `conventions.md`).
- **Keep payloads minimal and non-sensitive.** Prefer pushing an id plus
  "changed" and letting the client fetch, over broadcasting a full entity —
  realtime payloads cross to clients, so don't put PII or anything RLS protects
  on a channel.
- **Publish from the right place.** A long job (see workers above) publishes a
  completion event when it finishes; the HTTP handler returned long ago. This
  is the natural workers → realtime handoff.

### Recommended: Pusher Channels

Hosted WebSocket pub/sub that fits the "easy to add, generous free tier" bar
and matches this project family's existing use of Pusher/WebSocket handlers:

- **Simple pub/sub API** with the broadest SDK coverage (web, mobile, 15+
  languages), so adding realtime is a few lines rather than running socket
  infrastructure.
- **Free Sandbox plan** (not a trial — usable indefinitely for non-production):
  roughly 100 concurrent connections and 200K messages/day at the time of
  writing; check the current pricing page. A "message" counts both inbound and
  each delivery, so one publish to 50 subscribers is ~51 messages — size the
  plan against fan-out, not just publish rate.
- Private/presence channels with server-side auth, and naturally pairs with the
  worker recommendation above (publish job results to a channel).

Caveat worth recording: Pusher is a transport, not storage — it has no full
message history/replay, so the "design for missed messages" rule above is
load-bearing. Docs: https://pusher.com

As with the others, this is a default, not a mandate. **Ably** offers stronger
delivery guarantees and message replay; **Supabase Realtime** is free and
already integrated if the project is on Supabase and mainly needs database
change events; self-hosted **Socket.io** trades a managed service for full
control. Record the choice in `ARCHITECTURE.md`.
