import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gravarVersao } from "@/lib/db";
import { getFicha } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(async () => ({ estado: "fresco", erro: false, calculadoEm: 1_800_000_000, aviso: null })),
}));

const banco = await bancoDeProducao();
const Pagina = (await import("@/app/[slug]/page")).default;
const Trilhas = (await import("@/app/trilhas/page")).default;
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
});
afterEach(() => cleanup());

const abrir = async (slug: string) =>
  render(await Pagina({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));

/** A Rampa com UM campo a menos, gravada como versão nova pelo banco de
 *  verdade. Cada caso tira um só — o bloco daquele campo cala, o resto fica.
 *
 *  ⚠️ `gravarVersao` direto, e NÃO o `gravarEdicao` de `tests/banco.ts`: aquele
 *  faz `{ ...ficha, ...mudanca }`, e espalhar não APAGA chave — o campo
 *  "tirado" voltaria da ficha original e o teste mediria a página inteira. */
async function rampaSem(tirar: (f: Ficha) => void): Promise<void> {
  const rampa = (await getFicha("rampa-do-pepe"))!;
  const { origem: _origem, ...doc } = structuredClone(rampa);
  tirar(doc as unknown as Ficha);
  await gravarVersao(banco, "rampa-do-pepe", JSON.stringify(doc), "painel", 1_759_000_000);
}

// Cada linha: o campo, como tirá-lo, e o seletor do bloco que tem de sumir.
const CASOS: [string, (f: Ficha) => void, string][] = [
  ["rotulo_escaneio", (f) => { delete f.rotulo_escaneio; }, ".hero .scan"],
  ["premio", (f) => { delete f.premio; }, ".sec.premio"],
  ["voz", (f) => { delete f.voz; }, ".voz"],
  ["condicao.ressalva_proxy", (f) => { delete f.condicao.ressalva_proxy; }, ".caveat"],
  ["avisos", (f) => { delete f.avisos; }, '[data-bloco="avisos"]'],
  ["discriminador", (f) => { delete f.discriminador; }, ".gate"],
];

describe("a ficha cala o bloco do campo que falta — um por campo", () => {
  it.each(CASOS)("sem `%s`, o bloco some", async (_campo, tirar, seletor) => {
    const { container: antes } = await abrir("rampa-do-pepe");
    expect(antes.querySelector(seletor), "a premissa: com o campo, o bloco existe").not.toBeNull();
    cleanup();
    await rampaSem(tirar);
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(seletor)).toBeNull();
  });

  it("sem `discriminador`, nenhum par de aspas vazio sobra na tela", async () => {
    await rampaSem((f) => { delete f.discriminador; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.textContent).not.toContain("“”");
  });

  it("checagem com SÓ o que olhar: o bloco fica, sem a frase de desistir", async () => {
    await rampaSem((f) => { delete f.discriminador!.permissao_abortar; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".gate .read")).not.toBeNull();
    expect(container.querySelector(".gate .perm")).toBeNull();
  });

  it("checagem com SÓ a frase de desistir: o bloco fica, sem o que olhar", async () => {
    await rampaSem((f) => { delete f.discriminador!.como_ler; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".gate .perm")).not.toBeNull();
    expect(container.querySelector(".gate .read")).toBeNull();
  });

  it("checagem com SÓ o formato (nada pra ler nem pra desistir): o bloco some", async () => {
    await rampaSem((f) => { f.discriminador = { formato: "entrada" }; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".gate")).toBeNull();
  });
});

describe("o lugar da pessoa, que não tem nenhum deles", () => {
  it("nenhum dos seis blocos aparece, e nenhum título deles sobra", async () => {
    const { container } = await abrir(SLUG);
    for (const [, , seletor] of CASOS) expect(container.querySelector(seletor), seletor).toBeNull();
    const texto = container.textContent ?? "";
    for (const titulo of ["O prêmio", "a voz de quem conhece", "⚠ Avisos", "a checagem é sua", "A checagem é sua"]) {
      expect(texto, titulo).not.toContain(titulo);
    }
  });

  // 🔴 "Nunca preenche com texto genérico": o que a pessoa ESCREVEU aparece, e
  // nada no lugar do que ela não escreveu.
  it("o que ela respondeu aparece: promessa e acesso", async () => {
    const { container } = await abrir(SLUG);
    expect(container.textContent).toContain("O que é Pedra Mandada, na palavra de quem mandou.");
    expect(container.textContent).toContain("Como se chega a Pedra Mandada, na palavra de quem mandou.");
  });

  it("na lista do acervo, sem etiqueta de escaneio", async () => {
    const { container } = render(await Trilhas());
    const item = container.querySelector(`a[href="/${SLUG}"]`);
    expect(item, "a premissa: o lugar dela está na lista").not.toBeNull();
    expect(item!.querySelector(".scan")).toBeNull();
  });
});
