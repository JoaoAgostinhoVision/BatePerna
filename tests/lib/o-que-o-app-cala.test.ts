import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPOS_DA_FICHA } from "@/lib/campos-da-ficha";
import { oQueOAppCala } from "@/lib/o-que-o-app-cala";
import { rascunhoCompleto } from "../rascunho-completo";

/** O QUE O APP VAI CALAR (Tarefa 12): uma frase por opcional ausente.
 *
 *  Nenhum lugar real: o rascunho é o marcador de `tests/rascunho-completo.ts`. */

const S = "lugar-marcador-cala-cidade-marcador-cala";
const completo = () => rascunhoCompleto(S, "Lugar Marcador Cala", "Cidade Marcador Cala");

/** O documento sem o caminho concreto `caminho` (ponto `0` no lugar do molde). */
function sem(caminho: string, doc: Record<string, unknown> = completo()): Record<string, unknown> {
  const copia = structuredClone(doc);
  const degraus = caminho.split(".");
  let no: Record<string, unknown> = copia;
  for (const d of degraus.slice(0, -1)) no = no[d] as Record<string, unknown>;
  delete no[degraus.at(-1)!];
  return copia;
}

const OPCIONAIS = CAMPOS_DA_FICHA.filter((c) => !c.obrigatorio).map((c) => c.caminho.replace("[]", ".0"));

describe("oQueOAppCala", () => {
  it("nomeia, em português, o que o app deixa de dizer por cada campo ausente", () => {
    const frases = oQueOAppCala(sem("horario", sem("piso")));
    expect(frases).toHaveLength(2);
    expect(frases.some((f) => /chão|via/i.test(f))).toBe(true);
    expect(frases.some((f) => /fecha por hora/i.test(f))).toBe(true);
  });

  // 🔴 Não-vacuidade: uma função que devolve [] sempre passaria no inverso.
  it("ficha completa não cala nada", () => {
    expect(oQueOAppCala(completo())).toEqual([]);
  });

  // 🔴 A COMPLETUDE (G2): o conjunto vem do REGISTRO, não de uma lista à mão.
  // Cada opcional ausente, sozinho, dá EXATAMENTE uma frase — e frases distintas
  // entre campos distintos. O documento é PAGO, onde os de custo valem.
  it("cada opcional do registro, ausente, cala com uma frase só dele", () => {
    expect(OPCIONAIS.length, "a premissa: o registro tem opcionais").toBeGreaterThanOrEqual(8);
    const vistas = new Map<string, string>();
    for (const caminho of OPCIONAIS) {
      const frases = oQueOAppCala(sem(caminho));
      expect(frases, `${caminho} ausente`).toHaveLength(1);
      const [frase] = frases;
      expect(frase, `${caminho}: a frase é o caminho cru`).not.toBe(caminho);
      expect(frase, `${caminho}: a frase tem cara de caminho, não de português`).not.toMatch(/^[w.[]]+$/);
      expect(vistas.has(frase), `${caminho} repete a frase de ${vistas.get(frase)}`).toBe(false);
      vistas.set(frase, caminho);
    }
  });

  // 🔴 O INVERSO (I6): num lugar GRÁTIS, o valor e o chip não existem — a
  // ausência deles não cala nada, e dizer que calou seria falar de um tipo de
  // lugar num componente que serve todos.
  it("num lugar grátis, sem valor e sem chip, nada do custo é calado", () => {
    const gratis = { ...completo(), custo: { tag: "gratis" } };
    expect(oQueOAppCala(gratis)).toEqual([]);
    const pago = { ...completo(), custo: { tag: "pago" } };
    expect(oQueOAppCala(pago), "a premissa: pago sem os dois cala duas").toHaveLength(2);
  });

  it("nenhuma frase é o nome do campo cru", () => {
    const frases = oQueOAppCala(sem("secaRapido"));
    expect(frases).toHaveLength(1);
    for (const f of frases) {
      expect(f).not.toBe("secaRapido");
      expect(f).toMatch(/^Sem ele, /);
    }
  });

  // 🔴 A NOTA É MOLDE: uma frase só, pelo ponto 0 — o único de um lugar novo.
  it("o ponto 0 sem nota cala uma frase", () => {
    const frases = oQueOAppCala(sem("trajeto.waypoints.0.nota"));
    expect(frases).toHaveLength(1);
    expect(frases[0]).toMatch(/nota/);
  });

  // 🔴 M8 da auditoria: "f.length > 15" passa com qualquer frase. Aqui cada
  // frase é a do QUESTIONÁRIO, por subtração (o trecho depois do travessão,
  // com a primeira letra maiúscula e sem o negrito), ou uma das duas que ele não
  // cobre e que são redação minha, PENDENTE no código.
  it("cada frase é a do questionário por subtração, ou uma das duas que ele não cobre", () => {
    const doc = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\*\*/g, "");
    const listaDoDoc = doc.slice(doc.indexOf("Seis respostas são opcionais"), doc.indexOf("Nota pra quem mantém o schema"));
    expect(listaDoDoc.length, "a premissa: a lista dos opcionais foi achada no questionário").toBeGreaterThan(200);
    const corrido = listaDoDoc.replace(/\s*\n\s*/g, " ");
    const naoCobertos = new Set(["trajeto.waypoints.0.nota", "custo.valor"]);
    for (const caminho of OPCIONAIS) {
      const [frase] = oQueOAppCala(sem(caminho));
      if (naoCobertos.has(caminho)) continue;
      const comMinuscula = frase[0].toLowerCase() + frase.slice(1);
      expect(corrido, `${caminho}: "${frase}" não é trecho do questionário`).toContain(comMinuscula);
    }
  });

  it("documento que não é objeto: tudo ausente, nada estoura", () => {
    expect(oQueOAppCala(null).length).toBeGreaterThan(0);
    expect(oQueOAppCala("texto").length).toBe(oQueOAppCala(null).length);
  });
});
