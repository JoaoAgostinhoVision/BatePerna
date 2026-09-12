import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fatosDaTrilha, type TrilhaCompacta } from "@/lib/fatos-da-trilha";

/** 🔴 O DEFEITO QUE ESTE ARQUIVO TRANCA (2026-09-11). A montagem da linha
 *  "· barro · R$ 5 · sábado e domingo" morava DENTRO do `CartaoTrilha`, e
 *  `/trilhas` mostrava outra coisa. Quando a lista do acervo passou a mostrar
 *  os mesmos fatos, a saída preguiçosa era copiar a lista pra lá — e aí seriam
 *  **duas telas classificando o mesmo campo por conta própria**, inclusive o
 *  NÍVEL de cada um, que é a régua da L3 e decisão DELE.
 *
 *  ⚠️ A RÉGUA: nada aqui afirma sobre um lugar. As fixtures são sintéticas e
 *  medem a FUNÇÃO; quem mede o conteúdo real é `coerencia-acervo` e os testes
 *  de tela. */

const BASE: TrilhaCompacta = {
  custo: { tag: "gratis" },
  trajeto: { waypoints: [{ lat: -8.5, lng: -36.8 }] },
};

const textos = (t: TrilhaCompacta, o = {}) => fatosDaTrilha(t, o).map((f) => f.texto);
const niveis = (t: TrilhaCompacta, o = {}) => fatosDaTrilha(t, o).map((f) => f.nivel);

describe("os fatos compactos de uma trilha", () => {
  it("trilha sem nada declarado não inventa fato nenhum", () => {
    expect(fatosDaTrilha(BASE)).toEqual([]);
  });

  // 🔴 A CLASSIFICAÇÃO DE NÍVEL É O CONTEÚDO DESTA FUNÇÃO, não a ordem das
  // strings. Nível A é o que o telefone calcula igual pra qualquer um; Nível B
  // é o que só sabe quem foi, e brilha na tela. Decisão dele em 2026-09-09:
  // *"preço e horário brilham"*.
  it("distância é Nível A; piso, preço, dias e hora são Nível B", () => {
    const t: TrilhaCompacta = {
      ...BASE,
      piso: "barro",
      custo: { tag: "pago", valor: "R$ 5 por pessoa · cobrado no portão" },
      horario: { abre: "05:00", fecha: "17:00" },
      dias: ["sab", "dom"],
    };
    const o = { voce: { lat: -8.0, lng: -36.8 }, comAbertura: true };
    expect(textos(t, o)).toEqual([
      textos(t, o)[0], // a distância, seja qual for o número
      "barro",
      "R$ 5 por pessoa",
      "sábado e domingo",
      "5h–17h",
    ]);
    expect(niveis(t, o)).toEqual([undefined, "b", "b", "b", "b"]);
  });

  // Mata: marcar a distância como Nível B. Ela é o telefone calculando — se
  // brilhasse, a tela diria que saber a distância é conhecimento de quem foi.
  it("a distância NUNCA brilha, e é a única assim", () => {
    const t = { ...BASE, piso: "barro" as const };
    const fatos = fatosDaTrilha(t, { voce: { lat: -8.0, lng: -36.8 } });
    expect(fatos[0].nivel, "a distância virou Nível B").toBeUndefined();
    expect(fatos.slice(1).every((f) => f.nivel === "b"), "algum fato de lugar deixou de brilhar").toBe(true);
  });

  // 🔴 AS DUAS PORTAS DO SILÊNCIO, iguais às do resto do app: sem localização a
  // distância não entra, e sem o campo o fato não entra. Ausente é silêncio.
  it("sem localização, a distância simplesmente não entra", () => {
    const t = { ...BASE, piso: "barro" as const };
    expect(textos(t)).toEqual(["barro"]);
    expect(textos(t, { voce: null })).toEqual(["barro"]);
  });

  it("ficha grátis não mostra preço nenhum", () => {
    expect(textos({ ...BASE, custo: { tag: "gratis" } })).toEqual([]);
  });

  // O `custo.valor` é texto livre — o schema não garante separador. O corte
  // aceita " · " e " — ", e sem separador devolve a string inteira.
  it("o preço é cortado no primeiro separador, e sobrevive à ausência dele", () => {
    const pago = (valor: string) => textos({ ...BASE, custo: { tag: "pago", valor } });
    expect(pago("R$ 10 por pessoa · pago na entrada")).toEqual(["R$ 10 por pessoa"]);
    expect(pago("R$ 10 por pessoa — pago na entrada")).toEqual(["R$ 10 por pessoa"]);
    expect(pago("R$ 10")).toEqual(["R$ 10"]);
  });

  // 🔴 `comAbertura` SEPARA AS DUAS TELAS, e o padrão é `false` de propósito: o
  // cartão da home já tem o selo dizendo "Fechado agora · abre amanhã", e
  // repetir os dias ali alongaria uma linha que já quebra em duas no celular.
  // Um padrão `true` encheria a home sem ninguém decidir isso.
  it("por padrão a abertura NÃO entra — é a linha do cartão da home", () => {
    const t: TrilhaCompacta = { ...BASE, dias: ["sab", "dom"], horario: { abre: "05:00", fecha: "17:00" } };
    expect(textos(t)).toEqual([]);
    expect(textos(t, { comAbertura: true })).toEqual(["sábado e domingo", "5h–17h"]);
  });

  // 🔴 OS DOIS EIXOS VÊM SEPARADOS, e é o mesmo motivo pelo qual `dias` não mora
  // dentro de `horario`: uma trilha pode ter dia sem hora (a Rampa) ou hora sem
  // dia. Juntá-los numa string só obrigaria a inventar a metade que falta.
  it("dia sem hora, e hora sem dia, cada um sozinho", () => {
    expect(textos({ ...BASE, dias: ["sab", "dom"] }, { comAbertura: true })).toEqual(["sábado e domingo"]);
    expect(textos({ ...BASE, horario: { abre: "08:00", fecha: "17:00" } }, { comAbertura: true }))
      .toEqual(["8h–17h"]);
  });
});

// 🔴 A PROVA DE QUE A MONTAGEM É UMA SÓ. Sem isto, alguém "conserta" a lista do
// acervo escrevendo de novo os mesmos quatro campos lá dentro, a suíte fica
// verde, e as duas telas voltam a poder classificar o mesmo piso de formas
// diferentes — que é exatamente o que este refactor desfez.
describe("as duas telas leem a MESMA montagem", () => {
  const fonte = (p: string[]) =>
    readFileSync(path.join(process.cwd(), "src", ...p), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  const cartao = fonte(["app", "CartaoTrilha.tsx"]);
  const lista = fonte(["app", "ListaDoAcervo.tsx"]);

  it("as duas chamam fatosDaTrilha — e a tira de comentários não comeu os arquivos", () => {
    expect(cartao, "a tira comeu o CartaoTrilha").toContain("export default function");
    expect(lista, "a tira comeu a lista").toContain("export default function");
    expect(cartao, "o cartão da home parou de usar a montagem única").toContain("fatosDaTrilha(");
    expect(lista, "a lista do acervo parou de usar a montagem única").toContain("fatosDaTrilha(");
  });

  // 🔴 ESTE TESTE MUDOU DE ALVO EM 2026-09-11, e o jeito como isso aconteceu
  // vale mais que o teste: a lista do acervo mudou-se de `trilhas/page.tsx`
  // pro componente `ListaDoAcervo` (o `not-found` passou a precisar dela), e
  // o guarda ficou VERMELHO na hora, dizendo que a página tinha parado de usar
  // a montagem única. Era verdade e era inofensivo — ela delega. Guarda que
  // acusa mudança inofensiva ainda é guarda vivo; o que não serve é o que fica
  // verde apontando pra um arquivo que não faz mais nada.
  //
  // Agora ele guarda as TRÊS: quem monta (o componente e o cartão) e quem
  // delega (as duas páginas que mostram o acervo).
  it("as páginas do acervo DELEGAM — nenhuma delas remonta a lista por conta própria", () => {
    for (const caminho of [["app", "trilhas", "page.tsx"], ["app", "not-found.tsx"]]) {
      const src = fonte(caminho);
      const nome = caminho.join("/");
      expect(src, `a tira comeu ${nome}`).toContain("export default function");
      expect(src, `${nome} parou de usar a lista única`).toContain("<ListaDoAcervo");
      expect(
        src.includes("lista-item"),
        `${nome} voltou a desenhar a lista por conta própria`,
      ).toBe(false);
    }
  });

  // Mata: remontar a linha à mão em qualquer uma das duas que MONTAM. Os nomes
  // abaixo são os campos que a montagem tira da ficha — nenhum deles deve ser
  // lido diretamente por uma tela que já recebe os fatos prontos.
  it("nenhuma das duas remonta a linha à mão", () => {
    for (const [nome, src] of [["o cartão da home", cartao], ["a lista do acervo", lista]] as const) {
      for (const campo of ["rotuloPiso", "custo.valor", "rotuloDias", "rotuloFaixaCurta"]) {
        expect(src.includes(campo), `${nome} voltou a montar "${campo}" por conta própria`).toBe(false);
      }
    }
  });
});
