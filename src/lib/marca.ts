/** A pegada de bota. Escolhida entre pegada / carimbo / serra / trilha com as
 *  quatro julgadas recortadas em círculo e a 48px: "bate perna" é andar, então
 *  é a única em que o nome do app e o desenho são a mesma coisa — e simétrica,
 *  o corte maskable não tira nada dela. */
export const ACCENT = "#A5522A";
export const CREME = "#F8F2E6";

/** Traçados num viewBox 0 0 100 100. Sem texto: texto em ImageResponse
 *  exigiria embutir arquivo de fonte no bundle. */
export const ANTEPE =
  "M50 14c13 0 20 9 20 20 0 8-3 13-3 18 0 4-6 6-17 6s-17-2-17-6c0-5-3-10-3-18 0-11 7-20 20-20Z";
export const CALCANHAR = "M50 64c9 0 15 4.5 15 11s-6 11-15 11-15-4.5-15-11 6-11 15-11Z";

/** Barras do piso, em coordenadas do mesmo viewBox. */
export const PISO = [
  { x: 28, y: 33, w: 44 },
  { x: 28, y: 43, w: 44 },
  { x: 34, y: 72, w: 32 },
];

/** `margem` é o respiro em porcentagem do lado. A maskable precisa dele: o
 *  Android recorta num círculo e só a área central de ~80% é garantida. */
export const TAMANHOS: Record<string, { px: number; margem: number }> = {
  "192": { px: 192, margem: 0 },
  "512": { px: 512, margem: 0 },
  maskable: { px: 512, margem: 12 },
  apple: { px: 180, margem: 6 },
};

/** A janela do viewBox é fixa em 0–100 — a mesma grade em que ANTEPE, CALCANHAR
 *  e PISO foram desenhados. Só o desenho encolhe e desliza pra dentro dela; a
 *  janela nunca se move. (Uma versão anterior deslocava a janela por -margem,
 *  o que empurrava o desenho pro canto em vez de sobrar respiro nos 4 lados —
 *  extraído aqui, fora da rota, pra o teste conferir a centralização sem
 *  decodificar PNG e sem violar os exports permitidos num route handler.) */
export function geometria(margem: number) {
  const lado = 100 - margem * 2;
  return {
    janela: { min: 0, tamanho: 100 },
    desenho: { inicio: margem, fim: margem + lado, escala: lado / 100 },
  };
}
