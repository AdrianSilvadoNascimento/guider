# Code conventions

These are stack-agnostic defaults. `/guider init` adapts them to the project
and writes the project-specific version into `CLAUDE.md` / `ARCHITECTURE.md`.
The concrete example at the end shows one full instantiation.

## Naming — descriptive always

Cryptic names are a tax paid on every future read. The cost of a longer name is
one-time; the cost of decoding `d` is paid forever.

- No single-letter or cryptic abbreviations. `error` not `err`, `response` not
  `res`, `document` not `doc`, `accumulator` not `acc`, `previous` not `prev`.
- In `map`/`filter`/`find`/`forEach`/`reduce` and their equivalents, use the
  **singular** of the collection: `files.map(file => …)`, not `files.map(f => …)`.
- Same for callback params and locals everywhere, including socket/event
  handlers: `(data) => …` is fine, `(d) => …` is not.
- Treat a cryptic name in code you're already touching as a **fix, not a
  nitpick** — rename it within the scope of your change. Leave names in
  untouched code alone (surgical changes).

## Enums over string literals — never compare against raw strings

A bare string literal in a conditional is an undeclared enum with no compiler
help, no autocomplete, and no single place to find all the values. It is the
single most common source of "works until someone typos `'aproved'`" bugs.

- Branch on and compare against a **domain enum or named constant**, never a
  string literal. `status === DealStatus.Approved`, not `status === 'approved'`.
- Keep the set of valid values in one place so the type system enumerates them.
- **Never show a raw enum key to a user.** `COMUNHAO_PARCIAL` or `90_DIAS` is a
  database value, not UI copy. Translate through a single label map (e.g. a
  `translateEnumValue()` helper); new values get added to that map, not
  hard-coded at the call site.
- A workflow whose enum values move in a defined order (draft → submitted →
  approved) is a **state machine** — document the transitions in
  `ARCHITECTURE.md` rather than scattering status checks. See
  `architecture.md`.

## Responsibility separation & layering

Each unit should have one reason to change. The practical rules:

- **Never reach past the data-access layer.** Services/use-cases talk to a
  repository abstraction; they never touch the ORM/query builder/SQL directly.
  This keeps the data layer swappable and the business logic testable.
- **Abstract + implementation** for repositories: an interface the domain
  depends on, a concrete class that knows the ORM.
- **Dependency injection, not manual construction.** Inject collaborators;
  don't `new` a service inside another service. It makes wiring explicit and
  tests trivial.
- **Thin edges.** Controllers/route handlers and frontend pages are thin
  wrappers; logic lives in services and feature modules, not in the transport
  layer.
- **Optional dependencies degrade gracefully.** If a cache/queue is optional,
  the code must run with it absent (inject it as nullable, guard its use).

## DTO boundaries — never leak persistence types

The shape you store is not the shape you expose. Coupling them means every
schema change is an API change.

- Validate **input** with a schema/validator at the boundary.
- Map persistence entities to **response DTOs**; never return an ORM entity
  straight to a client.
- For types shared between backend and frontend, keep **one source of truth**
  (a shared package with a schema + inferred type). Validate output against it
  before returning; type the consumer from it. Never duplicate the interface in
  two places.

## Error handling & typing

- **Never swallow an error.** Log it with context and either propagate it or
  return a typed failure. A silent `catch {}` hides the next outage.
- Avoid unnecessary escape hatches in the type system (`any`, untyped `dict`,
  `interface{}`). If you reach for one, leave a comment saying why.
- External calls get **retry with exponential backoff**; caches always carry a
  **TTL** (see `data-integrity.md`).

## Logging

Use the project's structured logger with a consistent context marker so logs
are greppable. Emoji or tags as context prefixes (`✅` success, `❌` failure,
`⚠️` warning, `🔄` retry) are fine if the project adopts them consistently —
the point is consistency, not the specific glyph.

## DRY — and its limits

Remove duplication that represents a single decision expressed twice; when one
copy changes, the other should too. But do **not** abstract across code that
merely looks similar today and may diverge tomorrow — a premature abstraction
is harder to undo than a little duplication. Simplicity (the prime directive)
outranks DRY: two clear copies beat one contorted helper.

## Line length

Pick one limit and let the **formatter** enforce it so it never becomes a
review topic. Common choices: 80, 88 (Python/Ruff), 100, 120. `init` records
the project's number; the linter, not humans, is the enforcer.

---

## Concrete example — a TypeScript monorepo (NestJS + Prisma + Next.js)

This is one instantiation of the principles above, kept as a reference for how
specific a project's own conventions can get. Use it as a model for the level
of detail `init` should capture, not as a default to impose. (Reproduced in the
user's words; adapt freely.)

### Global (api, web, packages)

Descriptive names always; in `.map`/`.filter`/`.find`/`.forEach`/`.reduce` use
the singular (`files.map(file => …)`). `(err, res)` → `(error, response)`,
`doc` → `document`, `acc` → `accumulator`, `prev` → `previous`. Applies to
Pusher/WebSocket handlers too. A violation is a **bug** — rename occurrences in
the scope of the change.

### Backend (`apps/api`)

New module layout (legacy modules use `models/dto/`; migrate gradually):

```
src/domain/{name}/
  {name}.module.ts
  controllers/{name}.controller.ts
  services/{name}.service.ts
  dto/  create-{name}.dto.ts (input, class-validator) · {name}-response.dto.ts (output, never Prisma)
  repositories/  abstract/{name}.repository.abstract.ts · repo/{name}.repository.ts
```

Cross-cutting infra in `src/common/` (e.g. `idempotency.service.ts`).
Internal domain types via `Prisma.XGetPayload<{}>` (no `entity/` folder).

- Repository Abstract + Implementation — **never** touch Prisma directly in a
  service.
- DI via `@Inject()` — never `new` in a service.
- Redis always `@Optional()` so the app runs without it.
- Logs via `Logger` + a context emoji.
- `class-validator` on input; never expose a Prisma entity — map to a response
  DTO.
- Idempotency on critical operations (upload, OCR, generation):
  `IdempotencyService.wrap(key, fn, { ttlSeconds })`.
- Concurrent writes → `prisma.$transaction(async (tx) => { … })`.
- No unnecessary `any`; never swallow an error; retry-with-backoff for external
  APIs; cache always with a TTL.

### Frontend (`apps/web`)

Feature in `src/features/{domain}/` (`{Domain}View.tsx` + `components/`). Pages
in `src/app/(auth|public)/` are thin wrappers — logic lives in the feature.

- HTTP via `server.api.*`; the `X-Account-Id` header is managed by `Server`.
- FormData upload: don't set `Content-Type` (the client sets the boundary).
- Presigned upload: native `fetch()` with `PUT` (S3 rejects extra headers).
- Prefer existing `@/components/ui/*` before building a custom component.
- **Never show an enum key to the user** — translate via `translateEnumValue()`;
  add new values to the central translation map.

### Shared types

Any DTO/type used by both `api` and `web` lives once in `packages/shared` as a
schema + inferred type, imported from the shared package. The API validates
output before returning; the web app types from the inferred type. Never
duplicate the interface across both apps.
