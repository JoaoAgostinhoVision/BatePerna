import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import BuscaLugar, { ESPERA_MS } from "@/app/BuscaLugar";
import LocalVivo from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL } from "@/lib/local";
import { readFileSync } from "node:fs";
import path from "node:path";

// `ESPERA_MS` sai EXPORTADO de BuscaLugar.tsx (o Step 3 abaixo já traz o
// `export`). Mesmo precedente do `zoomDeTiles()` em src/lib/mapa.ts —
// "exportado (em vez de inline no componente) pra esse invariante ter teste".
// Assim os testes de relógio avançam o tempo pelo valor REAL: mudar a espera
// não faz um teste mentir, e não trava o valor a um número escrito à mão.

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const GRAVATA = { nome: "Gravatá", regiao: "Pernambuco", pais: "Brasil", lat: -8.2, lng: -35.56 };
// Segunda cidade, pros dois testes de relógio falso lá embaixo. Nome diferente
// de propósito — a REGIÃO das duas é a mesma (Pernambuco), então asserção por
// região não distinguiria uma da outra.
const RECIFE = { nome: "Recife", regiao: "Pernambuco", pais: "Brasil", lat: -8.05, lng: -34.9 };

function comLocalVivo() {
  return render(<LocalVivo><BuscaLugar /></LocalVivo>);
}

describe("a pílula", () => {
  it("sem localização e sem gps negado, convida", () => {
    comLocalVivo();
    expect(screen.getByRole("button", { name: /Ver daqui/ })).toBeTruthy();
  });

  it("com gps negado, oferece o caminho manual", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    comLocalVivo();
    expect(await screen.findByRole("button", { name: /escolher onde estou/ })).toBeTruthy();
  });

  it("com lugar escolhido, diz o nome dele", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    comLocalVivo();
    expect(await screen.findByRole("button", { name: /de Gravatá/ })).toBeTruthy();
  });

  // "Ver daqui" é o toque que pede o GPS — a promessa do "um toque na vida".
  it("'Ver daqui' pede o GPS, não abre a busca", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    comLocalVivo();
    await act(async () => { screen.getByRole("button", { name: /Ver daqui/ }).click(); });
    expect(pediu).toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("com gps negado, o toque abre a busca em vez de pedir de novo", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    comLocalVivo();
    const b = await screen.findByRole("button", { name: /escolher onde estou/ });
    await act(async () => { b.click(); });
    expect(pediu).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

describe("a busca", () => {
  async function abrir() {
    localStorage.setItem(CHAVE_GPS, "negado");
    comLocalVivo();
    const b = await screen.findByRole("button", { name: /escolher onde estou/ });
    await act(async () => { b.click(); });
  }

  it("mostra a região de cada resultado — sem ela o dedo acerta o lugar errado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    expect(await screen.findByText(/Pernambuco/)).toBeTruthy();
  });

  it("escolher um resultado guarda a localização e fecha a busca", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    const item = await screen.findByText(/Pernambuco/);
    await act(async () => { (item.closest("button") as HTMLButtonElement).click(); });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });

  it("serviço fora do ar: diz que não conseguiu buscar, não 'nada encontrado'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Recife" } });
    expect(await screen.findByText(/não consegui buscar/i)).toBeTruthy();
  });

  // Crédito do GeoNames: CC-BY exige atribuição visível E com link. O
  // `© OpenStreetMap` do mapa já tem teste próprio pelo mesmo motivo — este
  // app trata atribuição como obrigação, e obrigação sem teste é obrigação que
  // some no primeiro refactor de layout.
  it("credita o GeoNames com link, como a licença CC-BY exige", async () => {
    await abrir();
    const link = screen.getByRole("link", { name: /GeoNames/i });
    expect(link.getAttribute("href")).toContain("geonames.org");
  });

  // ——— OS DOIS ABAIXO VIERAM DO PRÉ-VOO, e são os mais importantes do arquivo.
  //
  // O `ESPERA_MS` e o guarda `meu === pedido.current` são as duas linhas desta
  // task com comentário que as justifica e ZERO teste — a família exata que já
  // custou cinco fix rounds nesta rodada. Apagar as duas deixava tudo verde:
  // os outros testes usam `findByText`, que espera até 1000ms e portanto não
  // percebe se a busca dispara a cada tecla; e nenhum deles tem duas
  // requisições em voo, que é a única situação em que o guarda faz algo.
  //
  // Os dois precisam de relógio falso. **Isso é chato e pode brigar com o
  // `act`** — se brigar, PARE e relate o que observou em vez de enfraquecer a
  // asserção. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` e devolva com
  // `vi.useRealTimers()` no fim de cada um, pra não vazar pros vizinhos que
  // rodam com relógio de verdade.

  it("espera a digitação parar: três letras, uma requisição só", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
      await abrir();
      const campo = screen.getByRole("textbox");
      fireEvent.change(campo, { target: { value: "G" } });
      fireEvent.change(campo, { target: { value: "Gr" } });
      fireEvent.change(campo, { target: { value: "Gra" } });
      // Antes da espera vencer, nada saiu do aparelho.
      expect(spy).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });
      // Uma requisição só, e com a ÚLTIMA letra — não três, nem a primeira.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain("q=Gra");
    } finally {
      vi.useRealTimers();
    }
  });

  // O guarda da corrida. Sem ele, a resposta de "Gravatá" chegando DEPOIS da
  // de "Recife" repinta a lista com o lugar errado — e a pessoa toca no que
  // está na tela achando que é o que ela pediu. Some da tela a cidade certa e
  // entra a errada, sem erro nenhum. Esta é a única forma de reproduzir: duas
  // requisições em voo, resolvidas fora de ordem.
  it("resposta velha chegando depois não sobrescreve a busca nova", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let soltarVelha!: (r: Response) => void;
      const velha = new Promise<Response>((r) => { soltarVelha = r; });
      vi.spyOn(globalThis, "fetch")
        .mockImplementationOnce(() => velha)
        .mockImplementationOnce(async () => Response.json([RECIFE]));

      await abrir();
      const campo = screen.getByRole("textbox");
      fireEvent.change(campo, { target: { value: "Gravatá" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });
      fireEvent.change(campo, { target: { value: "Recife" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });

      // A nova já pintou. Agora a VELHA responde, atrasada.
      // Asserção pelo NOME, não pela região: Recife e Gravatá são as duas de
      // Pernambuco, e um teste que olhasse "Pernambuco" passaria com qualquer
      // uma das duas na tela — provando nada.
      expect(await screen.findByText("Recife")).toBeTruthy();
      await act(async () => { soltarVelha(Response.json([GRAVATA])); await vi.advanceTimersByTimeAsync(10); });

      // Recife continua na tela; Gravatá não entrou.
      expect(screen.getByText("Recife")).toBeTruthy();
      expect(screen.queryByText("Gravatá")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("busca sem resultado diz que não achou", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xyzabc" } });
    expect(await screen.findByText(/não achei/i)).toBeTruthy();
  });

  it("o campo tem 16px — abaixo disso o Safari dá zoom sozinho ao focar e a tela salta", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    const regra = css.match(/\.busca-campo\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .busca-campo").not.toBeNull();
    expect(regra![0]).toMatch(/font-size:\s*16px/);
  });
});
