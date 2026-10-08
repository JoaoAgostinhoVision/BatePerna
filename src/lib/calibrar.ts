import type { RegraPadrao } from "@/lib/regra-padrao";
import { fichaSchema } from "@/types/ficha";

/** O lugar já tem regra própria: calibrar não sobrescreve (os números dela se
 *  mudam um a um, pelos editores de sempre). */
export class JaTemRegra extends Error {}

/** A frase do 409. Mora aqui, e não na rota: arquivo de rota do Next não
 *  exporta nada além dos métodos (`tests/deploy/exports-de-rota.test.ts`). */
// PENDENTE: redação minha, o João ainda não leu
export const JA_TEM_REGRA = "Nada foi gravado: este lugar já tem regra de chuva própria. Mude os números dela um a um, nos campos da regra.";

/** "CALIBRAR A CHUVA" DE UM LUGAR (spec de 07/10, Parte 4): o documento ganha a
 *  regra INTEIRA e a severidade, numa conta só. É isso que liga a regra
 *  própria — ela é derivada do documento (`noAr`), não coluna. A coerência é
 *  de quem chama (a rota). Não muda `docAtual`. */
export function calibrarDoc(docAtual: string, r: RegraPadrao): string {
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  if (atual.condicao.regra !== undefined) throw new JaTemRegra();
  return JSON.stringify(
    fichaSchema.parse({
      ...atual,
      condicao: {
        ...atual.condicao,
        regra: {
          tipo: "chuva_binaria",
          janela_previsao_horas: r.janela_previsao_horas,
          janela_passado_horas: r.janela_passado_horas,
          limiar_mm: r.limiar_mm,
        },
        severidade: r.severidade,
      },
    }),
  );
}
