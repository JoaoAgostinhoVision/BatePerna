import { describe, expect, it } from "vitest";
import { aplicarAviso, fechadoPeloDono, type Aviso } from "@/lib/aviso";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

const AGORA = 1_757_000_000;
const chuvosa: LeituraCarimbo = { estado: "frio", erro: false, calculadoEm: AGORA, aviso: null };
const seca: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: AGORA, aviso: null };
const av = (efeito: Aviso["efeito"], texto = "t"): Aviso => ({
  texto, efeito, criadoEm: AGORA, venceEm: AGORA + 3600,
});

describe("aplicarAviso", () => {
  it("sem aviso, a leitura passa intacta", () => {
    expect(aplicarAviso(chuvosa, null)).toEqual(chuvosa);
  });

  // 🔴 O DONO GANHA DO MOTOR. Ele sabe mais que a chuva — foi pra isso que o
  // campo existe. O motor dizendo "frio" e ele dizendo "secou" resolve nele.
  it("efeito fresco ganha de um motor que disse frio", () => {
    expect(aplicarAviso(chuvosa, av("fresco")).estado).toBe("fresco");
  });

  it("efeito frio ganha de um motor que disse fresco", () => {
    expect(aplicarAviso(seca, av("frio")).estado).toBe("frio");
  });

  // 🔴 `nenhum` é o caso do recado PURO: "a ponte caiu, tem desvio pela
  // direita" — vá, mas saiba disso. Mexer no estado aqui faria o app atribuir
  // ao aviso um veredito que o dono não deu.
  it("efeito nenhum NAO mexe no estado — só acrescenta o recado", () => {
    const r = aplicarAviso(chuvosa, av("nenhum", "ponte caiu"));
    expect(r.estado).toBe("frio");
    expect(r.aviso?.texto).toBe("ponte caiu");
  });

  // 🔴 `fechado` NAO e estado: o motor so responde fresco|frio. "Em reforma"
  // nao pode virar "frio", senao o app diz NAO VA com as palavras da CHUVA —
  // atribuindo ao tempo uma coisa que e obra. Quem le o fechado e a fase.
  it("efeito fechado nao vira estado de chuva", () => {
    const r = aplicarAviso(seca, av("fechado", "em reforma"));
    expect(r.estado).toBe("fresco");
    expect(fechadoPeloDono(r.aviso)).toBe(true);
  });

  it("o aviso viaja junto na leitura, sempre", () => {
    expect(aplicarAviso(seca, av("frio", "molhou")).aviso?.texto).toBe("molhou");
  });

  it("o erro da leitura nunca é mascarado pelo aviso", () => {
    const semLeitura: LeituraCarimbo = { estado: "frio", erro: true, calculadoEm: AGORA, aviso: null };
    expect(aplicarAviso(semLeitura, av("fresco")).erro).toBe(true);
  });
});

describe("fechadoPeloDono", () => {
  it("só o efeito fechado fecha", () => {
    expect(fechadoPeloDono(null)).toBe(false);
    expect(fechadoPeloDono(av("nenhum"))).toBe(false);
    expect(fechadoPeloDono(av("frio"))).toBe(false);
    expect(fechadoPeloDono(av("fresco"))).toBe(false);
    expect(fechadoPeloDono(av("fechado"))).toBe(true);
  });
});
