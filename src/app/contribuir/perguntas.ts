import { OPCIONAIS_DA_PESSOA } from "@/lib/campos-da-pessoa";
import { montarPerguntas } from "../admin/novo/perguntas";
import type { PerguntaNaTela } from "../admin/campos/tipos";

/** A ORDEM DA SPEC (07/10, Parte 1): nome, o ponto no mapa, o que é, como se
 *  chega, o que pode dar errado, custa ou é grátis (+ quanto), horário e dias.
 *  A pergunta do mapa é a do ponto 0 — grava o ponto e a chuva juntos, e desde
 *  17/10 também a cidade, que sai dele (era a 2ª pergunta; o mapa subiu pro
 *  lugar dela). */
export const ORDEM_DA_PESSOA: readonly string[] = [
  "trajeto.waypoints.0.nome", "trajeto.waypoints.0.lat", "promessa", "acesso", "avisos",
  "custo.tag", "custo.valor", "horario", "dias",
];

/** As perguntas DELA: as do painel (mesmo texto, mesmo instrumento), só as da
 *  lista dela, e com a obrigatoriedade DELA. Pergunta da lista que o painel não
 *  monta é defeito de programa — estoura, nunca some calada. */
export function montarPerguntasDaPessoa(doc: unknown): PerguntaNaTela[] {
  const doPainel = new Map(montarPerguntas(doc).map((q) => [q.campo.caminho, q]));
  return ORDEM_DA_PESSOA.map((caminho) => {
    const q = doPainel.get(caminho);
    if (!q) throw new Error(`a pergunta "${caminho}" não existe no formulário do painel`);
    return { ...q, campo: { ...q.campo, obrigatorio: !OPCIONAIS_DA_PESSOA.has(caminho) } };
  });
}
