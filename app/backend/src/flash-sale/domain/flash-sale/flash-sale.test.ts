import { FlashSaleService } from "src/flash-sale/domain/flash-sale/flash-sale.service";
import { SaleWindowStatus } from "src/flash-sale/types/sale-status";

describe("FlashSaleService window logic", () => {
  const service = new FlashSaleService(null as any, null as any, null as any);
  const resolve = (service as any).resolveWindowStatus.bind(service);

  it("returns UPCOMING before startsAt", () => {
    const startsAt = new Date("2026-09-09T10:00:00Z");
    const endsAt = new Date("2026-09-09T12:00:00Z");
    const now = new Date("2026-09-09T09:59:59.999Z");
    expect(resolve(now, startsAt, endsAt)).toBe(SaleWindowStatus.UPCOMING);
  });

  it("returns ACTIVE exactly at startsAt", () => {
    const startsAt = new Date("2026-09-09T10:00:00Z");
    const endsAt = new Date("2026-09-09T12:00:00Z");
    expect(resolve(startsAt, startsAt, endsAt)).toBe(SaleWindowStatus.ACTIVE);
  });

  it("returns ACTIVE exactly at endsAt", () => {
    const startsAt = new Date("2026-09-09T10:00:00Z");
    const endsAt = new Date("2026-09-09T12:00:00Z");
    expect(resolve(endsAt, startsAt, endsAt)).toBe(SaleWindowStatus.ACTIVE);
  });

  it("returns ENDED just after endsAt", () => {
    const startsAt = new Date("2026-09-09T10:00:00Z");
    const endsAt = new Date("2026-09-09T12:00:00Z");
    const now = new Date("2026-09-09T12:00:00.001Z");
    expect(resolve(now, startsAt, endsAt)).toBe(SaleWindowStatus.ENDED);
  });
});
