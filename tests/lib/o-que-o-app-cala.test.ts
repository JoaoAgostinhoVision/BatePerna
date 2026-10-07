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

/** Tem cara de caminho de campo, não de português: só letras sem acento,
 *  dígitos, `_`, ponto e colchetes (`custo.valor`, `trajeto.waypoints[0].nota`). */
const CARA_DE_CAMINHO = /^[\w.[\]]+$/;

/** As frases que o M6 da revisão da Tarefa 12 CORTOU do item do questionário. */
const CORTADAS = new Set(["custo.curto", "horario"]);

/** O item do questionário de `caminho`, do travessão ao próximo item — com a
 *  primeira letra como está lá (minúscula). */
function itemDoQuestionario(corrido: string, caminho: string): string {
  const inicio = corrido.indexOf(`\`${caminho}\` — `);
  if (inicio < 0) return "";
  const resto = corrido.slice(inicio + caminho.length + 5);
  const fim = resto.indexOf(" - `");
  return fim < 0 ? resto : resto.slice(0, fim);
}

/** `frase` é `item` com trechos TIRADOS e nada posto: as palavras dela, sem a
 *  pontuação de fim, aparecem em ordem nas dele. */
function subtracaoDe(frase: string, item: string): boolean {
  const palavras = (t: string) => t.split(/\s+/).map((p) => p.replace(/[.,:;]+$/, "")).filter((p) => p !== "");
  const dele = palavras(item);
  let i = 0;
  for (const p of palavras(frase)) {
    while (i < dele.length && dele[i] !== p) i++;
    if (i === dele.length) return false;
    i++;
  }
  return true;
}

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
      expect(frase, `${caminho}: a frase tem cara de caminho, não de português`).not.toMatch(CARA_DE_CAMINHO);
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

  // 🔴 M5 da revisão da Tarefa 12: o regex era `/^[w.[]]+$/` (sem as barras), e
  // não casava caminho cru nenhum. O controle prova que este casa.
  it("controle: a régua de 'cara de caminho' casa o caminho cru e não casa português", () => {
    for (const cru of ["custo.valor", "trajeto.waypoints.0.nota", "trajeto.waypoints[0].nota", "secaRapido"]) {
      expect(cru, cru).toMatch(CARA_DE_CAMINHO);
    }
    expect("Sem ele, a ficha nunca fecha por hora.").not.toMatch(CARA_DE_CAMINHO);
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
  // cobre e que são redação minha, que ele leu e marcou "Serve" (07/10).
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
      if (CORTADAS.has(caminho)) {
        const item = itemDoQuestionario(corrido, caminho);
        expect(item.length, `${caminho}: a premissa: o item foi achado no questionário`).toBeGreaterThan(20);
        expect(subtracaoDe(comMinuscula, item), `${caminho}: "${frase}" não é o item do questionário com trechos tirados`).toBe(true);
        expect(corrido, `${caminho}: a frase cortada voltou inteira — tire-a de CORTADAS`).not.toContain(comMinuscula);
        continue;
      }
      expect(corrido, `${caminho}: "${frase}" não é trecho do questionário`).toContain(comMinuscula);
    }
  });

  // 🔴 M6 da revisão da Tarefa 12: duas frases do questionário eram FALSAS
  // juntas de outro campo ausente ("o chip do topo mostra só o preço" — numa
  // ficha paga sem valor, ele mostra "Pago"; "o carimbo decide só pela chuva" —
  // com `dias` respondido, o lugar também fecha por dia). O conserto foi só por
  // SUBTRAÇÃO, e isto é o que a régua aceita: as palavras da frase, em ordem,
  // tiradas do item do questionário, nenhuma acrescentada.
  it("controle da subtração: palavra acrescentada ou fora de ordem não passa", () => {
    const item = "sem ele, a ficha nunca fecha por hora, e o carimbo decide só pela chuva.";
    expect(subtracaoDe("sem ele, a ficha nunca fecha por hora.", item)).toBe(true);
    expect(subtracaoDe("sem ele, a ficha nunca fecha por dia.", item)).toBe(false);
    expect(subtracaoDe("sem ele, a ficha fecha nunca por hora.", item)).toBe(false);
  });

  it("documento que não é objeto: tudo ausente, nada estoura", () => {
    expect(oQueOAppCala(null).length).toBeGreaterThan(0);
    expect(oQueOAppCala("texto").length).toBe(oQueOAppCala(null).length);
  });

  /** A frase de UM opcional ausente, sozinho, num documento pago. */
  const fraseDe = (caminho: string): string => oQueOAppCala(sem(caminho))[0];
  const DE_CUSTO = new Set(["custo.valor", "custo.curto"]);

  // 🔴 SEM `custo.tag`, O LUGAR NÃO É PAGO: a régua do custo pergunta "é pago?",
  // nunca "não é grátis?". Um documento sem tag (ou que nem abre) não cala o
  // valor nem o chip — dizer que calou seria falar de um lugar pago que ninguém
  // disse que é.
  it("documento que não é objeto: as frases de todo opcional que não é de custo, na ordem do registro", () => {
    const semCusto = OPCIONAIS.filter((c) => !DE_CUSTO.has(c));
    expect(semCusto.length, "a premissa: seis opcionais fora do custo").toBe(6);
    expect(oQueOAppCala(null)).toEqual(semCusto.map(fraseDe));
  });

  it("documento completo SEM custo nenhum: nada do custo é calado", () => {
    const doc = completo();
    delete doc.custo;
    expect(oQueOAppCala(doc)).toEqual([]);
  });

  // 🔴 A ORDEM É A DO REGISTRO, com mais de um ausente.
  it("dois ausentes saem na ordem do registro", () => {
    const [primeiro, segundo] = OPCIONAIS.filter((c) => c === "piso" || c === "horario");
    expect([primeiro, segundo], "a premissa: os dois estão no registro").toHaveLength(2);
    expect(oQueOAppCala(sem("horario", sem("piso")))).toEqual([fraseDe(primeiro), fraseDe(segundo)]);
  });
});
