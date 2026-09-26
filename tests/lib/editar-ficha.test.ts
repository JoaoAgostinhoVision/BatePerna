import { describe, expect, it } from "vitest";
import { aplicarCampo, eCampoEditavel } from "@/lib/editar-ficha";
import { loadAll } from "@/lib/ficha";

// 🔴 C5 da revisão do controlador: `.find` sem guarda devolve `undefined`, e
// `JSON.stringify(undefined)` é o VALOR `undefined` — que só estoura lá na
// frente, no `JSON.parse`, com uma mensagem que não diz nada sobre a causa.
const fichaBase = loadAll().find((f) => f.slug === "rampa-do-pepe");
if (!fichaBase) throw new Error('"rampa-do-pepe" sumiu de content/fichas');
const DOC = JSON.stringify(fichaBase);

describe("aplicarCampo", () => {
  it("aplica o campo e devolve documento válido", () => {
    const novo = JSON.parse(aplicarCampo(DOC, "voz", "a serra firmou de novo"));
    expect(novo.voz).toBe("a serra firmou de novo");
  });

  // 🔴 O documento INTEIRO é revalidado, não só o campo — é esta porta que
  // impede um formulário de gravar ficha quebrada, e ela é a única que existe.
  it("valor que quebra o schema estoura, e NÃO devolve documento", () => {
    expect(() => aplicarCampo(DOC, "voz", 42 as unknown as string)).toThrow();
  });

  it("documento já podre no banco não passa por ser editado num campo bom", () => {
    expect(() => aplicarCampo('{"slug":"x"}', "voz", "qualquer")).toThrow();
  });

  it("campo fora da lista não é editável", () => {
    expect(eCampoEditavel("slug")).toBe(false);
    expect(eCampoEditavel("piso")).toBe(false);
    expect(eCampoEditavel("voz")).toBe(true);
  });

  // 🔴 Editar a voz não pode mexer no piso. O spread é o que garante isso, e
  // sem este teste trocá-lo por `{ [campo]: valor }` passa verde no teste de
  // cima (a voz muda mesmo) e apaga a ficha inteira.
  it("só o campo pedido muda; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "voz", "outra coisa"));
    expect({ ...depois, voz: antes.voz }).toEqual(antes);
  });
});
