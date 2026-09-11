-- Re-anchor the seeded `default` sale window relative to when this migration runs,
-- so a fresh clone lands inside an ACTIVE window instead of one that already closed.
-- (0001 seeded a fixed calendar window, which goes stale the day after it was written.)
--
-- Idempotent and safe to re-run: only touches the one seeded row, and only when its
-- window has already ended — a window that's still open, or one an operator has
-- deliberately set for manual testing, is left alone.

INSERT INTO "sales" ("id", "product_name", "product_description", "total_stock", "starts_at", "ends_at")
VALUES (
  'default',
  'Messi Argentina 2026 Special Edition Jersey',
  'Limited commemorative run. Never restocked. One unit per person, while stock lasts.',
  100,
  now() - interval '1 hour',
  now() + interval '23 hours'
)
ON CONFLICT (id) DO UPDATE
SET
  "starts_at" = now() - interval '1 hour',
  "ends_at"   = now() + interval '23 hours'
WHERE "sales"."ends_at" < now();
