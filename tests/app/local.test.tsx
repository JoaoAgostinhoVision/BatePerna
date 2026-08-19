import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import LocalVivo, { useGps, useLocal, useMexerLocal } from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL, type Local } from "@/lib/local";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  // Restaura qualquer espião em Storage.prototype (setItem/getItem forçados a
  // estourar) — um espião vazado envenenaria localStorage pros arquivos de
  // teste seguintes, que nem sabem que ele existe.
  vi.restoreAllMocks();
});

const GRAVATA: Local = {
  tipo: "escolhido",
  coord: { lat: -8.20111, lng: -35.56472 },
  em: 1_800_000_000,
  nome: "Gravatá",
  regiao: "Pernambuco",
};

function Espia() {
  const l = useLocal();
  const gps = useGps();
  return <div data-testid="espia">{`${l.tipo}|${gps}`}</div>;
}

describe("LocalVivo", () => {
  it("fora de um provedor, é 'não sei' — nunca estoura", () => {
    render(<Espia />);
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|nunca");
  });

  // ESTA É A REGRA DURA. A home chega do cache do service worker com HTML
  // velho; ler o aparelho durante o render quebraria a hidratação exatamente
  // no elemento que carrega a decisão. Mesma disciplina do useVenceu.
  it("com localização guardada, o PRIMEIRO render ainda é 'não sei'", () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    let noPrimeiroRender = "";
    function Grava() {
      const l = useLocal();
      noPrimeiroRender ||= l.tipo;
      return null;
    }
    render(<LocalVivo><Grava /></LocalVivo>);
    expect(noPrimeiroRender).toBe("nao-sei");
  });

  it("depois de montar, a localização guardada entra", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
  });

  it("guardado torto não derruba nada: fica 'não sei'", async () => {
    localStorage.setItem(CHAVE_LOCAL, "{lixo");
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|nunca")).toBeTruthy();
  });

  // Aba anônima com armazenamento bloqueado, ou navegador que recusa leitura:
  // o `try/catch` do efeito de montagem existe pra isto. Sem ele a montagem
  // inteira estoura, e a home cairia na tela de erro por causa da localização.
  it("localStorage.getItem falhando não derruba a montagem: fica 'não sei'", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("leitura bloqueada");
    });
    render(<LocalVivo><Espia /></LocalVivo>);
    await act(async () => {});
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|nunca");
  });

  it("escolher grava no aparelho e aparece na tela", async () => {
    function Botao() {
      const { escolher } = useMexerLocal();
      return <button onClick={() => escolher(GRAVATA)}>escolher</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("escolher").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });

  // Armazenamento cheio ou aba anônima recusando escrita: a escolha ainda
  // precisa valer NESTA sessão — é a promessa do comentário em `escolher`.
  // Sem o `try/catch`, um `setItem` que estoura derrubaria a escolha inteira.
  //
  // Chama `escolher` direto (não via clique de botão): um clique passa pelo
  // despacho sintético de evento do React, que no jsdom reporta exceções de
  // handler como erro global em vez de propagar pro chamador — mascarando a
  // mutação em vez de provar o guarda. Chamando a função diretamente dentro
  // de `act`, a exceção (se o guarda for removido) estoura na cara do teste.
  it("localStorage.setItem falhando não impede a escolha em memória", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("armazenamento cheio");
    });
    let escolherCaptado: ((l: Local) => void) | null = null;
    function Capta() {
      escolherCaptado = useMexerLocal().escolher;
      return null;
    }
    render(<LocalVivo><Espia /><Capta /></LocalVivo>);
    act(() => { escolherCaptado!(GRAVATA); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
  });
});

describe("o GPS", () => {
  function aparelhoComGps(impl: (ok: PositionCallback, erro: PositionErrorCallback) => void) {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: impl },
    });
  }

  // O pedido do João, e o oposto exato do que o app fazia antes desta task:
  // sem nada guardado, a montagem já pede a posição sozinha.
  it("sem nada guardado, monta e JÁ chama getCurrentPosition", async () => {
    const pediu = vi.fn();
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    await act(async () => {});
    expect(pediu).toHaveBeenCalled();
  });

  it("pedirGps aceito vira localização de gps", async () => {
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -8.1, longitude: -35.5 } } as GeolocationPosition),
    );
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("gps|nunca");
  });

  // O remédio. Três testes, um por código — em bloco não prova nada: um
  // teste só, com um code só, aprova um mutante que grava "negado" pra
  // qualquer erro (ver tabela de mutação do brief).
  it("erro code 1 (permissão negada) grava bp.gps = negado", async () => {
    aparelhoComGps((_ok, erro) => erro({ code: 1 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|negado");
    expect(localStorage.getItem(CHAVE_GPS)).toBe("negado");
  });

  it("erro code 2 (posição indisponível) NÃO grava nada", async () => {
    aparelhoComGps((_ok, erro) => erro({ code: 2 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|nunca");
    expect(localStorage.getItem(CHAVE_GPS)).toBeNull();
  });

  it("erro code 3 (timeout) NÃO grava nada", async () => {
    aparelhoComGps((_ok, erro) => erro({ code: 3 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|nunca");
    expect(localStorage.getItem(CHAVE_GPS)).toBeNull();
  });

  // O ramo de erro do buscarGps também grava no aparelho — chave diferente
  // (CHAVE_GPS, não CHAVE_LOCAL) e vida diferente (dentro do callback de erro
  // assíncrono do geolocation, não de um handler de clique). Sem o `try/catch`
  // ali, um `setItem` que estoura derrubaria o próprio reconhecimento do
  // "negado" — a tela ficaria travada tentando de novo em vez de desistir.
  //
  // Chama `pedirGps` direto (capturado do hook), não via clique de botão,
  // pela mesma razão do teste de `escolher` acima: um clique passa pelo
  // despacho sintético de evento do React, que no jsdom mascara a exceção do
  // handler em vez de propagá-la pro `act()`.
  it("localStorage.setItem falhando no ramo de erro não impede o gps virar 'negado'", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("armazenamento cheio");
    });
    aparelhoComGps((_ok, erro) => erro({ code: 1 } as GeolocationPositionError));
    let pedirGpsCaptado: (() => void) | null = null;
    function Capta() {
      pedirGpsCaptado = useMexerLocal().pedirGps;
      return null;
    }
    render(<LocalVivo><Espia /><Capta /></LocalVivo>);
    act(() => { pedirGpsCaptado!(); });
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|negado");
  });

  // Erro que GRAVA algo (code 1) com uma posição já guardada em mãos: a
  // guardada continua. Trocar por "não sei" apagaria da tela um km que
  // estava certo. Code 1 de propósito — com code 2/3 nada é gravado, o que
  // provaria pouco sobre a localização não ser apagada.
  it("erro não apaga a localização que já existia", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    aparelhoComGps((_ok, erro) => erro({ code: 1 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    expect(await screen.findByText("escolhido|negado")).toBeTruthy();
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|negado");
  });

  // Concedido uma vez, o navegador não pergunta mais. A partir daí toda
  // abertura já vem com a posição, sem toque nenhum — é a promessa que o João
  // aprovou ("um toque na vida").
  it("com gps já concedido antes, busca sozinho ao montar", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.3, lng: -35.4 }, em: 1_800_000_000,
    }));
    const pediu = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: -8.31, longitude: -35.41 } } as GeolocationPosition),
    );
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(pediu).toHaveBeenCalled();
  });
});
