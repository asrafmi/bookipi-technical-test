# Frontend — Flash Sale

React + TypeScript + Vite. Single page: sale status, an identifier input, a Buy Now button, and feedback for every purchase outcome. Talks to the real backend over HTTP (axios) — the original in-memory mock has been fully retired.

## Stack

- **Vite + React 19 + TypeScript** — no router, no state library. One page doesn't need either.
- **Axios** for HTTP, wrapped in a thin typed layer (`api/http.ts` + `api/http-client.ts`) rather than used directly in call sites.
- **Oxlint** for linting.

## Structure

```
src/
  api/
    http.ts                  Typed get/post/put/patch/del methods over an AxiosInstance.
    http-client.ts            createHttpClient() — builds the AxiosInstance, normalizes
                               every failure response into an ApiError { status, code, message }.
    flash-sale/
      flash-sale-client.ts     One AxiosInstance scoped to VITE_FLASH_SALE_API_BASE_URL + "/v1".
      flash-sale.ts             getFlashSaleStatus / attemptPurchase / getUserStatus — the
                                 three real backend calls, [err, result] via awaitToError.
  domains/
    flash-sale.ts              Pure derivations: isValidIdentifier, formatSaleStartLabel,
                                derivePurchaseCardView (badge/stock text/button label/disabled/
                                feedback-visibility flags for PurchaseCard). No React, no fetch.
  components/       PurchaseCard (the page — pure JSX), CountdownTimer, StatusBadge, FeedbackMessage.
  hooks/            use-flash-sale (state + effects + composes domains/flash-sale into a `view`
                     object), use-countdown.
  lib/
    config.ts        Reads VITE_FLASH_SALE_* — window.__ENV__ (runtime) first, falling back
                      to import.meta.env (Vite build-time), for prod env injection without a rebuild.
    await-to-error.ts [err, result] tuple wrapper (same pattern as the backend's).
  types/
    flash-sale.ts     SaleStatus, PurchaseResult (accepted-discriminated union), error codes.
    error.ts          ErrorResponse — shape thrown by the http-client on a failed request.
```

The UI states (upcoming, ready, invalid input, submitting, success, already purchased,
sold out, ended, request failed) are not separate components — `PurchaseCard` renders
off a `view` object (`domains/flash-sale.ts`'s `derivePurchaseCardView`) that the
`useFlashSale` hook computes from `saleStatus` + `submitState` + `failure`. The
component itself contains no derivation logic, only JSX — see `hooks/use-flash-sale.ts`.

## Running

From the repo root, `npm run dev` starts backend and frontend together (see the
[root README](../../README.md)). To run just this app:

```bash
npm install
cp .env.example .env
npm run dev
```

Opens at `http://localhost:5173`. Requires the backend running and reachable at
`VITE_FLASH_SALE_API_BASE_URL` (default `http://localhost:3000`) — see the root
README's Quick start for bringing up the backend + its infrastructure.

## Real backend integration

`src/api/flash-sale/flash-sale.ts` calls the three real endpoints
(`GET /v1/flash-sale/:saleId/status`, `POST /v1/flash-sale/:saleId/purchase`,
`GET /v1/flash-sale/:saleId/purchase/:identifier`) via a shared axios instance
scoped to `VITE_FLASH_SALE_API_BASE_URL`. `:saleId` comes from
`VITE_FLASH_SALE_DEFAULT_SALE_ID` (default `"default"`, matching the one seeded sale
row — see the root README's Decision 6).

Errors follow a go-style `[err, result]` tuple (`lib/await-to-error.ts`), not
try/catch at the call site — `http-client.ts`'s response interceptor turns any
non-2xx response into an `ApiError { status, code, message }`, and `use-flash-sale.ts`
maps that into the same `PurchaseFailure` shape a successful-but-rejected response
would produce, so the UI doesn't need to know which path a failure came through.

**Known gap:** `lib/config.ts` supports runtime env injection (`window.__ENV__` first,
falling back to Vite's build-time `import.meta.env`) for the production Docker image —
see the root README's Known limitations. `api/flash-sale/flash-sale-client.ts` does
**not** go through that layer yet: it reads `import.meta.env.VITE_FLASH_SALE_API_BASE_URL`
directly and throws at module load if it's unset. In the current Docker setup this
still works because Vite's build-time env happens to be set, but it means the
API base URL is currently baked in at build time for this one file, not
runtime-injectable like `lib/config.ts` was designed to allow. Worth fixing before
relying on one built image against multiple backend URLs.

## Testing

Not yet wired up — no test runner is installed. See the root README's Known limitations.

## Linting

```bash
npm run lint
```
