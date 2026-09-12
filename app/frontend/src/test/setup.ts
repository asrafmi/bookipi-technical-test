import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest doesn't auto-cleanup between tests the way Jest + RTL's preset does —
// without this, each test's rendered tree piles up in the same jsdom document.
afterEach(() => {
  cleanup();
});
