# Frontend — Flash Sale

React + TypeScript + Vite. Single page: sale status, an identifier input, a Buy Now button, and feedback for every purchase outcome.

## Stack

- **Vite + React 19 + TypeScript** — no router, no state library. One page doesn't need either.
- **Oxlint** for linting.

## Structure

```
src/
  api/            API client. Currently an in-memory mock (see below) with the same
                  function signatures the real backend client will expose.
  components/     PurchaseCard (the page), CountdownTimer, StatusBadge, FeedbackMessage.
  hooks/          useFlashSale (state machine driving the card), useCountdown.
  types/          Shared types for sale status, purchase results, error codes.
```

The UI states (upcoming, ready, invalid input, submitting, success, already purchased,
sold out, ended, request failed) are not separate components — they're derived in
`PurchaseCard` from `saleStatus` + `submitState` + `failure`. See
`hooks/useFlashSale.ts` for the state shape.

## Running

From the repo root, `npm run dev` starts backend and frontend together (see the
[root README](../../README.md)). To run just this app:

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Mock API

`src/api/flashSaleApi.ts` currently simulates the three endpoints in-memory
(sale status, attempt purchase, check user status) with a fixed artificial delay,
so the UI can be built and demoed before the backend exists. Swapping it for real
`fetch` calls against the backend should not require touching any component —
the function signatures in that file are the contract.

## Testing

Not yet wired up — no test runner is installed. See the root README's known limitations.

## Linting

```bash
npm run lint
```
