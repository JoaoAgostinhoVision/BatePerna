import type { Coord } from "./geo";
import { ESTADO_DO_APP, PRAZO_BUSCA_MS, urlBuscaCidade } from "./lugares";
import {
  MAPA_ALTURA_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_ZOOM,
  MAPA_ZOOM_EDITOR,
  MAPA_ZOOM_EDITOR_MIN,
  enquadrar,
} from "./mapa";

/** DE ONDE O MAPA DE PÔR O PIN COMEÇA QUANDO AINDA NÃO HÁ PONTO (Tarefa 11f).
 *
 *  🔴 A VISTA NÃO É PONTO. É só o centro e o zoom do que a tela mostra ANTES de
 *  o dono tocar no mapa. Nada daqui é gravado, nem mostrado como fato: o mapa
 *  nasce SEM pin e sem Salvar, e o ponto só existe depois do toque dele. É isso
 *  que mantém a busca de cidade dentro da spec §3.2 (que proíbe trazer o PONTO
 *  de fora): o que vem de fora aqui é onde a câmera começa.
 *
 *  🔴 CALCULADA NO SERVIDOR E ENTREGUE POR PROP (I1 da auditoria). Uma busca
 *  no celular chegaria DEPOIS do mapa desenhado, e a vista pularia — talvez no
 *  meio do dedo dele, depois do toque. Aqui a página espera a vista (com prazo)
 *  e o mapa já nasce nela.
 *
 *  As fontes, na ordem:
 *   1. a coordenada da CHUVA com o ponto 0 já marcado → o ponto 0, no zoom de
 *      pôr o pin (o ponto de medir a chuva costuma ser perto do lugar, e quem
 *      marcou o ponto 0 foi ele);
 *   2. a CIDADE do lugar (o campo `cidade`, da 11b), achada no serviço de
 *      geocoding SÓ se o nome for IGUAL, o estado for o do app e o lugar for
 *      HABITADO, e só se sobrar uma (ou uma sede, ou uma do município de mesmo
 *      nome — `cidadeNoEstado`) → no `MAPA_ZOOM` da ficha pública (~26 km no
 *      celular, com nome de cidade: um município do sertão é maior que os ~6 km
 *      do zoom de pôr o pin). Achada mais de uma vez sem desempate, a vista
 *      cai no acervo com a origem `cidade-ambigua` — a tela não diz "não
 *      achei", que seria falso;
 *   3. o ACERVO no ar → o enquadramento das coordenadas dos lugares publicados,
 *      o mesmo quadro da home, com o zoom entre `MAPA_ZOOM_EDITOR_MIN` e
 *      `MAPA_ZOOM`. Dado do BANCO: nenhuma coordenada mora neste código;
 *   4. nada → `null`, e a tela diz que não há mapa (acervo vazio é impossível
 *      hoje, mas tem ramo, e não um número inventado). */

export type VistaDoMapa = { centro: Coord; z: number; origem: "ponto" | "cidade" | "acervo" | "cidade-ambigua" };

/** Caixa, acento e espaço não contam: "cidade  marcador" é "Cidade Márcador". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const ehCoord = (v: unknown): v is Coord =>
  typeof v === "object" &&
  v !== null &&
  Number.isFinite((v as Coord).lat) &&
  Number.isFinite((v as Coord).lng);

/** Uma linha da resposta do serviço, com o que a vista precisa e a busca da
 *  tela pública (`lerLugares`) não guarda: a CLASSE do lugar (`feature_code`,
 *  do GeoNames) e o MUNICÍPIO (`admin2`). Lida aqui, e não em `lerLugares`,
 *  pra a resposta da rota pública não mudar de forma. */
type Candidata = Coord & { nome: string; estado: string; classe: string; municipio: string };

function lerCandidatas(raw: unknown): Candidata[] {
  const results = (raw as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const texto = (v: unknown): string => (typeof v === "string" ? v : "");
  return results.flatMap((r) => {
    const o = (typeof r === "object" && r !== null ? r : {}) as Record<string, unknown>;
    const c = { lat: o.latitude, lng: o.longitude };
    if (typeof o.name !== "string" || !ehCoord(c)) return [];
    return [
      { nome: o.name, estado: texto(o.admin1), classe: texto(o.feature_code), municipio: texto(o.admin2), lat: c.lat, lng: c.lng },
    ];
  });
}

/** 🔴 LUGAR HABITADO (I-2 da revisão da 11f): as classes `PPL*` do GeoNames —
 *  cidade, sede, vila, povoado —, menos as que NÃO são habitadas hoje (`PPLH`
 *  histórico, `PPLQ` abandonado, `PPLW` destruído, `PPLCH` capital
 *  histórica). A busca devolve também o aeródromo (`AIRF`) e o cabo (`CAPE`) de
 *  mesmo nome, e era isso que fazia Santa Cruz do Capibaribe, Belo Jardim e o
 *  Cabo de Santo Agostinho virarem "duas" — e a tela dizer "não achei". */
const NAO_HABITADO = new Set(["PPLH", "PPLQ", "PPLW", "PPLCH"]);
const habitado = (classe: string): boolean => classe.startsWith("PPL") && !NAO_HABITADO.has(classe);

/** A cidade na resposta do serviço — só a de nome IGUAL (normalizado), no
 *  estado do app e HABITADA. Nunca "a primeira da lista": a busca devolve
 *  homônimos de outros estados antes (C2 da auditoria da Tarefa 11f).
 *
 *  Sobrou uma: é ela. Sobrou mais de uma, nesta ordem de desempate:
 *   1. a única SEDE (`PPLA*`, sede de município) — o Cabo de Santo Agostinho
 *      vem como sede e como povoado, no mesmo lugar;
 *   2. a única do MUNICÍPIO de mesmo nome (`admin2`) — Bonito, a do Véu de
 *      Noiva, vem duas vezes como `PPL`: a cidade, e um povoado de Ibirajuba.
 *  Nenhum desempate serve: `"ambigua"` (a cidade FOI achada, mais de uma vez).
 *  Nenhuma: `null`. Nos dois, a vista cai no acervo — nunca o estado errado. */
export function cidadeNoEstado(raw: unknown, cidade: string): Coord | "ambigua" | null {
  const alvo = normalizar(cidade);
  if (alvo === "") return null;
  const estado = normalizar(ESTADO_DO_APP);
  const iguais = lerCandidatas(raw).filter(
    (l) => normalizar(l.nome) === alvo && normalizar(l.estado) === estado && habitado(l.classe),
  );
  if (iguais.length === 0) return null;
  const sedes = iguais.filter((l) => l.classe.startsWith("PPLA"));
  const doMunicipio = iguais.filter((l) => normalizar(l.municipio) === alvo);
  const unica = [iguais, sedes, doMunicipio].find((lista) => lista.length === 1);
  return unica ? { lat: unica[0].lat, lng: unica[0].lng } : "ambigua";
}

/** O quadro do acervo no ar — o mesmo `enquadrar` da home, sobre as
 *  coordenadas que o banco tem —, com o zoom no piso do editor. */
export function vistaDoAcervo(coords: readonly Coord[]): VistaDoMapa | null {
  const validas = coords.filter(ehCoord);
  if (validas.length === 0) return null;
  const q = enquadrar(validas, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_PX);
  return { centro: q.centro, z: Math.min(MAPA_ZOOM, Math.max(MAPA_ZOOM_EDITOR_MIN, q.z)), origem: "acervo" };
}

export type FontesDaVista = {
  /** A resposta CRUA do serviço de geocoding pra esta cidade. Pode lançar. */
  buscarCidade: (cidade: string) => Promise<unknown>;
  /** As coordenadas dos lugares no ar. Pode lançar. */
  coordsDoAcervo: () => Promise<Coord[]>;
};

type DocDoLugar = { cidade?: unknown; trajeto?: { waypoints?: unknown[] } };
const comoDoc = (doc: unknown): DocDoLugar => (typeof doc === "object" && doc !== null ? doc : {}) as DocDoLugar;

/** A fonte 1, sem rede: pra a coordenada da CHUVA, o ponto 0 que o documento já
 *  tem, no zoom de pôr o pin. Qualquer outra pergunta, ou sem ponto 0: `null`.
 *  Síncrona de propósito — a ficha no ar (`FichaInteira`, que não espera nada)
 *  usa esta mesma conta. */
export function vistaNoPonto0(doc: unknown, caminho: string): VistaDoMapa | null {
  if (caminho !== "condicao.coords") return null;
  const p0 = comoDoc(doc).trajeto?.waypoints?.[0];
  return ehCoord(p0) ? { centro: { lat: p0.lat, lng: p0.lng }, z: MAPA_ZOOM_EDITOR, origem: "ponto" } : null;
}

/** A vista de UMA pergunta de coordenada ainda sem ponto, a partir do
 *  documento (o rascunho, ou a ficha no ar) e do caminho da pergunta. */
export async function vistaDaCoordSemPonto(
  doc: unknown,
  caminho: string,
  fontes: FontesDaVista,
): Promise<VistaDoMapa | null> {
  return vistaNoPonto0(doc, caminho) ?? (await vistaDaCidade(doc, fontes));
}

/** As fontes 2 a 4: a cidade do documento, o acervo, ou nada. É a vista da
 *  ficha no ar com uma linha de mapa torta (`FichaInteira`, `vistaSemPonto`),
 *  e a de toda pergunta do lugar novo que não seja a chuva com o ponto 0. */
export async function vistaDaCidade(doc: unknown, fontes: FontesDaVista): Promise<VistaDoMapa | null> {
  const d = comoDoc(doc);
  let ambigua = false;
  if (typeof d.cidade === "string" && d.cidade.trim() !== "") {
    try {
      const c = cidadeNoEstado(await fontes.buscarCidade(d.cidade), d.cidade);
      if (c === "ambigua") ambigua = true;
      else if (c) return { centro: c, z: MAPA_ZOOM, origem: "cidade" };
    } catch {
      // Serviço fora, estouro do prazo, resposta que não é JSON: cai no acervo.
    }
  }
  try {
    const v = vistaDoAcervo(await fontes.coordsDoAcervo());
    return v && ambigua ? { ...v, origem: "cidade-ambigua" } : v;
  } catch {
    return null;
  }
}

/** As fontes de PRODUÇÃO. A busca tem o prazo da busca de cidade da tela
 *  pública (`PRAZO_BUSCA_MS`), e o acervo é a leitura PÚBLICA (`getAllFichas`:
 *  só os lugares no ar, com o prazo e a memória dela) — o mesmo conjunto que a
 *  home enquadra. O import é preguiçoso pra este módulo não puxar o banco
 *  quando só as funções puras são usadas. */
export const FONTES_DE_PRODUCAO: FontesDaVista = {
  buscarCidade: async (cidade) => {
    const r = await fetch(urlBuscaCidade(cidade), { cache: "no-store", signal: AbortSignal.timeout(PRAZO_BUSCA_MS) });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  },
  coordsDoAcervo: async () => {
    const { getAllFichas } = await import("./ficha");
    return (await getAllFichas()).map((f) => f.condicao.coords);
  },
};
