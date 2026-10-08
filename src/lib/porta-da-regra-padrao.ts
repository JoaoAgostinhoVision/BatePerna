import { SEVERIDADES, type Severidade } from "@/lib/severidade";
import type { RegraPadrao } from "@/lib/regra-padrao";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";

// (`_PADRAO` no nome: `JANELA_NEGATIVA` já existe em `src/app/admin/campos/palavras.ts`, com outro texto — M10 da pré-auditoria)
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_NEGATIVA_PADRAO = "Nada foi gravado: uma janela de chuva não pode ser negativa. Escreva 0 ou mais horas.";
// PENDENTE: redação minha, o João ainda não leu
export const JANELAS_ZERADAS =
  "Nada foi gravado: com as duas janelas em 0 a regra nunca olha chuva nenhuma, e todo lugar sem regra própria ficaria 'seco' pra sempre.";
// PENDENTE: redação minha, o João ainda não leu
export const LIMIAR_SEM_CHUVA =
  "Nada foi gravado: o limite de chuva tem de ser maior que 0 mm. Com 0, qualquer orvalho fecharia todo lugar sem regra própria.";
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_ALEM_DA_PREVISAO = `Nada foi gravado: a previsão do tempo só vai até ${TETO_PREVISAO_HORAS} horas pra frente.`;
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_ALEM_DO_PASSADO = `Nada foi gravado: o histórico de chuva só volta ${TETO_PASSADO_HORAS} horas.`;

const CHAVES = ["janela_previsao_horas", "janela_passado_horas", "limiar_mm", "severidade"] as const;

/** A FORMA dos quatro valores de uma regra (exatamente as quatro chaves,
 *  três números finitos, uma severidade que existe), ou `null`. Sem juízo
 *  sobre os números: quem julga é `lerRegraDoCorpo` (a padrão) ou a coerência
 *  (o "Calibrar" de um lugar, Task 8). */
export function formaDaRegra(corpo: unknown): RegraPadrao | null {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return null;
  const c = corpo as Record<string, unknown>;
  if (Object.keys(c).length !== CHAVES.length || !CHAVES.every((k) => k in c)) return null;
  const { janela_previsao_horas: prev, janela_passado_horas: pass, limiar_mm: limiar, severidade } = c;
  if (![prev, pass, limiar].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (typeof severidade !== "string" || !(SEVERIDADES as readonly string[]).includes(severidade)) return null;
  return {
    janela_previsao_horas: prev as number,
    janela_passado_horas: pass as number,
    limiar_mm: limiar as number,
    severidade: severidade as Severidade,
  };
}

/** O CORPO DO `PUT /api/admin/regra-padrao`, lido e conferido. `null` = torto
 *  (a rota responde 400 vazio, como as outras portas do painel); `frase` = um
 *  número que o app não aceita, com o porquê. Os LIMITES são os do acervo
 *  (`janela-nao-zerada`, `janela-dentro-do-provedor` em `coerencia.ts`): cada
 *  janela pode ser 0 sozinha (decisões dele de 01/10), as duas juntas não. */
export function lerRegraDoCorpo(corpo: unknown): { regra: RegraPadrao } | { frase: string } | null {
  const regra = formaDaRegra(corpo);
  if (regra === null) return null;
  if (regra.janela_previsao_horas < 0 || regra.janela_passado_horas < 0) return { frase: JANELA_NEGATIVA_PADRAO };
  if (regra.janela_previsao_horas === 0 && regra.janela_passado_horas === 0) return { frase: JANELAS_ZERADAS };
  if (!(regra.limiar_mm > 0)) return { frase: LIMIAR_SEM_CHUVA };
  if (regra.janela_previsao_horas > TETO_PREVISAO_HORAS) return { frase: JANELA_ALEM_DA_PREVISAO };
  if (regra.janela_passado_horas > TETO_PASSADO_HORAS) return { frase: JANELA_ALEM_DO_PASSADO };
  return { regra };
}
