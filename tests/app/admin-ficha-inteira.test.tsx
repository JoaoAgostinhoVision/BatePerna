import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import FichaInteira, { ROTULOS, ROTULO_DO_PONTO, rotuloDe } from "@/app/admin/FichaInteira";
import { CAMPOS_DA_FICHA, camposDaFicha, type GrupoDaFicha } from "@/lib/campos-da-ficha";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { bancoDeProducao } from "../banco";
import { regraDe, semComentarios } from "../css";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// O acervo vem do BANCO pelo caminho de produção, como todo teste de tela do
// painel desde 2026-09-25 — nada de ficha inventada aqui: o que esta tela tem
// que aguentar é a ficha real, com os campos que ela de fato não tem.
await bancoDeProducao();
const ACERVO = await getAllFichas();

function exigir(slug: string): Ficha {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`"${slug}" sumiu do acervo — este arquivo mede as fichas reais`);
  return f;
}

/** A ficha SEM `horario` — é ela que prova o caso do bloco ausente com as
 *  folhas dele ainda na lista. Se um dia ela ganhar horário, o `exigir`
 *  abaixo continua passando e este arquivo passaria a medir outra coisa: daí
 *  a asserção explícita. */
const semHorario = exigir("rampa-do-pepe");
/** A ficha COM `horario` — o par simétrico: o bloco presente não pode repetir
 *  o valor das folhas. */
const comHorario = exigir("pedra-furada-de-venturosa");

/** 🔴 QUANTOS BLOCOS A FICHA SEM HORÁRIO TEM, CRAVADO À MÃO, e o motivo ao
 *  lado — sem o número, um registro que ENCOLHESSE passaria verde no laço
 *  abaixo (é a 44ª espécie do catálogo, que mordeu quatro vezes nesta rodada).
 *
 *  29 = as 25 entradas do registro que não são molde + as 4 folhas do único
 *  waypoint desta ficha (`nome`, `lat`, `lng`, `nota`). O registro tem 29
 *  entradas, das quais 4 são molde — então uma ficha de 1 waypoint dá
 *  25 + 4 = 29 blocos, e uma de 2 waypoints daria 33. (Era 30 até a Tarefa
 *  11b, 2026-10-04: a `cidade` entrou no registro, 31; e na 11c, no mesmo dia,
 *  `horario.abre` e `horario.fecha` saíram — o horário virou UMA entrada, a
 *  lista de faixas.) */
const BLOCOS_DE_UM_WAYPOINT = 29;

/** A ORDEM DOS SEIS GRUPOS, cravada à mão: ela é contrato desta tela (é a
 *  ordem em que o dono lê a ficha, a mesma da §3 do desenho), e o componente a
 *  DERIVA do registro. Cravar aqui é o que separa "o componente respeita a
 *  ordem do registro" de "o componente e o teste erram juntos": derivar a
 *  expectativa da mesma fonte que a implementação deixaria passar um registro
 *  reordenado por acidente. */
const ORDEM_DOS_GRUPOS: readonly GrupoDaFicha[] = [
  "voz",
  "chegar",
  "custo",
  "quando",
  "condicao",
  "discriminador",
];

const testidsDe = (raiz: HTMLElement, prefixo: string): string[] =>
  [...raiz.querySelectorAll(`[data-testid^="${prefixo}"]`)].map((e) => e.getAttribute("data-testid")!);

describe("FichaInteira — a ficha inteira, em grupos", () => {
  it("mostra TODOS os campos concretos desta ficha, nenhum a menos", () => {
    const campos = camposDaFicha(semHorario);
    expect(campos, "o registro mudou de tamanho: confira o motivo cravado acima").toHaveLength(
      BLOCOS_DE_UM_WAYPOINT,
    );
    const { container } = render(<FichaInteira ficha={semHorario} />);
    for (const c of campos) {
      expect(screen.getByTestId(`campo-${c.caminho}`), c.caminho).toBeTruthy();
    }
    // E nenhum bloco A MAIS: sem isto, um componente que renderizasse blocos
    // extras (ou os mesmos campos duas vezes) passaria no laço de cima.
    expect(testidsDe(container, "campo-")).toHaveLength(BLOCOS_DE_UM_WAYPOINT);
  });

  // 🔴 O DEFEITO QUE O PLANO DESTA TAREFA PEDIA. O teste escrito no plano
  // iterava `CAMPOS_DA_FICHA` — o registro CRU, que traz MOLDES (`[]` =
  // "qualquer índice"). Satisfazê-lo exigiria um bloco
  // `campo-trajeto.waypoints[].nome`, que não é campo de ficha nenhuma: é um
  // molde, não dá pra gravar, e não corresponde a dado nenhum na tela do dono.
  it("nenhum MOLDE vai pra tela — só caminhos concretos, com índice", () => {
    const { container } = render(<FichaInteira ficha={semHorario} />);
    expect(
      [...container.querySelectorAll('[data-testid*="[]"]')],
      "um molde do registro virou bloco de tela",
    ).toHaveLength(0);
    expect(screen.getByTestId("campo-trajeto.waypoints.0.nome")).toBeTruthy();
  });

  it("uma ficha com 3 waypoints mostra os 3 conjuntos, e o número de blocos cresce com ela", () => {
    const wp = semHorario.trajeto.waypoints[0];
    const tres: Ficha = {
      ...semHorario,
      trajeto: { waypoints: [0, 1, 2].map((i) => ({ ...wp, nome: `parada ${i}` })) },
    };
    const { container } = render(<FichaInteira ficha={tres} />);
    for (const i of [0, 1, 2]) {
      expect(screen.getByTestId(`campo-trajeto.waypoints.${i}.nome`), `waypoint ${i}`).toBeTruthy();
    }
    // 25 fixos + 3 × 4 folhas de waypoint.
    expect(testidsDe(container, "campo-")).toHaveLength(25 + 12);
  });

  // 🔴 Sem isto, um componente que renderiza uma caixa vazia passa no teste de
  // cima e não mostra NADA. Um caso por espécie do registro, e cada asserção
  // é `within(o bloco daquele campo)` — "está em algum lugar da tela" é a
  // espécie que o catálogo pegou em 25/09.
  //
  // 🔴 A TASK 6 PARTIU ESTE CASO EM DOIS, e a razão é de desenho: onde o campo
  // ganhou INSTRUMENTO, o valor mora DENTRO do controle (é o que o dono vai
  // editar) e um `<p>` ao lado diria a mesma coisa duas vezes — então ali o que
  // se mede é o valor do controle, não o texto do bloco.
  //
  // 🔴 NA TASK 8 A ÚLTIMA ESPÉCIE SEM INSTRUMENTO (`coord`) GANHOU O MAPA, e este
  // caso deixou de medir `<p>` de leitura: o número da coordenada agora mora no
  // `coord-atual` DO EDITOR, embaixo do mapa. As três linhas `coord` têm três
  // formas diferentes de mostrar, e as três são medidas — a `.lat` de um ponto
  // mostra o PAR do ponto (é ela que carrega o mapa dele), a `.lng` só o número
  // dela. O que tinha `<p>` (o `bloco` presente) deixou de existir na Tarefa
  // 11c: o horário virou a lista de faixas, cujas caixas SÃO o valor.
  it("o VALOR de cada campo `coord` aparece DENTRO do bloco dele, no número embaixo do mapa", () => {
    render(<FichaInteira ficha={semHorario} />);
    const lido = (caminho: string, texto: string) =>
      expect(
        screen.getByTestId(`campo-${caminho}`).querySelector('[data-testid="coord-atual"]')?.textContent,
        `${caminho} não mostrou o valor dentro do bloco`,
      ).toBe(texto);

    const wp = semHorario.trajeto.waypoints[0];
    lido("trajeto.waypoints.0.lat", `${wp.lat}, ${wp.lng}`); // coord metade, com o mapa do ponto
    lido("trajeto.waypoints.0.lng", String(wp.lng)); // coord metade, só o número
    lido(
      "condicao.coords",
      `${semHorario.condicao.coords.lat}, ${semHorario.condicao.coords.lng}`,
    ); // coord par
  });

  it("o VALOR de cada campo COM instrumento aparece dentro do controle do bloco dele", () => {
    render(<FichaInteira ficha={semHorario} />);
    const naCaixa = (caminho: string, texto: string) =>
      expect(
        within(screen.getByTestId(`campo-${caminho}`)).getByDisplayValue(texto),
        `${caminho} não trouxe o valor dentro do controle`,
      ).toBeTruthy();

    naCaixa("voz", semHorario.voz); // prosa
    naCaixa("acesso", semHorario.acesso); // prosa
    naCaixa("custo.valor", semHorario.custo.valor!); // prosa opcional PREENCHIDA
    naCaixa("piso", semHorario.piso!); // lista de uma
    naCaixa("condicao.severidade", semHorario.condicao.severidade); // lista de uma
    // 🔴 `numero` (Task 7): os TRÊS, não um de amostra — o limiar é fracionário
    // (`0.2`) e as janelas são inteiras, e um editor que coagisse pra inteiro
    // mostraria `0` no campo que decide se o lugar fecha.
    naCaixa("condicao.regra.limiar_mm", String(semHorario.condicao.regra.limiar_mm));
    naCaixa("condicao.regra.janela_passado_horas", String(semHorario.condicao.regra.janela_passado_horas));
    naCaixa("condicao.regra.janela_previsao_horas", String(semHorario.condicao.regra.janela_previsao_horas));

    // lista de VÁRIOS: o valor é o conjunto marcado, não um texto
    const dias = within(screen.getByTestId("campo-dias"));
    for (const d of semHorario.dias!) {
      expect(
        (dias.getByRole("checkbox", { name: d }) as HTMLInputElement).checked,
        `${d} está na ficha e não veio marcado`,
      ).toBe(true);
    }
    // booleano: a resposta marcada é a que a ficha diz
    expect(semHorario.carroComum, "esta ficha perdeu o `carroComum`").toBe(true);
    const carro = within(screen.getByTestId("campo-carroComum"));
    expect((carro.getByRole("radio", { name: "Sim" }) as HTMLInputElement).checked).toBe(true);
    expect((carro.getByRole("radio", { name: "Não" }) as HTMLInputElement).checked).toBe(false);
    // o horário (a lista de faixas) só a ficha que TEM horário pode provar, e
    // está provado no `describe` "o horário, uma entrada só" mais abaixo.
  });

  it("o RÓTULO de cada campo aparece dentro do bloco dele, e não é o caminho cru", () => {
    const { container } = render(<FichaInteira ficha={semHorario} />);
    for (const c of camposDaFicha(semHorario)) {
      const marca = container.querySelector(`[data-testid="campo-${c.caminho}"] [data-rotulo]`);
      expect(marca, `${c.caminho} ficou sem rótulo dentro do bloco dele`).not.toBeNull();
      // 🔴 A RÉGUA É O PONTO, e ela nasceu de duas tentativas erradas medidas.
      // `not.toBe(c.caminho)` é frouxa: o ramo do ponto devolvia
      // `Ponto 1 · trajeto.waypoints.0.nota`, que não é IGUAL ao caminho e
      // mostrava o caminho cru na cara do dono. E `not.toContain(c.caminho)` é
      // dura demais: o rótulo "A promessa" contém, com razão, a palavra
      // `promessa`. O que nenhum rótulo desta tela pode ter é **caminho
      // pontuado** — nenhum deles tem ponto, e todo caminho aninhado tem.
      expect(marca!.textContent, `${c.caminho} mostrou o caminho cru como rótulo`).not.toBe(c.caminho);
      expect(marca!.textContent, `${c.caminho}: rótulo com ponto é caminho vazando`).not.toMatch(/\w\.\w/);
      expect(marca!.textContent, `${c.caminho} veio com rótulo vazio`).toBeTruthy();
    }
  });

  it("campo ausente é marcado como ausente, não some nem finge vazio", () => {
    const semPiso: Ficha = { ...semHorario, piso: undefined };
    render(<FichaInteira ficha={semPiso} />);
    const bloco = screen.getByTestId("campo-piso");
    expect(bloco).toBeTruthy();
    // 🔴 O PARÁGRAFO DE AUSÊNCIA, não o `textContent` do bloco: desde a Task 6 o
    // botão "Não sei — o app cala sobre isto" mora no mesmo bloco, e medir o
    // texto todo faria este caso passar por causa do BOTÃO — "guarda que sai com
    // o código certo pelo motivo errado", que mordeu três vezes nesta rodada.
    const frase = bloco.querySelector(".adm-campo-ausente");
    expect(frase, "o parágrafo de ausência sumiu do bloco").not.toBeNull();
    expect(frase!.textContent).toBe("Ainda sem dados");
    expect(bloco.hasAttribute("data-ausente")).toBe(true);
  });

  // 🔴 O PAR SIMÉTRICO, e sem ele o caso de cima fica VERDE numa tela que
  // escreve "Ainda sem dados" em TODOS os blocos — a espécie "guarda que sai com o
  // código certo pelo motivo errado", que mordeu três vezes nesta rodada.
  it("campo preenchido NÃO traz a marca de ausente — e só os três ausentes de verdade a trazem", () => {
    const { container } = render(<FichaInteira ficha={semHorario} />);
    const cheio = screen.getByTestId("campo-voz");
    expect(cheio.hasAttribute("data-ausente"), "campo preenchido veio marcado de ausente").toBe(false);
    expect(cheio.querySelector(".adm-campo-ausente"), "campo cheio ganhou frase de ausência").toBeNull();
    // `voz` é OBRIGATÓRIO, então não há botão de "não sei" nenhum neste bloco —
    // é o que deixa a asserção de `textContent` continuar valendo depois da
    // Task 6.
    expect(cheio.textContent).not.toMatch(/ainda sem dados/i);

    // 🔴 2, cravado e com motivo: nesta ficha falta exatamente o `horario` (uma
    // entrada só desde a Tarefa 11c) — e a `cidade`, que NENHUMA ficha real
    // tem até o João respondê-la pelo painel (Tarefa 11b: obrigatória no
    // registro, e ninguém a preenche por ele). Todo o resto do registro está
    // preenchido (piso, carroComum, dias, secaRapido, custo.valor,
    // custo.curto e a nota do waypoint, que são os opcionais que ela TEM).
    const marcados = [...container.querySelectorAll("[data-ausente]")].map(
      (e) => e.getAttribute("data-testid")!,
    );
    expect(marcados.sort()).toEqual(["campo-cidade", "campo-horario"]);
  });

  // 🔴 `false` NÃO É SILÊNCIO. `carroComum: false` é uma AFIRMAÇÃO ("não
  // chega") e o schema diz isso por extenso; ausente é silêncio. Um `!valor`
  // no componente misturaria as duas — e `condicao.regra.limiar_mm` pode ser
  // `0`, que cairia no mesmo buraco.
  it("booleano `false` diz Não, e não é marcado como ausente", () => {
    render(<FichaInteira ficha={{ ...semHorario, carroComum: false }} />);
    const bloco = screen.getByTestId("campo-carroComum");
    expect(bloco.hasAttribute("data-ausente")).toBe(false);
    expect(within(bloco).getByText("Não")).toBeTruthy();
  });

  it("os campos aparecem agrupados, e cada bloco mora DENTRO do grupo dele", () => {
    render(<FichaInteira ficha={semHorario} />);
    for (const c of camposDaFicha(semHorario)) {
      expect(
        within(screen.getByTestId(`grupo-${c.grupo}`)).getByTestId(`campo-${c.caminho}`),
        `${c.caminho} ficou fora do grupo ${c.grupo}`,
      ).toBeTruthy();
    }
  });

  it("nenhum grupo fica órfão: os seis do registro estão na tela, na ordem cravada", () => {
    const { container } = render(<FichaInteira ficha={semHorario} />);
    expect(
      [...new Set(CAMPOS_DA_FICHA.map((c) => c.grupo))],
      "o registro ganhou, perdeu ou reordenou um grupo",
    ).toEqual([...ORDEM_DOS_GRUPOS]);
    expect(testidsDe(container, "grupo-")).toEqual(ORDEM_DOS_GRUPOS.map((g) => `grupo-${g}`));
  });

  it("dentro de cada grupo, a ordem dos campos é a do registro", () => {
    render(<FichaInteira ficha={semHorario} />);
    const campos = camposDaFicha(semHorario);
    for (const g of ORDEM_DOS_GRUPOS) {
      expect(testidsDe(screen.getByTestId(`grupo-${g}`), "campo-"), `ordem do grupo ${g}`).toEqual(
        campos.filter((c) => c.grupo === g).map((c) => `campo-${c.caminho}`),
      );
    }
  });
});

describe("FichaInteira — o horário, uma entrada só (a lista de faixas)", () => {
  // 🔴 TAREFA 11c: o horário deixou de ser um bloco com duas folhas e virou UMA
  // entrada, a lista de 1 a 3 faixas. As caixas de hora SÃO o valor: o bloco
  // não repete as horas num `<p>` ao lado, e não diz mais "sim".
  it("com horário: as horas da faixa estão nas caixas, e as duas horas não são campos", () => {
    render(<FichaInteira ficha={comHorario} />);
    const bloco = screen.getByTestId("campo-horario");
    const [faixa] = comHorario.horario!;
    expect(within(bloco).getByDisplayValue(faixa.abre)).toBeTruthy();
    expect(within(bloco).getByDisplayValue(faixa.fecha)).toBeTruthy();
    expect(screen.queryByTestId("campo-horario.abre")).toBeNull();
    expect(screen.queryByTestId("campo-horario.fecha")).toBeNull();
  });

  it("com intervalo: as duas faixas, na ordem, cada uma com as duas horas", () => {
    const ALMOCO = [
      { abre: "08:00", fecha: "10:00" },
      { abre: "14:00", fecha: "17:00" },
    ];
    render(<FichaInteira ficha={{ ...comHorario, horario: ALMOCO }} />);
    const caixas = [...screen.getByTestId("campo-horario").querySelectorAll<HTMLInputElement>("input[type=time]")];
    expect(caixas.map((c) => c.value)).toEqual(["08:00", "10:00", "14:00", "17:00"]);
  });

  // 🔴 Ausente, o campo aparece MARCADO — nunca some —, e o caminho de volta
  // depois de um "não tem" é uma faixa de caixas VAZIAS: nada pré-preenchido.
  it("sem horário: um bloco só, marcado ausente, com as caixas vazias", () => {
    expect(semHorario.horario, "esta ficha ganhou horário — o caso deixou de ser medido").toBeUndefined();
    render(<FichaInteira ficha={semHorario} />);
    const bloco = screen.getByTestId("campo-horario");
    expect(bloco.hasAttribute("data-ausente")).toBe(true);
    expect(bloco.querySelector(".adm-campo-ausente")!.textContent).toBe("Ainda sem dados");
    const caixas = [...bloco.querySelectorAll<HTMLInputElement>("input[type=time]")];
    expect(caixas.map((c) => c.value)).toEqual(["", ""]);
  });
});

describe("FichaInteira — o componente serve os três lugares", () => {
  // 🔴 A voz é de UM lugar só, e este componente serve o acervo inteiro.
  it("serve as três fichas sem nenhuma frase de uma aparecer na outra", () => {
    expect(ACERVO.length, "com uma ficha só este teste não separa nada").toBeGreaterThan(1);
    for (const f of ACERVO) {
      const { unmount } = render(<FichaInteira ficha={f} />);
      for (const outra of ACERVO.filter((x) => x.slug !== f.slug)) {
        expect(screen.queryByText(outra.voz), `${outra.slug} vazou na tela de ${f.slug}`).toBeNull();
        expect(screen.queryByText(outra.promessa)).toBeNull();
      }
      unmount();
    }
  });

  // 🔴 A espécie que o agente `voz-do-lugar` caça, METADE 1: texto fixo que
  // MUDA de lugar pra lugar. Se um rótulo saísse do dado da ficha, ele variaria
  // entre as três — e um rótulo é sobre a FORMA do campo, que é igual em
  // qualquer lugar do mundo.
  it("o rótulo de um mesmo campo é IGUAL nas três fichas", () => {
    const porFicha = ACERVO.map((f) => {
      const { container, unmount } = render(<FichaInteira ficha={f} />);
      const mapa = new Map<string, string>();
      for (const e of container.querySelectorAll("[data-rotulo]")) {
        mapa.set(e.getAttribute("data-rotulo")!, e.textContent ?? "");
      }
      unmount();
      return mapa;
    });
    const primeira = porFicha[0];
    expect(primeira.size, "nenhum rótulo foi lido: o marcador `data-rotulo` sumiu").toBeGreaterThan(0);
    for (const outra of porFicha.slice(1)) {
      for (const [caminho, rotulo] of outra) {
        if (primeira.has(caminho)) {
          expect(rotulo, `o rótulo de ${caminho} muda de lugar pra lugar`).toBe(primeira.get(caminho));
        }
      }
    }
  });

  // 🔴 METADE 2, e é a que o teste de cima NÃO pega: um rótulo que NOMEIE um
  // lugar é igual nas três fichas — e falso em duas. ("O piso da via até a
  // Rampa" passaria ali sem piscar.) O vocabulário proibido SAI DO ACERVO (os
  // radicais dos slugs, sem as palavrinhas de ligação), nunca de uma lista
  // escrita aqui: ficha nova traz as palavras dela sozinha. Mesmo molde do
  // `RADICAIS_DE_PISO` em `tests/lib/questionario.test.ts`.
  //
  // ⚠️ O QUE ELE NÃO ALCANÇA: substantivo de lugar sem nome próprio ("no
  // portão", "na guarita"). Isso continua sendo trabalho do agente
  // `voz-do-lugar` e da leitura do dono — nenhum teste pega.
  it("nenhuma frase FIXA da tela nomeia um lugar do acervo", () => {
    const semAcento = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    // 🔴 O CERCO FICOU COM BURACO NA PRIMEIRA VERSÃO, e um re-revisor provou:
    // ele filtrava por `p.length > 3` para não tropeçar nos conectivos do slug
    // (`de`, `do`), e isso descartava **`veu`** — a palavra-chave da ficha mais
    // nova do acervo. Medido: o rótulo `"O piso da via ate o Veu"` passava
    // VERDE. E baixar o limiar sozinho não serve: com `> 2` o guarda fica
    // vermelho por INOCÊNCIA, porque `includes` casa `veu` dentro de
    // "cho**veu**".
    //
    // O conserto é casar por PALAVRA (fronteira), não por substring, e tirar os
    // conectivos por LISTA em vez de por tamanho. Assim `veu` entra no cerco e
    // "choveu" não dispara.
    const CONECTIVOS = ["de", "do", "da", "dos", "das", "e"];
    const proibidas = [
      ...new Set(ACERVO.flatMap((f) => f.slug.split("-"))),
    ]
      .map(semAcento)
      .filter((p) => !CONECTIVOS.includes(p));
    expect(proibidas.length, "nenhum radical de slug: o cerco ficaria oco").toBeGreaterThan(2);
    expect(proibidas, "o radical curto do Véu tem de estar no cerco").toContain("veu");

    const fixas: string[] = [];
    for (const f of ACERVO) {
      const { container, unmount } = render(<FichaInteira ficha={f} />);
      for (const sel of ["h2", "h3", "[data-rotulo]", ".adm-campo-ausente"]) {
        for (const e of container.querySelectorAll(sel)) fixas.push(e.textContent ?? "");
      }
      unmount();
    }
    expect(fixas.length, "nenhuma frase fixa foi lida: o cerco ficaria oco").toBeGreaterThan(30);
    for (const frase of fixas) {
      // Palavras da frase, sem acento e sem pontuação: é a fronteira que
      // impede "choveu" de acusar `veu`, e que faz `veu` sozinho acusar.
      const palavrasDaFrase = new Set(
        semAcento(frase)
          .split(/[^a-z0-9]+/)
          .filter((p) => p.length > 0),
      );
      for (const palavra of proibidas) {
        expect(
          palavrasDaFrase.has(palavra),
          `a frase fixa "${frase}" fala de um lugar (${palavra}) num componente que serve os três`,
        ).toBe(false);
      }
    }
  });

  // 🔴 O CONTROLE DO CERCO, e ele existe porque a primeira versão deste guarda
  // tinha buraco: um cerco que casa por palavra pode ficar OCO por outro lado —
  // se a fronteira for frouxa, "choveu" acusa `veu` e o guarda fica vermelho
  // por inocência; se for dura demais, o nome do lugar passa. Estas duas linhas
  // fixam os dois lados, com as frases que de fato estão na tela.
  it("o cerco de nome de lugar acusa o nome e NÃO acusa a palavra que o contém", () => {
    const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const palavras = (frase: string) =>
      new Set(semAcento(frase).split(/[^a-z0-9]+/).filter((p) => p.length > 0));

    expect(palavras("Quantas horas pra trás olhar se choveu").has("veu"), "choveu NÃO é o Véu").toBe(false);
    expect(palavras("O piso da via ate o Veu").has("veu"), "o Véu É o Véu").toBe(true);
    expect(palavras("Parada 1 · O nome do ponto").has("rampa"), "sem nome de lugar aqui").toBe(false);
  });

});

describe("FichaInteira — os guardas do que cresce: rótulo e CSS", () => {
  // 🔴 O DEFEITO I6 DA REVISÃO FINAL DE 26/09, que este arquivo não vai
  // repetir: `EditorDeVoz` e `HistoricoDaVoz` (hoje `HistoricoDaFicha`) nasceram SEM UMA REGRA sequer no
  // `admin.css` e a suíte inteira ficou verde — o `<textarea>` caía no default
  // do navegador na mão do dono. Classe que a tela usa e a folha não conhece
  // não é detalhe de estilo, é elemento sem forma nenhuma.
  it("toda classe que esta tela usa tem regra no `admin.css`", () => {
    const css = semComentarios("admin/admin.css");
    // 🔴 AS DUAS FICHAS, NÃO UMA (Task 8). Uma classe pode existir só numa
    // delas — foi o `.adm-campo-valor`, que vivia só no bloco `horario`
    // PRESENTE (saiu na 11c da folha e na 11d do código) —, e medir uma ficha só
    // acusaria como morta uma regra viva na outra. Medido: o vermelho era esse.
    const { container } = render(
      <>
        <FichaInteira ficha={semHorario} />
        <FichaInteira ficha={comHorario} />
      </>,
    );
    // 🔴 E O EDITOR DO TRAJETO ABERTO (Tarefa 11c): o ponto novo só aparece
    // depois do toque, e as classes dele (`.adm-editor-caixa`, `.adm-editor-ajuda`)
    // entram na medição pelo estado em que o dono as vê. ⚠️ A 11c escreveu aqui
    // que, sem o toque, a `.adm-editor-ajuda` seria acusada de morta — não é
    // verdade desde que o `EditorFaixas` mostra a mesma classe no horário
    // AUSENTE (a ficha sem horário a tem em repouso); corrigido na 11d.
    fireEvent.click(within(screen.getAllByTestId("editor-waypoints")[0]).getByRole("button"));
    // 🔴 E O HORÁRIO COM DUAS FAIXAS (Tarefa 11d). Nenhuma ficha do acervo tem
    // intervalo, e o "tirar esta faixa" só existe com duas ou mais: sem este
    // toque no "+ outra faixa", a regra `.adm-editor-tirar-faixa` seria acusada
    // de morta estando viva no primeiro almoço que ele cadastrar.
    const maisFaixa = container.querySelectorAll<HTMLButtonElement>("[data-mais-faixa]");
    expect(maisFaixa.length, "nenhum '+ outra faixa' na tela: o toque abaixo não aconteceria").toBeGreaterThan(0);
    // ⚠️ E É ESTE MESMO TOQUE que põe o "Desfazer" (`.adm-editor-desfazer`,
    // Tarefa 15) na medição: a faixa a mais deixa o horário diferente do salvo.
    // Sem mudança nenhuma ele não existe, e a regra dele pareceria morta.
    for (const b of maisFaixa) fireEvent.click(b);
    const classes = [...new Set([...container.querySelectorAll("[class]")].flatMap((e) => [...e.classList]))];
    expect(classes.length, "nenhuma classe foi lida: o teste ficaria oco").toBeGreaterThan(0);
    for (const c of classes) {
      expect(regraDe(css, `.${c}`), `\`.${c}\` está na tela e não tem regra no admin.css`).not.toBeNull();
    }

    // 🔴 E A OUTRA DIREÇÃO, que a primeira versão deixou aberta (medido por um
    // re-revisor: uma regra `.adm-campo-fantasma` acrescentada ao arquivo
    // passava verde). Uma classe renomeada deixa a regra MORTA para sempre, e
    // regra morta no `admin.css` é a mesma espécie do defeito que este bloco
    // existe pra impedir, de cabeça pra baixo.
    const daTela = new Set(classes.map((c) => `.adm-campo`).concat(classes.map((c) => `.${c}`)));
    // 🔴 `.adm-editor*` ENTROU NO ENUMERADOR NA TASK 6. Sem isso, uma regra
    // `.adm-editor-fantasma` acrescentada à folha ficaria morta pra sempre com a
    // suíte verde — o mesmo furo que um re-revisor mediu na Task 5, só num
    // prefixo novo. Quem decide o alcance do guarda é o ENUMERADOR, não a lista
    // de classes que a tela usa hoje.
    const regrasDoPrefixo = [
      ...css.matchAll(
        /(\.adm-campo[a-z-]*|\.adm-grupo[a-z-]*|\.adm-editor[a-z-]*|\.adm-ficha-inteira)\s*(?:,|\{)/g,
      ),
    ].map((m) => m[1]);
    expect(regrasDoPrefixo.length, "nenhuma regra desta tela foi lida: o guarda ficaria oco").toBeGreaterThan(5);
    expect(
      regrasDoPrefixo.filter((r) => r.startsWith(".adm-editor")).length,
      "nenhuma regra de editor foi lida: metade do guarda ficaria oca",
    ).toBeGreaterThan(5);
    for (const regra of new Set(regrasDoPrefixo)) {
      expect(daTela.has(regra), `\`${regra}\` tem regra no admin.css e classe nenhuma da tela a usa`).toBe(true);
    }
  });

  // 🔴 A 44ª espécie aplicada aos RÓTULOS: sem isto, campo novo no registro
  // nasce na tela chamado pelo CAMINHO CRU (`condicao.regra.limiar_mm` na cara
  // do dono), com a suíte verde. As duas direções, porque rótulo sobrando é
  // rótulo de campo que morreu.
  //
  // Os dois mapas são medidos separados porque são chaveados diferente: o
  // molde do registro (`[]`) não entra em `ROTULOS` — as folhas de um ponto
  // são chaveadas pela folha em `ROTULO_DO_PONTO` (ver a justificativa no
  // componente). Aqui a partição sai do próprio registro, nunca de uma lista
  // escrita à mão.
  it("todo campo do registro tem rótulo, e não há rótulo sobrando", () => {
    const moldes = CAMPOS_DA_FICHA.filter((c) => c.caminho.includes("[]"));
    const fixos = CAMPOS_DA_FICHA.filter((c) => !c.caminho.includes("[]"));
    expect(moldes.length, "o registro perdeu os moldes: a partição abaixo ficaria oca").toBe(4);

    expect(Object.keys(ROTULOS).sort()).toEqual(fixos.map((c) => c.caminho).sort());
    expect(Object.keys(ROTULO_DO_PONTO).sort()).toEqual(
      moldes.map((c) => c.caminho.split(".").at(-1)!).sort(),
    );
  });

  // 🔴 E O QUE VALE DE VERDADE É A FUNÇÃO, não os mapas: é `rotuloDe` que a
  // tela chama, e é ela que junta o prefixo da parada. Um caminho concreto que
  // caia no `?? caminho` sai daqui vermelho.
  it("`rotuloDe` devolve rótulo de gente pra TODO caminho concreto das três fichas", () => {
    for (const f of ACERVO) {
      for (const c of camposDaFicha(f)) {
        expect(rotuloDe(c.caminho), `${f.slug}: ${c.caminho} caiu no caminho cru`).not.toBe(c.caminho);
        // A mesma régua do ponto: é ela que pega o `Ponto 1 · <caminho cru>`,
        // que a asserção de cima deixava passar (medido na revisão).
        expect(rotuloDe(c.caminho), `${f.slug}: ${c.caminho} vazou pontuado no rótulo`).not.toMatch(/\w\.\w/);
      }
    }
    // e o prefixo da parada de fato distingue duas paradas
    expect(rotuloDe("trajeto.waypoints.1.nome")).not.toBe(rotuloDe("trajeto.waypoints.0.nome"));
  });
});
