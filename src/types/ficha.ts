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
  // `curto` é o CHIP do topo da ficha — a forma curta do custo, na palavra de
  // quem conhece o lugar.
  //
  // 🔴 Ele nasceu porque o chip era montado no código como `${preço} · portão`,
  // com o "portão" ESCRITO À MÃO (2026-08-27). Verdade na Rampa, que cobra num
  // portão de verdade — e uma invenção em qualquer trilha paga que cobre numa
  // guarita, por Pix, ou com um cara na estrada. Decisão dele: *"tem que ser
  // algo personalizável, nem tudo tem o mesmo valor e mesma forma"* — o VALOR
  // muda e a FORMA de cobrar muda, então as duas coisas vêm da ficha.
  //
  // Opcional pela régua de sempre: ficha paga sem o campo mostra só o preço
  // extraído de `valor`, e o app **cala sobre onde se paga** em vez de inventar
  // um portão. Ficha grátis não tem chip nenhum.
  custo: z.object({
    tag: z.enum(["gratis", "pago"]),
    valor: z.string().optional(),
    curto: z.string().optional(),
  }),
  // Opcional porque é FATO DE ROTEIRO — quem responde é quem conhece o
  // lugar, não quem escreve o código. Obrigatório, ele derrubaria o
  // carregamento de qualquer ficha futura que chegue sem o dado (a Rampa, a
  // única que existe hoje, TEM o campo desde a Task 8, 2026-08-23 — mas a
  // opcionalidade não é sobre ela, é sobre a próxima ficha que ainda não tem).
  //
  // A rodada "review do celular" APAGOU daqui `esforco` (quão puxada, sobre o
  // corpo de quem vai) e `duracao`: este app só sabe falar de LUGAR, e quem
  // ficou no lugar deles é o campo abaixo. Ficha antiga que ainda traga os
  // dois campos continua carregando — o zod descarta chave desconhecida em
  // silêncio —, ela só não os enxerga mais.
  //
  // O piso da via até a trilha — o PIOR trecho do caminho, não o final nem a
  // média (ver o comentário em `src/lib/piso.ts`). Opcional porque é fato de
  // roteiro, e ficha sem ele nunca é escondida pelo filtro de piso. Montado a
  // partir de `PISOS`, nunca uma lista repetida aqui.
  //
  // 🔴 `extensaoKm` — km da trilha, SÓ IDA — morava aqui ao lado, como par
  // deste campo. Apagado na contração de 2026-08-23 (Task 7): sem o campo, não
  // sobra recorte de "tamanho da trilha" nem tela que o mostre.
  piso: z.enum(PISOS).optional(),
  // Carro comum chega até aqui?
  //
  // 🔴 Ele existe porque o `piso` estava sendo usado como PROXY disso, e errava
  // contra a pessoa (2026-08-27). As duas fichas reais são `barro` e têm
  // exigências OPOSTAS: a Rampa do Pepê não sobe de carro comum; na Pedra
  // Furada carro comum passa sempre — *"chão batido é barro com areia"*. Mesmo
  // material, respostas contrárias: o material nunca ia responder isso.
  //
  // Booleano, e não escala de veículo: o que ele disse sobre cada lugar foi
  // sim/não. Uma escala ("carro alto", "4x4") seria fato inventado.
  //
  // Opcional pela REGRA DE HONESTIDADE 2: ficha sem o campo NUNCA é escondida
  // pelo filtro. `false` é uma AFIRMAÇÃO ("não chega"); ausente é silêncio.
  carroComum: z.boolean().optional(),
  // A meia-frase que explica POR QUE o chão firma neste lugar — o tempero da
  // linha verde do carimbo, logo depois de "sem chuva nas últimas ~Xh".
  //
  // 🔴 Ela nasceu FIXA no `Carimbo.tsx` ("Área alta, escorre rápido — a serra
  // firmou"), verdadeira enquanto a Rampa era a única ficha do acervo, e virou
  // MENTIRA no dia em que a Pedra Furada entrou: lá é estrada de chão batido e
  // PLANA, não há serra. Mesma família do Critical de geografia inventada — o
  // app afirmando sobre um lugar real coisa que ninguém mediu ali.
  //
  // Por que não dá pra derivar de `piso`: as duas fichas de hoje são `barro` e
  // mesmo assim precisam de frases OPOSTAS. O que separa as duas é o relevo, e
  // relevo é fato de roteiro — quem responde é quem conhece o lugar.
  //
  // Opcional pela mesma razão do `piso`: ficha futura que chegue sem o dado
  // carrega, e o carimbo simplesmente NÃO diz a segunda oração. Silêncio é a
  // saída honesta; frase genérica de reserva seria o defeito de volta com
  // outra roupa.
  secaRapido: z.string().optional(),
  // A faixa de horário em que dá pra entrar, hora de Recife.
  //
  // 🔴 Ele nasceu de o app AFIRMAR MAIS DO QUE SABE (2026-08-27). O carimbo só
  // olhava chuva, e a Pedra Furada fecha às 17h: às 18h com céu limpo a ficha
  // dizia "Pode ir" com o lugar fechado havia uma hora. Mesma família do
  // `SEM INFORMAÇÕES · tome cuidado` da v3.4 — e a decisão dele foi a mesma de
  // lá: **quando o app não pode afirmar, ele para de afirmar.**
  //
  // Opcional, e a régua é a de sempre: **ficha sem horário NUNCA fecha**. O app
  // não sabe que aquele lugar tem hora, então não inventa uma. A Rampa do Pepê
  // é justamente esse caso — ninguém disse o horário dela, e ela segue decidindo
  // só pela chuva, exatamente como antes.
  //
  // ⚠️ O QUE ESTE CAMPO NÃO GUARDA: o NOME da coisa que fecha. Nem "portão",
  // nem "guarita". Foi esse tipo de palavra que passou o dia 2026-08-27 inteiro
  // sendo arrancada do código, e a tela diz só as horas. Quando o nome importar,
  // ele é prosa do `acesso` — ou vira campo, com o `custo.curto` de molde.
  horario: z
    .object({
      abre: z.string().regex(/^\d{2}:\d{2}$/),
      fecha: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

export type Waypoint = z.infer<typeof waypointSchema>;
export type Regra = z.infer<typeof regraSchema>;
export type Condicao = z.infer<typeof condicaoSchema>;
export type Ficha = z.infer<typeof fichaSchema>;
