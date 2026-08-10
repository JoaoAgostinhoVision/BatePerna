import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import Carimbo from "@/app/Carimbo";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 42); // 08h42 em Recife
const AGORA_S = AGORA_MS / 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

type Props = { estado: "fresco" | "frio"; erro: boolean; calculadoEm: number; pass: number; fut: number };

function montar(props: Partial<Props> = {}) {
  return render(
    <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} {...props} />,
  );
}

describe("Carimbo", () => {
  it("leitura fresca afirma", () => {
    const { container } = montar();
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("leitura vencida para de afirmar e manda checar no portão", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
    expect(container.textContent).toContain("sem leitura");
  });

  it("vencida, diz de que hora era a leitura", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 }); // 08h02
    expect(container.textContent).toContain("8h02");
  });

  it("vencida, marca o bloco pro CSS pintar de parada mesmo com estado fresco", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".decision")?.getAttribute("data-venceu")).toBe("1");
  });

  it("vence sozinho com o app aberto, sem recarregar", () => {
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });
    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
  });

  it("volta do bolso já vencido, sem esperar o intervalo de 60s", () => {
    // O celular passou 4h no bolso. O relógio andou; o setInterval não — o
    // navegador estrangula timer de aba escondida. Quem reavalia é o instante
    // em que a tela volta a ser olhada, que é o instante do portão.
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
    expect(container.textContent).toContain("sem leitura");
  });

  it("volta do cache do navegador (pageshow) também reavalia", () => {
    // O service worker tornou "página retomada do cache" o caso normal, e
    // restauração de bfcache não dispara visibilitychange em todo navegador.
    const { container } = montar({ calculadoEm: AGORA_S });
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
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
    expect(live).toContain("sem leitura da chuva");
  });

  it("sem leitura, marca o bloco pro CSS parar o pulso", () => {
    const semLeitura = montar({ estado: "frio", erro: true });
    expect(semLeitura.container.querySelector(".decision")?.getAttribute("data-sem-leitura")).toBe("1");
    cleanup();
    const vencida = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(vencida.container.querySelector(".decision")?.getAttribute("data-sem-leitura")).toBe("1");
    cleanup();
    expect(montar().container.querySelector(".decision")?.getAttribute("data-sem-leitura")).toBe(null);
  });

  it("o CSS que para o pulso aponta pro atributo que o componente emite", () => {
    // Metade deste defeito era CSS: a regra existia, mas presa a data-venceu, e
    // o ramo de erro não tem esse atributo. Este par não pode desemparelhar.
    const css = readFileSync(path.join(process.cwd(), "src", "app", "ficha.css"), "utf8");
    expect(css).toMatch(/\[data-sem-leitura="1"\][^{]*\.pulse\s*\{[^}]*animation:\s*none/);
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
});
