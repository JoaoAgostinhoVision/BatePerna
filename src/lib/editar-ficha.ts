import { fichaSchema } from "@/types/ficha";

/** Os campos que esta porta aceita mudar.
 *
 *  🔴 LISTA BRANCA, e é de propósito. Sem ela, um corpo com
 *  `{"campo":"slug"}` renomearia o lugar e quebraria todo link que já circula.
 *  A rodada de 2026-09-24 abre só a `voz`; as outras entram uma a uma, com a
 *  tela que cada uma precisa (número e regra pedem seletor, não texto livre). */
export const CAMPOS_EDITAVEIS = ["voz"] as const;
export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

export function eCampoEditavel(c: string): c is CampoEditavel {
  return (CAMPOS_EDITAVEIS as readonly string[]).includes(c);
}

/** Aplica UM campo sobre o documento atual e devolve o JSON novo.
 *
 *  🔴 REVALIDA O DOCUMENTO INTEIRO, não só o campo: esta é a porta que impede
 *  um formulário de gravar ficha quebrada, e ela é a única. Estoura em vez de
 *  devolver algo meio certo — quem chama traduz o estouro em 400. */
export function aplicarCampo(docAtual: string, campo: CampoEditavel, valor: string): string {
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  return JSON.stringify(fichaSchema.parse({ ...atual, [campo]: valor }));
}
