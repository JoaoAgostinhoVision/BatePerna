import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import LocalVivo, { useGps, useLocal, useMexerLocal } from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL, CHAVE_SESSAO, MARCA_SESSAO, VALIDADE_ESCOLHA_S, type Local } from "@/lib/local";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
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

  // A OUTRA METADE do mesmo pedido do João: "só modificaria se o usuário
  // quiser" — e quem escolheu a cidade na mão já quis. Sem guarda no efeito de
  // montagem, o callback de sucesso chama `escolher` e grava por cima do
  // `bp.local`. MEDIDO na revisão da branch: guardado "Gravatá", o GPS
  // responde (-7, -34.8), e o que sobra no aparelho é `{"tipo":"gps",…}` — a
  // cidade some e nada na tela diz por quê. Como o app não usa `next/link`,
  // todo toque em cartão remonta o `<LocalVivo>`: escolher na home e abrir uma
  // ficha já bastava.
  //
  // O mock RESPONDE de propósito. Um mock mudo provaria só que nada foi
  // gravado, e não gravar por não ter resposta é outra coisa.
  it("com cidade escolhida na mão E na mesma aba, a montagem não sobrescreve", async () => {
    const agora = Math.floor(Date.now() / 1000);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: agora }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    const pediu = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => {});
    // Nem chega a PEDIR — e isso é asserção própria: disparado, o navegador
    // exibe o balão de permissão do sistema pra quem já respondeu na mão.
    expect(pediu).not.toHaveBeenCalled();
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    const noAparelho = JSON.parse(localStorage.getItem(CHAVE_LOCAL)!);
    expect(noAparelho.tipo).toBe("escolhido");
    expect(noAparelho.nome).toBe("Gravatá");
  });

  // ——— a escolha VENCIDA, nos dois eixos, e cada um sozinho ———

  // Aba nova: o `localStorage` sobreviveu, o `sessionStorage` não. É o caso de
  // fechar o app e abrir de novo.
  it("cidade escolhida em OUTRA aba: pede o GPS e ele vence", async () => {
    const agora = Math.floor(Date.now() / 1000);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: agora }));
    // sem sessionStorage de propósito
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)!)).toMatchObject({
      tipo: "gps", coord: { lat: -7, lng: -34.8 },
    });
  });

  // Mesma aba, escolha velha: é o PWA do iPhone suspenso desde ontem.
  it("cidade escolhida há 7h, mesma aba: pede o GPS e ele vence", async () => {
    const velha = Math.floor(Date.now() / 1000) - (VALIDADE_ESCOLHA_S + 60);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: velha }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
  });

  // 🔴 A METADE QUE IMPEDE O PISCA — e ela é a decisão de produto, não
  // detalhe: vencida a escolha, o que está na tela CONTINUA na tela até o GPS
  // responder, e se ele não responder, fica. Apagar uma localização boa pra
  // mostrar "não sei" tiraria da tela um km que estava certo. Precedente já em
  // produção, escrito em local.tsx no ramo de erro do GPS.
  it("escolha vencida e GPS que ERRA: a cidade fica, não vira 'não sei'", async () => {
    const velha = Math.floor(Date.now() / 1000) - (VALIDADE_ESCOLHA_S + 60);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: velha }));
    aparelhoComGps((_ok, erro) =>
      erro({ code: 2, message: "" } as GeolocationPositionError),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => {});
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)!).nome).toBe("Gravatá");
  });

  // ——— quem escreve o marcador, e quem NÃO escreve ———

  it("escolher uma cidade marca a sessão", async () => {
    function Botao() {
      const { escolher } = useMexerLocal();
      return <button onClick={() => escolher(GRAVATA)}>escolher</button>;
    }
    render(<LocalVivo><Botao /><Espia /></LocalVivo>);
    await act(async () => { screen.getByText("escolher").click(); });
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBe(MARCA_SESSAO);
  });

  // 🔴 A OUTRA DIREÇÃO, e sem ela o guarda `l.tipo === "escolhido"` não tem
  // dono: o `escolher` é TAMBÉM o caminho de sucesso do GPS. Marcando ali, uma
  // leitura automática se disfarçaria de escolha manual e sobreviveria 6h como
  // se a pessoa tivesse digitado a cidade.
  it("o GPS entrando sozinho NÃO marca a sessão", async () => {
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });

  // O ramo que já está no ar e não pode ter mudado: `tipo: "gps"` guardado
  // continua pedindo sozinho. Um guarda largo demais mataria em silêncio o
  // automático que a Task 1 da rodada passada entregou.
  it("com gps guardado, continua buscando sozinho ao montar — mesmo com marcador de sessão", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: Math.floor(Date.now() / 1000),
    }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    const pediu = vi.fn();
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    await act(async () => {});
    expect(pediu).toHaveBeenCalled();
  });

  // sessionStorage também estoura em aba anônima do Safari. Mesma disciplina
  // dos outros dois try/catch deste arquivo: a escolha vale em memória e
  // pronto, sem tela de erro.
  //
  // Só o `sessionStorage.setItem` falha — o `localStorage.setItem` funciona
  // de verdade. Se os dois estourassem juntos, a exceção do `localStorage` —
  // a PRIMEIRA linha do bloco — já seria pega antes do código chegar na linha
  // do `sessionStorage`, e o teste provaria proteção nenhuma sobre ELA.
  //
  // MEDIDO: `vi.spyOn(sessionStorage, "setItem")` sozinho NÃO intercepta a
  // chamada — o objeto global do jsdom ignora a propriedade própria e o
  // `setItem` real segue rodando, sem lançar nada. É preciso espionar
  // `Storage.prototype` (que os dois compartilham) e usar `this` pra
  // distinguir QUAL instância chamou, preservando o comportamento real do
  // `localStorage` via a implementação original capturada antes do mock.
  //
  // Chama `escolher` direto (não via clique de botão), mesma razão do teste
  // irmão logo acima: o despacho sintético de evento do React reporta
  // exceções de handler como erro global em vez de propagar pro chamador,
  // mascarando a mutação em vez de provar o guarda.
  it("sessionStorage que estoura não derruba a montagem", () => {
    const setItemOriginal = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage, chave: string, valor: string,
    ) {
      if (this === sessionStorage) throw new DOMException("cheio", "QuotaExceededError");
      return setItemOriginal.call(this, chave, valor);
    });
    let escolherCaptado: ((l: Local) => void) | null = null;
    function Capta() {
      escolherCaptado = useMexerLocal().escolher;
      return null;
    }
    render(<LocalVivo><Espia /><Capta /></LocalVivo>);
    act(() => { escolherCaptado!(GRAVATA); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    // E o localStorage GRAVOU de verdade — não é o caso de os dois terem
    // falhado juntos.
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });

  // A direção oposta, e as duas precisam existir juntas: sem nada guardado o
  // pedido automático não só acontece como GRAVA. Um guarda largo demais
  // (pegando "nao-sei" junto com "escolhido") deixaria o teste de cima verde
  // e mataria em silêncio o automático que a Task 1 entregou.
  it("sem nada guardado, a leitura automática entra na tela E no aparelho", async () => {
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)!)).toMatchObject({
      tipo: "gps",
      coord: { lat: -7, lng: -34.8 },
    });
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
    // Marcador de sessão: sem ele a escolha já não valeria (Task 2 do review
    // do celular) e a montagem pediria o GPS sozinha, disparando o erro ANTES
    // do toque — o que não é o que este teste mede.
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    aparelhoComGps((_ok, erro) => erro({ code: 1 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    // Antes do toque o gps ainda é "nunca": com uma cidade escolhida na mão
    // guardada e a sessão viva, a montagem NÃO pede a posição sozinha (ver o
    // bloco abaixo). Este teste é sobre o TOQUE, então quem dispara aqui é o
    // botão.
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => { screen.getByText("pedir").click(); });
    expect(await screen.findByText("escolhido|negado")).toBeTruthy();
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
    // E GRAVA: o que fica no aparelho é a posição de AGORA (-8.31/-35.41),
    // não a que estava guardada (-8.3/-35.4). Sem essas duas coordenadas
    // diferentes, "gps|nunca" na tela também apareceria se a leitura nova
    // tivesse sido jogada fora.
    expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)!).coord)
      .toEqual({ lat: -8.31, lng: -35.41 });
  });
});

// ——————— a permissão do navegador desfaz a lembrança velha ———————
//
// 🔴 MEDIDO EM PRODUÇÃO, no navegador do dono do app: a API respondia
// `granted` e o `bp.gps` dizia `negado`. O botão "daqui" — o caminho de volta
// pro GPS, que ele pediu duas vezes — ficava escondido por causa disso.
// `"negado"` era gravado uma vez e nenhum ponto do código o desfazia.
describe("a permissão do navegador vence a lembrança guardada", () => {
  function aparelhoComPermissao(estado: PermissionState | "erro") {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: vi.fn() },
      permissions: {
        query: estado === "erro"
          ? vi.fn(() => Promise.reject(new Error("sem suporte")))
          : vi.fn(() => Promise.resolve({ state: estado } as PermissionStatus)),
      },
    });
  }

  it("guardado 'negado' mas o navegador PERMITE: o app para de tratar como negado", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    aparelhoComPermissao("granted");
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|nunca")).toBeTruthy();
  });

  // 🔴 E a lembrança MENTIROSA tem que sair do aparelho, não só da tela: senão
  // ela volta a mandar no dia em que a API não responder (o Safari antigo).
  it("a chave velha é APAGADA do aparelho, não só ignorada", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    aparelhoComPermissao("granted");
    render(<LocalVivo><Espia /></LocalVivo>);
    await screen.findByText("nao-sei|nunca");
    expect(localStorage.getItem(CHAVE_GPS)).toBeNull();
  });

  // A direção oposta, e sem ela "ignora a lembrança sempre" passaria acima.
  it("o navegador NEGA de verdade: continua negado, e fica gravado", async () => {
    aparelhoComPermissao("denied");
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|negado")).toBeTruthy();
    expect(localStorage.getItem(CHAVE_GPS)).toBe("negado");
  });

  // 🔴 O RAMO DO iPHONE: o Safari só passou a responder `permissions.query`
  // pra geolocalização em versões recentes — antes disso REJEITA. Sem fonte, a
  // lembrança é tudo o que há, e o comportamento tem que ser o de antes desta
  // correção. Se este teste cair, o conserto virou regressão no veículo real.
  it("a API rejeitando: a lembrança continua mandando", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    aparelhoComPermissao("erro");
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|negado")).toBeTruthy();
    expect(localStorage.getItem(CHAVE_GPS)).toBe("negado");
  });

  it("sem a API de permissão no navegador: a lembrança continua mandando", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: vi.fn() } });
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|negado")).toBeTruthy();
  });
});
