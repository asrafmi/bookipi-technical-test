import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountdownTimer } from "./CountdownTimer";

function unitValue(container: HTMLElement, label: string): string | null {
  const unitLabel = within(container).getByText(label);
  const unit = unitLabel.closest(".countdown__unit");
  return unit?.querySelector(".countdown__value")?.textContent ?? null;
}

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the start label and the initial breakdown of the remaining time", () => {
    const target = new Date("2026-01-02T01:02:03.000Z").toISOString(); // +1d 1h 2m 3s
    const { container } = render(<CountdownTimer startLabel="Starts tomorrow" targetIso={target} />);

    expect(screen.getByText("Starts tomorrow")).toBeInTheDocument();
    expect(unitValue(container, "DAYS")).toBe("01");
    expect(unitValue(container, "HRS")).toBe("01");
    expect(unitValue(container, "MIN")).toBe("02");
    expect(unitValue(container, "SEC")).toBe("03");
  });

  it("counts down as time advances", () => {
    const target = new Date("2026-01-01T00:00:05.000Z").toISOString(); // +5s
    const { container } = render(<CountdownTimer startLabel="Starts soon" targetIso={target} />);

    expect(unitValue(container, "SEC")).toBe("05");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(unitValue(container, "SEC")).toBe("02");
  });

  it("floors at zero instead of going negative once the target has passed", () => {
    const target = new Date("2026-01-01T00:00:02.000Z").toISOString();
    const { container } = render(<CountdownTimer startLabel="Starts soon" targetIso={target} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(unitValue(container, "SEC")).toBe("00");
    expect(unitValue(container, "MIN")).toBe("00");
  });
});
