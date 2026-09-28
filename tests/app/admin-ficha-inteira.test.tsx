import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
 *  30 = as 26 entradas do registro que não são molde + as 4 folhas do único
 *  waypoint desta ficha (`nome`, `lat`, `lng`, `nota`). O registro tem 30
 *  entradas, das quais 4 são molde — então uma ficha de 1 waypoint dá
 *  26 + 4 = 30 blocos, e uma de 2 waypoints daria 34. */
const BLOCOS_DE_UM_WAYPOINT = 30;

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
    // 26 fixos + 3 × 4 folhas de waypoint.
    expect(testidsDe(container, "campo-")).toHaveLength(26 + 12);
  });

  // 🔴 Sem isto, um componente que renderiza uma caixa vazia passa no teste de
  // cima e não mostra NADA. Um caso por espécie do registro, e cada asserção
  // é `within(o bloco daquele campo)` — "está em algum lugar da tela" é a
  // espécie que o catálogo pegou em 25/09.
  it("o VALOR de cada campo preenchido aparece DENTRO do bloco dele", () => {
    render(<FichaInteira ficha={semHorario} />);
    const dentro = (caminho: string, texto: string) =>
      expect(
        within(screen.getByTestId(`campo-${caminho}`)).getByText(texto),
        `${caminho} não mostrou o valor dentro do bloco`,
      ).toBeTruthy();

    dentro("voz", semHorario.voz); // prosa
    dentro("acesso", semHorario.acesso); // prosa
    dentro("custo.valor", semHorario.custo.valor!); // prosa opcional PREENCHIDA
    dentro("piso", semHorario.piso!); // lista
    dentro("condicao.severidade", semHorario.condicao.severidade); // lista
    dentro("dias", "sab, dom"); // lista de vários
    dentro("carroComum", "Sim"); // booleano
    dentro("condicao.regra.limiar_mm", String(semHorario.condicao.regra.limiar_mm)); // numero
    dentro("trajeto.waypoints.0.lat", String(semHorario.trajeto.waypoints[0].lat)); // coord metade
    dentro(
      "condicao.coords",
      `${semHorario.condicao.coords.lat}, ${semHorario.condicao.coords.lng}`,
    ); // coord par
    // a espécie `hora` só a ficha que TEM horário pode provar, e está provada
    // no bloco "o bloco `horario`" mais abaixo.
  });

  it("o RÓTULO de cada campo aparece dentro do bloco dele, e não é o caminho cru", () => {
    const { container } = render(<FichaInteira ficha={semHorario} />);
    for (const c of camposDaFicha(semHorario)) {
      const marca = container.querySelector(`[data-testid="campo-${c.caminho}"] [data-rotulo]`);
      expect(marca, `${c.caminho} ficou sem rótulo dentro do bloco dele`).not.toBeNull();
      expect(marca!.textContent, `${c.caminho} mostrou o caminho cru como rótulo`).not.toBe(c.caminho);
      expect(marca!.textContent, `${c.caminho} veio com rótulo vazio`).toBeTruthy();
    }
  });

  it("campo ausente é marcado como ausente, não some nem finge vazio", () => {
    const semPiso: Ficha = { ...semHorario, piso: undefined };
    render(<FichaInteira ficha={semPiso} />);
    const bloco = screen.getByTestId("campo-piso");
    expect(bloco).toBeTruthy();
    expect(bloco.textContent).toMatch(/não sei|não diz/i);
    expect(bloco.hasAttribute("data-ausente")).toBe(true);
  });

  // 🔴 O PAR SIMÉTRICO, e sem ele o caso de cima fica VERDE numa tela que
  // escreve "não sei" em TODOS os blocos — a espécie "guarda que sai com o
  // código certo pelo motivo errado", que mordeu três vezes nesta rodada.
  it("campo preenchido NÃO traz a marca de ausente — e só os três ausentes de verdade a trazem", () => {
    const { container } = render(<FichaInteira ficha={semHorario} />);
    const cheio = screen.getByTestId("campo-voz");
    expect(cheio.hasAttribute("data-ausente"), "campo preenchido veio marcado de ausente").toBe(false);
    expect(cheio.textContent).not.toMatch(/não sei|não diz/i);

    // 🔴 3, cravado e com motivo: nesta ficha faltam exatamente `horario`,
    // `horario.abre` e `horario.fecha` — todo o resto do registro está
    // preenchido (piso, carroComum, dias, secaRapido, custo.valor,
    // custo.curto e a nota do waypoint, que são os opcionais que ela TEM).
    const marcados = [...container.querySelectorAll("[data-ausente]")].map(
      (e) => e.getAttribute("data-testid")!,
    );
    expect(marcados.sort()).toEqual(["campo-horario", "campo-horario.abre", "campo-horario.fecha"]);
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

describe("FichaInteira — o bloco `horario`, que não é caixa de texto", () => {
  // 🔴 `camposDaFicha` devolve TRÊS entradas sobre o mesmo assunto: `horario`
  // (espécie `bloco`), `horario.abre` e `horario.fecha`. O bloco existe pra
  // responder "este lugar TEM horário?" — é ele que carrega o "não sei" do
  // grupo na porta de escrita.
  it("com horário: o bloco diz que sim, e NÃO repete o valor de folha nenhuma", () => {
    render(<FichaInteira ficha={comHorario} />);
    const bloco = screen.getByTestId("campo-horario");
    expect(bloco.textContent).toMatch(/sim/i);
    expect(
      bloco.textContent,
      "o bloco repetiu a hora de abrir — a tela diz a mesma coisa duas vezes",
    ).not.toContain(comHorario.horario!.abre);
    expect(bloco.textContent).not.toContain(comHorario.horario!.fecha);
    // as folhas continuam mostrando o valor delas, cada uma no bloco dela
    expect(within(screen.getByTestId("campo-horario.abre")).getByText(comHorario.horario!.abre));
    expect(within(screen.getByTestId("campo-horario.fecha")).getByText(comHorario.horario!.fecha));
  });

  // 🔴 A função itera o REGISTRO, não o documento: bloco ausente não faz as
  // folhas dele sumirem da lista. Então elas têm que aparecer MARCADAS, nunca
  // desaparecer — o dono que abriu a tela pra preencher a hora precisa ver
  // onde ela entra.
  it("sem horário: os TRÊS blocos aparecem, e os três dizem ausente", () => {
    expect(semHorario.horario, "esta ficha ganhou horário — o caso deixou de ser medido").toBeUndefined();
    render(<FichaInteira ficha={semHorario} />);
    for (const caminho of ["horario", "horario.abre", "horario.fecha"]) {
      const bloco = screen.getByTestId(`campo-${caminho}`);
      expect(bloco, `${caminho} sumiu da tela`).toBeTruthy();
      expect(bloco.hasAttribute("data-ausente"), `${caminho} não veio marcado`).toBe(true);
      expect(bloco.textContent, caminho).toMatch(/não sei|não diz/i);
    }
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
    const proibidas = [
      ...new Set(ACERVO.flatMap((f) => f.slug.split("-")).filter((p) => p.length > 3)),
    ].map(semAcento);
    expect(proibidas.length, "nenhum radical de slug: o cerco ficaria oco").toBeGreaterThan(2);

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
      for (const palavra of proibidas) {
        expect(
          semAcento(frase).includes(palavra),
          `a frase fixa "${frase}" fala de um lugar (${palavra}) num componente que serve os três`,
        ).toBe(false);
      }
    }
  });

});

describe("FichaInteira — os guardas do que cresce: rótulo e CSS", () => {
  // 🔴 O DEFEITO I6 DA REVISÃO FINAL DE 26/09, que este arquivo não vai
  // repetir: `EditorDeVoz` e `HistoricoDaVoz` nasceram SEM UMA REGRA sequer no
  // `admin.css` e a suíte inteira ficou verde — o `<textarea>` caía no default
  // do navegador na mão do dono. Classe que a tela usa e a folha não conhece
  // não é detalhe de estilo, é elemento sem forma nenhuma.
  it("toda classe que esta tela usa tem regra no `admin.css`", () => {
    const css = semComentarios("admin/admin.css");
    const { container } = render(<FichaInteira ficha={semHorario} />);
    const classes = [...new Set([...container.querySelectorAll("[class]")].flatMap((e) => [...e.classList]))];
    expect(classes.length, "nenhuma classe foi lida: o teste ficaria oco").toBeGreaterThan(0);
    for (const c of classes) {
      expect(regraDe(css, `.${c}`), `\`.${c}\` está na tela e não tem regra no admin.css`).not.toBeNull();
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
      }
    }
    // e o prefixo da parada de fato distingue duas paradas
    expect(rotuloDe("trajeto.waypoints.1.nome")).not.toBe(rotuloDe("trajeto.waypoints.0.nome"));
  });
});
