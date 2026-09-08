# High-Throughput Flash Sale System

A take-home implementation of a flash sale platform: one product, fixed stock, one
unit per person, no login. Users see the sale's status, enter an identifier, and
attempt to buy — the system must not oversell and must not let anyone buy twice,
even under heavy concurrent load.

Monorepo: [`app/frontend`](app/frontend) (React) and [`app/backend`](app/backend) (NestJS + Fastify API).

## Status

- Done — Frontend: all UI states implemented against a mock API (see [app/frontend/README.md](app/frontend/README.md)).
- Done — Backend: boilerplate set up (NestJS + Fastify, config loading, Swagger docs) with
  one dummy endpoint (`GET /v1/flash-sale/status`, hardcoded response). See
  [app/backend/README.md](app/backend/README.md).
- Pending — Backend: purchase logic, the other two endpoints, persistence, and the frontend
  actually talking to it.
- Pending — Stress tests, unit/integration tests: waiting on the real backend logic.

## Quick start

```bash
npm run install:all   # installs root, backend, and frontend deps
cp app/backend/.env.example app/backend/.env
npm run dev            # runs backend + frontend concurrently
```

Backend starts at `http://localhost:3000` (Swagger docs at `/docs`), frontend at
`http://localhost:5173`. The frontend still talks to its own in-memory mock API, not
the backend yet — see [app/frontend/README.md](app/frontend/README.md).

To run either side alone, see [app/backend/README.md](app/backend/README.md) or
[app/frontend/README.md](app/frontend/README.md).

## Repo layout

```
app/
  frontend/   React + TypeScript + Vite. See app/frontend/README.md.
  backend/    NestJS + Fastify + TypeScript API. Boilerplate + one dummy endpoint.
              See app/backend/README.md.
```

## Architecture

The atomic purchase mechanism, source of truth, and persistence strategy are not
implemented yet — the backend is boilerplate plus one dummy endpoint. The diagram
and request-path walkthrough will land here once those decisions are made, as a
Mermaid block so it renders inline on GitHub.

## Key design decisions

To be filled in as decisions are made — this section is written alongside the
code, not reconstructed afterward. So far:

- **Frontend has no backend dependency yet.** The API client
  (`app/frontend/src/api/flashSaleApi.ts`) exposes the same three functions the
  real backend will serve (sale status, attempt purchase, check user status),
  backed by an in-memory mock. This let UI work start before the backend exists,
  and means swapping in real `fetch` calls later shouldn't touch any component.
- **UI states are derived, not enumerated.** The design spec calls out nine
  distinct screens (upcoming, ready, invalid input, submitting, success, already
  purchased, sold out, ended, request failed). These aren't nine components —
  they're one `PurchaseCard` whose rendering is derived from sale status +
  submit state + failure reason. Fewer states to keep in sync by hand.
- **Backend stack: NestJS on Fastify, not Express.** Chosen for the built-in DI/module
  system (keeps the domain/application/infrastructure layering below explicit rather
  than convention-only) and Fastify's throughput advantage, relevant given the
  brief's high-throughput requirement.
- **Config is centralized in a typed `ConfigService`, never `process.env` directly.**
  One place to see every env-driven value, and a startup-time check
  (`validate-env.ts`) that fails fast if a required variable is missing instead of
  surfacing as an obscure runtime error later.

## API reference

Only one endpoint exists so far, and its response is a hardcoded dummy — see
[app/backend/README.md](app/backend/README.md#api-reference) for the current shape.

Planned per the brief:

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/flash-sale/status` | Sale status (upcoming/active/ended) | Done — dummy response |
| `POST /v1/flash-sale/purchase` | Attempt a purchase | Pending |
| `GET /v1/flash-sale/purchase/:identifier` | Check own purchase result | Pending |

Error taxonomy (machine-readable codes, not HTTP status alone) is not implemented
yet — will be documented here once the purchase endpoint exists.

## Testing

- Backend: Jest is wired (`.test.ts` suffix) but no tests exist yet — `npm run test:backend` passes with 0 tests found.
- Frontend: no test runner installed yet.
- Integration/stress tests: pending the real backend logic.

## Stress test results

Not yet applicable — pending the backend's concurrency control implementation.

## Known limitations

- Backend has no real purchase logic, persistence, or the other two endpoints yet —
  only boilerplate and one dummy endpoint. The frontend is still fully built against
  its own mock and has not been exercised against the real server.
- No authentication — a plain identifier (email/username) is trusted as-is, per
  the brief's simplification.
- No automated tests yet on either side.

## What I would do differently with more time

To be filled in at the end.
