import { describe, expect, it } from "vitest";
import {
  JANELA_ALEM_DO_PASSADO, JANELA_ALEM_DA_PREVISAO, JANELA_NEGATIVA_PADRAO, JANELAS_ZERADAS, LIMIAR_SEM_CHUVA, lerRegraDoCorpo,
} from "@/lib/porta-da-regra-padrao";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";

const BOA = { janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2, severidade: "cuidado" };

describe("lerRegraDoCorpo", () => {
  it("a regra boa passa, igual", () => {
    expect(lerRegraDoCorpo(BOA)).toEqual({ regra: BOA });
  });

  it.each([
    ["não é objeto", "x"],
    ["lista", [BOA]],
    ["chave a mais", { ...BOA, tipo: "chuva_binaria" }],
    ["chave a menos", { janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2 }],
    ["número em texto", { ...BOA, limiar_mm: "0.2" }],
    ["infinito", { ...BOA, janela_passado_horas: Infinity }],
    ["NaN", { ...BOA, limiar_mm: Number.NaN }],
    ["severidade que não existe", { ...BOA, severidade: "talvez" }],
  ])("%s: torto, sem frase", (_nome, corpo) => {
    expect(lerRegraDoCorpo(corpo)).toBeNull();
  });

  // Decisões dele de 01/10: CADA janela pode ser zero sozinha.
  it("previsão 0 sozinha passa; passado 0 sozinho passa", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: 0 })).toEqual({ regra: { ...BOA, janela_previsao_horas: 0 } });
    expect(lerRegraDoCorpo({ ...BOA, janela_passado_horas: 0 })).toEqual({ regra: { ...BOA, janela_passado_horas: 0 } });
  });

  // Review Focus 5.
  it("zera as duas janelas: recusada com a frase", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: 0, janela_passado_horas: 0 })).toEqual({ frase: JANELAS_ZERADAS });
  });

  it("janela negativa: recusada com a frase, em cada uma das duas", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: -1 })).toEqual({ frase: JANELA_NEGATIVA_PADRAO });
    expect(lerRegraDoCorpo({ ...BOA, janela_passado_horas: -1 })).toEqual({ frase: JANELA_NEGATIVA_PADRAO });
  });

  it("limiar 0 ou negativo: recusado com a frase", () => {
    expect(lerRegraDoCorpo({ ...BOA, limiar_mm: 0 })).toEqual({ frase: LIMIAR_SEM_CHUVA });
    expect(lerRegraDoCorpo({ ...BOA, limiar_mm: -0.1 })).toEqual({ frase: LIMIAR_SEM_CHUVA });
  });

  it("além do provedor: recusada, e o teto exato passa", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: TETO_PREVISAO_HORAS + 1 })).toEqual({ frase: JANELA_ALEM_DA_PREVISAO });
    expect(lerRegraDoCorpo({ ...BOA, janela_passado_horas: TETO_PASSADO_HORAS + 1 })).toEqual({ frase: JANELA_ALEM_DO_PASSADO });
    expect("regra" in lerRegraDoCorpo({ ...BOA, janela_previsao_horas: TETO_PREVISAO_HORAS })!).toBe(true);
  });
});
