import { afterEach, describe, expect, it } from "vitest";
import {
  CHAVE_FILA,
  diaRecife,
  guardar,
  pendentes,
  remover,
  type Relato,
} from "@/lib/fila-relato";

afterEach(() => localStorage.clear());

/** 🔴 O DEFEITO QUE ESTA FILA FECHA (2026-09-10): o `✓ Fui` é a ÚNICA porta pela
 *  qual conhecimento de quem foi entra neste app sem o dono escrever uma ficha —
 *  e ela se fechava exatamente onde a pessoa está quando tem o que contar: no
 *  lugar, sem sinal. O `catch` do envio pintava uma tela de erro e o relato
 *  morria ali.
 *
 *  Nenhum teste daqui usa timer falso: **o relógio entra por parâmetro**, que é
 *  o que permite virar o dia sem mexer em estado global. */
const UM_DIA = 86_400_000;
// 2027-01-15, 14h em Recife (17h UTC) — bem longe das bordas do dia.
const AGORA = Date.UTC(2027, 0, 15, 17, 0);

const relato = (slug: string, tipo: "seco" | "barro" = "seco", ms = AGORA): Relato => ({
  slug,
  tipo,
  dia: diaRecife(ms),
});

describe("diaRecife: a conta que agora tem um dono só", () => {
  // 🔴 Ela estava escrita à mão dentro do ConfirmarFui.tsx, e passou a ser
  // precisa em dois lugares (a chave do "já contou" e o descarte da fila).
  it("o dia vira às 03h UTC, que é a meia-noite de Recife (UTC−3)", () => {
    const vespera = Date.UTC(2027, 0, 16, 2, 59); // 23h59 do dia 15, em Recife
    const virada = Date.UTC(2027, 0, 16, 3, 0); //  00h00 do dia 16, em Recife
    expect(diaRecife(virada)).toBe(diaRecife(vespera) + 1);
  });

  // 🔴 O CONTROLE DO FUSO, e ele é o que separa "a conta está certa" de "a conta
  // roda": se `diaRecife` esquecesse o offset e usasse UTC puro, o teste acima
  // continuaria passando — a virada só mudaria de hora. Esta asserção fixa QUAL
  // hora, e mata a versão sem fuso.
  it("e NÃO vira à meia-noite UTC — senão o fuso não estaria lá", () => {
    const antesUTC = Date.UTC(2027, 0, 15, 23, 59);
    const depoisUTC = Date.UTC(2027, 0, 16, 0, 0);
    expect(diaRecife(depoisUTC)).toBe(diaRecife(antesUTC));
  });

  it("a tarde inteira de um mesmo dia é o mesmo dia", () => {
    expect(diaRecife(AGORA)).toBe(diaRecife(AGORA + 3 * 3_600_000));
  });
});

describe("a fila guarda e devolve", () => {
  it("o que foi guardado volta em pendentes", () => {
    guardar(relato("rampa-do-pepe", "barro"));
    expect(pendentes(AGORA)).toEqual([{ slug: "rampa-do-pepe", tipo: "barro", dia: diaRecife(AGORA) }]);
  });

  it("trilhas diferentes convivem", () => {
    guardar(relato("rampa-do-pepe"));
    guardar(relato("veu-de-noiva-de-bonito", "barro"));
    expect(pendentes(AGORA).map((r) => r.slug).sort()).toEqual([
      "rampa-do-pepe",
      "veu-de-noiva-de-bonito",
    ]);
  });

  // 🔴 MUTAÇÃO: um `push` simples no lugar do filtro. A pessoa que erra o botão
  // e responde de novo viraria DOIS relatos, e nenhum contador de "foram"
  // aguenta contar a mesma ida duas vezes sem mentir.
  it("um relato por trilha por dia — o último ganha, e não vira dois", () => {
    guardar(relato("rampa-do-pepe", "seco"));
    guardar(relato("rampa-do-pepe", "barro"));
    expect(pendentes(AGORA)).toHaveLength(1);
    expect(pendentes(AGORA)[0].tipo).toBe("barro");
  });

  it("remover tira só o relato certo", () => {
    guardar(relato("rampa-do-pepe"));
    guardar(relato("veu-de-noiva-de-bonito"));
    remover(relato("rampa-do-pepe"));
    expect(pendentes(AGORA).map((r) => r.slug)).toEqual(["veu-de-noiva-de-bonito"]);
  });
});

describe("o descarte do dia vencido, que é a decisão mais delicada daqui", () => {
  // 🔴 O placar do app é do DIA DE HOJE. Um relato de ontem subindo hoje seria
  // contado como se a pessoa tivesse ido hoje — o app afirmando sobre um dia em
  // que ninguém foi. Enquanto a rota não carregar o dia de origem, o relato
  // vencido é descartado, e isso está anotado como pergunta no RESUME.
  it("relato de ontem não sobe", () => {
    guardar(relato("rampa-do-pepe", "seco", AGORA - UM_DIA));
    expect(pendentes(AGORA)).toEqual([]);
  });

  it("e ele some do armazenamento — fila que só cresce é lixo no aparelho", () => {
    guardar(relato("rampa-do-pepe", "seco", AGORA - UM_DIA));
    pendentes(AGORA);
    expect(localStorage.getItem(CHAVE_FILA)).toBeNull();
  });

  it("o de ontem some sem levar o de hoje junto", () => {
    guardar(relato("rampa-do-pepe", "seco", AGORA - UM_DIA));
    guardar(relato("veu-de-noiva-de-bonito", "barro"));
    expect(pendentes(AGORA).map((r) => r.slug)).toEqual(["veu-de-noiva-de-bonito"]);
  });
});

describe("corpo inválido é fila VAZIA, nunca relato inventado", () => {
  // 🔴 `localStorage` é editável por qualquer um e sobrevive a troca de versão
  // do app. Um JSON de outra época daria `undefined` nos três campos, e um
  // relato com `slug: undefined` subiria pra uma ficha que não existe. Mesma
  // régua do `ehLeitura` no Carimbo — o corpo é conferido, não assumido.
  // 🔴 TODO CORPO PODRE AQUI CARREGA O DIA DE HOJE, e isso é o teste. A
  // primeira versão deste bloco usava `dia: 20000` — um dia de 2024 — e
  // **passava por engano**: quem rejeitava era o DESCARTE POR DIA, não o
  // validador. Medido por mutação (M30): trocar `cru.filter(ehRelato)` por um
  // `cast` cru deixava a suíte VERDE. O teste dizia provar uma coisa e provava
  // outra.
  const HOJE = diaRecife(AGORA);
  it.each([
    ["JSON quebrado", "{{{"],
    ["não é lista", '{"slug":"x"}'],
    ["item sem slug", `[{"tipo":"seco","dia":${HOJE}}]`],
    ["tipo fora do par", `[{"slug":"x","tipo":"lama","dia":${HOJE}}]`],
    ["dia não é número", '[{"slug":"x","tipo":"seco","dia":"hoje"}]'],
    ["slug vazio", `[{"slug":"","tipo":"seco","dia":${HOJE}}]`],
    ["item nulo", `[null,{"slug":"x","tipo":"seco"}]`],
  ])("%s não vira relato", (_nome, cru) => {
    localStorage.setItem(CHAVE_FILA, cru);
    expect(pendentes(AGORA)).toEqual([]);
  });

  it("e o item bom sobrevive ao item podre ao lado", () => {
    const bom = { slug: "rampa-do-pepe", tipo: "seco", dia: diaRecife(AGORA) };
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: 42, tipo: "seco", dia: diaRecife(AGORA) }, bom]));
    expect(pendentes(AGORA)).toEqual([bom]);
  });
});

describe("a chave não fica pra trás", () => {
  // Sem isto, todo aparelho que uma vez ficou sem sinal carregaria a chave pra
  // sempre — e um `localStorage` cheio de chaves mortas é o que faz o app
  // parecer que "guardou alguma coisa" quando não guardou nada.
  it("esvaziar a fila APAGA a chave, em vez de guardar uma lista vazia", () => {
    const r = relato("rampa-do-pepe");
    guardar(r);
    expect(localStorage.getItem(CHAVE_FILA)).not.toBeNull(); // controle
    remover(r);
    expect(localStorage.getItem(CHAVE_FILA)).toBeNull();
  });
});
