import { SaleWindowStatus } from "../../types/sale-status";

export interface SaleStatus {
  status: SaleWindowStatus;
  productName: string;
  productDescription: string;
  startsAt: string;
  endsAt: string;
  stockRemaining: number;
  totalStock: number;
}
