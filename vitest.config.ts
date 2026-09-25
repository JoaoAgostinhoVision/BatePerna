import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // A suite deste app e SO o que mora em `tests/`. Sem esta linha, o glob
    // padrao do vitest (`**/*.test.*`) varre o repo inteiro e engole os testes
    // de `/BatePerna/` -- uma copia git-ignored de outro projeto que mora aqui
    // dentro e importa modulos que este app nao tem. O resultado era uma suite
    // vermelha por codigo que nao e nosso, quebrando a regra de "todo commit
    // roda `npx vitest run` verde" por uma pasta que o git nem versiona.
    include: ["tests/**/*.test.{ts,tsx}"],
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
