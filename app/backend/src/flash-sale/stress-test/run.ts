import "reflect-metadata";
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDrizzleClient, DrizzleClient } from "src/db/client";
import { createRedisClient, RedisClient } from "src/redis/redis.client";
import { purchases, sales } from "src/db/schema";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";

// Standalone stress test script — per the project's testing notes (section 4.3):
// "a tool like k6 or autocannon is fine, but the invariant assertions can be your
// own script." This hits the real, already-running HTTP server (never reimplements
// the purchase decision itself, per section 8.5) and asserts invariants against the
// real Postgres/Redis state after each run, not just throughput.
//
// Prerequisites: docker compose (db + redis) and the Nest app running (`npm run dev`
// or `npm start`), same as the integration tests.

const BASE_URL = process.env.STRESS_TEST_BASE_URL ?? "http://localhost:3000";
const HOUR = 60 * 60 * 1000;

// Minimal ANSI helpers — no chalk/colors dependency for a single-file script.
// NO_COLOR (https://no-color.org) and non-TTY output (e.g. piped to a file) both
// disable it, so `npm run test:stress | tee results.log` doesn't save escape codes.
const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
function paint(code: string, text: string): string {
  return colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}
const color = {
  bold: (s: string) => paint("1", s),
  dim: (s: string) => paint("2", s),
  cyan: (s: string) => paint("36", s),
  yellow: (s: string) => paint("33", s),
  green: (s: string) => paint("32", s),
  red: (s: string) => paint("31", s),
};
const pass = (s: string) => color.green(color.bold(s));
const fail = (s: string) => color.red(color.bold(s));
const verdict = (ok: boolean, label = ok ? "PASS" : "FAIL") => (ok ? pass(label) : fail(label));
function heading(title: string): void {
  console.log(`\n${color.bold(color.cyan(`=== ${title} ===`))}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add a small delay between iterations to avoid saturating the DB/Redis with back-to-back runs, which can cause false negatives in the stress test.
const INTER_ITERATION_DELAY_MS = Number(process.env.STRESS_TEST_ITERATION_DELAY_MS ?? 2000);

interface PurchaseResponseBody {
  accepted: boolean;
  code?: string;
  identifier?: string;
}

async function purchase(saleId: string, identifier: string): Promise<{ status: number; body: PurchaseResponseBody }> {
  const res = await fetch(`${BASE_URL}/v1/flash-sale/${saleId}/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  const body = (await res.json()) as PurchaseResponseBody;
  return { status: res.status, body };
}

async function seedSale(
  db: DrizzleClient,
  overrides: Partial<typeof sales.$inferInsert> = {},
): Promise<typeof sales.$inferSelect> {
  const id = overrides.id ?? `stress-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  const [sale] = await db
    .insert(sales)
    .values({
      productName: "Stress Test Product",
      productDescription: "Seeded for stress testing",
      totalStock: 10,
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + HOUR),
      ...overrides,
      id,
    })
    .returning();
  return sale;
}

async function cleanupSale(db: DrizzleClient, redis: RedisClient, saleId: string): Promise<void> {
  await db.delete(purchases).where(eq(purchases.saleId, saleId));
  await db.delete(sales).where(eq(sales.id, saleId));
  await redis.del(`sale:${saleId}:stock`, `sale:${saleId}:buyers`);
}

interface OversellIterationResult {
  iteration: number;
  accepted: number;
  soldOut: number;
  redisStockRemaining: number;
  dbRowCount: number;
  passed: boolean;
  durationMs: number;
}

async function runOversellIteration(
  db: DrizzleClient,
  redis: RedisClient,
  iteration: number,
  stock: number,
  concurrentUsers: number,
): Promise<OversellIterationResult> {
  const sale = await seedSale(db, { totalStock: stock });
  try {
    const identifiers = Array.from({ length: concurrentUsers }, (_, i) => `oversell-${iteration}-user-${i}@stress.test`);

    const start = Date.now();
    const results = await Promise.all(identifiers.map((identifier) => purchase(sale.id, identifier)));
    const durationMs = Date.now() - start;

    const accepted = results.filter((r) => r.body.accepted === true).length;
    const soldOut = results.filter((r) => r.body.code === PurchaseErrorCode.SOLD_OUT).length;

    const redisStockRemaining = Number((await redis.get(`sale:${sale.id}:stock`)) ?? "-1");
    const dbRowCount = (await db.query.purchases.findMany({ where: eq(purchases.saleId, sale.id) })).length;

    const passed =
      accepted === stock &&
      soldOut === concurrentUsers - stock &&
      redisStockRemaining === 0 &&
      dbRowCount === stock;

    return { iteration, accepted, soldOut, redisStockRemaining, dbRowCount, passed, durationMs };
  } finally {
    await cleanupSale(db, redis, sale.id);
  }
}

interface DuplicateUserResult {
  accepted: number;
  alreadyPurchased: number;
  dbRowCount: number;
  passed: boolean;
}

async function runDuplicateUserTest(db: DrizzleClient, redis: RedisClient, concurrentRequests: number): Promise<DuplicateUserResult> {
  const sale = await seedSale(db, { totalStock: 5 });
  try {
    const identifier = "duplicate-user@stress.test";
    const results = await Promise.all(Array.from({ length: concurrentRequests }, () => purchase(sale.id, identifier)));

    const accepted = results.filter((r) => r.body.accepted === true).length;
    const alreadyPurchased = results.filter((r) => r.body.code === PurchaseErrorCode.ALREADY_PURCHASED).length;
    const dbRowCount = (await db.query.purchases.findMany({ where: eq(purchases.saleId, sale.id) })).length;

    const passed = accepted === 1 && alreadyPurchased === concurrentRequests - 1 && dbRowCount === 1;

    return { accepted, alreadyPurchased, dbRowCount, passed };
  } finally {
    await cleanupSale(db, redis, sale.id);
  }
}

interface BoundaryResult {
  beforeStartCode: string | undefined;
  beforeStartPassed: boolean;
  afterEndCode: string | undefined;
  afterEndPassed: boolean;
}

async function runBoundaryTest(db: DrizzleClient, redis: RedisClient): Promise<BoundaryResult> {
  const upcoming = await seedSale(db, {
    startsAt: new Date(Date.now() + HOUR),
    endsAt: new Date(Date.now() + 2 * HOUR),
  });
  const ended = await seedSale(db, {
    startsAt: new Date(Date.now() - 2 * HOUR),
    endsAt: new Date(Date.now() - HOUR),
  });
  try {
    const beforeStart = await purchase(upcoming.id, "boundary-before-start@stress.test");
    const afterEnd = await purchase(ended.id, "boundary-after-end@stress.test");

    return {
      beforeStartCode: beforeStart.body.code,
      beforeStartPassed: beforeStart.status === 403 && beforeStart.body.code === PurchaseErrorCode.SALE_NOT_STARTED,
      afterEndCode: afterEnd.body.code,
      afterEndPassed: afterEnd.status === 410 && afterEnd.body.code === PurchaseErrorCode.SALE_ENDED,
    };
  } finally {
    await cleanupSale(db, redis, upcoming.id);
    await cleanupSale(db, redis, ended.id);
  }
}

function printTable(rows: OversellIterationResult[]): void {
  console.log(
    color.dim("\n| Iter | Accepted | Sold out | Redis stock | DB rows | Duration (ms) | Result |"),
  );
  console.log(color.dim("|---|---|---|---|---|---|---|"));
  for (const r of rows) {
    console.log(
      `| ${r.iteration} | ${r.accepted} | ${r.soldOut} | ${r.redisStockRemaining} | ${r.dbRowCount} | ${r.durationMs} | ${verdict(r.passed)} |`,
    );
  }
}

async function main(): Promise<void> {
  const stock = Number(process.env.STRESS_TEST_STOCK ?? 50);
  const concurrentUsers = Number(process.env.STRESS_TEST_CONCURRENCY ?? 10000);
  const iterations = Number(process.env.STRESS_TEST_ITERATIONS ?? 10);

  const db = createDrizzleClient({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? "flash_sale",
    username: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    poolMax: Number(process.env.DB_POOL_MAX ?? 20),
  });
  const redis = createRedisClient({
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  });

  console.log(color.dim(`Stress test target: ${BASE_URL}`));
  console.log(color.dim(`Config: stock=${stock}, concurrentUsers=${concurrentUsers}, iterations=${iterations}`));

  heading("Oversell test");
  console.log(color.yellow(`Stock S=${stock}, N=${concurrentUsers} concurrent distinct users, repeated ${iterations}x`));
  console.log(color.dim("Invariant: exactly S accepted, N-S SOLD_OUT, Redis stock == 0, DB rows == S\n"));

  const oversellResults: OversellIterationResult[] = [];
  for (let i = 1; i <= iterations; i++) {
    const result = await runOversellIteration(db, redis, i, stock, concurrentUsers);
    oversellResults.push(result);
    process.stdout.write(result.passed ? color.green(".") : color.red("X"));
    if (i < iterations) await sleep(INTER_ITERATION_DELAY_MS);
  }
  console.log();
  printTable(oversellResults);

  const oversellAllPassed = oversellResults.every((r) => r.passed);
  const avgDurationMs = oversellResults.reduce((sum, r) => sum + r.durationMs, 0) / oversellResults.length;
  const totalRequests = concurrentUsers * iterations;
  const totalDurationMs = oversellResults.reduce((sum, r) => sum + r.durationMs, 0);
  const throughputRps = totalRequests / (totalDurationMs / 1000);
  const oversellPassCount = oversellResults.filter((r) => r.passed).length;

  const oversellLabel = oversellAllPassed ? "ALL PASSED" : "FAILED";
  const oversellCountNote = color.dim(`(${oversellPassCount}/${iterations} iterations)`);
  console.log(`\nOversell test: ${verdict(oversellAllPassed, oversellLabel)} ${oversellCountNote}`);
  console.log(color.dim(`Avg iteration duration: ${avgDurationMs.toFixed(1)}ms | Approx throughput: ${throughputRps.toFixed(1)} req/s`));

  await sleep(INTER_ITERATION_DELAY_MS);

  heading("Duplicate-user test");
  const dupConcurrency = Number(process.env.STRESS_TEST_DUPLICATE_CONCURRENCY ?? 100);
  console.log(color.yellow(`One identifier, N=${dupConcurrency} concurrent requests`));
  console.log(color.dim("Invariant: exactly 1 accepted, N-1 ALREADY_PURCHASED, DB rows == 1\n"));

  const dupResult = await runDuplicateUserTest(db, redis, dupConcurrency);
  console.log(
    `accepted=${dupResult.accepted}, alreadyPurchased=${dupResult.alreadyPurchased}, dbRows=${dupResult.dbRowCount} => ${verdict(dupResult.passed)}`,
  );

  heading("Boundary test");
  console.log(color.dim("One request just before startsAt, one just after endsAt\n"));
  const boundaryResult = await runBoundaryTest(db, redis);
  console.log(
    `before start -> code=${boundaryResult.beforeStartCode} => ${verdict(boundaryResult.beforeStartPassed)}`,
  );
  console.log(
    `after end    -> code=${boundaryResult.afterEndCode} => ${verdict(boundaryResult.afterEndPassed)}`,
  );

  const allPassed = oversellAllPassed && dupResult.passed && boundaryResult.beforeStartPassed && boundaryResult.afterEndPassed;

  console.log(
    `\n${color.bold(color.cyan("=== Summary ==="))} ${verdict(allPassed, allPassed ? "ALL INVARIANTS HELD" : "SOME INVARIANTS VIOLATED")}`,
  );

  await redis.quit();
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Stress test crashed:", err);
  process.exit(1);
});
