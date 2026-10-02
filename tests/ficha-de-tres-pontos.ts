import { fichaSchema, type Ficha } from "@/types/ficha";

/** A FICHA DE TRÊS PONTOS — fixture de TESTE da cadeia de waypoints (Tarefa 10).
 *
 *  🔴 NENHUM LUGAR REAL GANHA ETAPA. Todo nome aqui é MARCADOR ("Segundo
 *  ponto", "Terceiro ponto"), nunca geografia, e todo texto é sobre um lugar
 *  que não existe. Copiar a Rampa e pendurar etapas nela seria escrever, num
 *  arquivo do repositório, um caminho até um lugar real que ninguém percorreu.
 *
 *  🔴 O NOME DO DESTINO COMEÇA COM "Zz" DE PROPÓSITO: ele ordena DEPOIS de todo
 *  nome do acervo real, e é isso que deixa o teste da ordem do acervo provar a
 *  POSIÇÃO (pelo destino) em vez de só "não é o primeiro". Um destino que
 *  ordenasse no meio da lista deixaria a mutação "ordena pela etapa"
 *  sobreviver por coincidência de alfabeto.
 *
 *  Não é um teste (o `include` do vitest só coleta `*.test.*`). Passa pelo
 *  `fichaSchema` aqui mesmo: fixture que não é ficha mede o vazio. */
export const DESTINO = "Zz destino marcador";
export const SEGUNDO = "Segundo ponto";
export const TERCEIRO = "Terceiro ponto";
export const NOTA_DO_SEGUNDO = "nota marcadora do segundo ponto";

export const TRES_PONTOS: Ficha = fichaSchema.parse({
  slug: "lugar-de-tres-pontos-teste",
  modos: ["contemplativo"],
  rotulo_escaneio: "MARCADOR",
  promessa: "Uma promessa marcadora, de um lugar que não existe.",
  voz: "Uma voz marcadora, de um lugar que não existe.",
  premio: "Um prêmio marcador.",
  trajeto: {
    waypoints: [
      { nome: DESTINO, lat: -8.4, lng: -36.2 },
      { nome: SEGUNDO, lat: -8.41, lng: -36.21, nota: NOTA_DO_SEGUNDO },
      { nome: TERCEIRO, lat: -8.42, lng: -36.22 },
    ],
  },
  acesso: "Um acesso marcador.",
  avisos: "Um aviso marcador.",
  condicao: {
    coords: { lat: -8.4, lng: -36.2 },
    regra: { tipo: "chuva_binaria", janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 1 },
    severidade: "nao-va",
    regra_texto: "chuva marcadora nas últimas 6h ou nas próximas 3h",
    ressalva_proxy: "Uma ressalva marcadora — confira no lugar.",
  },
  discriminador: {
    formato: "marcador",
    como_ler: "Uma leitura marcadora.",
    permissao_abortar: "Uma permissão marcadora.",
  },
  custo: { tag: "gratis" },
});

/** Cópia PROFUNDA, sempre — o teste que muda um nome de etapa nunca pode sujar
 *  a fixture que o caso seguinte lê (C3 da auditoria da Tarefa 10). */
export const tresPontos = (): Ficha => structuredClone(TRES_PONTOS);

/** A MESMA ficha com DOIS pontos — o lugar e uma etapa. É o estado logo depois
 *  do primeiro "acrescentar", o mais comum de todos, e a fronteira onde "tirar o
 *  último" é tirar a ÚNICA etapa (onda de conserto 1 da Tarefa 10, Critical 2
 *  da revisão: nenhuma prova exercitava este tamanho). Slug próprio, pra poder
 *  morar no mesmo banco que a de três sem se confundir com ela. */
export const doisPontos = (): Ficha => {
  const f = tresPontos();
  return { ...f, slug: "lugar-de-dois-pontos-teste", trajeto: { waypoints: f.trajeto.waypoints.slice(0, 2) } };
};
