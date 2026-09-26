import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import CartaoTrilha from "@/app/CartaoTrilha";
import LocalVivo from "@/app/local";
import { CHAVE_LOCAL } from "@/lib/local";
import { getFichasComCondicao } from "@/lib/ficha";
import { agoraRecife } from "@/lib/horario";
import { semComentarios } from "../css";
import { bancoDeProducao } from "../banco";

afterEach(() => { cleanup(); localStorage.clear(); });

// `getFichasComCondicao()[0]` significava "a Rampa" só enquanto o acervo tinha
// UMA ficha. Com a segunda (Pedra Furada de Venturosa, 2026-08-25) o índice
// passou a apontar pra outra trilha — `ordenarPorNome` ordena pelo nome do
// waypoint, e "Pedra Furada" vem antes de "Rampa do Pepê". O índice dizia ONDE
// a ficha estava; o slug diz QUAL ficha o teste quer, que é o que os
// comentários daqui já afirmavam em português ("é a Rampa de verdade").
// O acervo vem do BANCO desde 2026-09-25 (semeado de `content/fichas/`), e é
// lido UMA vez no topo: `ficha` é a constante que quase todo teste daqui
// renderiza, e `beforeEach` roda depois da avaliação do módulo.
await bancoDeProducao();
const ACERVO = await getFichasComCondicao();

function fichaReal(slug: string) {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`ficha "${slug}" não está no acervo — estes testes são sobre ela`);
  return f;
}

const ficha = fichaReal("rampa-do-pepe");
const leitura = { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000, aviso: null };

describe("a linha de metadados do cartão", () => {
  it("sem localização, não inventa km", () => {
    const { container } = render(<CartaoTrilha ficha={ficha} inicial={leitura} />);
    expect(container.textContent).not.toContain("linha reta");
  });

  it("com localização, mostra o km em linha reta", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    render(<LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>);
    expect(await screen.findByText(/km em linha reta/)).toBeTruthy();
  });

  // ANTES este teste era `if (ficha.custo.tag === "pago") expect(...)` — um `if`
  // sem `else`, que **não assere nada** se a ficha for gratuita. Teste que pode
  // silenciosamente não testar é a família que esta rodada já pagou sete vezes.
  // A Rampa é `pago` hoje (conferido no JSON), mas amarrar o teste a isso o
  // deixa refém do conteúdo: ficha sintética resolve os dois problemas.
  it("mostra o custo quando a ficha cobra, e só a parte curta dele", () => {
    const paga = {
      ...ficha,
      custo: { tag: "pago" as const, valor: "R$ 5 por pessoa — cobrado no portão da entrada" },
    };
    const { container } = render(<CartaoTrilha ficha={paga} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("R$ 5 por pessoa");
    // O cartão é uma linha de relance: a logística do portão fica pra ficha.
    expect(meta).not.toContain("cobrado no portão");
  });

  // Este é o teste que teria pego o defeito real: o de cima usa ficha
  // SINTÉTICA com "—" (suposição errada de um brief antigo); o JSON de
  // verdade da Rampa usa "·". Ficha sintética só prova a função; só a ficha
  // real prova que ela funciona com o conteúdo que existe. `ficha` aqui é
  // getFichasComCondicao()[0] sem override nenhum — é a Rampa de verdade.
  // Se a Rampa um dia mudar de custo, este teste QUEBRA — é esperado: o
  // conteúdo mudou, alguém tem que olhar a tela de novo, não é bug.
  it("com a ficha real da Rampa, mostra só a parte curta do custo (separador '·')", () => {
    expect(ficha.custo.tag).toBe("pago");
    expect(ficha.custo.valor).toContain(" · ");
    const { container } = render(<CartaoTrilha ficha={ficha} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("R$ 5 por pessoa");
    expect(meta).not.toContain("cobrado no portão");
  });

  // custo.valor é texto livre; nada no schema garante separador nenhum. Um
  // custo curto sem "—" nem "·" tem que continuar aparecendo inteiro, não
  // sumir nem virar string vazia.
  it("custo sem separador continua aparecendo inteiro", () => {
    const semSeparador = { ...ficha, custo: { tag: "pago" as const, valor: "R$ 10" } };
    const { container } = render(<CartaoTrilha ficha={semSeparador} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toContain("R$ 10");
  });

  // O piso está aqui de propósito, e é o conserto de uma asserção que
  // MASCARAVA um sumiço: antes este teste era só `?.textContent ?? ""` +
  // `not.toContain("R$")` numa ficha gratuita SEM mais nada — e nessa ficha a
  // linha inteira não existe, então a asserção passava com o elemento AUSENTE.
  // É a mesma família do `aria-label` que escondeu a `<legend>` na Task 4.
  // Com a linha sustentada por outra parte, "não tem custo" volta a significar
  // "a linha existe e o custo não está nela".
  // (Era `extensaoKm` quem sustentava a linha antes da Task 6; a extensão
  // saiu da tela, então quem sustenta agora é o piso.)
  //
  // O `valor` numa ficha `gratis` não é descuido, é o que faz o teste provar o
  // que o nome promete. O schema PERMITE `{ tag: "gratis", valor: … }`, e uma
  // ficha que virou gratuita com o texto de custo herdado de uma edição
  // anterior é o caso real: sem esta string aqui, o cartão podia ler `valor`
  // sem olhar a `tag` e mostrar "R$ 5" num cartão marcado como grátis, com a
  // suíte inteira verde (medido: apagar `custo.tag === "pago" &&` sobrevivia).
  // As duas versões só se separam quando existe um `valor` pra ser mostrado
  // por engano.
  it("ficha gratuita não ganha linha de custo", () => {
    const gratis = {
      ...ficha,
      custo: { tag: "gratis" as const, valor: "R$ 5 por pessoa" },
      piso: "asfalto-esburacado" as const,
    };
    const { container } = render(<CartaoTrilha ficha={gratis} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta");
    expect(meta).not.toBeNull();
    expect(meta?.textContent).toBe("asfalto esburacado");
  });

  // O PAYLOAD desta rodada chega aqui. Herdeiro direto do teste que antes
  // guardava `esforco`/`duracao`: sem ele, o campo que o schema ganhou
  // (`piso`) podia nunca chegar à tela e nada acusaria — todos os outros
  // testes desta lista só provam AUSÊNCIA.
  //
  // Duas escolhas de exemplo são load-bearing, e nenhuma é decorativa:
  //
  // - `piso: "asfalto-esburacado"`, não "barro". `rotuloPiso("barro")` devolve
  //   "barro": com barro, chamar a função e mostrar o enum cru dão a MESMA
  //   string e nenhuma asserção separa as duas versões. Com o hífen, separa.
  // - a asserção é da LINHA INTEIRA (`toBe`), não `toContain`. É a única coisa
  //   aqui que prova a ORDEM — distância · piso · custo.
  it("com piso, ele aparece na linha, já formatado", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const cheia = { ...ficha, piso: "asfalto-esburacado" as const };
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={cheia} inicial={leitura} /></LocalVivo>,
    );
    await screen.findByText(/km em linha reta/);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    // O "~60 km" é de Gravatá até o waypoint da Rampa, com o conteúdo real: se
    // a ficha mudar de coordenada este número muda e o teste quebra, que é o
    // comportamento certo — alguém tem que olhar a tela de novo.
    expect(meta).toBe("~60 km em linha reta · asfalto esburacado · R$ 5 por pessoa");
  });

  // 🔴 O teste "o cartão não mostra mais km de trilha, mesmo com o campo na
  // ficha" morreu aqui (Task 7, 2026-08-23): ele escrevia `extensaoKm: 4.2`
  // de propósito no fixture pra provar "a tela parou de mostrar" (campo
  // presente) contra "o dado sumiu" (campo ausente) — distinção que só faz
  // sentido enquanto o campo existe no schema. Sem `extensaoKm`, ele ficou
  // EQUIVALENTE ao teste "ficha gratuita não ganha linha de custo" lá em
  // cima: os dois chegam na mesma asserção final ("asfalto esburacado") pelo
  // mesmo caminho (gratis + piso "asfalto-esburacado", sem localização). Eles
  // diferem em dois detalhes — o sobrevivente tem `custo.valor: "R$ 5 por
  // pessoa"` (o apagado não tinha) e não usa `<LocalVivo>` (o apagado usava)
  // —, e nenhum dos dois carrega prova que o outro não já carregasse: o
  // `valor` extra é exatamente o que já faz o sobrevivente mais forte (prova
  // que `gratis` ignora um `valor` presente, não só que ele fica ausente), e
  // o `<LocalVivo>` não muda o resultado porque nenhum dos dois grava
  // localização — preservar os dois seria duplicar sem motivo.

  // Herdeiro do antigo "ficha sem esforço/duração não mostra campo vazio",
  // apontado pro campo novo: sem piso, nem traço nem "undefined" no lugar.
  it("sem piso, a linha não inventa e não deixa separador solto", () => {
    const semPiso = { ...ficha, piso: undefined };
    const { container } = render(<CartaoTrilha ficha={semPiso} inicial={leitura} />);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toBe("R$ 5 por pessoa");
    expect(container.textContent).not.toContain("undefined");
  });

  // O teste que fala de PRODUÇÃO. `ficha` é a Rampa de verdade, lida da fonte de
  // verdade (o BANCO, desde 2026-09-25), que
  // desde 2026-08-23 traz `piso: "barro"` — dado do João, sustentado pela ficha
  // real em três lugares. É a primeira vez que o campo criado na rodada
  // passada aparece na tela dele. Fixture sintética não provaria isso.
  it("a Rampa REAL mostra distância, o piso de barro e o custo", async () => {
    expect(ficha.piso).toBe("barro");
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>,
    );
    await screen.findByText(/km em linha reta/);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toBe("~60 km em linha reta · barro · R$ 5 por pessoa");
  });

  // Ausência de ELEMENTO, não de texto — e é a diferença que importa. Nenhuma
  // asserção sobre `textContent` pega isto: `?.textContent ?? ""` dá a mesma
  // string vazia com o `<span>` presente e vazio ou com ele ausente, e o
  // `partes.length > 0 &&` podia cair sem nada acusar (medido: caía, e a suíte
  // ficava toda verde). Não é cosmético: `.bp .cartao` é flex com `gap: .2rem`
  // e `.cartao-meta` tem `margin-top: .35rem`, então um span vazio ainda é
  // item de flex e deixa ~0,55rem de folga — um cartão mais alto que os
  // vizinhos, com nada dentro. Ficha gratuita, sem localização e sem piso é o
  // caso real que chega lá.
  it("sem nada pra mostrar, a linha de metadados não existe", () => {
    const nua = {
      ...ficha,
      custo: { tag: "gratis" as const },
      piso: undefined,
    };
    const { container } = render(<CartaoTrilha ficha={nua} inicial={leitura} />);
    expect(container.querySelector(".cartao-meta")).toBeNull();
  });
});

// 🔴 A L3 CHEGA NA HOME (2026-09-10), e o que a motivou foi um número: até este
// dia `data-nivel` aparecia **zero vez** em `home.css`, `CartaoTrilha.tsx`,
// `SeloTrilha.tsx`, `MapaHome.tsx` e `FolhaTrilhas.tsx`. A procedência por
// contraste foi construída em 09/09 **só na ficha aberta** — a primeira tela do
// app, a que se navega, não distinguia o que o mapa entrega do que só sabe quem
// foi. Ninguém decidiu isso; aconteceu.
//
// 🔴 O NÍVEL DE CADA CAMPO NÃO É ESCOLHA DESTA TELA. É a régua escrita em
// `[slug]/page.tsx`: Nível A é o que o mapa e o feed de chuva entregam igual pra
// qualquer um; Nível B é o que só sabe quem foi — e a régua **nomeia o piso**.
// O preço é B por decisão dele em 09/09 ("preço e horário brilham"). A
// distância é A: o telefone calcula.
describe("a linha de metadados obedece à mesma régua de nível da ficha", () => {
  const comLocal = () =>
    localStorage.setItem(
      CHAVE_LOCAL,
      JSON.stringify({
        tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
        em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
      }),
    );

  const meta = (c: HTMLElement) =>
    Array.from(c.querySelectorAll(".cartao-meta span[data-nivel], .cartao-meta span:not([data-nivel])"))
      .filter((s) => !s.querySelector("span") && !s.classList.contains("sep"))
      .map((s) => [s.textContent ?? "", s.getAttribute("data-nivel")] as const);

  it("o piso e o preço brilham; a distância não", async () => {
    comLocal();
    // A Rampa é paga E tem piso — exercita os três pedaços de uma vez.
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={fichaReal("rampa-do-pepe")} inicial={leitura} /></LocalVivo>,
    );
    await screen.findByText(/km/);

    const pedacos = meta(container);
    expect(pedacos.length, "os três pedaços têm que existir").toBe(3);

    const nivelDe = (t: string) => pedacos.find(([texto]) => texto.includes(t))?.[1];
    expect(nivelDe("km"), "a distância é Nível A — o telefone calcula").toBeNull();
    expect(nivelDe("barro"), "o piso é Nível B — a régua o nomeia").toBe("b");
    expect(nivelDe("R$"), "o preço é Nível B — decisão dele em 09/09").toBe("b");
  });

  // 🔴 O separador não é conhecimento de ninguém — é pontuação. Com o " · "
  // colado no texto de cada pedaço (o `join` que existia até hoje), a marca do
  // Nível B pintaria o ponto junto.
  it("o separador fica FORA da marca", () => {
    const { container } = render(<CartaoTrilha ficha={fichaReal("rampa-do-pepe")} inicial={leitura} />);
    const seps = Array.from(container.querySelectorAll(".cartao-meta .sep"));
    expect(seps.length).toBeGreaterThan(0);
    for (const s of seps) expect(s.getAttribute("data-nivel")).toBeNull();
    // E o texto visível não mudou de forma: continua "a · b · c".
    expect(container.querySelector(".cartao-meta")?.textContent).toMatch(/\S · \S/);
  });

  // 🔴 A ASSIMETRIA É O DESENHO INTEIRO, igual na ficha: marcar o Nível A
  // criaria a etiqueta simétrica que a decisão recusa e faria a distância
  // parecer credencial. `[data-nivel="a"]` não existe neste repo, e este guarda
  // varre os dois arquivos da home pra continuar assim.
  it("não existe marca de Nível A na home, nem no markup nem no CSS", () => {
    comLocal();
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={fichaReal("rampa-do-pepe")} inicial={leitura} /></LocalVivo>,
    );
    expect(container.querySelectorAll('[data-nivel="a"]')).toHaveLength(0);
    expect(semComentarios("home.css")).not.toContain('data-nivel="a"');
    // Controle: o B existe mesmo — senão a ausência do A passa por vacuidade.
    expect(semComentarios("home.css")).toContain('data-nivel="b"');
  });

  // O acervo inteiro, não uma ficha: a Pedra Furada é GRÁTIS, então o cartão
  // dela tem dois pedaços e não três. Guarda que só olha a Rampa é cego a isso.
  it("vale pro acervo inteiro, e ficha grátis simplesmente tem um pedaço a menos", () => {
    for (const f of ACERVO) {
      const { container } = render(<CartaoTrilha ficha={f} inicial={leitura} />);
      for (const [texto, nivel] of meta(container)) {
        if (f.piso && texto.includes(f.piso.replace(/-/g, " "))) expect(nivel, f.slug).toBe("b");
      }
      cleanup();
    }
  });
});

// 🔴 C1 DA REVISÃO FINAL (2026-09-16), espelho do teste do `Carimbo`. Na home
// NÃO há `AvisoDoDono`: o cartão é a afirmação inteira. A Rampa numa QUARTA,
// com "a rampa está em reforma" valendo, saía "FECHADO AGORA / abre sábado" —
// e "abre sábado" é FALSO enquanto o aviso vale. O dono ganha do calendário
// como ganha do motor: fecharam os dois, a linha de baixo do selo se cala.
// Renderiza `CartaoTrilha` (não `SeloTrilha` solto) porque é o cartão quem lê a
// leitura e monta a `abertura` da ficha real — o selo virou apresentacional.
describe("o selo do cartão, com o dono e o calendário fechando juntos", () => {
  // 2027-01-13 é uma quarta-feira; 9h em Recife = 12h UTC. A Rampa REAL só
  // abre sábado e domingo (content/), e é o dia que o calendário fecha.
  const QUARTA_S = Date.UTC(2027, 0, 13, 12, 0) / 1000;
  const quarta = () => agoraRecife(QUARTA_S);
  const emReforma = {
    texto: "a rampa está em reforma",
    efeito: "fechado" as const,
    criadoEm: QUARTA_S - 86_400,
    venceEm: QUARTA_S + 7 * 86_400,
  };

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(QUARTA_S * 1000); });
  afterEach(() => { vi.useRealTimers(); });

  // CONTROLE DA PREMISSA E GUARDA DE REGRESSÃO num só: fechou SÓ o calendário,
  // a frase do calendário SAI. Sem esta metade, um fixture que nunca fechasse
  // faria a asserção de ausência lá embaixo passar pelo motivo errado.
  it("fechada só pelo calendário, o selo diz quando abre — como sempre disse", () => {
    const { container } = render(
      <CartaoTrilha ficha={ficha} inicial={{ ...leitura, calculadoEm: QUARTA_S }} agora={quarta()} />,
    );
    expect(container.querySelector(".selo .w")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".selo .s")?.textContent).toBe("abre sábado");
  });

  it("fechada pelo calendário E pelo dono, o selo NÃO promete sábado nenhum", () => {
    const { container } = render(
      <CartaoTrilha
        ficha={ficha}
        inicial={{ ...leitura, calculadoEm: QUARTA_S, aviso: emReforma }}
        agora={quarta()}
      />,
    );
    // O que TEM que estar lá: a palavra, a fase, e o elemento da linha de baixo.
    expect(container.querySelector(".selo .w")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".selo")?.getAttribute("data-fase")).toBe("fechado");
    expect(container.querySelector(".selo .s"), "a linha de baixo do selo sumiu").not.toBeNull();
    // E o que NÃO pode: a promessa do calendário por cima do fechado do dono.
    expect(
      container.querySelector(".selo .s")?.textContent,
      "o selo voltou a prometer 'abre sábado' com o dono dizendo que está em reforma",
    ).toBe("");
  });
});
