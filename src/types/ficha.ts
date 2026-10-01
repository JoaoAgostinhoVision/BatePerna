import { z } from "zod";
import { PISOS } from "@/lib/piso";
import { SEVERIDADES } from "@/lib/severidade";
import { DIAS } from "@/lib/semana";

export const waypointSchema = z.object({
  nome: z.string(),
  lat: z.number(),
  lng: z.number(),
  nota: z.string().optional(),
});

/** 🔴 OS TRÊS NÚMEROS QUE GOVERNAM O MOTOR, E O `.finite()` É A ÚNICA
 *  RESTRIÇÃO AQUI — por medição, não por gosto (Task 7, 2026-09-30).
 *
 *  O `.finite()` fecha UMA coisa, e ela é um estado de caixa-preta que a Task 7
 *  tornou alcançável do celular: `1e999` é sintaxe válida num
 *  `<input type="number">`, o `JSON.parse` o entrega como `Infinity`, e
 *  `Infinity` passava por `z.number()`. Medido, ponta a ponta, antes de esta
 *  linha existir:
 *
 *    aplicarCampo(doc, "condicao.regra.janela_previsao_horas", Infinity)
 *      → ACEITA, e o documento novo fica com `"janela_previsao_horas":null`
 *        (é o que `JSON.stringify` faz com `Infinity`)
 *      → e esse documento NÃO RELÊ: `invalid_type, expected number, received null`
 *
 *  O que isso significa na mão dele: o lugar **sai do ar** (o caminho de leitura
 *  é `fichaSchema.parse` em `buscarFichas`/`getFicha`) e ele **não consegue
 *  consertar pelo painel**, porque o painel precisa ler a ficha pra mostrá-la.
 *  É a porta de mão única que o ruling C1 da Tarefa 1 desta rodada já pagou uma
 *  vez. E o portão de coerência não alcança: `!(Infinity > 0)` é `false`, então
 *  `janela-nao-zerada` não acusa nada e a gravação sai com 200.
 *
 *  🔴 E POR QUE NÃO `.int().min(1)` / `.gt(0)`, QUE É O QUE PARECE CERTO. Eu
 *  medi, e deixa o app PIOR em três frentes:
 *
 *   1. **A recusa do zero vira muda.** Hoje zerar o limiar pelo painel devolve
 *      **409** com *"O limite de chuva de X é 0 mm: qualquer orvalho fecha o
 *      lugar, e o app passa a dizer não o ano inteiro."* — a regra
 *      `janela-nao-zerada` de `src/lib/coerencia.ts`, que roda NA GRAVAÇÃO desde
 *      a Tarefa 3. Com a restrição no schema, `aplicarCampo` estoura um
 *      `ZodError` ANTES do portão, a rota devolve **400 de corpo vazio** (ela não
 *      vaza `ZodError`, de propósito) e ele lê *"Não consegui salvar."*. A porta
 *      fica mais estreita e a tela fica mais burra.
 *   2. **Quatro casos vermelhos, medidos** (`npm test`, 1454/1458): os dois do
 *      portão de coerência que provam o 409 e a frase certa, e dois de `loadAll`
 *      que passam a morrer com um `ZodError` sobre um NÚMERO num guarda que é
 *      sobre SLUG REPETIDO — guarda vermelho pelo motivo errado.
 *   3. **O zod aceitar 0 é decisão escrita**, não esquecimento: está no
 *      comentário de `janela-nao-zerada` (*"o zod aceita 0 de propósito (as
 *      fixtures sintéticas usam), então o guarda pertence ao ACERVO, não ao
 *      schema"*), e sete arquivos de teste usam `0/0/0` como fixture sintética.
 *      Recusar no schema tornaria o ramo do limiar daquela regra
 *      **inalcançável** — a 52ª espécie do catálogo deste projeto.
 *
 *  ⚠️ E O QUE ESTA LINHA DE PROPÓSITO **NÃO** RECUSA: janela fracionária
 *  (`2.5`). `avaliar` a usa sem reclamar e `buildUrl` a arredonda pra cima em
 *  dias; é um valor que um dono pode querer de verdade, e numa porta o falso
 *  positivo é pior que o falso negativo, porque trava o dono de gravar uma
 *  verdade. Quem recusa zero, negativo, limiar nulo e janela acima do teto do
 *  provedor é o portão de coerência, com frase (`janela-nao-zerada` e
 *  `janela-dentro-do-provedor`). ⚠️ Desde 2026-10-01 a janela de PREVISÃO pode
 *  ser zero — decisão do João: "só olhar a chuva que já caiu". */
export const regraSchema = z.object({
  tipo: z.literal("chuva_binaria"),
  janela_previsao_horas: z.number().finite(),
  janela_passado_horas: z.number().finite(),
  limiar_mm: z.number().finite(),
});

export const condicaoSchema = z.object({
  coords: z.object({ lat: z.number(), lng: z.number() }),
  regra: regraSchema,
  // COM QUE FORÇA esta trilha fala quando choveu. A `regra` acima diz SE
  // choveu; este campo diz o que isso significa AQUI — e são coisas diferentes,
  // o que o acervo provou em 2026-09-10: as três fichas usam a mesma
  // `chuva_binaria` e têm três respostas distintas na voz dele ("molhou, não
  // vá" / "espera passar umas 3 horas" / "dá pra ir com cuidado").
  //
  // 🔴 OBRIGATÓRIO, e é o ponto do campo. Opcional com padrão, ficha nova
  // entraria calada herdando a severidade da Rampa — que é exatamente o defeito
  // que ele existe pra fechar. Sem ele o schema recusa a ficha, e a pergunta vai
  // pro dono do lugar antes de ir à tela. As palavras de cada nível moram em
  // `src/lib/severidade.ts`, nunca aqui.
  severidade: z.enum(SEVERIDADES),
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
  // contra a pessoa (2026-08-27): quem filtrava pedindo piso melhor que barro
  // perdia TODAS as fichas do acervo — e em todas elas carro comum chega. O
  // material nunca ia responder "meu carro chega lá?".
  //
  // ⚠️ ESTE COMENTÁRIO AFIRMAVA O CONTRÁRIO ATÉ 2026-09-04, e o erro era meu:
  // dizia *"a Rampa do Pepê não sobe de carro comum"*, frase que eu tinha
  // escrito no `RESUME` e nunca conferido na ficha. `rampa-do-pepe.json` diz
  // `carroComum: true` e *"dá pra ir de carro comum — mas só quando não estiver
  // chovendo"*: a ressalva é de CHUVA, e quem a diz é o carimbo. A correção
  // entrou no JSON e no teste em 27/08 e **este comentário ficou com o erro**,
  // justificando o campo com a crença que o campo desmentiu. Achado por
  // auditoria, não por teste: **nada ancora um comentário de justificativa ao
  // dado que ele justifica.**
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
  // OS DIAS DA SEMANA em que da pra entrar.
  //
  // 🔴 Ele nasceu do MESMO defeito que o `horario`, num eixo que nao existia
  // (2026-09-11). A Rampa do Pepe virou "Eco Park" e passou a receber visita
  // **so aos sabados e domingos** — e como ela nao tem `horario`, numa quarta
  // seca o app dizia "Pode ir" e mandava a pessoa dirigir 178 km ate um portao
  // trancado. O app afirmando mais do que sabe, pela terceira vez, e a decisao
  // e a mesma das outras duas: **quando nao pode afirmar, ele para de afirmar.**
  //
  // 🔴 POR QUE NAO MORA DENTRO DE `horario`: a Rampa tem DIA e nao tem HORA.
  // Ninguem disse a que horas ela abre. Aninhar `dias` no `horario` obrigaria
  // a inventar um `abre`/`fecha` so pra poder declarar o sabado — geografia
  // inventada com roupa de schema. Os dois eixos sao independentes: hora sem
  // dia, dia sem hora, os dois, ou nenhum.
  //
  // Opcional pela regua de sempre: **ficha sem `dias` NUNCA fecha por dia.** O
  // app nao sabe que aquele lugar folga, entao nao inventa uma folga.
  //
  // `.min(1)` porque `[]` significaria "nao abre nunca" — uma regra que fecha
  // todo dia, irma da janela de chuva zerada que `coerencia-acervo` ja barra.
  // Se um lugar fechou de vez, quem diz isso e a ausencia da ficha.
  //
  // ⚠️ A PROCEDENCIA DESTE DADO NA RAMPA E A INTERNET, NAO ELE — autorizada
  // por ele em 2026-09-11 ("pode atualizar a hora pela internet"), e e o
  // primeiro campo do acervo cuja fonte nao e a boca do dono do app. Fica dito
  // aqui e em `docs/pesquisa-externa-2026-09-11.md`.
  //
  // Montado a partir de `DIAS`, nunca uma lista repetida aqui — e a ORDEM
  // daquele array e o indice de `Date.getUTCDay()`. Ver `src/lib/semana.ts`.
  dias: z.array(z.enum(DIAS)).min(1).optional(),
});

export type Waypoint = z.infer<typeof waypointSchema>;
export type Regra = z.infer<typeof regraSchema>;
export type Condicao = z.infer<typeof condicaoSchema>;
export type Ficha = z.infer<typeof fichaSchema>;
