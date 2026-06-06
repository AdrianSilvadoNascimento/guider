# API documentation (OpenAPI / Swagger)

An API spec that disagrees with the code is worse than no spec: it's a confident
lie. A consumer reads "this field is required," builds against it, and ships a
bug that the docs caused. The governing principle is the same "one source of
truth" rule that `conventions.md` applies to shared types — **the spec is
generated from the code, never maintained beside it** — plus the
`quality-gates.md` rule that a convention a human maintains by hand is a
convention that rots. So: generate the spec from the code, and let a machine fail
the build when the two drift.

## Single source of truth — generate, don't hand-write

The endpoints, their request shapes, and their response shapes already exist in
the code. The spec must be **derived from them**, not transcribed into a parallel
document that someone has to remember to update.

- Generate the OpenAPI document from the framework's route definitions and the
  **same validation schemas that already guard the boundary** — the
  class-validator DTOs, the zod schemas, the pydantic models. This is exactly the
  shared-type rule in `conventions.md`: one declaration, many consumers (runtime
  validation *and* the spec).
- A hand-written `openapi.yaml` kept next to the code is the drift anti-pattern.
  If a project has one, treat moving it under code generation as the fix.

## Document every public endpoint, completely

For each endpoint the API exposes:

- **Method, path, and a human summary** — what it does, not just its signature.
- **Request schema** — params, query, body, content type.
- **Response per status** — the success DTO *and* the error shapes (400/401/
  403/404/409/422/500 as they apply), so a consumer can handle failure without
  guessing.
- **Auth requirement** — which scheme/scope the route needs.

Document the **response DTO, never the ORM/persistence entity** — this is the
DTO-boundary rule from `conventions.md` viewed from the doc side. A spec that
exposes your `User` table's columns leaks the same thing a leaked entity does,
just on paper. Drive the schema from the response DTO type.

## Serve it, export it, version it

- **Serve interactive docs** (Swagger UI / Redoc / Scalar) at a known route in
  non-production. If the API is sensitive, authorize that route — the docs
  describe your attack surface.
- **Export the spec as an artifact** — commit `openapi.json` (or emit it in the
  build) so consumers, client-codegen, and the drift gate all read the same
  authoritative file rather than scraping a running server.
- **Version it with the API.** A breaking change to a route is a change to the
  spec; bump and record it the way you version the API itself.

## Drift gate — make a machine the enforcer

The whole convention collapses if "regenerate the docs" is a step a human is
trusted to remember. Wire a CI check (per `quality-gates.md`):

- **Regenerate the spec and diff it against the committed copy; fail on any
  difference.** A merge that changes a route without updating the spec is then
  impossible, not merely frowned upon.
- Or, at minimum, **assert every registered route appears in the spec** so a new
  undocumented endpoint blocks the build.
- Run it on every PR alongside lint/type-check (`quality-gates.md`).

## Per-stack specifics

Adapt to the project's framework; the principle (generate-from-code +
drift-gate) is constant.

- **NestJS** — `@nestjs/swagger`. Build with `DocumentBuilder`; schemas are
  derived from class-validator DTOs (add `@ApiProperty` only where inference
  needs help). `SwaggerModule.setup()` serves the UI; add a small script that
  writes `openapi.json` for the drift gate. Annotate responses with
  `@ApiResponse({ type: XResponseDto })` — the response DTO, never the Prisma
  entity (matches `conventions.md`).
- **FastAPI** — OpenAPI and `/docs` + `/openapi.json` are built in, generated
  from pydantic models and type hints. The convention here is **completeness, not
  wiring**: declare `response_model=` on every route, tag and summarize them, add
  examples, and document error responses with `responses=`.
- **Express / Fastify** — `@fastify/swagger`, or `swagger-jsdoc` /
  `zod-to-openapi` to derive the spec from zod schemas, served via
  `swagger-ui-express`. Prefer schema-derived over JSDoc comments so the spec
  can't drift from validation.
- **Spring** — `springdoc-openapi` (auto from controllers + DTOs). **Django REST
  Framework** — `drf-spectacular` from serializers. **Go** — `swag` (annotations)
  or `huma` (spec-first from typed handlers).

## What `/guider init` records

`init` writes the project's actual choices into `ARCHITECTURE.md` /
`APPLICATION.md`: the framework/tool generating the spec, where the spec file
lives, the route the interactive docs are served at (and its auth), and the
exact drift-gate command. `/guider spec` (see `spec-flow.md`) sets this up when
it's missing and closes the gaps when it's partial; `/guider audit` flags
undocumented endpoints and spec↔code drift against this contract.
