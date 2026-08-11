import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import Carimbo from "@/app/Carimbo";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 42); // 08h42 em Recife
const AGORA_S = AGORA_MS / 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Props = { estado: "fresco" | "frio"; erro: boolean; calculadoEm: number; pass: number; fut: number; slug: string };

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
    const css = readFileSync(path.join(process.cwd(), "src", "app", "ficha.css"), "utf8");
    expect(css).toMatch(/\[data-fase="sem-informacoes"\][^{]*\.pulse\s*\{[^}]*animation:\s*none/);
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
});
