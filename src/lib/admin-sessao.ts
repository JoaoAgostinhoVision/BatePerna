// src/lib/admin-sessao.ts
import { createHmac, timingSafeEqual } from "node:crypto";

/** Quanto tempo a sessão do painel vale. Sete dias: ele entra do celular na
 *  estrada e não pode ser expulso no meio de um aviso; e um cookie eterno num
 *  celular perdido é o app inteiro na mão de quem achou. */
export const DURACAO_SESSAO_S = 7 * 24 * 60 * 60;

export type ResultadoSessao =
  | { valida: true }
  | { valida: false; motivo: "formato" | "assinatura" | "expirada" };

function assinar(segredo: string, payload: string): string {
  return createHmac("sha256", segredo).update(payload).digest("base64url");
}

/** Compara sem vazar, pelo TEMPO, onde as cadeias divergem.
 *
 *  🔴 `timingSafeEqual` exige buffers do mesmo tamanho — passar tamanhos
 *  diferentes ESTOURA. Por isso o comprimento é checado antes, e sim: isto
 *  vaza o comprimento. Vazar "a senha tem 31 caracteres" é inofensivo; vazar
 *  "o primeiro caractere está certo" é o que permite extrair byte a byte. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export function criarSessao(segredo: string, agora: number, duracaoS: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: agora + duracaoS })).toString("base64url");
  return `${payload}.${assinar(segredo, payload)}`;
}

/** A sessão é boa? Verifica ASSINATURA antes de olhar o conteúdo — um payload
 *  adulterado não pode nem chegar ao `JSON.parse`. */
export function lerSessao(segredo: string, token: string, agora: number): ResultadoSessao {
  const partes = token.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return { valida: false, motivo: "formato" };
  }
  const [payload, hmac] = partes;
  if (!iguaisEmTempoConstante(hmac, assinar(segredo, payload))) {
    return { valida: false, motivo: "assinatura" };
  }
  let exp: unknown;
  try {
    exp = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp;
  } catch {
    return { valida: false, motivo: "formato" };
  }
  if (typeof exp !== "number") return { valida: false, motivo: "formato" };
  return agora < exp ? { valida: true } : { valida: false, motivo: "expirada" };
}

/** A senha digitada bate com a configurada? Tempo constante, sempre. */
export function senhaConfere(esperada: string, recebida: string): boolean {
  return iguaisEmTempoConstante(esperada, recebida);
}
