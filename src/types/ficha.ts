import { z } from "zod";
import { PISOS } from "@/lib/piso";

export const waypointSchema = z.object({
  nome: z.string(),
  lat: z.number(),
  lng: z.number(),
  nota: z.string().optional(),
});

export const regraSchema = z.object({
  tipo: z.literal("chuva_binaria"),
  janela_previsao_horas: z.number(),
  janela_passado_horas: z.number(),
  limiar_mm: z.number(),
});

export const condicaoSchema = z.object({
  coords: z.object({ lat: z.number(), lng: z.number() }),
  regra: regraSchema,
  regra_texto: z.string(),
  ressalva_proxy: z.string(),
});

export const discriminadorSchema = z.object({
  formato: z.string(),
  como_ler: z.string(),
  permissao_abortar: z.string(),
});

/** Quanto o corpo sofre. Três degraus e só: mais que isso e ninguém sabe a
 *  diferença entre o segundo e o terceiro. */
export const esforcoSchema = z.enum(["leve", "media", "puxada"]);
export type Esforco = z.infer<typeof esforcoSchema>;

export const fichaSchema = z.object({
  slug: z.string(),
  modos: z.array(z.string()),
  rotulo_escaneio: z.string(),
  promessa: z.string(),
  voz: z.string(),
  premio: z.string(),
  trajeto: z.object({ waypoints: z.array(waypointSchema).min(1) }),
  acesso: z.string(),
  avisos: z.string(),
  condicao: condicaoSchema,
  discriminador: discriminadorSchema,
  custo: z.object({ tag: z.enum(["gratis", "pago"]), valor: z.string().optional() }),
  // Opcionais porque são FATO DE ROTEIRO — quem responde é quem conhece o
  // lugar, não quem escreve o código. A ficha que existe hoje não os tem, e
  // obrigatórios eles derrubariam o carregamento dela.
  //
  // DE SAÍDA (rodada "review do celular"): este app só sabe falar de LUGAR,
  // não do corpo de quem vai — `esforco` está sendo trocado por `piso`
  // (o piso da via, um fato do lugar). Continuam de pé só porque a rodada
  // segue "expandir → migrar → contrair": apagar agora, antes dos
  // consumidores migrarem, deixaria o `tsc` vermelho no meio do caminho. Quem
  // apaga é a Task 8.
  esforco: esforcoSchema.optional(),
  // Minutos, não texto: é o filtro que compara. `duracao: "1h30"` obrigaria a
  // interpretar português na hora de decidir se cabe numa manhã.
  // DE SAÍDA, mesma razão do `esforco` acima — ver o comentário ali.
  duracao: z.number().int().positive().optional(),
  // O piso da via até a trilha — o PIOR trecho do caminho, não o final nem a
  // média (ver o comentário em `src/lib/piso.ts`). Opcional pela mesma razão
  // de `esforco`/`duracao`: é fato de roteiro, e ficha sem ele nunca é
  // escondida. Montado a partir de `PISOS`, nunca uma lista repetida aqui.
  piso: z.enum(PISOS).optional(),
  // Km, SÓ IDA — decisão explícita do dono do app. Ficha sem ele nunca é
  // escondida pelo filtro de extensão.
  extensaoKm: z.number().positive().optional(),
});

export type Waypoint = z.infer<typeof waypointSchema>;
export type Regra = z.infer<typeof regraSchema>;
export type Condicao = z.infer<typeof condicaoSchema>;
export type Ficha = z.infer<typeof fichaSchema>;
