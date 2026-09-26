import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HistoricoDaVoz from "@/app/admin/HistoricoDaVoz";

// 🔴 C3 da revisão do controlador: este arquivo (teste de TELA) fica em
// `tests/app/`; o teste de ROTA acrescentado na Task 7 mora em
// `tests/api/route-admin-ficha.test.ts`, junto dos irmãos da Task 6.

const SLUG = "rampa-do-pepe";
const AGORA = 1_758_200_000;

describe("HistoricoDaVoz", () => {
  // 🔴 O autor é por LINHA, não fixo. Com rótulo fixo o João leria "você, pelo
  // painel" na frase que eu transcrevi em agosto — e a procedência, que é a
  // razão desta tabela existir, viraria decoração.
  it("mostra quem escreveu cada versão", () => {
    render(
      <HistoricoDaVoz
        versoes={[
          { id: 2, ficha_slug: SLUG, doc: JSON.stringify({ voz: "nova" }), autor: "painel", criado_em: AGORA + 10 },
          { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente", criado_em: AGORA },
        ]}
      />,
    );
    expect(screen.getByText(/você, pelo painel/i)).toBeTruthy();
    expect(screen.getByText(/acervo original/i)).toBeTruthy();
  });
});
