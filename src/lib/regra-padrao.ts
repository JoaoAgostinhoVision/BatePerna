import type { Severidade } from "@/lib/severidade";
import type { Ficha, FichaNoAr } from "@/types/ficha";

/** A REGRA PADRÃO DA CHUVA (spec de 07/10, Parte 4): o que o carimbo usa em
 *  todo lugar que não tem regra própria — hoje, todo lugar mandado por quem usa
 *  o app. Mora no BANCO (`regra_padrao`), e a tela dele é `/admin/chuva`:
 *  mudar não pede código nem deploy.
 *
 *  Puro e sem zod, pela régua de `severidade.ts`: client component pode ler. */
export type RegraPadrao = {
  janela_previsao_horas: number;
  janela_passado_horas: number;
  limiar_mm: number;
  severidade: Severidade;
};

/** A semente da linha, e SÓ a semente: `ensureSchema` a grava com
 *  `INSERT OR IGNORE`, então ela nunca desfaz o que o João mudou depois.
 *  Os números são a decisão dele de 07/10: *"use a sua sugestão"*. */
export const REGRA_PADRAO_INICIAL: RegraPadrao = {
  janela_previsao_horas: 3,
  janela_passado_horas: 6,
  limiar_mm: 0.2,
  severidade: "cuidado",
};

/** A FICHA COMO O PÚBLICO A VÊ, montada num lugar só (`buscarFichas` e a
 *  leitura do dono usam esta, e nenhuma outra).
 *
 *  🔴 A REGRA EFETIVA: com `condicao.regra` no documento, a dele — e a padrão
 *  não encosta, nem na severidade (que cai na padrão só se o documento tiver
 *  regra e não tiver severidade, estado que nenhuma porta produz). Sem regra,
 *  os QUATRO números da padrão RECEBIDA — nunca `REGRA_PADRAO_INICIAL`: a
 *  padrão é dado do banco, e o João a muda pelo painel.
 *
 *  🔴 A REGRA PRÓPRIA É DERIVADA DO DOCUMENTO, NÃO COLUNA (escolha 1 do plano
 *  de 07/10): calibrar grava a regra no documento, e "voltar a esta" leva junto
 *  o que a versão dizia. Uma coluna separada divergiria no primeiro "voltar".
 *
 *  Não muda `doc`: devolve um objeto novo. */
export function noAr(doc: Ficha, origem: { conferido: boolean }, padrao: RegraPadrao): FichaNoAr {
  const propria = doc.condicao.regra;
  return {
    ...doc,
    condicao: {
      ...doc.condicao,
      regra: propria ?? {
        tipo: "chuva_binaria",
        janela_previsao_horas: padrao.janela_previsao_horas,
        janela_passado_horas: padrao.janela_passado_horas,
        limiar_mm: padrao.limiar_mm,
      },
      severidade: propria ? (doc.condicao.severidade ?? padrao.severidade) : padrao.severidade,
    },
    origem: { conferido: origem.conferido, regraPropria: propria !== undefined },
  };
}
