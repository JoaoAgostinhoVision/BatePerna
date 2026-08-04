import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    // Node 22+ ships an experimental built-in `localStorage` global that, when
    // no --localstorage-file is configured, shadows jsdom's window.localStorage
    // with a broken stub (no .clear/.setItem/etc). Disabling it lets jsdom's
    // own Storage implementation populate the global as expected.
    poolOptions: {
      threads: { execArgv: ["--no-experimental-webstorage"] },
      forks: { execArgv: ["--no-experimental-webstorage"] },
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
