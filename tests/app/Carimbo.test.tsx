import type { ComponentProps } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Profiler, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { regraDe, semComentarios, valorDe } from "../css";
import type { Piso } from "@/lib/piso";
import { SEVERIDADES } from "@/lib/severidade";
import Carimbo from "@/app/Carimbo";
import Moldura from "@/app/Moldura";
import SeloTrilha from "@/app/SeloTrilha";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 42); // 08h42 em Recife
const AGORA_S = AGORA_MS / 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** A voz da RAMPA DO PEPÊ, que é a ficha que estes testes montam (`slug=
 *  "rampa-do-pepe"`): nível `nao-va`, janela de 6h. Fixa aqui porque este
 *  arquivo testa o CARIMBO, não a severidade — quem prova que cada nível fala
 *  a sua língua é `tests/lib/severidade.test.ts`. */
const VOZ_RAMPA = { severidade: "nao-va", horasPassado: 6 } as const;

// 🔴 DERIVADO DO COMPONENTE, e não escrito à mão (2026-09-11). Esta linha era
// uma CÓPIA das props do Carimbo, e como toda cópia ela envelheceu em silêncio:
// já tinha perdido a prop `voz` e, quando `horario` virou `abertura`, o `tsc`
// acusou o teste em vez do defeito. Uma fonte só — a mesma régua que o
// `marcaDe` e o `vozDaFicha` seguem no produto.
type Props = ComponentProps<typeof Carimbo>;

function montar(props: Partial<Props> = {}) {
  return render(
    <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" voz={VOZ_RAMPA} {...props} />,
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
    <Moldura estado={estado} severidade={VOZ_RAMPA.severidade} fase="afirmando">
      <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" voz={VOZ_RAMPA} {...props} />
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
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
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
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });
    // Vencido não manda mais "Não vá" — informa que não sabe.
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("volta do bolso já vencido, sem esperar o intervalo de 60s", async () => {
    // O celular passou 4h no bolso. O relógio andou; o setInterval não — o
    // navegador estrangula timer de aba escondida. A reavaliação é imediata
    // (por isso já sai buscando, "CONFERINDO…"); sem resposta, o carimbo
    // termina dizendo que não sabe — nunca "Pode ir" de novo por conta própria.
    const { pendentes } = redeFalsa();
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
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
    // Estava no ar: a ficha dizia "Não vá · sem leitura" e logo abaixo
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
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
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
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
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
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");

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
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
  });

  it("200 com corpo fora do trio cai no mesmo tratamento de falha", async () => {
    // Sem conferir o corpo, os três campos viriam `undefined`,
    // carimboVenceu(undefined) daria NaN >= 1800 → false, e a tela afirmaria
    // "Pode ir" a partir de nada. A invariante mais protegida do projeto é
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
    // "Não vá" dentro de um selo VERDE, com o pin do mapa verde junto — e a
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

    expect(container.querySelector(".mark")?.textContent).toBe("Não vá");
    expect(moldura?.getAttribute("data-state")).toBe("frio");
  });

  // 🔴 O DEFEITO QUE ESTES QUATRO TRANCAM, e ele acontecia TODO DIA depois das
  // 17h, sem chuva nenhuma: o carimbo ficava vermelho dizendo "Fechado agora" e
  // o pin do mapa continuava VERDE. A cor do pin saía só de `data-state`, que
  // responde "choveu?" — e as fases que NÃO falam de chuva (`fechado`,
  // `sem-informacoes`) nunca o alcançavam, porque `data-fase` vivia no
  // `.decision`, que não é ancestral do pin. A home já tratava os dois casos; a
  // ficha tratava metade. É o mesmo "palavra e cor discordando" que o arquivo
  // inteiro existe pra impedir, sobrevivendo num canto.
  //
  // ⚠️ E a suíte estava VERDE com o defeito de pé: 807/807.
  it("fechado: a moldura publica a fase, e o pin do mapa a alcança", () => {
    vi.setSystemTime(Date.UTC(2027, 0, 15, 21, 0)); // 18h em Recife
    const { container } = montarNaMoldura({
      estado: "fresco",
      calculadoEm: Math.floor(Date.UTC(2027, 0, 15, 21, 0) / 1000),
      abertura: { horario: { abre: "05:00", fecha: "17:00" } },
    });
    const moldura = container.querySelector("main.bp");

    // O carimbo já diz "Fechado agora" — é o controle: sem isto, a asserção de
    // baixo passaria num carimbo que nem entrou na fase.
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    expect(moldura?.getAttribute("data-fase")).toBe("fechado");
    // 🔴 E o estado NÃO muda: o lugar continua seco. É justamente por isso que
    // `data-state` sozinho não resolvia — ele está certo e mesmo assim o pin
    // ficava verde.
    expect(moldura?.getAttribute("data-state")).toBe("fresco");
  });

  it("sem leitura: a moldura publica a fase pelo mesmo caminho", async () => {
    redeFalsa();
    const { container } = montarNaMoldura({ estado: "fresco", erro: true });
    await act(async () => {});
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector("main.bp")?.getAttribute("data-fase")).toBe("sem-informacoes");
  });

  it("o CSS alcança o pin nas duas fases que não falam de chuva", () => {
    const css = semComentarios("ficha.css");
    for (const fase of ["sem-informacoes", "fechado"]) {
      const regra = regraDe(css, `.bp[data-state][data-fase="${fase}"] .wp-pin`);
      expect(regra, `sem regra de pin pra fase ${fase}`).toBeTruthy();
      expect(valorDe(regra![0], "background")).toBe("var(--stop)");
    }
  });

  // 🔴 MUTAÇÃO DE ESPECIFICIDADE, e ela é a que mata em silêncio. Sem o
  // `[data-state]` no seletor, a regra de fase cai pra (0,2,0) e PERDE pras
  // regras de estado logo acima — que estão em (0,3,0). O pin voltaria a ser
  // verde com o teste de cima ainda VERDE, porque a regra existiria.
  it("a regra de fase do pin ganha da regra de estado — senão ela não faz nada", () => {
    const css = semComentarios("ficha.css");
    const esp = (s: string) => [
      (s.match(/#/g) ?? []).length,
      (s.match(/\.[a-z-]+|\[[^\]]+\]/g) ?? []).length,
      (s.match(/(^|\s|>)[a-z]+(?![\w-]*[[.])/g) ?? []).length,
    ];
    const fase = '.bp[data-state][data-fase="fechado"] .wp-pin';
    const estado = '.bp[data-state="cuidado"] .wp-pin';
    const [a, b] = [esp(fase), esp(estado)];
    const peso = (e: number[]) => e[0] * 100 + e[1] * 10 + e[2];
    expect(peso(a), `fase ${a} não ganha de estado ${b}`).toBeGreaterThanOrEqual(peso(b));
    // Empate em especificidade se resolve por ordem — então, se empatar, a
    // regra de fase TEM que vir depois. Vale nos dois casos.
    if (peso(a) === peso(b)) expect(css.indexOf(fase)).toBeGreaterThan(css.indexOf(estado));
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
    //   como vencida)       2: Pode ir
    const { pendentes } = redeFalsa();
    const quadros: string[] = [];
    const registrar = () => { quadros.push(document.querySelector(".mark")?.textContent ?? ""); };

    render(
      <Profiler id="carimbo" onRender={registrar}>
        <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" voz={VOZ_RAMPA} />
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
    expect(quadros.at(-1)).toBe("Pode ir");
  });
});

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-26). Até hoje a linha verde
// terminava com "Área alta, escorre rápido — a serra firmou", escrita FIXA
// aqui dentro. Era verdade sobre a Rampa, e este componente serve o acervo
// inteiro: no dia em que a Pedra Furada entrou, o app passou a afirmar serra
// num lugar plano. Mesma família do Critical de geografia inventada.
describe("Carimbo — a explicação do relevo vem da FICHA", () => {
  const PLANA = "Área plana — o chão batido retém menos água que o barro.";
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
  // ("choveu… o chão batido retém menos água que o barro"), então ela não sai do
  // ternário. Mutação alvo: mover o `{secaRapido}` pra fora do ramo fresco.
  // 🔴 Igualdade na frase inteira, e não `not.toContain("chão batido")`: a
  // asserção de ausência de texto passaria por vacuidade se a `.reason` sumisse.
  // Com o `toBe`, o ramo frio de verdade tem que estar lá — e a frase seca, não.
  it("no ramo frio a frase de relevo não aparece — ela explica o chão SECO", () => {
    const { container } = montar({ estado: "frio", secaRapido: PLANA, piso: "barro" });
    expect(container.querySelector(".reason")?.textContent).toBe(
      "Choveu nas últimas ~6h (ou vem chuva nas próximas ~3h). O barro segura água — risco de atolar.",
    );
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

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-27) — a OUTRA PONTA da mesma
// frase, e ela sobreviveu à rodada de ontem. O ramo molhado dizia "O barro
// segura água — risco de atolar", fixo aqui dentro. Estava certo POR SORTE: as
// duas fichas do acervo são de barro. A 3ª de asfalto faria o app afirmar barro
// onde não há — a mentira agendada de sempre, num componente que serve todos.
describe("Carimbo — o que a chuva faz com o chão vem do PISO", () => {
  const MOLHADO = "Choveu nas últimas ~6h (ou vem chuva nas próximas ~3h).";

  it("com barro, a frase do material entra depois da leitura de chuva", () => {
    const { container } = montar({ estado: "frio", piso: "barro" });
    expect(container.querySelector(".reason")?.textContent).toBe(
      `${MOLHADO} O barro segura água — risco de atolar.`,
    );
  });

  // 🔴 ESTE É O TESTE DA RODADA. Ficha de asfalto é o caso que não existe no
  // acervo hoje e por isso deixou a frase fixa passar dois meses: em runtime,
  // "frase do piso" e "frase fixa de barro" são indistinguíveis enquanto todo o
  // acervo for de barro. Só um piso SEM frase separa as duas versões.
  it("piso sem frase termina no ponto final — o app cala em vez de inventar barro", () => {
    const { container } = montar({ estado: "frio", piso: "asfalto-tapete" });
    expect(container.querySelector(".reason")?.textContent).toBe(MOLHADO);
  });

  // O par ortogonal do de cima: aquele prova que um piso CONHECIDO sem frase
  // cala; este, que ficha sem piso nenhum cala igual. São dois caminhos
  // diferentes até o mesmo silêncio, e uma frase de reserva mataria só um.
  it("ficha sem piso cala do mesmo jeito", () => {
    const { container } = montar({ estado: "frio" });
    expect(container.querySelector(".reason")?.textContent).toBe(MOLHADO);
  });

  // A direção de volta: a frase do material é do ramo MOLHADO. Solta do
  // ternário, ela apareceria embaixo de "Sem chuva nas últimas ~6h" — o app
  // avisando de atoleiro num dia seco.
  it("no ramo seco a frase do material não aparece", () => {
    const { container } = montar({ estado: "fresco", piso: "barro" });
    expect(container.querySelector(".reason")?.textContent).toBe(
      "Sem chuva nas últimas ~6h e nada previsto pras próximas ~3h.",
    );
  });

  // Sem leitura, o app devolve a decisão — e a instrução tem que servir a quem
  // olha DIRIGINDO. Igualdade, não `not.toContain("portão")`: a asserção de
  // ausência sozinha ficaria verde com a `.reason` sumida.
  it("sem leitura, manda olhar o chão NO CAMINHO — não no portão", () => {
    const { container } = montar({ estado: "frio", erro: true });
    expect(container.querySelector(".reason")?.textContent).toBe(
      "Não deu pra ler a chuva agora. Na dúvida, cheque o chão no caminho.",
    );
  });

  // 🔴 PROVA DE FONTE, e ela cobre o que nenhuma asserção de tela cobre: com as
  // duas fichas de hoje sendo de barro, a versão certa e a versão com a frase
  // fixa de reserva pintam a MESMA tela. Só a fonte separa — mesmo precedente
  // do `"use client"` e do `z.enum(PISOS)`.
  it("nenhum material escrito à mão no componente", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "app", "Carimbo.tsx"), "utf8");
    // Os comentários CITAM a frase antiga de propósito, pra contar de onde ela
    // veio. A tira precisa de guarda, senão a asserção de ausência abaixo passa
    // por vacuidade: as duas linhas seguintes provam que o código sobreviveu.
    const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(codigo, "a tira de comentários comeu o código").toContain("function motivo(");
    expect(codigo, "o carimbo parou de perguntar ao piso").toContain("chuvaNoPiso");
    expect(codigo, "a frase do barro não pode voltar pro código").not.toMatch(
      /atolar|segura água/i,
    );
    // Ele olha o chão DIRIGINDO, não parado no portão (decisão dele,
    // 2026-08-27). "cheque o barro no portão" errava as duas coisas de uma vez:
    // supunha o material E o lugar onde a pessoa decide.
    expect(codigo, "o carimbo voltou a mandar alguém ao portão").not.toMatch(/portão/i);
  });
});

// 🔴 A DUPLICAÇÃO QUE ESTE TESTE FECHA (2026-08-27). A palavra estava escrita à
// mão nos DOIS componentes. Trocar "Pode subir" por "Pode ir" era duas edições,
// e quem fizesse uma só deixava a home e a ficha discordando na mesma sessão —
// irmã do defeito histórico "a palavra e a cor nascendo de commits diferentes".
//
// A prova de FONTE (em tests/lib/carimbo-fase.test.ts) garante que nenhum dos
// dois escreve a palavra; este garante o que importa na tela: que o valor que
// chega nos dois é o MESMO. Uma não substitui a outra — a de fonte não olha a
// tela, e esta passaria com as duas escrevendo a mesma coisa à mão.
describe("a ficha e o cartão dizem a MESMA palavra", () => {
  const leitura = (estado: "fresco" | "frio") => ({ estado, erro: false, calculadoEm: AGORA_S });

  // 🔴 O CRUZAMENTO CRESCEU EM 2026-09-10: não são mais 2 casos, são 2 × 3 — a
  // palavra agora depende do NÍVEL da ficha, e carimbo e selo leem a mesma voz
  // por caminhos diferentes (o carimbo por prop da página, o selo pelo
  // `vozDaFicha` do cartão). Divergir num nível e bater nos outros é
  // exatamente o que a lista de 2 casos não veria.
  it.each(
    (["fresco", "frio"] as const).flatMap((estado) =>
      SEVERIDADES.map((severidade) => [estado, severidade] as const),
    ),
  )("com leitura %s e nível %s, carimbo e selo não divergem", (estado, severidade) => {
    const voz = { severidade, horasPassado: 6 } as const;
    const carimbo = render(
      <Carimbo estado={estado} erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" voz={voz} />,
    ).container.querySelector(".mark")?.textContent;
    cleanup();
    const selo = render(<SeloTrilha leitura={leitura(estado)} voz={voz} />).container
      .querySelector(".w")?.textContent;

    // Truthy antes de comparar: sem isto, dois elementos SUMIDOS dariam
    // `undefined === undefined` e o teste passaria com a tela vazia.
    expect(carimbo, "o carimbo perdeu a palavra").toBeTruthy();
    expect(selo, "o selo perdeu a palavra").toBeTruthy();
    expect(selo).toBe(carimbo);
  });
});

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-27). O carimbo só olhava
// CHUVA. A Pedra Furada fecha às 17h — às 18h com céu limpo a ficha dizia
// "Pode ir" com o lugar fechado havia uma hora. Decisão dele: o carimbo passa a
// olhar a hora.
//
// ⚠️ `AGORA_MS` do arquivo é 08h42 em Recife, DENTRO da faixa: por isso nenhum
// teste acima muda de resposta ao ganhar um horário. Quem quer o fechado move o
// relógio à mão — e sempre com timer FALSO, senão a suíte passaria de manhã e
// cairia à noite.
describe("Carimbo — a hora, e não só a chuva", () => {
  const PEDRA = { abre: "05:00", fecha: "17:00" };

  // Move o relógio E devolve o instante, porque os dois têm que andar juntos:
  // na primeira versão deste bloco eu movi só o relógio e deixei a leitura das
  // 08h42 — ela venceu de verdade, e o teste acusou "SEM INFORMAÇÕES" achando
  // que era defeito do fechado. Era o app certo e o teste errado.
  const asHoras = (hRecife: number) => {
    const ms = Date.UTC(2027, 0, 15, hRecife + 3, 0); // +3 = Recife → UTC
    vi.setSystemTime(ms);
    return ms / 1000;
  };

  it("18h com céu limpo: FECHADO — era isto que dizia 'Pode ir'", () => {
    const calculadoEm = asHoras(18);
    const { container } = montar({ abertura: { horario: PEDRA }, calculadoEm });
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".sub")?.textContent).toBe("abre amanhã às 5h");
    expect(container.querySelector(".reason")?.textContent).toBe("Fecha às 17h, abre às 5h.");
    expect(container.querySelector(".decision")?.getAttribute("data-fase")).toBe("fechado");
  });

  // O outro lado da mesma moeda, e ele não é redundante: "amanhã" e "hoje" são
  // a diferença entre perder o dia e só esperar.
  it("4h da manhã: fechado também, mas abre HOJE", () => {
    const calculadoEm = asHoras(4);
    const { container } = montar({ abertura: { horario: PEDRA }, calculadoEm });
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".sub")?.textContent).toBe("abre às 5h");
  });

  it("dentro da faixa, o carimbo volta a falar de chuva", () => {
    const calculadoEm = asHoras(9);
    const { container } = montar({ abertura: { horario: PEDRA }, calculadoEm });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
    expect(container.querySelector(".decision")?.getAttribute("data-fase")).toBe("afirmando");
  });

  // 🔴 A PRIORIDADE, na tela e não só na função pura: a leitura das 08h42 lida
  // às 18h está vencida de verdade, e mesmo assim o que se lê é "Fechado
  // agora". É o certo — saber que a chuva não foi lida não muda que o lugar
  // fechou, e "SEM INFORMAÇÕES · tome cuidado" ali convidaria a tentar.
  it("com leitura VENCIDA e o lugar fechado, quem vence é o fechado", () => {
    asHoras(18);
    const { container } = montar({ abertura: { horario: PEDRA }, calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
  });

  // 🔴 ESTE É O TESTE QUE PROTEGE A RAMPA. Ninguém disse o horário dela, e ela
  // não pode passar a fechar por causa desta rodada: sem o campo, o app decide
  // só pela chuva, exatamente como antes.
  it("ficha SEM horário nunca fecha, nem às 18h", () => {
    const calculadoEm = asHoras(18);
    const { container } = montar({ calculadoEm });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
  });

  // Fechado, a linha viva não pode dizer "lido da chuva agora": ela existe pra
  // afirmar que a leitura é de agora, e com o lugar fechado a leitura de chuva
  // não é o que decide. Mesma família do pulso ao lado de "SEM INFORMAÇÕES".
  it("fechado, a linha viva para de falar de chuva", () => {
    const calculadoEm = asHoras(18);
    const { container } = montar({ abertura: { horario: PEDRA }, calculadoEm });
    expect(container.querySelector(".live")?.textContent).toBe("fora do horário de agora");
  });

  it("o CSS pinta o carimbo fechado de parada, e para o pulso", () => {
    // A palavra e a COR têm que dizer o mesmo — "Fechado agora" num carimbo
    // verde é o pin verde ao lado do carimbo frio de volta.
    const css = semComentarios("ficha.css");
    const cor = regraDe(css, '.bp .decision[data-fase="fechado"] .stamp');
    expect(cor, "faltou a regra de cor da fase fechado").not.toBeNull();
    expect(valorDe(cor![0], "--st-bg")).toBe("var(--stop-bg)");
    const pulso = regraDe(css, '.bp .decision[data-fase="fechado"] .live .pulse');
    expect(pulso, "o pulso voltou a pulsar com o lugar fechado").not.toBeNull();
    expect(valorDe(pulso![0], "animation")).toBe("none");
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
        <Carimbo estado="frio" erro={true} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" voz={VOZ_RAMPA} />
      </StrictMode>,
    );

    tocar(container);
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    await act(async () => { pendentes[0].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S }); });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode ir");
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
