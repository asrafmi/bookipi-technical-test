import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts (build config) so `vite build` never picks up
// test-only settings — same reasoning as the backend's separate Jest config
// for unit vs. integration (see app/backend/README.md#testing).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
