import { readFileSync } from "node:fs";
import path from "node:path";
import { Profiler, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { regraDe, semComentarios, valorDe } from "../css";
import Carimbo from "@/app/Carimbo";
import Moldura from "@/app/Moldura";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 42); // 08h42 em Recife
const AGORA_S = AGORA_MS / 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Props = { estado: "fresco" | "frio"; erro: boolean; calculadoEm: number; pass: number; fut: number; slug: string; secaRapido?: string };

function montar(props: Partial<Props> = {}) {
  return render(
    <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" {...props} />,
  );
}

/** Uma rede que o teste controla: cada chamada devolve uma promessa que o teste
 *  resolve na hora que quiser. É o que permite testar o prazo de 3s. */
function redeFalsa() {
  const pendentes: { ok: (corpo: unknown) => void; falhar: () => void }[] = [];
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve, reject) => {
        pendentes.push({
          ok: (corpo) => resolve(new Response(JSON.stringify(corpo), { status: 200 })),
          falhar: () => reject(new Error("offline")),
        });
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, pendentes };
}

/** O carimbo dentro da moldura de verdade — o `<main className="bp" data-state>`
 *  que a ficha renderiza. É onde a COR mora. */
function montarNaMoldura(props: Partial<Props> = {}) {
  const { estado = "fresco" } = props;
  return render(
    <Moldura estado={estado}>
      <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" {...props} />
    </Moldura>,
  );
}

function tocar(container: HTMLElement) {
  const botao = container.querySelector("button.decision");
  if (!botao) throw new Error("o carimbo não virou botão");
  act(() => { botao.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

describe("Carimbo", () => {
  it("leitura fresca afirma", () => {
    const { container } = montar();
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("leitura vencida para de afirmar e devolve a decisão pra você", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector(".sub")?.textContent).toBe("tome cuidado");
  });

  it("vencida, diz de que hora era a leitura", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 }); // 08h02
    expect(container.textContent).toContain("8h02");
  });

  it("vencida, marca a fase pro CSS pintar de parada mesmo com estado fresco", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".decision")?.getAttribute("data-fase")).toBe("sem-informacoes");
  });

  it("vence sozinho com o app aberto, sem recarregar", () => {
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });
    // Vencido não manda mais "Não suba" — informa que não sabe.
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("volta do bolso já vencido, sem esperar o intervalo de 60s", async () => {
    // O celular passou 4h no bolso. O relógio andou; o setInterval não — o
    // navegador estrangula timer de aba escondida. A reavaliação é imediata
    // (por isso já sai buscando, "CONFERINDO…"); sem resposta, o carimbo
    // termina dizendo que não sabe — nunca "Pode subir" de novo por conta própria.
    const { pendentes } = redeFalsa();
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");
    await act(async () => { pendentes[0].falhar(); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("volta do cache do navegador (pageshow) também reavalia", async () => {
    const { pendentes } = redeFalsa();
    const { container } = montar({ calculadoEm: AGORA_S });
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");
    await act(async () => { pendentes[0].falhar(); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("desmontado, não deixa ouvinte pra trás", () => {
    const { unmount } = montar({ calculadoEm: AGORA_S });
    unmount();
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    // Sem a limpeza, o setVenceu de um componente morto reclamaria aqui.
    expect(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pageshow"));
    }).not.toThrow();
  });

  it("sem leitura de chuva, é honesto desde o começo", () => {
    const { container } = montar({ estado: "frio", erro: true });
    expect(container.textContent).toContain("Não deu pra ler a chuva agora");
  });

  it("sem leitura e ainda no prazo, o .live não diz que leu — é o caso comum do Open-Meteo fora do ar", () => {
    // Estava no ar: a ficha dizia "Não suba · sem leitura" e logo abaixo
    // "lido da chuva agora", com o pulso piscando. Uma contradizia a outra.
    const { container } = montar({ estado: "frio", erro: true });
    const live = container.querySelector(".live")?.textContent ?? "";
    expect(live).not.toContain("lido da chuva");
    expect(live).toContain("toque pra conferir");
  });

  it("sem leitura, marca a fase pro CSS parar o pulso", () => {
    const semLeitura = montar({ estado: "frio", erro: true });
    expect(semLeitura.container.querySelector(".decision")?.getAttribute("data-fase")).toBe("sem-informacoes");
    cleanup();
    expect(montar().container.querySelector(".decision")?.getAttribute("data-fase")).toBe("afirmando");
  });

  it("o CSS que para o pulso aponta pro atributo que o componente emite", () => {
    // Metade deste defeito era CSS: a regra existia, mas presa a data-venceu, e
    // o ramo de erro não tem esse atributo. Este par não pode desemparelhar.
    //
    // 🔴 Lido pelo VALOR: `[^}]*animation:\s*none` dentro do bloco casava em
    // `--animation: none` sem nenhuma `animation` de verdade — MEDIDO, 523/523
    // VERDE com o pulso "lendo a chuva agora" continuando a pulsar embaixo de
    // um "SEM INFORMAÇÕES". É a mesma família do pin verde ao lado do carimbo
    // frio, só que em movimento em vez de cor.
    const seletor = '.bp .decision[data-fase="sem-informacoes"] .live .pulse';
    const regra = regraDe(semComentarios("ficha.css"), seletor);
    expect(regra, `faltou a regra ${seletor} no ficha.css`).not.toBeNull();
    expect(valorDe(regra![0], "animation"), "o pulso voltou a pulsar sem leitura nenhuma")
      .toBe("none");
  });

  it("vencida com erro, não inventa que houve leitura", () => {
    // erro=true: calculadoEm é o instante da tentativa falha, não de uma leitura —
    // vencido ou não, o motivo e o .live não podem citar uma hora de leitura que não existiu.
    const { container } = montar({ estado: "frio", erro: true, calculadoEm: AGORA_S - 40 * 60 }); // 08h02
    expect(container.querySelector(".reason")?.textContent).toContain("Não deu pra ler a chuva agora");
    expect(container.querySelector(".reason")?.textContent).not.toContain("8h02");
    expect(container.querySelector(".live")?.textContent).not.toContain("vencida");
    expect(container.querySelector(".live")?.textContent).not.toContain("8h02");
  });

  it("sem informação, o carimbo é botão de verdade — e continua anunciado como botão", () => {
    // Alvo do tamanho do bloco, que a mão suja acerta — e <button> em vez de
    // div com clique dá teclado e leitor de tela sem código extra.
    //
    // role="status" no <button> sobrescrevia o papel implícito de botão: um
    // leitor de tela anunciava "região de status" em vez de "botão", bem no
    // elemento que a pessoa precisa tocar. Por isso o <button> não pode levar
    // role="status" — só o <div> (que é a região que se atualiza sozinha).
    const { container } = montar({ estado: "frio", erro: true });
    const bloco = container.querySelector(".decision");
    expect(bloco?.tagName).toBe("BUTTON");
    expect(bloco?.getAttribute("type")).toBe("button");
    expect(bloco?.getAttribute("role")).not.toBe("status");
  });

  it("com leitura boa não há botão nenhum", () => {
    // Botão que não serve pra nada é ruído no meio da decisão.
    expect(montar().container.querySelector(".decision")?.tagName).toBe("DIV");
  });
});

describe("Carimbo — a busca", () => {
  const QUATRO_H_MS = 4 * 60 * 60 * 1000;

  it("volta pra tela com leitura vencida e busca a de agora", async () => {
    const { fetchMock, pendentes } = redeFalsa();
    const { container } = montar({ calculadoEm: AGORA_S });
    vi.setSystemTime(AGORA_MS + QUATRO_H_MS);

    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/carimbo?slug=rampa-do-pepe",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    await act(async () => {
      pendentes[0].ok({
        estado: "fresco", erro: false, calculadoEm: Math.floor((AGORA_MS + QUATRO_H_MS) / 1000),
      });
    });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("leitura boa na tela não gasta rede ao voltar", () => {
    const { fetchMock } = redeFalsa();
    montar({ calculadoEm: AGORA_S });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passados 3s sem resposta volta a responder — e a resposta atrasada ainda repinta", async () => {
    const { pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });

    tocar(container);
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    act(() => { vi.advanceTimersByTime(3_001); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector(".reason")?.textContent).toContain("Não deu tempo");

    // A requisição não foi cancelada: aos 7s ela chega e ainda vale.
    await act(async () => {
      pendentes[0].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S });
    });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("rede caída mostra que não deu, com o toque ainda disponível", async () => {
    const { pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });
    tocar(container);
    await act(async () => { pendentes[0].falhar(); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector("button.decision")).not.toBeNull();
  });

  it("uma busca por vez — gatilho durante o Conferindo não dispara outra", () => {
    const { fetchMock } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });
    tocar(container);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("o piso de 30s segura a segunda busca automática, mas não o toque", async () => {
    const { fetchMock, pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true, calculadoEm: AGORA_S });

    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { pendentes[0].falhar(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // barrada pelo piso

    tocar(container);
    expect(fetchMock).toHaveBeenCalledTimes(2); // o toque passa por cima
  });

  it("página com erro do servidor não busca ao carregar", () => {
    // pageshow dispara em todo carregamento. Retentar aqui trocaria a mensagem
    // honesta por 3s de "Conferindo…" em toda abertura, durante uma queda.
    const { fetchMock } = redeFalsa();
    montar({ estado: "frio", erro: true, calculadoEm: AGORA_S });
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("vence e a rede nunca responde — o prazo de tela resolve sozinho, sem depender de resposta nenhuma", () => {
    // O que este teste prova: quando a leitura vence, a busca automática sai
    // (podeBuscar já dá "sim" pra jaVenceu=true) e, mesmo que a rede não
    // devolva NADA — nem ok(), nem falhar() —, o prazo de 3s de buscar()
    // ainda assim tira a tela de "Conferindo…" e a leva pra "SEM INFORMAÇÕES".
    // `vi.setSystemTime` (e não `advanceTimersByTime`) evita que o
    // `setInterval` de 60s da validade dispare de verdade durante o salto.
    //
    // O que este teste NÃO prova: que o `setVenceu(jaVenceu)` de `tentar()` é
    // necessário. Por mutação (apagar a linha, rodar a suíte, restaurar),
    // confirmamos que hoje ela é redundante — todo caminho automático que a
    // exercitaria também dispara busca, e é o prazo de `buscar()` quem decide
    // a tela final. Ver o comentário na própria linha, em Carimbo.tsx, e a
    // rodada de correção no relatório da task.
    const { fetchMock, pendentes } = redeFalsa();
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");

    vi.setSystemTime(AGORA_MS + 31 * 60 * 1000);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    act(() => { vi.advanceTimersByTime(3_001); });
    expect(pendentes).toHaveLength(1); // nunca respondida
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("duas buscas sobrepostas — a resposta da mais velha chega depois e é descartada", async () => {
    // O prazo de 3s libera a tela sem cancelar a 1ª requisição; um toque nessa
    // hora dispara uma 2ª. A guarda de geração é o que impede a resposta
    // atrasada da 1ª de pisar na leitura (ou no "Conferindo…") da 2ª.
    const { pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });

    tocar(container); // 1ª busca (geração 1)
    act(() => { vi.advanceTimersByTime(3_001); }); // prazo de tela libera o toque de novo
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");

    tocar(container); // 2ª busca (geração 2) — a 1ª ainda está pendente, sem resposta
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");
    expect(pendentes).toHaveLength(2);

    // A 1ª (a mais velha) responde agora, com uma leitura fresca — mas geração
    // velha: tem que ser descartada, sem tirar o "Conferindo…" da 2ª da tela.
    await act(async () => {
      pendentes[0].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S - 999 });
    });
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    // A 2ª (a que vale) responde — essa sim repinta.
    await act(async () => {
      pendentes[1].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S });
    });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("200 com corpo fora do trio cai no mesmo tratamento de falha", async () => {
    // Sem conferir o corpo, os três campos viriam `undefined`,
    // carimboVenceu(undefined) daria NaN >= 1800 → false, e a tela afirmaria
    // "Pode subir" a partir de nada. A invariante mais protegida do projeto é
    // justamente essa: nunca afirmar sem leitura.
    const { pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });

    tocar(container);
    await act(async () => { pendentes[0].ok({ tudo: "bem", estado: "molhado" }); });

    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector("button.decision")).not.toBeNull();
  });

  it("corpo que nem é JSON também", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>portal cativo do wifi</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = montar({ estado: "frio", erro: true });

    tocar(container);
    await act(async () => {});

    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });
});

describe("Carimbo — a cor acompanha a leitura que está na tela", () => {
  const QUATRO_H_MS = 4 * 60 * 60 * 1000;

  it("leitura nova troca a palavra E a cor da ficha inteira", async () => {
    // 9h em casa: o servidor leu fresco, selo verde. 11h no portão: a tela
    // volta, a leitura venceu, a busca sai e vem "frio". Sem isto a ficha diria
    // "Não suba" dentro de um selo VERDE, com o pin do mapa verde junto — e a
    // cor é o que o motorista lê primeiro.
    const { pendentes } = redeFalsa();
    const { container } = montarNaMoldura({ estado: "fresco", calculadoEm: AGORA_S });
    const moldura = container.querySelector("main.bp");
    expect(moldura?.getAttribute("data-state")).toBe("fresco"); // o que o servidor pintou

    vi.setSystemTime(AGORA_MS + QUATRO_H_MS);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => {
      pendentes[0].ok({
        estado: "frio", erro: false, calculadoEm: Math.floor((AGORA_MS + QUATRO_H_MS) / 1000),
      });
    });

    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
    expect(moldura?.getAttribute("data-state")).toBe("frio");
  });

  it("o CSS pinta o selo a partir do mesmo atributo que a moldura escreve", () => {
    // jsdom não computa cor: o que dá pra travar é o par atributo/seletor.
    // Se um dos dois mudar de nome sozinho, o selo fica em silêncio.
    const css = readFileSync(path.join(process.cwd(), "src", "app", "ficha.css"), "utf8");
    expect(css).toMatch(/\.bp\[data-state="frio"\]\s*\.stamp\s*\{[^}]*--st-ink:\s*var\(--stop-ink\)/);
  });

  it("a fase continua ganhando da cor do estado: sem informações pinta de parada", () => {
    // Precedência de especificidade: .bp .decision[data-fase] .stamp (4 classes)
    // vence .bp[data-state] .stamp (3). Se a regra da fase saísse do ar, uma
    // leitura vencida de uma página que abriu fresca ficaria verde.
    const css = readFileSync(path.join(process.cwd(), "src", "app", "ficha.css"), "utf8");
    const fase = css.indexOf('.decision[data-fase="sem-informacoes"] .stamp');
    const estado = css.indexOf('.bp[data-state="frio"]   .stamp');
    expect(fase).toBeGreaterThan(-1);
    expect(estado).toBeGreaterThan(-1);
    expect(fase).toBeGreaterThan(estado); // e vem depois, pra ganhar até em empate
  });

  it("a moldura não mexe na cor enquanto a busca não trouxer nada", async () => {
    // Busca que falha não é leitura nova: a cor do servidor continua valendo,
    // e quem avisa que não há informação é a fase (que pinta o selo de parada).
    const { pendentes } = redeFalsa();
    const { container } = montarNaMoldura({ estado: "fresco", calculadoEm: AGORA_S });

    vi.setSystemTime(AGORA_MS + QUATRO_H_MS);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { pendentes[0].falhar(); });

    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector("main.bp")?.getAttribute("data-state")).toBe("fresco");
  });
});

describe("Carimbo — o que os quadros commitados mostram", () => {
  const QUATRO_H_MS = 4 * 60 * 60 * 1000;

  it("a leitura que acaba de chegar nunca é pintada como vencida, nem por um quadro", async () => {
    // O Profiler entrega cada COMMIT (depois da mutação do DOM, antes dos
    // efeitos passivos) — é o único jeito honesto de ver o que o navegador
    // teria chance de pintar. `act` sozinho drena render + efeito num bloco só
    // e esconde exatamente o quadro que este teste procura:
    //   0: CONFERINDO…      1: SEM INFORMAÇÕES (citando a leitura recém-chegada
    //   como vencida)       2: Pode subir
    const { pendentes } = redeFalsa();
    const quadros: string[] = [];
    const registrar = () => { quadros.push(document.querySelector(".mark")?.textContent ?? ""); };

    render(
      <Profiler id="carimbo" onRender={registrar}>
        <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" />
      </Profiler>,
    );

    vi.setSystemTime(AGORA_MS + QUATRO_H_MS);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(document.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    quadros.length = 0; // só interessam os quadros a partir da resposta
    await act(async () => {
      pendentes[0].ok({
        estado: "fresco", erro: false, calculadoEm: Math.floor((AGORA_MS + QUATRO_H_MS) / 1000),
      });
    });

    expect(quadros.length).toBeGreaterThan(0); // o recorder está mesmo gravando
    expect(quadros).not.toContain("SEM INFORMAÇÕES");
    expect(quadros.at(-1)).toBe("Pode subir");
  });
});

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-26). Até hoje a linha verde
// terminava com "Área alta, escorre rápido — a serra firmou", escrita FIXA
// aqui dentro. Era verdade sobre a Rampa, e este componente serve o acervo
// inteiro: no dia em que a Pedra Furada entrou, o app passou a afirmar serra
// num lugar plano. Mesma família do Critical de geografia inventada.
describe("Carimbo — a explicação do relevo vem da FICHA", () => {
  const PLANA = "Área plana — o chão batido absorve mais que o barro.";
  const SERRA = "Área alta, escorre rápido — a serra firmou.";

  it("a frase da ficha aparece depois da leitura de chuva", () => {
    const { container } = montar({ secaRapido: PLANA });
    expect(container.querySelector(".reason")?.textContent).toBe(
      `Sem chuva nas últimas ~6h e nada previsto pras próximas ~3h. ${PLANA}`,
    );
  });

  // O par que prova que a frase é DA FICHA e não do componente: mesma
  // montagem, texto diferente. Sem ele, o teste de cima passaria com a frase
  // fixa de volta no código, desde que fosse esta.
  it("outra ficha, outra frase — o componente não tem geografia própria", () => {
    const { container } = montar({ secaRapido: SERRA });
    expect(container.querySelector(".reason")?.textContent).toBe(
      `Sem chuva nas últimas ~6h e nada previsto pras próximas ~3h. ${SERRA}`,
    );
  });

  // 🔴 Igualdade, não `not.toContain`: a asserção de AUSÊNCIA de texto mascara
  // o sumiço do elemento (lição da Task 6). Com `toBe` na frase inteira, o
  // teste cai tanto se alguém puser frase genérica de reserva quanto se a
  // `.reason` deixar de existir — e o `?.textContent` de um elemento ausente é
  // `undefined`, que não é igual a string nenhuma.
  it("ficha SEM a frase termina no ponto final — o app cala em vez de inventar", () => {
    const { container } = montar();
    expect(container.querySelector(".reason")?.textContent).toBe(
      "Sem chuva nas últimas ~6h e nada previsto pras próximas ~3h.",
    );
  });

  // A frase explica por que o chão FIRMA. No ramo frio ela seria contradição
  // ("choveu… o chão batido absorve mais que o barro"), então ela não sai do
  // ternário. Mutação alvo: mover o `{secaRapido}` pra fora do ramo fresco.
  it("no ramo frio a frase não aparece — ela explica o chão SECO", () => {
    const { container } = montar({ estado: "frio", secaRapido: PLANA });
    const texto = container.querySelector(".reason")?.textContent ?? "";
    expect(texto).toContain("risco de atolar"); // o ramo frio de verdade, não um vazio
    expect(texto).not.toContain("chão batido");
  });

  // PROVA DE FONTE — precedente do `"use client"` e do `z.enum(PISOS)`. Em
  // runtime, "frase da ficha" e "frase da ficha com a antiga de reserva" são
  // indistinguíveis enquanto toda ficha do acervo trouxer o campo: os testes
  // acima passam nas duas versões. Só a fonte separa, e é ela que impede a
  // geografia de um lugar de voltar a morar no componente que serve todos.
  it("nenhuma geografia escrita à mão no componente", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "app", "Carimbo.tsx"), "utf8");
    // Os comentários deste arquivo CITAM a frase antiga de propósito, pra
    // contar de onde ela veio — referência histórica legítima, o balde (b) da
    // Task 8. Sem tirá-los, esta prova falharia com o código certo.
    const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    // 🔴 A TIRA PRECISA DE GUARDA, senão o remédio vira o próximo furo: um
    // regex que comesse o arquivo inteiro deixaria a asserção de AUSÊNCIA
    // abaixo passar por vacuidade, sempre. Estas duas linhas provam que o
    // código sobreviveu à tira.
    expect(codigo, "a tira de comentários comeu o código").toContain("function motivo(");
    expect(codigo).toContain("secaRapido");
    expect(codigo, "a frase da Rampa não pode voltar pro código").not.toMatch(
      /serra|Área alta|área plana/i,
    );
  });
});

describe("Carimbo — StrictMode e desmontagem", () => {
  it("sob StrictMode (o modo do next dev) a resposta ainda repinta", async () => {
    // StrictMode monta, limpa e monta de novo. Enquanto `vivo` só era derrubado
    // na limpeza e nunca rearmado, o segundo mount nascia morto: a resposta era
    // descartada, o `finally` não tirava o "Conferindo…" e o prazo de 3s
    // retornava cedo — a tela ficava em CONFERINDO… pra sempre. Só em dev, que
    // é justamente onde a gente confere com o olho.
    const { pendentes } = redeFalsa();
    const { container } = render(
      <StrictMode>
        <Carimbo estado="frio" erro={true} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" />
      </StrictMode>,
    );

    tocar(container);
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    await act(async () => { pendentes[0].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S }); });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("desmontado com a busca em voo, a resposta que chega não é aplicada nem estoura", async () => {
    // O deferido "desmonte durante busca em voo sem teste direto". O React 18
    // não avisa mais sobre setState em componente morto, então o que dá pra
    // afirmar é o observável: nada volta pra tela e nada é jogado.
    const gritou = vi.spyOn(console, "error").mockImplementation(() => {});
    const { pendentes } = redeFalsa();
    const { container, unmount } = montar({ estado: "frio", erro: true });

    tocar(container);
    unmount();
    await act(async () => { pendentes[0].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S }); });

    expect(document.querySelector(".mark")).toBeNull();
    expect(gritou).not.toHaveBeenCalled();
    gritou.mockRestore();
  });
});
