# Architecture guardrails

Structure is a cost as well as a benefit. A bounded context, a state machine,
or an extra layer earns its place by removing more confusion than it adds. The
prime directive holds here harder than anywhere: **introduce structure when the
domain's complexity demands it, never preemptively.** A premature boundary is
worse than no boundary — it's friction with no payoff and it's expensive to
remove.

Default posture: start simple, and let pressure from the domain tell you when
to add a seam.

## Folder patterns — organize by domain, not by layer (once it's worth it)

Two common shapes:

- **By technical layer** — `controllers/`, `services/`, `models/`. Fine for a
  small app; everything related to one feature is scattered across folders.
- **By bounded context / feature** — `billing/`, `deals/`, `auth/`, each
  containing its own controller/service/repository/dto. Related code lives
  together; a feature can be understood and changed in one place.

Move toward by-domain as the app grows. Within a domain module, the standard
layout (adapt names to the stack) is the controller (transport), the
service/use-case (logic), the repository (data access, abstract +
implementation), and DTOs (input + output). Cross-cutting infrastructure
(idempotency, logging, auth) lives in a shared `common/` area, not duplicated
per domain. `init` records the project's exact convention so it's applied
consistently.

## Bounded contexts — when to draw a boundary

Draw one when two parts of the domain have **different language, different
rules, or different rates of change** — when "user" means one thing in billing
and another in support, or when a team owns one area independently. Signals you
need a boundary:

- The same word means different things in different parts of the code.
- A change in one area keeps forcing unrelated changes in another (tight
  coupling that shouldn't exist).
- One area has a fundamentally different lifecycle or owner.

A boundary means a clear interface between contexts and no reaching across it
into the other's internals. Until those signals appear, one well-named module
is simpler and correct. Document the contexts and their relationships in
`ARCHITECTURE.md` only once they exist.

## State machines — when status strings become a machine

A field that moves through a defined sequence of values with rules about which
transitions are legal *is* a state machine, whether or not it's modeled as one.
Once there are more than a couple of states, or any "you can't go from X to Z"
rules, model it explicitly:

- Define the **states** as an enum (never raw string literals — see
  `conventions.md`).
- Define the **allowed transitions** in one place, and reject the rest. The
  illegal transition should be impossible to express, not merely discouraged.
- Put side effects on transitions, not scattered across the code that happens
  to set the status.
- Document the diagram in `ARCHITECTURE.md`:

  ```
  draft ──submit──▶ submitted ──approve──▶ approved
                        │
                        └──reject──▶ rejected
  ```

The anti-pattern Guider is built to prevent: `if (deal.status === 'approved')`
checks sprinkled across twenty files, with the legal transitions living only in
people's heads. Centralize the machine; let the rest of the code ask it.

## Responsibility separation (recap)

Covered in `conventions.md`; the architectural half: keep layers from leaking
into each other. Transport doesn't do business logic; business logic doesn't do
data access; data access doesn't know about HTTP. Each layer depends inward on
abstractions, never outward on concretions. This is what makes a context
testable in isolation and replaceable without a rewrite.

## What `/guider init` records

`ARCHITECTURE.md` should capture: the folder convention, the list of bounded
contexts and how they relate, every explicit state machine with its diagram and
transition rules, the layering rule, and a pointer back to the data-integrity
decisions. Keep it a map of *why the code is shaped this way*, so the shape
survives contact with the next change.
