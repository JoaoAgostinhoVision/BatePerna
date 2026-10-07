/** OS ENDEREÇOS DO LUGAR NOVO — num módulo NEUTRO (nem `"use client"`, nem
 *  registro), porque dois lados os usam (Tarefa 12): o `FormularioDeLugar`
 *  (cliente) e a página de servidor `/admin/novo/publicar`. Uma função exportada
 *  de um arquivo `"use client"` chega ao servidor como REFERÊNCIA de cliente, e
 *  chamá-la lá estoura — por isso ela saiu de lá e mora aqui. */

/** O endereço da pergunta N do rascunho — a posição mora na URL. */
export const enderecoDaPergunta = (slug: string, n: number): string =>
  `/admin/novo?slug=${encodeURIComponent(slug)}&p=${n}`;

/** O endereço da tela de publicar o rascunho. */
export const enderecoDePublicar = (slug: string): string => `/admin/novo/publicar?slug=${encodeURIComponent(slug)}`;
