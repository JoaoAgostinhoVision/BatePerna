import type { Severidade } from "@/lib/severidade";

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
