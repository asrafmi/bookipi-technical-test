# High-Throughput Flash Sale System

A take-home implementation of a flash sale platform: one product, fixed stock, one
unit per person, no login. Users see the sale's status, enter an identifier, and
attempt to buy — the system must not oversell and must not let anyone buy twice,
even under heavy concurrent load.

Monorepo: [`app/frontend`](app/frontend) (React) and `app/backend` (Node.js/TypeScript API — not yet built).

## Status

- ✅ Frontend: all UI states implemented against a mock API (see [app/frontend/README.md](app/frontend/README.md)).
- ⏳ Backend: not started yet. Purchase logic, persistence, and the real API this frontend will talk to are still to come.
- ⏳ Stress tests, unit/integration tests for backend logic: pending the backend.

## Quick start

```bash
npm run install:all   # installs root, backend, and frontend deps
npm run dev            # runs backend + frontend concurrently
```

Until the backend exists, `npm run dev` will fail on the backend half. To run just
the frontend against its built-in mock API:

```bash
cd app/frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Repo layout

```
app/
  frontend/   React + TypeScript + Vite. See app/frontend/README.md.
  backend/    Node.js + TypeScript API. Not yet implemented.
```

## Architecture

To be filled in once the backend's core design decisions (atomic purchase
mechanism, source of truth, persistence strategy) are made and implemented.
The diagram will live here as a Mermaid block so it renders inline on GitHub.

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

## API reference

Not finalized — pending the backend. Planned endpoints per the brief: sale status,
attempt purchase, check own purchase result.

## Testing

Not yet applicable — see Status above.

## Stress test results

Not yet applicable — pending the backend's concurrency control implementation.

## Known limitations

- Backend does not exist yet. The frontend is fully built against a mock and has
  not been exercised against a real server.
- No authentication — a plain identifier (email/username) is trusted as-is, per
  the brief's simplification.
- No automated tests yet on either side.

## What I would do differently with more time

To be filled in at the end.
