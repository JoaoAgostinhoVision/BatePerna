import type { Ficha } from "@/types/ficha";
import { avaliar, type Estado } from "@/lib/motor";
import { fetchPrecip, fetchPrecipMulti, type JanelaMax } from "@/lib/weather";
import { aplicarAviso, daLinha, type Aviso } from "@/lib/aviso";
import { avisoVigente, avisosVigentes, getClient } from "@/lib/db";
// `comPrazo` mora em `cache-rotas.ts` (puro; só importa `despacho.ts`, que
// não importa nada) — sem ciclo com este módulo, conferido em 2026-09-16.
import { comPrazo } from "@/lib/cache-rotas";

/** Quanto o carimbo espera o BANCO pelo aviso do dono antes de seguir sem ele.
 *
 *  🔴 O `catch` de `lerAviso`/`lerAvisos` segura ERRO, não DEMORA (revisão
 *  final, 2026-09-16). Um Turso pendurado — sem responder e sem recusar —
 *  travaria a ficha, a home e o `/api/carimbo(s)`, que são o portão: antes
 *  desta branch nenhum desses caminhos dependia do banco, e o `fetchPrecip`
 *  já usa `AbortSignal.timeout` exatamente por isso.
 *
 *  2 s porque é UMA consulta de uma linha, indexada, num banco da mesma região
 *  — muito mais que o normal, e ainda assim menor que os 4 s do clima
 *  (`PRAZO_CLIMA_MS`) que corre em PARALELO: o aviso nunca vira o gargalo, e o
 *  pior caso da página continua sendo o do clima, abaixo dos 6 s em que o
 *  service worker desiste da rede (`PRAZO_REDE_MS`). */
export const PRAZO_AVISO_MS = 2_000;

/** O que descreve um carimbo. A página entrega isto ao componente; a rota
 *  /api/carimbo devolve isto no corpo. Mesmo formato de propósito: são a mesma
 *  informação chegando por dois caminhos. */
export type LeituraCarimbo = {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  /** A palavra do dono sobre este lugar, se houver uma valendo agora.
   *  `null` explícito (e não opcional) para que o guarda `ehLeitura` da tela
   *  possa exigir a chave — leitura sem a chave é leitura de uma versão velha
   *  do servidor, e tratar isso como "sem aviso" esconderia um aviso real. */
  aviso: Aviso | null;
};

/** Lê a chuva de agora e decide. Mora aqui, e não dentro da página, porque a
 *  rota precisa da MESMA função: duas fontes pro mesmo carimbo seriam a semente
 *  de duas respostas diferentes pro mesmo morro.
 *
 *  🔴 E DEPOIS DA CHUVA VEM O DONO. `aplicarAviso` é o último passo de
 *  propósito: ele esteve lá, a previsão não. Ver `src/lib/aviso.ts`.
 *
 *  As duas buscas saem JUNTAS: uma não depende da outra, e em série o pior
 *  caso somaria os dois prazos (2 s + 4 s), encostando nos 6 s do service
 *  worker. Em paralelo, o pior caso é o do clima. */
export async function resolverEstado(ficha: Ficha, debug?: string): Promise<LeituraCarimbo> {
  const agora = Math.floor(Date.now() / 1000);
  const [aviso, base] = await Promise.all([lerAviso(ficha.slug, agora), semAviso(ficha, debug, agora)]);
  return aplicarAviso(base, aviso);
}

/** O carimbo só-clima, que é o que este módulo sempre fez. */
async function semAviso(ficha: Ficha, debug: string | undefined, agora: number): Promise<LeituraCarimbo> {
  if (debug === "fresco" || debug === "frio")
    return { estado: debug, erro: false, calculadoEm: agora, aviso: null };
  try {
    const { coords, regra } = ficha.condicao;
    const { precips } = await fetchPrecip(coords, regra);
    return { estado: avaliar(regra, precips, agora), erro: false, calculadoEm: agora, aviso: null };
  } catch {
    // Sem leitura de chuva → lado seguro, e diz a verdade (não finge verde).
    return { estado: "frio", erro: true, calculadoEm: agora, aviso: null };
  }
}

/** O aviso, e nunca uma exceção NEM uma espera sem fim: banco fora do ar não
 *  pode derrubar o carimbo, e banco PENDURADO não pode segurá-lo. Sem aviso é
 *  o caso NORMAL — é assim que o app roda hoje, e é assim que ele tem que
 *  continuar rodando se o Turso cair ou emudecer.
 *
 *  `comPrazo` NÃO cancela a consulta (não há o que cancelar num
 *  `@libsql/client`); ela só deixa de ser esperada. Uma resposta que chegue
 *  depois é descartada — o carimbo já foi. */
async function lerAviso(slug: string, agora: number): Promise<Aviso | null> {
  try {
    const l = await comPrazo(avisoVigente(getClient(), slug, agora), PRAZO_AVISO_MS, null);
    return l ? daLinha(l) : null;
  } catch {
    return null;
  }
}

/** Os avisos de TODOS os lugares, numa consulta só — irmão do `lerAviso`, e
 *  pela mesma razão que `resolverEstados` existe: N consultas saindo do celular
 *  no portão é o que esta família de funções existe pra evitar. Mesmo prazo. */
async function lerAvisos(agora: number): Promise<Map<string, Aviso>> {
  try {
    const linhas = await comPrazo(avisosVigentes(getClient(), agora), PRAZO_AVISO_MS, new Map());
    return new Map([...linhas].map(([slug, l]) => [slug, daLinha(l)]));
  } catch {
    return new Map();
  }
}

/** A janela que cobre TODAS as regras: o maior passado e a maior previsão,
 *  cada eixo escolhido por si — uma trilha pode pedir passado longo e previsão
 *  curta, outra o oposto, e a requisição única precisa satisfazer as duas. */
export function janelaMaxima(fichas: Ficha[]): JanelaMax {
  return {
    passadoHoras: Math.max(...fichas.map((f) => f.condicao.regra.janela_passado_horas)),
    previsaoHoras: Math.max(...fichas.map((f) => f.condicao.regra.janela_previsao_horas)),
  };
}

/** O carimbo de várias trilhas, numa chamada de rede só.
 *
 *  O julgamento continua sendo o `avaliar` de sempre, uma vez por trilha, com a
 *  regra dela: o que ganhou versão plural foi o transporte da chuva, nunca a
 *  decisão. Home, ficha e /api/carimbo não podem divergir sobre o mesmo morro.
 *
 *  Falhou a busca — rede, prazo, ou lista de tamanho errado — e NINGUÉM recebe
 *  carimbo. Meia home preenchida parece defeito e a pessoa não sabe quais
 *  confiar; todas sem leitura é uma frase honesta que ela entende. */
export async function resolverEstados(fichas: Ficha[]): Promise<Map<string, LeituraCarimbo>> {
  const agora = Math.floor(Date.now() / 1000);
  if (fichas.length === 0) return new Map();
  // Juntas, pela mesma razão de `resolverEstado`: em série os prazos somam.
  const [avisos, base] = await Promise.all([lerAvisos(agora), climaDeTodas(fichas, agora)]);
  return new Map(
    [...base].map(([slug, leitura]) => [slug, aplicarAviso(leitura, avisos.get(slug) ?? null)]),
  );
}

/** O clima de todas, que é o que `resolverEstados` sempre fez. */
async function climaDeTodas(fichas: Ficha[], agora: number): Promise<Map<string, LeituraCarimbo>> {
  try {
    const series = await fetchPrecipMulti(
      fichas.map((f) => f.condicao.coords),
      janelaMaxima(fichas),
    );
    return new Map(
      fichas.map((f, i) => [
        f.slug,
        {
          estado: avaliar(f.condicao.regra, series[i], agora),
          erro: false,
          calculadoEm: agora,
          aviso: null,
        },
      ]),
    );
  } catch {
    return new Map(
      fichas.map((f) => [
        f.slug,
        { estado: "frio" as const, erro: true, calculadoEm: agora, aviso: null },
      ]),
    );
  }
}
