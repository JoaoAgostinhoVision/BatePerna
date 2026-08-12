import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import FolhaTrilhas from "@/app/FolhaTrilhas";
import { LeiturasProvider } from "@/app/leituras";
import type { Ficha } from "@/types/ficha";

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);

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
      regra_texto: "",
      ressalva_proxy: "",
    },
    discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
    custo: { tag: "gratis" },
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_S * 1000); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe("FolhaTrilhas", () => {
  it("nenhum cabeçalho pode afirmar o oposto do cartão que está embaixo dele", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    // `pares` chega na ordem que o page.tsx monta: a classificação de quando a
    // página nasceu no servidor — seca fresco, molhada frio.
    const pares = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S } },
    ];
    // O contexto (a leitura de AGORA, publicada depois) inverteu: seca virou
    // frio, molhada virou fresco. É literalmente o defeito do portão: o
    // servidor rotulou de um jeito, o clima mudou, e o cabeçalho tem que
    // acompanhar — não ficar preso ao que o servidor escreveu.
    const invertido = new Map([
      ["seca", { estado: "frio" as const, erro: false, calculadoEm: AGORA_S }],
      ["molhada", { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S }],
    ]);

    const { container } = render(
      <LeiturasProvider value={invertido}>
        <FolhaTrilhas pares={pares} />
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

  it("a leitura vence sozinha, sem nenhuma requisição — e os cabeçalhos somem", () => {
    const seca = fichaFake("seca");
    const pares = [{ ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } }];

    const { container } = render(<FolhaTrilhas pares={pares} />);
    expect(container.querySelector(".grupo-k")?.textContent).toBe("Hoje o tempo deixa");

    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });

    expect(container.querySelector(".grupo-k")).toBeNull();
    expect(container.querySelector(".selo")?.textContent).toContain("SEM INFORMAÇÕES");
  });

  it("clima fora do ar — erro em todas — e nenhuma frase de veredito aparece", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    const pares = [
      { ficha: seca, leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S } },
    ];

    const { container } = render(<FolhaTrilhas pares={pares} />);

    expect(container.querySelectorAll(".grupo-k")).toHaveLength(0);
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
    expect(container.textContent).not.toContain("Hoje não");
    expect(container.textContent).not.toContain("Não suba");
    expect(container.textContent).not.toContain("Pode subir");
  });

  it("todas com leitura confiável — os dois cabeçalhos aparecem, na ordem certa", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    const pares = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S } },
    ];

    const { container } = render(<FolhaTrilhas pares={pares} />);

    const cabecalhos = Array.from(container.querySelectorAll(".grupo-k")).map((el) => el.textContent);
    expect(cabecalhos).toEqual(["Hoje o tempo deixa", "Hoje não"]);
  });

  it("o primeiro quadro mostra cabeçalho — igual ao HTML do servidor mostraria — mesmo com a leitura já vencida no relógio", () => {
    // Mesma técnica de tests/app/home.test.tsx ("useVenceu devolve false no
    // primeiro quadro"): o Profiler entrega o COMMIT antes dos efeitos
    // passivos, que é o único jeito honesto de ver o que o HTML do servidor
    // (e o primeiro paint do cliente) mostrariam. `render()` sozinho já drena
    // o efeito — perguntar ao DOM depois dele já responde com o valor
    // corrigido, escondendo justamente o quadro que este teste precisa provar.
    const seca = fichaFake("seca");
    const pares = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S - 40 * 60 } },
    ];
    const quadros: string[] = [];
    const registrar = () => {
      quadros.push(document.querySelector(".grupo-k")?.textContent ?? "sem cabeçalho");
    };

    render(
      <Profiler id="folha" onRender={registrar}>
        <FolhaTrilhas pares={pares} />
      </Profiler>,
    );

    expect(quadros[0]).toBe("Hoje o tempo deixa"); // primeiro commit: useAlgumVenceu ainda não rodou
    // depois do efeito, o mesmo DOM já sabe que a leitura venceu
    expect(document.querySelector(".grupo-k")).toBeNull();
  });
});
