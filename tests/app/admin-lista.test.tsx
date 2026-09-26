import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import ListaDeLugares from "@/app/admin/ListaDeLugares";
import { marcaAgora } from "@/app/admin/marca-agora";
import { loadAll } from "@/lib/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

afterEach(() => cleanup());

const FICHAS = loadAll();

// Não importa o estado do motor pra provar link -> slug — qualquer leitura
// "seca" serve.
const leituraSeca: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: 1_758_000_000, aviso: null };

// 🔴 Sábado ao meio-dia em Recife: dentro da janela de horário de Pedra
// Furada (5h–17h) e Véu de Noiva (8h–17h), e a Rampa do Pepê (só sáb/dom)
// também aberta — mesmo instante que `tests/app/painel-admin.test.tsx` já usa
// (lá, `SAB_MEIODIA`) pra manter o acervo INTEIRO fora do calendário fechado,
// sem reinventar a conta.
const SAB_MEIODIA = 1_757_170_800;

// 🔴 CORREÇÃO ALÉM DAS QUATRO RULINGS, MEDIDA E NÃO SUPOSTA: o brief original
// usava leitura "fresco" pra montar as marcas esperadas do 2º teste. Mas
// `marcaDe` só olha a severidade da ficha quando o ESTADO é "frio" — com
// "fresco" ela sempre devolve "Pode ir", não importa a severidade. Isso
// colapsava as três marcas esperadas numa só ("Pode ir" × 3), o que quebra
// DUAS coisas ao mesmo tempo: (a) o `toBeGreaterThan(1)` da Ruling P10b nunca
// seria satisfazível, e (b) o mutante M4 (hardcode "Pode ir" literal) ficaria
// IDÊNTICO ao certo — nunca morreria, não importa como o componente escopa a
// asserção. "frio" é a leitura que faz `falaMolhada` falar a severidade de
// cada ficha (espera / não-vá / cuidado — a mesma variedade que a Ruling
// P10b mediu), e é o que faz M4 de fato morrer.
const leituraFria: LeituraCarimbo = { estado: "frio", erro: false, calculadoEm: SAB_MEIODIA, aviso: null };

describe("ListaDeLugares", () => {
  // 🔴 O modo de falha que este teste tranca é o link do lugar errado: tocar
  // na Pedra Furada e cair na Rampa — e editar a voz de um lugar achando que é
  // a de outro é a pior coisa que este painel pode fazer.
  it("lista todos os lugares, cada um linkando pro próprio slug", () => {
    render(
      <ListaDeLugares
        fichas={FICHAS}
        leituras={Object.fromEntries(FICHAS.map((f) => [f.slug, leituraSeca]))}
        agora={1_758_000_000}
      />,
    );
    for (const f of FICHAS) {
      const link = screen.getByRole("link", { name: new RegExp(f.trajeto.waypoints[0].nome, "i") });
      expect(link.getAttribute("href")).toBe(`/admin/${f.slug}`);
    }
  });

  // 🔴 RULING P10. Duas correções sobre o teste do brief:
  //  (a) a asserção da marca fica ESCOPADA ao <li> do lugar — nunca um
  //      `getAllByText` solto na tela inteira, que prova só "a marca está EM
  //      ALGUM LUGAR", não "a marca está ao lado do NOME CERTO". É a forma
  //      que pega a troca de marcas entre lugares (M5, abaixo).
  //  (b) `new Set(marcas).size` exige MAIS DE UMA marca distinta (`>1`), não
  //      "não vazio" (`>0`, que qualquer acervo não-vazio satisfaz mesmo sem
  //      variedade nenhuma).
  it("o rótulo de cada lugar é o do selo público daquele lugar", () => {
    const leituras = Object.fromEntries(FICHAS.map((f) => [f.slug, leituraFria]));
    render(<ListaDeLugares fichas={FICHAS} leituras={leituras} agora={SAB_MEIODIA} />);

    const marcas = FICHAS.map((f) => marcaAgora(f, leituraFria, SAB_MEIODIA));
    expect(new Set(marcas).size, "acervo sem variedade de voz não prova nada aqui").toBeGreaterThan(1);

    for (const f of FICHAS) {
      const marcaEsperada = marcaAgora(f, leituraFria, SAB_MEIODIA);
      const link = screen.getByRole("link", { name: new RegExp(f.trajeto.waypoints[0].nome, "i") });
      const item = link.closest("li");
      expect(item, `sem <li> envolvendo o link de ${f.slug}`).not.toBeNull();
      // Escopado ao ITEM deste lugar: a pergunta é "a marca ao lado DESTE nome
      // é a marca DESTE lugar?", nunca "a marca aparece em algum lugar da
      // tela?" — a segunda pergunta passaria com as marcas trocadas entre
      // lugares (M5).
      const escapada = marcaEsperada.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(within(item!).getByText(new RegExp(escapada, "i"))).not.toBeNull();
    }
  });
});
