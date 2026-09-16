import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import FolhaTrilhas from "@/app/FolhaTrilhas";
import { agoraRecife } from "@/lib/horario";
import { LeiturasProvider } from "@/app/leituras";
import type { Ficha } from "@/types/ficha";

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);

/** 🔴 O RELÓGIO CHEGA POR PROP DESDE 2026-09-12, e este helper o deriva do
 *  MESMO `Date.now()` falso que cada teste crava. Antes a folha chamava
 *  `useAgoraRecife` por dentro; o hook subiu pro `MioloHome` porque a home
 *  tinha DOIS relógios (aqui e no mapa) decidindo a mesma tela — e o recorte
 *  "dá hoje" passou a depender do fechamento. Derivar aqui, em vez de cravar
 *  um número, é o que mantém estes testes falando do instante que eles mesmos
 *  escolheram. */
const relogio = () => agoraRecife(Math.floor(Date.now() / 1000));

// Mesmo padrão sintético de tests/app/home.test.tsx (fichaFake): só os campos
// que a folha (e o cartão, por baixo) leem. Não depende do conteúdo real do
// projeto — hoje tem uma ficha só, e não dá pra provar dois grupos com uma.
function fichaFake(slug: string): Ficha {
  return {
    slug,
    modos: [],
    rotulo_escaneio: "",
    promessa: `promessa de ${slug}`,
    voz: "",
    premio: "",
    trajeto: { waypoints: [{ nome: slug, lat: 0, lng: 0 }] },
    acesso: "",
    avisos: "",
    condicao: {
      coords: { lat: 0, lng: 0 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 0, janela_passado_horas: 0, limiar_mm: 0 },

      severidade: "nao-va",
      regra_texto: "",
      ressalva_proxy: "",
    },
    discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
    custo: { tag: "gratis" },
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_S * 1000); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

// ——————— o que sobrou aqui, e o que mudou de arquivo ———————
//
// A conta subiu pro `MioloHome`: `confia` e `visiveis` não nascem mais nesta
// folha, chegam por prop. O que ficou neste arquivo é o que a folha ainda
// DECIDE — agrupar ou não, e o que cada cabeçalho afirma sobre o que está
// embaixo dele.
//
// Mudaram pra tests/app/MioloHome.test.tsx, porque lá é o ponto de uso das
// linhas que os fazem falhar: o bloco inteiro de "filtro e agrupamento
// juntos" (quem recorta é o miolo) e os testes de onde `confia` sai
// (`useAlgumVenceu` e `algumErro` também subiram). Deixá-los aqui, montando só
// a folha, seria testar uma prop que o teste mesmo escreve.
describe("FolhaTrilhas", () => {
  it("nenhum cabeçalho pode afirmar o oposto do cartão que está embaixo dele", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    // `visiveis` chega na ordem que o `MioloHome` entrega, que é a que o
    // `page.tsx` montou: a classificação de quando a página nasceu no servidor
    // — seca fresco, molhada frio.
    const visiveis = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S, aviso: null } },
    ];
    // O contexto (a leitura de AGORA, publicada depois) inverteu: seca virou
    // frio, molhada virou fresco. É literalmente o defeito do portão: o
    // servidor rotulou de um jeito, o clima mudou, e o cabeçalho tem que
    // acompanhar — não ficar preso ao que o servidor escreveu.
    const invertido = new Map([
      ["seca", { estado: "frio" as const, erro: false, calculadoEm: AGORA_S, aviso: null }],
      ["molhada", { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null }],
    ]);

    const { container } = render(
      <LeiturasProvider value={invertido}>
        <FolhaTrilhas visiveis={visiveis} confia={true} agora={relogio()} />
      </LeiturasProvider>,
    );

    for (const cabecalho of Array.from(container.querySelectorAll(".grupo-k"))) {
      const esperado = cabecalho.textContent === "Hoje o tempo deixa" ? "fresco" : "frio";
      const grupo = cabecalho.nextElementSibling;
      for (const cartao of Array.from(grupo?.querySelectorAll(".cartao") ?? [])) {
        expect(cartao.getAttribute("data-state")).toBe(esperado);
      }
    }
    // E a inversão realmente aconteceu — não é "nada contradiz nada" só porque
    // nada mudou de lugar.
    expect(container.querySelector("#seca")?.getAttribute("data-state")).toBe("frio");
    expect(container.querySelector("#molhada")?.getAttribute("data-state")).toBe("fresco");
  });

  // 🔴 O DEFEITO QUE ESTE TESTE TRANCA (2026-08-27). "Hoje o tempo deixa" é uma
  // AFIRMAÇÃO sobre os cartões embaixo dele. Uma trilha que fecha às 17h, lida
  // às 18h com o tempo BOM, continuaria caindo ali — o grupo convidando pra uma
  // coisa que não dá, e o selo logo abaixo dizendo "Fechado agora". É a mesma
  // régua do cabeçalho que some quando o filtro esvazia o grupo.
  it("trilha fechada sai do grupo 'Hoje o tempo deixa', mesmo com o tempo bom", () => {
    vi.setSystemTime(Date.UTC(2027, 0, 15, 21, 0)); // 18h em Recife
    const AGORA_18 = Math.floor(Date.UTC(2027, 0, 15, 21, 0) / 1000);
    const fechada = { ...fichaFake("fechada"), horario: { abre: "05:00", fecha: "17:00" } };
    const aberta = fichaFake("aberta"); // sem horário: nunca fecha
    const visiveis = [
      { ficha: fechada, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_18, aviso: null } },
      { ficha: aberta, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_18, aviso: null } },
    ];

    const { container } = render(<FolhaTrilhas visiveis={visiveis} confia={true} agora={relogio()} />);

    const cabecalhos = Array.from(container.querySelectorAll(".grupo-k")).map((c) => c.textContent);
    expect(cabecalhos).toEqual(["Hoje o tempo deixa", "Hoje não"]);

    // O par que importa: as DUAS estão frescas, e mesmo assim se separaram. Sem
    // a `aberta`, "tudo caiu em Hoje não" passaria por qualquer motivo.
    const doGrupo = (titulo: string) =>
      Array.from(
        Array.from(container.querySelectorAll(".grupo-k"))
          .find((c) => c.textContent === titulo)!
          .nextElementSibling!.querySelectorAll(".cartao"),
      ).map((a) => a.getAttribute("id"));

    expect(doGrupo("Hoje o tempo deixa")).toEqual(["aberta"]);
    expect(doGrupo("Hoje não")).toEqual(["fechada"]);

    // E o cartão diz a mesma coisa que o grupo — é o ponto do arquivo inteiro.
    expect(container.querySelector("#fechada .selo .w")?.textContent).toBe("Fechado agora");
    expect(container.querySelector("#fechada .selo .s")?.textContent).toBe("abre amanhã às 5h");
    expect(container.querySelector("#aberta .selo .w")?.textContent).toBe("Pode ir");
  });

  // O ramo LISO. Quem decide que não dá pra confiar é o `MioloHome` (clima
  // fora do ar, leitura vencida); o que esta folha faz com a resposta é isto:
  // nenhum cabeçalho, e nenhuma frase de veredito, porque `Não vá` é só pro
  // barro MEDIDO.
  it("sem poder confiar na leitura, a folha vira lista lisa — e nenhuma frase de veredito aparece", () => {
    const visiveis = [
      { ficha: fichaFake("seca"), leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S, aviso: null } },
      { ficha: fichaFake("molhada"), leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S, aviso: null } },
    ];

    const { container } = render(<FolhaTrilhas visiveis={visiveis} confia={false} agora={relogio()} />);

    expect(container.querySelectorAll(".grupo-k")).toHaveLength(0);
    expect(container.querySelectorAll(".cartao")).toHaveLength(2);
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
    expect(container.textContent).not.toContain("Hoje não");
    expect(container.textContent).not.toContain("Não vá");
    expect(container.textContent).not.toContain("Pode ir");
  });

  it("todas com leitura confiável — os dois cabeçalhos aparecem, na ordem certa", () => {
    const visiveis = [
      { ficha: fichaFake("seca"), leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null } },
      { ficha: fichaFake("molhada"), leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S, aviso: null } },
    ];

    const { container } = render(<FolhaTrilhas visiveis={visiveis} confia={true} agora={relogio()} />);

    const cabecalhos = Array.from(container.querySelectorAll(".grupo-k")).map((el) => el.textContent);
    expect(cabecalhos).toEqual(["Hoje o tempo deixa", "Hoje não"]);
  });

  // A folha não é mais quem recorta, mas continua sendo quem AVISA. O estado
  // vazio é dela, e ele é o que a §7.4 da spec exige: nunca folha em branco.
  it("lista vazia vira o aviso e o jeito de limpar, não uma folha em branco", () => {
    const { container } = render(<FolhaTrilhas visiveis={[]} confia={true} agora={relogio()} />);
    expect(container.textContent).toContain("Nenhuma trilha com esses filtros");
    expect(container.querySelector(".folha-vazia button")?.textContent).toContain("limpar");
    expect(container.querySelectorAll(".cartoes")).toHaveLength(0);
  });
});

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-09-10). Com a severidade valendo,
// o carimbo da Véu de Noiva passou a dizer "Vá com cuidado" em âmbar — e ela
// continuava caindo sob o cabeçalho "Hoje não". É a MESMA família do selo verde
// dizendo "Não vá": um elemento da tela afirmando o contrário do vizinho. A
// diferença é que este nasceria do mesmo commit, de propósito, e nenhum teste
// deste arquivo piscou quando o agrupamento mudou de dois grupos pra três.
describe("o agrupamento pergunta o TOM, não o estado", () => {
  const titulos = (c: HTMLElement) =>
    Array.from(c.querySelectorAll(".grupo-k")).map((k) => k.textContent);

  const doGrupo = (c: HTMLElement, titulo: string) =>
    Array.from(
      Array.from(c.querySelectorAll(".grupo-k"))
        .find((k) => k.textContent === titulo)!
        .nextElementSibling!.querySelectorAll(".cartao"),
    ).map((a) => a.getAttribute("id"));

  const molhada = (slug: string, severidade: Ficha["condicao"]["severidade"]) => {
    const f = fichaFake(slug);
    return {
      ficha: { ...f, condicao: { ...f.condicao, severidade } },
      leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S, aviso: null },
    };
  };

  // MUTAÇÃO: voltar o filtro pra `atual(p).estado === "fresco"` / `!podem`. As
  // três molhadas caem juntas em "Hoje não" e o grupo do meio some.
  it("molhada de nível `cuidado` NÃO cai sob 'Hoje não' — vai pro grupo do meio", () => {
    const visiveis = [
      { ...molhada("cuidadosa", "cuidado") },
      { ...molhada("proibida", "nao-va") },
      { ficha: fichaFake("seca"), leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null } },
    ];

    const { container } = render(<FolhaTrilhas visiveis={visiveis} confia={true} agora={relogio()} />);

    // Os três cabeçalhos, NESTA ordem: o que dá, o que dá com ressalva, o que
    // não dá. A ordem é a leitura de cima pra baixo e faz parte do que se prova.
    expect(titulos(container)).toHaveLength(3);
    expect(titulos(container)[0]).toBe("Hoje o tempo deixa");
    expect(titulos(container)[2]).toBe("Hoje não");

    expect(doGrupo(container, "Hoje o tempo deixa")).toEqual(["seca"]);
    expect(doGrupo(container, "Hoje não")).toEqual(["proibida"]);
    // O do meio é o único que resta, e tem que ter a cuidadosa sozinha.
    const meio = titulos(container)[1]!;
    // 🔴 A guarda de vacuidade, e ela não é formalidade: com o título vazio o
    // `.grupo-k` ainda renderiza (uma faixa em branco sobre os cartões), e as
    // duas desigualdades abaixo passariam — "" não é nenhum dos outros dois.
    // A tela ficaria com um cabeçalho MUDO e a suíte verde.
    expect(meio.trim().length).toBeGreaterThan(0);
    expect(meio).not.toBe("Hoje o tempo deixa");
    expect(meio).not.toBe("Hoje não");
    expect(doGrupo(container, meio)).toEqual(["cuidadosa"]);

    // E o cartão diz a mesma coisa que o grupo — é o ponto do arquivo inteiro.
    expect(container.querySelector("#cuidadosa")?.getAttribute("data-state")).toBe("cuidado");
    expect(container.querySelector("#proibida")?.getAttribute("data-state")).toBe("frio");
  });

  // 🔴 `espera` divide o vermelho com `nao-va` de propósito (ver `tomDe`): a
  // pergunta do grupo é "dá pra ir AGORA?", e "espera 6h" é não-agora. Este
  // teste é o que impede alguém de "consertar" isso por engano.
  it("molhada de nível `espera` cai sob 'Hoje não', junto com a proibida", () => {
    const visiveis = [molhada("espereira", "espera"), molhada("proibida", "nao-va")];
    const { container } = render(<FolhaTrilhas visiveis={visiveis} confia={true} agora={relogio()} />);

    expect(titulos(container)).toEqual(["Hoje não"]);
    expect(doGrupo(container, "Hoje não")).toEqual(["espereira", "proibida"]);
  });

  // FECHADO ganha do nível, pela mesma frase que já o tirava do grupo de cima:
  // com o portão trancado, o que a chuva permite não decide nada.
  it("fechada de nível `cuidado` cai sob 'Hoje não', mesmo com o tempo bom", () => {
    vi.setSystemTime(Date.UTC(2027, 0, 15, 21, 0)); // 18h em Recife
    const AGORA_18 = Math.floor(Date.UTC(2027, 0, 15, 21, 0) / 1000);
    const base = fichaFake("fechada");
    const fechada = {
      ficha: { ...base, condicao: { ...base.condicao, severidade: "cuidado" as const }, horario: { abre: "05:00", fecha: "17:00" } },
      leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_18, aviso: null },
    };
    const aberta = { ...molhada("aberta", "cuidado"), leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_18, aviso: null } };

    const { container } = render(<FolhaTrilhas visiveis={[fechada, aberta]} confia={true} agora={relogio()} />);

    // O par que importa: as duas são `cuidado` e molhadas, e mesmo assim se
    // separaram. Sem a `aberta`, "tudo caiu em Hoje não" passaria por qualquer
    // motivo.
    expect(titulos(container)).toHaveLength(2);
    expect(titulos(container)[1]).toBe("Hoje não");
    expect(doGrupo(container, "Hoje não")).toEqual(["fechada"]);
    expect(doGrupo(container, titulos(container)[0]!)).toEqual(["aberta"]);
  });

  // A régua do cabeçalho que some junto com o grupo vazio vale pro novo também:
  // um título é uma AFIRMAÇÃO sobre o que está embaixo, e sem nada embaixo ele
  // mente. Sem este teste o grupo do meio poderia nascer sempre.
  it("sem nenhuma trilha de nível `cuidado`, o grupo do meio não aparece", () => {
    const visiveis = [
      molhada("proibida", "nao-va"),
      { ficha: fichaFake("seca"), leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null } },
    ];
    const { container } = render(<FolhaTrilhas visiveis={visiveis} confia={true} agora={relogio()} />);
    expect(titulos(container)).toEqual(["Hoje o tempo deixa", "Hoje não"]);
  });
});
