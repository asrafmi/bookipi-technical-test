import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseCard } from "./PurchaseCard";
import * as flashSaleApi from "../api/flash-sale/flash-sale";
import type { SaleStatus } from "../types/flash-sale";

// The API layer is the real boundary here (same reasoning as the backend
// integration suite mocking nothing below the HTTP layer): PurchaseCard,
// useFlashSale, and domains/flash-sale all run for real. Only the network
// call itself is replaced, so these tests exercise the actual derived-state
// logic the component renders from.
vi.mock("../api/flash-sale/flash-sale");

const mockedApi = vi.mocked(flashSaleApi);

const activeSale: SaleStatus = {
  status: "active",
  productName: "Messi Argentina 2026 Special Edition Jersey",
  productDescription: "Limited commemorative run.",
  startsAt: "2026-01-01T00:00:00.000Z",
  endsAt: "2026-01-02T00:00:00.000Z",
  stockRemaining: 5,
  totalStock: 100,
};

describe("PurchaseCard", () => {
  beforeEach(() => {
    mockedApi.getFlashSaleStatus.mockResolvedValue(activeSale);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state before the sale status resolves", () => {
    mockedApi.getFlashSaleStatus.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PurchaseCard />);
    expect(screen.getByText("Loading sale status…")).toBeInTheDocument();
  });

  it("renders the sale's product info and remaining stock once status loads", async () => {
    render(<PurchaseCard />);

    expect(await screen.findByText(activeSale.productName)).toBeInTheDocument();
    expect(screen.getByText("5 units left")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("disables Buy Now until a valid identifier is entered", async () => {
    const user = userEvent.setup();
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    const buyButton = screen.getByRole("button", { name: "Buy Now" });
    const input = screen.getByLabelText("Email or username");

    expect(buyButton).toBeDisabled();

    await user.type(input, "not-an-email");
    expect(buyButton).toBeDisabled();
    expect(screen.getByText("Check your entry")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "user@example.com");
    expect(buyButton).toBeEnabled();
  });

  it("submits a purchase and shows the success state", async () => {
    mockedApi.attemptPurchase.mockResolvedValue({
      accepted: true,
      identifier: "user@example.com",
      purchasedAt: "2026-01-01T00:01:00.000Z",
    });
    const user = userEvent.setup();
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    await user.type(screen.getByLabelText("Email or username"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Buy Now" }));

    expect(await screen.findByText("You're in.")).toBeInTheDocument();
    expect(screen.getByText("Confirmed for user@example.com.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Purchased" })).toBeDisabled();
    expect(mockedApi.attemptPurchase).toHaveBeenCalledWith("default", "user@example.com");
  });

  it("shows the already-purchased feedback and locks the button on a duplicate purchase", async () => {
    mockedApi.attemptPurchase.mockResolvedValue({
      accepted: false,
      code: "ALREADY_PURCHASED",
      message: "You have already purchased this item.",
    });
    const user = userEvent.setup();
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    await user.type(screen.getByLabelText("Email or username"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Buy Now" }));

    expect(await screen.findByText("You're already in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Already Purchased" })).toBeDisabled();
  });

  it("shows the sold-out state and disables Buy Now when stock is exhausted", async () => {
    mockedApi.getFlashSaleStatus.mockResolvedValue({ ...activeSale, stockRemaining: 0 });
    render(<PurchaseCard />);

    expect(await screen.findByText("Every unit is claimed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sold Out" })).toBeDisabled();
  });

  it("shows the ended state once the sale window has closed", async () => {
    mockedApi.getFlashSaleStatus.mockResolvedValue({ ...activeSale, status: "ended" });
    render(<PurchaseCard />);

    expect(await screen.findByText("This drop has closed")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sale Ended" })).toBeDisabled();
  });

  it("checks purchase status via the check-status action and reports NOT_PURCHASED", async () => {
    mockedApi.getUserStatus.mockResolvedValue({
      accepted: false,
      code: "NOT_PURCHASED",
      message: "This user has not purchased an item in this sale.",
    });
    const user = userEvent.setup();
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    await user.type(screen.getByLabelText("Email or username"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Already have one? Check your status" }));

    expect(await screen.findByText("Not purchased yet")).toBeInTheDocument();
    expect(mockedApi.getUserStatus).toHaveBeenCalledWith("default", "nobody@example.com");
    // Checking status is a read — it must not lock or affect the Buy Now flow.
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeEnabled();
  });

  it("checks purchase status and reports a prior purchase", async () => {
    mockedApi.getUserStatus.mockResolvedValue({
      accepted: true,
      identifier: "user@example.com",
      purchasedAt: "2026-01-01T00:01:00.000Z",
    });
    const user = userEvent.setup();
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    await user.type(screen.getByLabelText("Email or username"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Already have one? Check your status" }));

    expect(await screen.findByText("You're in.")).toBeInTheDocument();
    expect(screen.getByText("Confirmed for user@example.com.")).toBeInTheDocument();
  });

  it("disables the check-status action until a valid identifier is entered", async () => {
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    expect(screen.getByRole("button", { name: "Already have one? Check your status" })).toBeDisabled();
  });

  it("clears a stale check-status result once a purchase is submitted", async () => {
    mockedApi.getUserStatus.mockResolvedValue({
      accepted: false,
      code: "NOT_PURCHASED",
      message: "This user has not purchased an item in this sale.",
    });
    mockedApi.attemptPurchase.mockResolvedValue({
      accepted: true,
      identifier: "user@example.com",
      purchasedAt: "2026-01-01T00:01:00.000Z",
    });
    const user = userEvent.setup();
    render(<PurchaseCard />);
    await screen.findByText(activeSale.productName);

    await user.type(screen.getByLabelText("Email or username"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Already have one? Check your status" }));
    expect(await screen.findByText("Not purchased yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buy Now" }));
    await waitFor(() => expect(screen.queryByText("Not purchased yet")).not.toBeInTheDocument());
    expect(screen.getByText("You're in.")).toBeInTheDocument();
  });
});
