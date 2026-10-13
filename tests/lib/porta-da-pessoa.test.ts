import { describe, expect, it } from "vitest";
import { REGRAS } from "@/lib/coerencia";
import {
  ABERTURA_DA_EDICAO, FALTA_DA_PESSOA, FORA_DA_LISTA_DELA, FRASE_DA_PESSOA, RECUSA_DA_PESSOA, fraseDaPessoa, prepararPublicacaoDaPessoa,
} from "@/lib/porta-da-pessoa";
import { FORMA_ERRADA, RASCUNHO_ILEGIVEL, SLUG_DE_DENTRO } from "@/lib/porta-de-publicar";

const SLUG = "pedra-mandada-cidade-teste";
const COMPLETO = {
  slug: SLUG, modos: [], cidade: "Cidade Teste", promessa: "Uma pedra.", acesso: "De carro.",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] },
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
};
const preparar = (doc: unknown) => prepararPublicacaoDaPessoa(JSON.stringify(doc), SLUG);

describe("prepararPublicacaoDaPessoa", () => {
  // 🔴 I2 da pré-auditoria (MEDIDO com o zod do repo): o `fichaSchema.parse`
  // devolve as chaves na ordem da FORMA do schema (`promessa, trajeto,
  // acesso`), não na do documento (`promessa, acesso, trajeto`). Comparar o
  // TEXTO ficaria vermelho com a porta certa — e o "conserto" óbvio (devolver
  // o texto cru) desfaria a normalização. Compara-se o OBJETO: vai ao ar o
  // documento normalizado, com as mesmas respostas, e a ordem é irrelevante.
  it("o documento completo dela vai ao ar com as mesmas respostas (normalizado)", () => {
    const r = preparar(COMPLETO);
    expect("doc" in r, JSON.stringify(r)).toBe(true);
    expect(JSON.parse((r as { doc: string }).doc)).toEqual(COMPLETO);
  });

  it("ilegível: a frase de sempre", () => {
    expect(prepararPublicacaoDaPessoa("{", SLUG)).toEqual({ frase: RASCUNHO_ILEGIVEL });
  });

  it("faltando um obrigatório dela: a frase dela", () => {
    const { acesso: _a, ...sem } = COMPLETO;
    expect(preparar(sem)).toEqual({ frase: FALTA_DA_PESSOA });
  });

  // 🔴 Review Focus 1: o documento com chave fora da lista é recusado aqui,
  // venha de onde vier. A pessoa não publica voz nem regra.
  it.each([
    ["voz", { voz: "x" }],
    ["condicao.regra", { condicao: { coords: COMPLETO.condicao.coords, regra: { tipo: "chuva_binaria", janela_previsao_horas: 1, janela_passado_horas: 1, limiar_mm: 1 } } }],
    ["discriminador", { discriminador: { como_ler: "x" } }],
  ])("documento com chave fora da lista (`%s`): recusado", (_c, mais) => {
    expect(preparar({ ...COMPLETO, ...mais })).toEqual({ frase: FORA_DA_LISTA_DELA });
  });

  it("forma errada: a frase de sempre", () => {
    expect(preparar({ ...COMPLETO, custo: { tag: "caro" } })).toEqual({ frase: FORMA_ERRADA });
  });

  it("slug de dentro diferente do endereço: a frase de sempre", () => {
    expect(preparar({ ...COMPLETO, slug: "outro" })).toEqual({ frase: SLUG_DE_DENTRO });
  });
});

describe("fraseDaPessoa", () => {
  it("toda chave de FRASE_DA_PESSOA é uma regra que existe — nenhuma fantasma", () => {
    expect(Object.keys(FRASE_DA_PESSOA).length, "a tabela foi lida vazia").toBe(6);
    for (const k of Object.keys(FRASE_DA_PESSOA)) expect(REGRAS, k).toContain(k);
  });

  it("regra com frase dela: a dela, nunca a do painel", () => {
    expect(fraseDaPessoa({ regra: "texto-emprestado", slug: SLUG, frase: "frase do painel" }, "publicar")).toBe(FRASE_DA_PESSOA["texto-emprestado"]);
  });

  it("regra sem frase dela: a de reserva, nunca a do painel", () => {
    expect(fraseDaPessoa({ regra: "janela-nao-zerada", slug: SLUG, frase: "frase do painel" }, "publicar")).toBe(RECUSA_DA_PESSOA);
  });

  // 🔴 I2 DA REVISÃO FINAL: na EDIÇÃO do lugar dela no ar, "Nada foi
  // publicado" é falso (o lugar ESTÁ publicado). A variante sai da MESMA
  // tabela — só a abertura muda —, então toda frase da tabela tem de abrir com
  // a abertura do publicar, senão a troca não acontece e a falsa passa calada.
  it.each([...Object.keys(FRASE_DA_PESSOA), "janela-nao-zerada"])(
    "`%s` na edição: abre com ABERTURA_DA_EDICAO, não diz 'publicado', e o resto é o do publicar",
    (regra) => {
      const v = { regra, slug: SLUG, frase: "frase do painel" };
      const doPublicar = fraseDaPessoa(v, "publicar");
      const daEdicao = fraseDaPessoa(v, "editar");
      expect(doPublicar.startsWith("Nada foi publicado: "), doPublicar).toBe(true);
      expect(daEdicao.startsWith(`${ABERTURA_DA_EDICAO} `), daEdicao).toBe(true);
      expect(daEdicao).not.toMatch(/publicad/i);
      expect(daEdicao.slice(ABERTURA_DA_EDICAO.length)).toBe(doPublicar.slice("Nada foi publicado:".length));
    },
  );
});
