import type { PurchaseResult, SaleStatus, UserStatus } from "../types/flashSale";

const PRODUCT_NAME = "Lionel Messi Argentina 2026 Special Edition Black and Gold Premium Soccer Jersey Shirt";
const PRODUCT_DESCRIPTION = "Limited commemorative run. Never restocked.";
const PRODUCT_IMAGE = "/Lionel Messi Premium Kit.jpg";
const TOTAL_STOCK = 500;

const NOW = Date.now();
const SALE_STARTS_AT = new Date(NOW + 15_000).toISOString();
const SALE_ENDS_AT = new Date(NOW + 30 * 60_000).toISOString();

const NETWORK_DELAY_MS = 500;

let stockRemaining = 128;
const purchasedIdentifiers = new Set<string>(["jordan@example.com"]);

function delay<T>(value: T, ms = NETWORK_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function getWindowStatus(): "upcoming" | "active" | "ended" {
  const now = Date.now();
  if (now < new Date(SALE_STARTS_AT).getTime()) return "upcoming";
  if (now > new Date(SALE_ENDS_AT).getTime()) return "ended";
  return "active";
}

export async function fetchSaleStatus(): Promise<SaleStatus> {
  return delay({
    status: getWindowStatus(),
    productName: PRODUCT_NAME,
    productDescription: PRODUCT_DESCRIPTION,
    productImage: PRODUCT_IMAGE,
    startsAt: SALE_STARTS_AT,
    endsAt: SALE_ENDS_AT,
    stockRemaining,
    totalStock: TOTAL_STOCK,
  });
}

export async function attemptPurchase(identifier: string): Promise<PurchaseResult> {
  const windowStatus = getWindowStatus();

  if (windowStatus === "upcoming") {
    return delay({ ok: false, code: "SALE_NOT_STARTED", message: "The sale hasn't opened yet." });
  }
  if (windowStatus === "ended") {
    return delay({ ok: false, code: "SALE_ENDED", message: "This drop has closed." });
  }
  if (purchasedIdentifiers.has(identifier)) {
    return delay({
      ok: false,
      code: "ALREADY_PURCHASED",
      message: `${identifier} already secured a unit — one per person.`,
    });
  }
  if (stockRemaining <= 0) {
    return delay({ ok: false, code: "SOLD_OUT", message: "All units have been purchased. Thanks for trying." });
  }

  stockRemaining -= 1;
  purchasedIdentifiers.add(identifier);
  return delay({ ok: true, identifier, purchasedAt: new Date().toISOString() });
}

export async function fetchUserStatus(identifier: string): Promise<UserStatus> {
  return delay({
    hasPurchased: purchasedIdentifiers.has(identifier),
    identifier,
    purchasedAt: purchasedIdentifiers.has(identifier) ? new Date().toISOString() : undefined,
  });
}
