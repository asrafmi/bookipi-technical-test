import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedbackMessage } from "./FeedbackMessage";

describe("FeedbackMessage", () => {
  it("renders the title and body", () => {
    render(<FeedbackMessage tone="neutral" title="You're already in" body="You have already purchased this item." />);
    expect(screen.getByText("You're already in")).toBeInTheDocument();
    expect(screen.getByText("You have already purchased this item.")).toBeInTheDocument();
  });

  it("applies the tone class", () => {
    const { container } = render(<FeedbackMessage tone="error" title="t" body="b" />);
    expect(container.querySelector(".feedback--error")).toBeInTheDocument();
  });

  it("renders the check icon only for the success tone", () => {
    const { container: success } = render(<FeedbackMessage tone="success" title="t" body="b" />);
    expect(success.querySelector("svg")).toBeInTheDocument();

    const { container: neutral } = render(<FeedbackMessage tone="neutral" title="t" body="b" />);
    expect(neutral.querySelector("svg")).not.toBeInTheDocument();
  });
});
