# Backend — Flash Sale

NestJS + Fastify + TypeScript. Currently boilerplate only: one dummy endpoint,
no real purchase logic, no database yet.

## Stack

- **NestJS** on the **Fastify** adapter (`@nestjs/platform-fastify`), not Express.
- **Swagger** (`@nestjs/swagger`) served at `/docs`.
- **`@nestjs/config`** wrapped in a project `ConfigService` — typed getters instead
  of reading `process.env` directly. See `src/config/config.service.ts`.
- **Jest** (`.test.ts` suffix, not `.spec.ts`) — wired but no tests written yet.
- Drizzle + PostgreSQL are the planned persistence stack (see root README) but are
  not wired up yet — see Status below.

## Structure

```
src/
  main.ts              Bootstraps Nest + Fastify, mounts Swagger, reads port from ConfigService.
  app.module.ts         Root module — imports ConfigModule and FlashSaleModule.
  config/
    config.module.ts    Global module wrapping @nestjs/config, resolves .env by file
                         location (not process.cwd()) so it works regardless of the
                         directory the process is launched from.
    config.service.ts   Typed getters, e.g. config.app().port. Add more here as needed.
    validate-env.ts     Throws at startup if a required env var is missing (skipped
                         when NODE_ENV=test).
  flash-sale/
    domain/flash-sale/          Business logic. flash-sale.service.ts currently returns
                                 a hardcoded dummy SaleStatus.
    application/rest/
      controller/                flash-sale.controller.ts — GET /v1/flash-sale/status.
      response/                  Swagger-documented response DTOs.
    types/                       as const status/error code objects (see root README's
                                  naming conventions).
    flash-sale.module.ts
```

This layering (`domain` / `application` / `infrastructure` / `types` per module)
mirrors an internal NestJS boilerplate pattern, kept to the single module this
system needs — no CQRS, no extra modules for the sake of structure.

## Status

- Done — Boilerplate: NestJS + Fastify app boots, Swagger docs live at `/docs`, config
  loading with startup validation.
- Done — One dummy endpoint: `GET /v1/flash-sale/status` — hardcoded response, not backed
  by real state.
- Pending — Purchase logic, the other two endpoints, persistence, and tests.

## Running

From the repo root, `npm run dev` starts backend and frontend together (see the
[root README](../../README.md)). To run just this app:

```bash
npm install
cp .env.example .env
npm run dev
```

Starts at `http://localhost:3000`. Swagger docs at `http://localhost:3000/docs`.

## Configuration

Copy `.env.example` to `.env` before running — `PORT` is required at startup
(validation is skipped when `NODE_ENV=test`).

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Yes | Port the Fastify server listens on. |

## API reference

### `GET /v1/flash-sale/status`

Returns the current sale status. **Dummy response** — always returns the same
hardcoded body regardless of any real sale window or stock state.

```json
{
  "status": "upcoming",
  "productName": "Limited Edition Product",
  "productDescription": "Dummy response — not wired to real state yet.",
  "startsAt": "2026-01-01T00:00:00.000Z",
  "endsAt": "2026-01-01T00:00:00.000Z",
  "stockRemaining": 0,
  "totalStock": 0
}
```

Two more endpoints are planned per the brief (attempt purchase, check own result)
but not implemented yet.

## Testing

```bash
npm test
```

Jest is configured (`testRegex: .test.ts$`) but no test files exist yet — passes
with 0 tests found.

## Linting

```bash
npm run lint
```
