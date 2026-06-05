# Data integrity & concurrency

Integrity bugs are the worst kind: they're silent, they corrupt state that
other features trust, and they often surface only under load or attack. The
governing principle: **enforce each guarantee at the lowest layer that can
enforce it.** A rule in the database holds even when application code is buggy,
bypassed, or replaced; a rule in application code only holds while that exact
code runs.

```
strongest ▲  database constraints / RLS / transactions
          │  application invariants / idempotency / typed errors
weakest   ▼  "we'll remember to check it" in a code comment
```

## Row-Level Security (RLS) & multi-tenancy

If rows belong to tenants/users and isolation matters, enforce it in the
database, not only in `WHERE` clauses the application has to remember.

- Enable RLS on tenant-scoped tables and write policies keyed to the current
  tenant/user (e.g. a session variable or the connection's role).
- The app sets the tenant context per request; the DB enforces it. A forgotten
  filter then fails closed (no rows) instead of leaking another tenant's data.
- Keep policies in migrations and version them; treat a policy change like a
  schema change. Test that cross-tenant reads return nothing.

## Encryption

- **In transit** — TLS everywhere, including service-to-service and DB
  connections.
- **At rest** — disk/volume encryption as a baseline; column-level encryption
  for genuinely sensitive fields (PII, tokens, secrets) using a managed key
  (KMS/Vault), never a hard-coded key.
- Don't log decrypted sensitive values. Redact in logs and error payloads.
- Hash, don't encrypt, anything you only need to verify (passwords → a slow
  password hash; never reversible).

## Transactions — the gate against concurrent writes

Any operation that writes more than one row, or reads-then-writes, can be
corrupted by a concurrent operation. Wrap it in a transaction so it's atomic:
all of it happens or none of it does.

```
withTransaction(async (tx) => {
  const current = await repo.find(id, tx);   // read
  assertInvariant(current);                  // check
  await repo.update(id, next, tx);           // write — atomic with the read
});
```

For read-modify-write races specifically, choose the right gate:

- **Atomic DB operation** — push the logic into one statement
  (`UPDATE … SET n = n + 1`, upsert, conditional update) so there's no window.
- **Optimistic concurrency** — a `version` column; the update asserts the
  version it read and retries on conflict. Best for low contention.
- **Pessimistic / advisory locks** — `SELECT … FOR UPDATE` or an advisory lock
  when you must serialize a section. Best for high contention or external side
  effects.

Pick the lightest gate that closes the window; don't reach for a lock when an
atomic statement will do (prime directive: simplicity).

## Idempotency — the gate against duplicate execution

Anything that can be retried — a webhook, a client that double-submits, a job
that re-runs — will eventually run twice. This is also the load-bearing rule
for background workers (`infrastructure.md`): a queue that retries on failure
*will* redeliver, so the task must be safe to run twice. Critical operations
(uploads, payments, OCR/generation, anything with side effects or cost) must be
safe to run twice.

- Accept or derive an **idempotency key** per logical operation.
- On first run, record the key with its result and a **TTL**; on a repeat,
  return the stored result instead of re-executing.
- A small wrapper makes this uniform:
  `idempotency.wrap(key, fn, { ttlSeconds })`.
- Combine with a transaction when the operation also writes: record the key and
  the effect atomically, so a crash can't leave the key set but the work undone
  (or vice versa).

## External calls — retries & caching

- **Retry with exponential backoff** (and jitter) on transient failures from
  external APIs; cap attempts; never retry a non-idempotent call without an
  idempotency key.
- **Cache always with a TTL.** A cache entry with no expiry is a future
  stale-data bug. Pick a TTL deliberately and document why. For the full
  cache-aside pattern and the recommended managed cache (Upstash Redis), see
  `infrastructure.md`.
- Make external clients **fail typed**, not silent — a swallowed timeout
  becomes a mystery later.

## What `/guider init` records

For each of the above, `init` writes the project's actual decisions into
`ARCHITECTURE.md`: which tables have RLS, what's encrypted and with which key
source, which operations are transactional, which are idempotent and where the
keys come from, and the retry/cache policy for each external integration. The
point is that the next person — or the next Claude — can see the guarantees
without reverse-engineering them from the code.
