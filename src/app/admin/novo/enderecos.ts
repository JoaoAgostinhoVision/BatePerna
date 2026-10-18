/** OS ENDEREÇOS DO LUGAR NOVO — num módulo NEUTRO (nem `"use client"`, nem
 *  registro), porque dois lados os usam (Tarefa 12): o `FormularioDeLugar`
 *  (cliente) e a página de servidor `/admin/novo/publicar`. Uma função exportada
 *  de um arquivo `"use client"` chega ao servidor como REFERÊNCIA de cliente, e
 *  chamá-la lá estoura — por isso ela saiu de lá e mora aqui. */

const e = encodeURIComponent;

export type Onde = "painel" | "contribuir";

/** OS ENDEREÇOS DO FORMULÁRIO DE LUGAR NOVO, por quem o usa (07/10). O
 *  formulário é UM (os mesmos editores, as mesmas perguntas); muda pra onde ele
 *  grava e pra onde ele leva. É uma tabela num módulo que os componentes de
 *  cliente importam, porque quem a escolhe é uma página de SERVIDOR, e função
 *  não atravessa essa fronteira como prop — a página passa só a CHAVE (`onde`).
 *
 *  `corrigir` (17/10, Task 7): a pergunta N com `&volta=revisao` — o "Corrigir"
 *  da revisão e o do aviso do par levam a UMA pergunta, e o seguir dela volta
 *  pra revisão (a tela de publicar), sem passar pelas outras.
 *
 *  `recarregarSe401`: na tela de QUEM USA, 401 é a sessão do Clerk que venceu no
 *  meio; recarregar leva a página de servidor a pedir login, e o Clerk a devolve
 *  ao MESMO endereço. No painel do João fica `false`: lá o 401 continua sendo a
 *  frase de falha de sempre. */
export const ROTAS = {
  painel: {
    rascunhoApi: "/api/admin/rascunho",
    buscaApi: "/api/admin/buscar-no-mapa",
    publicarApi: "/api/admin/publicar",
    pergunta: (slug: string, n: number) => `/admin/novo?slug=${e(slug)}&p=${n}`,
    corrigir: (slug: string, n: number) => `/admin/novo?slug=${e(slug)}&p=${n}&volta=revisao`,
    publicar: (slug: string) => `/admin/novo/publicar?slug=${e(slug)}`,
    comecou: (slug: string) => `/admin/novo?slug=${e(slug)}`,
    publicou: (slug: string) => `/admin/${e(slug)}`,
    desistiu: "/admin",
    recarregarSe401: false,
  },
  contribuir: {
    rascunhoApi: "/api/contribuir/rascunho",
    buscaApi: "/api/contribuir/buscar-no-mapa",
    publicarApi: "/api/contribuir/publicar",
    pergunta: (slug: string, n: number) => `/contribuir/novo?slug=${e(slug)}&p=${n}`,
    corrigir: (slug: string, n: number) => `/contribuir/novo?slug=${e(slug)}&p=${n}&volta=revisao`,
    publicar: (slug: string) => `/contribuir/novo/publicar?slug=${e(slug)}`,
    comecou: (slug: string) => `/contribuir/novo?slug=${e(slug)}`,
    // Publicou: a pessoa vê o lugar como o público vê — com a marca.
    publicou: (slug: string) => `/${e(slug)}`,
    desistiu: "/contribuir",
    recarregarSe401: true,
  },
} as const satisfies Record<Onde, unknown>;

/** O endereço da pergunta N do rascunho DO JOÃO — a posição mora na URL. */
export const enderecoDaPergunta = ROTAS.painel.pergunta;

/** O endereço da tela de publicar o rascunho DO JOÃO. */
export const enderecoDePublicar = ROTAS.painel.publicar;
