import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fichaSchema } from "@/types/ficha";

const DOC = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8");

describe("o questionário cobre a ficha inteira", () => {
  it("todo campo do schema tem pergunta — senão a ficha nova nasce incompleta", () => {
    for (const campo of Object.keys(fichaSchema.shape)) {
      expect(DOC, `faltou pergunta para "${campo}"`).toContain(`\`${campo}\``);
    }
  });
});
