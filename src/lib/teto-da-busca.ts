/** O TETO DA BUSCA NO MAPA, em caracteres — um módulo só pra ele, SEM import
 *  nenhum (revisão final de 18/10). Mora aqui, e não só em `./nominatim`, porque
 *  a caixa da busca (`BuscaNoMapa`, de cliente) o usa como `maxLength`, e o
 *  `./nominatim` traz `./lugares` junto, que o formulário de cliente não pode
 *  alcançar (o guarda do bundle em `tests/app/admin-formulario-de-lugar.test.tsx`).
 *  O `./nominatim` o reexporta: um número só, pra rota e pra tela. */

/** Caracteres. Acima disso a rota recusa sem pedir nada. */
export const TETO_DA_BUSCA = 120;
