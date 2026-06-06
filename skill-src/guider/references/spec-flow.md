# `/guider spec` — scaffold or improve the API documentation

`spec` makes the API documentation real: it sets up OpenAPI generation when a
project has none, and closes the gaps when a project's docs are partial or
drifting. It is the command that operationalizes the `api-docs.md` convention —
**the spec is generated from the code, every endpoint is documented, and a CI
gate fails on drift.** Read `api-docs.md` first; this file is the procedure, that
one is the standard.

Like `init`, `spec` splits on what already exists: an empty API doc story gets
scaffolded, an existing one gets improved. Like `fix`, the improvements are real
edits to the codebase — kept surgical and behavior-preserving (they change
*generated docs*, not runtime behavior).

---

## Phase 1 — Detect

Look before doing anything.

- **Is there an HTTP API surface at all?** Find the controllers/routers/route
  handlers. If the project exposes no HTTP API (a CLI, a library, a pure
  worker), say so and stop — there's nothing to document.
- **Which framework**, and does it generate OpenAPI idiomatically (see the
  per-stack list in `api-docs.md`)?
- **Is OpenAPI tooling already wired?** Look for the generator dependency
  (`@nestjs/swagger`, `springdoc`, `drf-spectacular`, `swagger-jsdoc`,
  `zod-to-openapi`…), a served docs route, an exported `openapi.json`/`.yaml`,
  and a drift gate in CI.
- **Read the contract.** If a Guider `ARCHITECTURE.md`/`APPLICATION.md` records
  the API-docs decisions (tool, spec location, served route, drift command),
  honor them.

Report what you found, then branch: nothing wired → Phase 2a; partial/drifting →
Phase 2b.

---

## Phase 2a — Absent → scaffold

Wire the per-stack tooling from `api-docs.md`, the smallest setup that satisfies
the convention:

- Generate the spec **from the code and its validation schemas** (not a
  hand-written file).
- Serve interactive docs at a known non-prod route; authorize it if the API is
  sensitive.
- Add a script that **exports `openapi.json`** as an artifact.
- Add a **CI drift gate**: regenerate and diff against the committed spec, fail
  on any difference (or, minimally, assert every route appears).

Posture (consistent with `init` and `quality-gates.md`): **edit configs in place
with a visible diff, and propose dependency installs rather than running them.**
Don't install packages, don't start the server. Name the commands and let the
user run them.

---

## Phase 2b — Present → improve

Find and close the gaps against `api-docs.md`, then fix them:

- **Undocumented endpoints** — routes missing from the spec entirely.
- **Incomplete responses** — no error responses, or only the 200 documented.
- **Leaked entities** — the spec documents an ORM/persistence type instead of the
  response DTO (the DTO-boundary rule in `conventions.md`). Point the schema at
  the response DTO.
- **Spec↔code drift** — the committed spec no longer matches what the code
  generates.
- **Missing drift gate** — generation exists but nothing enforces it; add the CI
  check.

These are doc-only edits — adding decorators/annotations, response-type
declarations, tags, summaries, examples. They change the generated spec, not
behavior, so apply them surgically and automatically, matching surrounding style
and reusing existing DTOs/schemas rather than inventing parallel ones. **Confirm
before** adding a new dependency, exposing a new served route, or committing a
large regenerated spec file. If a "gap" turns out intentional on a closer read
(an internal route deliberately hidden), skip it and note why — same discipline
as `fix-flow.md`.

---

## Phase 3 — Verify

Run the project's spec-generation + drift-check command and confirm it passes —
the regenerated spec matches the committed copy and every route is present. If
generation requires a heavy build or an install you only proposed, say so and let
the user run it rather than forcing it. Report what changed: endpoints now
documented, schemas added, the gate wired.

---

## Phase 4 — Summary

Close with: what was scaffolded or improved, the served docs route and the
exported spec path, the drift-gate command, any dependency installs the user
still needs to run, and (if this filled in a contract) the lines worth recording
in `ARCHITECTURE.md`/`APPLICATION.md` per `api-docs.md`. Then stop.
