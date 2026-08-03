import { z } from "zod";

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
});

export type Waypoint = z.infer<typeof waypointSchema>;
export type Regra = z.infer<typeof regraSchema>;
export type Condicao = z.infer<typeof condicaoSchema>;
export type Ficha = z.infer<typeof fichaSchema>;
