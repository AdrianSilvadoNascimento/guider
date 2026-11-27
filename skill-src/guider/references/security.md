# Application security

Security findings outrank every other area. A naming slip costs readability; a
missing ownership check leaks another customer's data. So in Guider:

- every security finding is severity `high` and risk `risky` — `/guider fix`
  never applies one without a yes;
- every security fix ships with a **negative test** — the attack that used to
  work, now asserted to fail;
- the check happens on the server, at the lowest layer that can enforce it
  (`data-integrity.md`'s principle, applied to attackers instead of bugs).

This doc owns authorization, injection, sessions and the attack-facing side of
concurrency. RLS, encryption and transaction mechanics are owned by
`data-integrity.md`; secret scanning by `quality-gates.md` §3. This doc points
to them and does not repeat them.

## Authorization — IDOR / BOLA

Insecure Direct Object Reference (IDOR, called BOLA in the OWASP API list) is
the most common serious API bug: the handler loads a record by the ID the client
sent and never checks that the caller may see it. Authentication proves who the
caller is; it says nothing about which rows they own.

- **Every lookup by a client-supplied ID is scoped to the caller.** Put the
  owner/tenant in the query (`WHERE id = $1 AND tenant_id = $2`), or route all
  access through one policy function (`can(user, action, resource)`). A
  separate `if (order.userId !== user.id)` after the load works, but it is the
  check most often forgotten — prefer scoping the query.
- **Fail as "not found".** Return 404, not 403, for a resource the caller can't
  see, so IDs can't be enumerated.
- **The tenant/user comes from the session, never from the body or query
  string.** A `tenantId` field in the request is input, not identity.
- **Writes too.** `PATCH /orders/:id`, `DELETE`, bulk endpoints, nested routes
  (`/projects/:p/files/:f` must check that `f` belongs to `p` *and* `p` to the
  caller), exports, file downloads, signed-URL generation, GraphQL resolvers and
  websocket/realtime channel joins (`infrastructure.md`).
- **Mass assignment.** Bind input to a DTO with an allowlist of fields; never
  spread the request body into an update (`role`, `tenantId`, `isAdmin`,
  `ownerId`, `price` are the usual victims).
- **Function-level authz.** Admin and internal routes check the role on the
  server; hiding the button is not a control.
- Where the database can enforce isolation, RLS backs this up
  (`data-integrity.md` §RLS) — defense in depth, not a replacement.

**Required test** for each resource: user B requests user A's record by ID
(read, update, delete) and gets 404, and A's record is unchanged.

## Concurrency as an attack — locks and races

`data-integrity.md` §Transactions owns *how* to close a race window. Here is
where attackers look for one, because a race they can trigger on purpose is a
vulnerability, not just a bug:

- **Check-then-act on money or quota** — balance, credits, coupon use, stock,
  rate limits, "one free trial per account". Two parallel requests both pass the
  check, both act. Close it with an atomic conditional update
  (`UPDATE … SET balance = balance - $1 WHERE id = $2 AND balance >= $1`), a
  unique constraint, or a row lock (`SELECT … FOR UPDATE`).
- **TOCTOU on files and permissions** — checking a path or a permission, then
  using it after a gap in which it can change.
- **Double submission** — payments, order placement, invitations; pair the lock
  with an idempotency key (`data-integrity.md` §Idempotency).
- **Optimistic vs. pessimistic** — a `version` column for low contention; a row
  or advisory lock when the section has external side effects. Pick the lightest
  gate that closes the window.

**Required test**: fire the operation N times in parallel
(`Promise.all`, a thread pool) and assert the invariant holds — one coupon
redemption, no negative balance.

## Injection

The rule behind every kind: **keep data and code apart.** Input is passed as a
parameter to an API that cannot interpret it as code — never concatenated into
a string that something will parse.

| Kind | Never | Instead |
|---|---|---|
| SQL | `` `SELECT … WHERE id = ${id}` ``, `$queryRawUnsafe`, `.raw(str)` with input | Parameters / ORM; raw SQL only with bind params (`$queryRaw` tagged template, `?`/`$1`) |
| NoSQL | Request objects straight into a filter (`{ email: req.body.email }` accepts `{ $ne: null }`) | Validate type/shape with a schema first; cast to string |
| OS command | `exec(\`convert ${file}\`)`, `shell=True` with input | `execFile`/`spawn` with an args array, no shell; allowlist values |
| XSS | `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `{@html}`, `|safe` with user content | Framework escaping; sanitize (DOMPurify) when HTML is a feature; a strict CSP |
| SSRF | `fetch(req.body.url)` from the server | Allowlist of hosts; block private/link-local ranges after DNS resolution; no redirects to them |
| Path traversal | `path.join(base, req.params.name)` used as-is | Resolve, then assert the result still starts with `base`; or map IDs to paths |
| Template | User input compiled as a template | Pass it as a variable to a fixed template |
| Header / log | Raw input in a header or log line | Strip CR/LF; structured logging |
| Redirect | `res.redirect(req.query.next)` | Allowlist, or relative paths only |
| Prompt (LLM features) | User or fetched text treated as instructions with tool access | Treat it as data; least-privilege tools; confirm side effects; never let the model's output pick an authz decision |

Validate input at the boundary with a schema (Zod, Pydantic, class-validator) —
that rejects the wrong *shape*. It does not replace parameterization, which
stops the wrong *meaning*.

## Authentication and sessions

Prefer a maintained provider or library over hand-rolled auth. When the project
owns it:

- Passwords: argon2id (or bcrypt/scrypt) — never a fast hash, never reversible.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`; rotate the
  session ID on login and privilege change; real logout invalidates server-side.
- CSRF protection for cookie-authenticated state-changing requests.
- Tokens: short-lived access token, verified signature *and* algorithm,
  audience and expiry; revocable refresh tokens.
- Rate-limit and lock out login, password reset, OTP and invite endpoints.
- Reset and invite links: single-use, expiring, random (not guessable IDs).
- The same error for "no such user" and "wrong password".

## Configuration and exposure

- Secrets from env or a manager, never the repo — the secret-scan gate
  (`quality-gates.md` §3) catches the commit; this rule covers the design.
- CORS: an explicit origin allowlist; never `*` together with credentials.
- Security headers: CSP, `Strict-Transport-Security`, `X-Content-Type-Options`,
  `frame-ancestors`.
- Errors to clients carry no stack traces, SQL or internal IDs.
- Debug routes, admin panels and API docs routes are off or authenticated in
  production (`api-docs.md`).

## Files, webhooks and deserialization

- Uploads: check size and type by content (not just the extension), store
  outside the web root or in object storage, serve with
  `Content-Disposition: attachment` when the type is risky, never execute.
- Webhooks: verify the provider's signature over the raw body, reject stale
  timestamps, and process idempotently (`data-integrity.md` §Idempotency).
- Never deserialize untrusted data with a format that can construct arbitrary
  objects (`pickle`, Java native serialization, YAML `load` without a safe loader).

## Logging and privacy

No passwords, tokens, full card numbers or unneeded PII in logs, traces or error
reports. Scrub them in the error/telemetry SDK config (`observability.md`), not
by hoping each call site remembers.

## What `/guider init` records

The security round of the interview fills these in, and they go into
`ARCHITECTURE.md` §Security (or `docs/SECURITY.md` once it outgrows a section):

- The authorization model — who owns what (user, tenant, org), roles, and where
  the check lives (a policy module, guards/middleware, scoped repositories, RLS).
- Which routes are public, which are authenticated, which are admin-only.
- Multi-tenancy, and whether isolation is enforced in the database.
- LLM features with tool access, if any.

The two hard rules every project's `AGENTS.md` gets: *every lookup by a
client-supplied ID is scoped to the caller*, and *input never becomes code —
queries are parameterized, commands take an args array*.

## Deeper review

Guider's audit checks these rules as part of its sweep; it is not a penetration
test. For a dedicated pass, recommend a security-review tool rather than
reimplementing one: the built-in `/security-review` per change, and a
whole-repo multi-pass auditor (such as `16-eyes`) on a schedule.
