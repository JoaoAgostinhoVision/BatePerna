import { fichaSchema } from "@/types/ficha";
import { lugarMarcador } from "./lugar-marcador";

/** UM RASCUNHO COMPLETO, PRONTO PRA PUBLICAR (Tarefa 12) — como objeto, pra cada
 *  teste tirar ou trocar uma resposta.
 *
 *  🔴 NENHUM LUGAR REAL, NENHUMA CIDADE REAL: parte do `lugarMarcador` (ele
 *  mesmo marcador) e acrescenta TODO opcional do registro com valor marcador —
 *  é PAGO, com `custo.valor` e `custo.curto`, com `carroComum`, e com a `nota` no
 *  ponto 0 (I6 da auditoria de 06/10): sem isso, "ficha completa não cala nada"
 *  ficaria vermelho por inocência, ou a função seria afrouxada pra caber.
 *
 *  Os textos não citam piso, hora nem preço além do que os campos dizem — as
 *  regras de coerência comparam prosa com campo, e o teste mediria a acusação
 *  em vez da publicação. Passa pelo `fichaSchema` aqui: fixture que não é ficha
 *  mede o vazio. */
export function rascunhoCompleto(slug: string, nome: string, cidade: string): Record<string, unknown> {
  const base = lugarMarcador(slug, nome, cidade);
  const doc = {
    ...base,
    // Os textos que DISTINGUEM um lugar (`texto-emprestado`) são próprios deste
    // rascunho: o `lugarMarcador` só faz a voz própria, e dois marcadores no
    // mesmo banco dividiriam a promessa e o prêmio.
    voz: `Uma voz marcadora do rascunho ${slug}.`,
    promessa: `Uma promessa marcadora do rascunho ${slug}.`,
    premio: `Um prêmio marcador do rascunho ${slug}.`,
    rotulo_escaneio: "RASCUNHO MARCADOR",
    trajeto: { waypoints: [{ ...base.trajeto.waypoints[0], nota: "Uma nota marcadora do ponto." }] },
    custo: { tag: "pago", valor: "R$ 10 marcador, por pessoa", curto: "R$ 10" },
    piso: "barro",
    carroComum: true,
    horario: [{ abre: "08:00", fecha: "17:00" }],
    dias: ["sab", "dom"],
    secaRapido: `Uma frase marcadora de chão, só de ${slug}.`,
  };
  fichaSchema.parse(doc);
  return JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
}
