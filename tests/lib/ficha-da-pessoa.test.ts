import { describe, expect, it } from "vitest";
import { fichaSchema, type Ficha } from "@/types/ficha";
import { obrigatoriosFaltando } from "@/lib/porta-de-publicar";
import { violacoesDoAcervo } from "@/lib/coerencia";
import { loadAll } from "@/lib/ficha";

/** O documento como a pessoa o deixa: só as perguntas obrigatórias dela. */
const daPessoa = (nome: string): Ficha =>
  fichaSchema.parse({
    slug: `${nome.toLowerCase().replace(/ /g, "-")}-cidade-teste`,
    modos: [],
    cidade: "Cidade Teste",
    promessa: `O que é ${nome}.`,
    trajeto: { waypoints: [{ nome, lat: -8.31, lng: -35.97 }] },
    acesso: `Como se chega a ${nome}.`,
    condicao: { coords: { lat: -8.31, lng: -35.97 } },
    custo: { tag: "gratis" },
  });

/** Os caminhos que viram opcionais no SCHEMA nesta rodada. Fonte: a spec de
 *  07/10, Parte 1, "O que NÃO se pergunta" — mais `avisos`, que é a pergunta
 *  opcional 6 dela. */
const OPCIONAIS_NO_SCHEMA = [
  "rotulo_escaneio", "voz", "premio", "avisos",
  "condicao.regra", "condicao.severidade", "condicao.regra_texto", "condicao.ressalva_proxy",
  "discriminador", "discriminador.formato", "discriminador.como_ler", "discriminador.permissao_abortar",
] as const;

function semCaminho(f: Ficha, caminho: string): unknown {
  const copia = structuredClone(f) as unknown as Record<string, Record<string, unknown>>;
  const [a, b] = caminho.split(".");
  if (b === undefined) delete (copia as Record<string, unknown>)[a];
  else delete copia[a][b];
  return copia;
}

describe("o documento de quem usa o app", () => {
  it("abre no fichaSchema com só as perguntas dela", () => {
    expect(() => daPessoa("Pedra Mandada")).not.toThrow();
  });

  it.each(OPCIONAIS_NO_SCHEMA)("`%s` é opcional no schema (uma ficha do João sem ele abre)", (caminho) => {
    const rampa = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
    expect(fichaSchema.safeParse(semCaminho(rampa, caminho)).success).toBe(true);
  });

  it("a regra entra INTEIRA ou não entra — meia regra é recusada", () => {
    const rampa = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
    const meia = structuredClone(rampa) as unknown as { condicao: { regra: Record<string, unknown> } };
    delete meia.condicao.regra.limiar_mm;
    expect(fichaSchema.safeParse(meia).success).toBe(false);
  });

  // 🔴 A porta de publicar do JOÃO não afrouxa: cada campo que o schema soltou
  // continua faltando pra ela.
  it("a porta do JOÃO continua exigindo cada campo que o schema soltou", () => {
    const faltam = obrigatoriosFaltando(daPessoa("Pedra Mandada"));
    for (const c of [
      "rotulo_escaneio", "voz", "premio", "avisos",
      "condicao.regra.janela_previsao_horas", "condicao.regra.janela_passado_horas", "condicao.regra.limiar_mm",
      "condicao.severidade", "condicao.regra_texto", "condicao.ressalva_proxy",
      "discriminador.formato", "discriminador.como_ler", "discriminador.permissao_abortar",
    ]) {
      expect(faltam, c).toContain(c);
    }
  });
});

describe("a coerência diante do que a pessoa não respondeu", () => {
  // 🔴 Sem a guarda, `String(undefined)` dá "undefined" nas duas fichas e a
  // regra acusa "têm a voz exatamente igual" entre dois lugares SEM voz.
  it("duas fichas sem voz, prêmio e etiqueta não 'emprestam' texto uma da outra", () => {
    const v = violacoesDoAcervo([daPessoa("Pedra Um"), daPessoa("Pedra Dois")]);
    expect(v.filter((x) => x.regra === "texto-emprestado")).toEqual([]);
  });

  it("ficha sem regra e sem checagem não derruba nenhuma regra, nem acusa as de chuva", () => {
    let v: ReturnType<typeof violacoesDoAcervo> = [];
    expect(() => { v = violacoesDoAcervo([daPessoa("Pedra Um")]); }).not.toThrow();
    expect(v.filter((x) => x.regra.startsWith("janela-"))).toEqual([]);
  });

  // A guarda é por AUSÊNCIA, não por "a ficha é da pessoa": duas promessas
  // iguais continuam acusadas.
  it("duas fichas com a MESMA promessa continuam acusadas", () => {
    const a = daPessoa("Pedra Um");
    const b = { ...daPessoa("Pedra Dois"), promessa: a.promessa };
    expect(violacoesDoAcervo([a, b]).map((x) => x.regra)).toContain("texto-emprestado");
  });
});
