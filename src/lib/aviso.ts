import type { AvisoLinha, EfeitoAviso } from "@/lib/db";
// 🔴 `import type`, E ISSO É LOAD-BEARING. `carimbo-estado.ts` importa VALORES
// daqui (`aplicarAviso`, `daLinha`), então este import fecharia um ciclo — mas
// só de tipo, e o TypeScript o apaga na compilação: em runtime não há ciclo
// nenhum. Trocar por import de valor quebra o app no navegador. Decisão
// registrada como Ruling R3 no ledger do plano de 2026-09-13.
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

/** O aviso como ele viaja pra tela: sem `id`, sem `retirado`. */
export type Aviso = {
  texto: string;
  efeito: EfeitoAviso;
  criadoEm: number;
  venceEm: number;
};

export function daLinha(l: AvisoLinha): Aviso {
  return { texto: l.texto, efeito: l.efeito, criadoEm: l.criado_em, venceEm: l.vence_em };
}

/** O lugar está fechado porque o DONO disse, não porque o calendário disse.
 *
 *  🔴 POR QUE `fechado` NÃO É ESTADO: o motor só responde `fresco | frio` — ele
 *  só sabe de chuva. Transformar "em reforma" em `frio` faria o app dizer "não
 *  vá" **com as palavras da chuva** (`falaMolhada`), atribuindo ao tempo uma
 *  coisa que é obra. O app afirmando causa falsa é a linha vermelha deste
 *  projeto. Quem lê isto é `faseDe`, pelo campo `fechadoPeloDono`. */
export function fechadoPeloDono(aviso: Aviso | null | undefined): boolean {
  return aviso?.efeito === "fechado";
}

/** A leitura do carimbo depois da palavra do dono.
 *
 *  🔴 O DONO GANHA DO MOTOR, sempre. Ele esteve lá; a previsão não. Só os
 *  efeitos `fresco` e `frio` mexem no estado — `nenhum` é recado puro e
 *  `fechado` não é estado (ver acima).
 *
 *  `erro` NUNCA é mascarado: se o servidor não conseguiu ler a chuva, isso
 *  continua verdade, e a tela continua tendo que dizer. Um aviso não é uma
 *  leitura de chuva. */
export function aplicarAviso(leitura: LeituraCarimbo, aviso: Aviso | null): LeituraCarimbo {
  if (!aviso) return leitura;
  const estado =
    aviso.efeito === "fresco" || aviso.efeito === "frio" ? aviso.efeito : leitura.estado;
  return { ...leitura, estado, aviso };
}
