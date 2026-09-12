import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the given label", () => {
    render(<StatusBadge label="Live" tone="live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it.each([
    ["upcoming", "badge--upcoming"],
    ["live", "badge--live"],
    ["ended", "badge--ended"],
  ] as const)("applies the %s tone class", (tone, expectedClass) => {
    render(<StatusBadge label="x" tone={tone} />);
    expect(screen.getByText("x")).toHaveClass(expectedClass);
  });
});
