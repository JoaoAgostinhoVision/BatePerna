import { z } from "zod";
import { PISOS } from "@/lib/piso";
import { CIDADE_SEM_LETRA, CIDADE_VAZIA, slugDoNome } from "@/lib/rascunho";
import { SEVERIDADES } from "@/lib/severidade";
import { DIAS } from "@/lib/semana";
import { problemaDasFaixas, type Faixa } from "@/lib/horario";
import { fichaSchema, type Ficha } from "@/types/ficha";

/** A ESPINHA DO PAINEL: um registro declarado de campos, e uma porta só que
 *  grava qualquer um deles.
 *
 *  🔴 POR QUE REGISTRO E NÃO UM `if` (nem um array de nomes). Até 2026-09-26
 *  isto era `CAMPOS_EDITAVEIS = ["voz"]` — uma lista escrita à mão. Este
 *  projeto já pagou TRÊS vezes pela mesma doença: lista à mão fica cega ao que
 *  cresceu, e o campo novo nasce invisível com a suíte verde. O remédio não é
 *  cuidado, é PROVA: `tests/lib/campos-da-ficha.test.ts` caminha o
 *  `fichaSchema` até as FOLHAS e compara contra este registro. Campo novo no
 *  schema passa a nascer editável ou nascer justificado — nunca esquecido.
 *
 *  O que NÃO entra, e por quê, está em `FORA_DE_PROPOSITO` no arquivo de teste
 *  (motivo escrito ao lado de cada um) e na §2.1 do desenho. */

/** A espécie decide O INSTRUMENTO da tela, não o tipo em TypeScript.
 *
 *  - `prosa` — caixa de texto.
 *  - `lista` — escolher de lista fechada; **nunca digitar**. Sempre com
 *    `opcoes`: três delas vêm de `PISOS`/`DIAS`/`SEVERIDADES`, e `custo.tag` tem
 *    a lista LITERAL aqui mesmo, 80 linhas abaixo — dívida da Task 1, e dizer
 *    que nenhuma é cópia repetida era falso.
 *  - `booleano` — interruptor, com a frase que ele vira na tela ao lado.
 *  - `faixas` — o HORÁRIO inteiro (Tarefa 11c): uma lista de 1 a 3 faixas
 *    `{abre, fecha}`, gravada de uma vez — a gravação SUBSTITUI a lista. As
 *    regras (ordem, sobreposição, 24h só sozinha) são de `problemaDasFaixas`,
 *    em `horario.ts`. O "não sei" tira a chave, e é o único caminho até "sem
 *    horário": `[]` é recusado.
 *  - `numero` — número DE MOTOR (limiar de chuva, janelas): a tela mostra a
 *    consequência ao vivo antes de gravar.
 *  ⚠️ `hora` e `bloco` existiram até a Tarefa 11d: eram as duas folhas do
 *    `horario` (`horario.abre`/`.fecha`) e o objeto delas, editados folha a
 *    folha. O horário virou a lista acima (11c: dado, registro e porta; 11d: a
 *    tela), e as duas espécies saíram do tipo — junto com o `EditorHora`, o
 *    `EditorBloco` e a maquinaria de bloco da tela. A emenda está em
 *    `docs/superpowers/2026-09-27-rulings-painel-completo.md`.
 *  - `coord` — editado no MAPA, com pin arrastado. Duas formas convivem aqui
 *    de propósito, porque o schema as declara diferentes: `condicao.coords` é
 *    o PAR (`{lat, lng}`) e `trajeto.waypoints[].lat`/`.lng` são as METADES
 *    (números soltos). Quem grava não precisa distinguir — o
 *    `fichaSchema.parse` da porta recusa a forma errada no caminho errado. */
export type EspecieCampo = "prosa" | "lista" | "booleano" | "numero" | "coord" | "faixas";

/** O bloco em que o campo aparece na tela do painel. Os nomes seguem os blocos
 *  que a ficha pública já tem (`src/app/[slug]/page.tsx`): `acesso`, `avisos`,
 *  `piso` e o trajeto moram todos dentro do bloco Trajeto, por isso `chegar`. */
export type GrupoDaFicha = "voz" | "chegar" | "custo" | "quando" | "condicao" | "discriminador";

export type CampoDaFicha = {
  /** Caminho até a folha, com `.` entre os degraus. Pode ser um MOLDE: o
   *  `[]` em `trajeto.waypoints[].nome` significa "qualquer índice". */
  caminho: string;
  especie: EspecieCampo;
  /** O schema exige esta chave DENTRO do pai dela. Obrigatório não tem
   *  "não sei" (§4.2 do desenho). */
  obrigatorio: boolean;
  grupo: GrupoDaFicha;
  opcoes?: readonly string[];
};

export type ValorDeCampo =
  | string
  | number
  | boolean
  | readonly string[]
  | { lat: number; lng: number }
  | readonly Faixa[];

/** A marca de "qualquer índice" dentro de um caminho. */
const MOLDE = "[]";

/** 🔴 OS WAYPOINTS ENTRAM COMO MOLDE, NÃO COMO LISTA DE ÍNDICES. Quantos
 *  waypoints uma ficha tem é DADO, não código: escrever
 *  `trajeto.waypoints.7.nome` aqui seria cravar no código um número que mora
 *  no banco. Quem expande o molde para os índices que uma ficha realmente tem
 *  é `camposDaFicha(ficha)`. */
// 🔴 O tipo é anotado à mão (`readonly CampoDaFicha[]`) DE PROPÓSITO, e o
// `satisfies` fica junto: sem a anotação, o `as const` vaza a união de 29
// literais pra fora do módulo e todo chamador que tenha um `string` na mão
// (um caminho vindo do corpo de um `PUT`, uma chave de `Map` num teste) para
// de compilar. O `satisfies` é quem continua conferindo cada entrada.
export const CAMPOS_DA_FICHA: readonly CampoDaFicha[] = [
  // — o que o lugar é, na voz de quem foi —
  { caminho: "rotulo_escaneio", especie: "prosa", obrigatorio: true, grupo: "voz" },
  { caminho: "promessa", especie: "prosa", obrigatorio: true, grupo: "voz" },
  { caminho: "voz", especie: "prosa", obrigatorio: true, grupo: "voz" },
  { caminho: "premio", especie: "prosa", obrigatorio: true, grupo: "voz" },

  // — como se chega, e o que se encontra no caminho —
  // 🔴 A CIDADE (Tarefa 11b) abre o grupo: é o que separa dois lugares de mesmo
  // nome. `obrigatorio: true` aqui e opcional no schema — a divergência é
  // declarada, com o motivo, em `OBRIGATORIO_SO_NO_REGISTRO` no teste deste
  // registro. Obrigatória quer dizer: sem "não sei", e o lugar novo nasce com ela.
  { caminho: "cidade", especie: "prosa", obrigatorio: true, grupo: "chegar" },
  // O molde: `[]` é "qualquer índice". `nome`/`lat`/`lng` são obrigatórios
  // DENTRO do waypoint; `nota` não é.
  { caminho: "trajeto.waypoints[].nome", especie: "prosa", obrigatorio: true, grupo: "chegar" },
  { caminho: "trajeto.waypoints[].lat", especie: "coord", obrigatorio: true, grupo: "chegar" },
  { caminho: "trajeto.waypoints[].lng", especie: "coord", obrigatorio: true, grupo: "chegar" },
  { caminho: "trajeto.waypoints[].nota", especie: "prosa", obrigatorio: false, grupo: "chegar" },
  { caminho: "acesso", especie: "prosa", obrigatorio: true, grupo: "chegar" },
  { caminho: "avisos", especie: "prosa", obrigatorio: true, grupo: "chegar" },
  { caminho: "piso", especie: "lista", obrigatorio: false, grupo: "chegar", opcoes: PISOS },
  { caminho: "carroComum", especie: "booleano", obrigatorio: false, grupo: "chegar" },

  // — o que custa —
  { caminho: "custo.tag", especie: "lista", obrigatorio: true, grupo: "custo", opcoes: ["gratis", "pago"] },
  { caminho: "custo.valor", especie: "prosa", obrigatorio: false, grupo: "custo" },
  { caminho: "custo.curto", especie: "prosa", obrigatorio: false, grupo: "custo" },

  // — quando dá pra ir —
  // 🔴 O HORÁRIO INTEIRO É UMA ENTRADA (Tarefa 11c, 2026-10-04): a lista de 1 a
  // 3 faixas, gravada de uma vez — "fecha pro almoço" são duas faixas que só
  // fazem sentido juntas. Até a 11c era um BLOCO com as duas folhas editadas
  // uma a uma (ruling H1); as emendas da 11c e da 11d estão em
  // `docs/superpowers/2026-09-27-rulings-painel-completo.md`.
  // É esta entrada que carrega o "não sei": sem ela não existiria caminho
  // nenhum pra dizer "este lugar não fecha por horário" — e a régua do app
  // (`src/types/ficha.ts`, e `fechadoAgora` em `src/lib/horario.ts`) é que ficha sem horário
  // NUNCA fecha. A régua tem que ser alcançável do celular.
  { caminho: "horario", especie: "faixas", obrigatorio: false, grupo: "quando" },
  { caminho: "dias", especie: "lista", obrigatorio: false, grupo: "quando", opcoes: DIAS },

  // — o que a chuva faz aqui —
  { caminho: "condicao.coords", especie: "coord", obrigatorio: true, grupo: "condicao" },
  { caminho: "condicao.regra.janela_previsao_horas", especie: "numero", obrigatorio: true, grupo: "condicao" },
  { caminho: "condicao.regra.janela_passado_horas", especie: "numero", obrigatorio: true, grupo: "condicao" },
  { caminho: "condicao.regra.limiar_mm", especie: "numero", obrigatorio: true, grupo: "condicao" },
  { caminho: "condicao.severidade", especie: "lista", obrigatorio: true, grupo: "condicao", opcoes: SEVERIDADES },
  { caminho: "condicao.regra_texto", especie: "prosa", obrigatorio: true, grupo: "condicao" },
  { caminho: "condicao.ressalva_proxy", especie: "prosa", obrigatorio: true, grupo: "condicao" },
  { caminho: "secaRapido", especie: "prosa", obrigatorio: false, grupo: "condicao" },

  // — o que se olha na entrada pra decidir —
  { caminho: "discriminador.formato", especie: "prosa", obrigatorio: true, grupo: "discriminador" },
  { caminho: "discriminador.como_ler", especie: "prosa", obrigatorio: true, grupo: "discriminador" },
  { caminho: "discriminador.permissao_abortar", especie: "prosa", obrigatorio: true, grupo: "discriminador" },
] as const satisfies readonly CampoDaFicha[];

/** `trajeto.waypoints.2.nome` → `trajeto.waypoints[].nome`. Todo degrau que é
 *  só dígitos vira `[]` colado no degrau anterior. */
function moldeDe(caminho: string): string {
  let saida = "";
  for (const degrau of caminho.split(".")) {
    if (/^\d+$/.test(degrau)) saida += MOLDE;
    else saida += saida === "" ? degrau : `.${degrau}`;
  }
  return saida;
}

/** Acha a entrada do registro para um caminho — CONCRETO ou molde.
 *
 *  ⚠️ A entrada devolvida é a do registro, então `.caminho` de um waypoint vem
 *  com `[]`, não com o índice que você pediu. Quem precisa do caminho concreto
 *  já o tem em mãos; quem precisa da lista concreta chama `camposDaFicha`. */
export function campoPorCaminho(caminho: string): CampoDaFicha | undefined {
  const exato = CAMPOS_DA_FICHA.find((c) => c.caminho === caminho);
  if (exato) return exato;
  const molde = moldeDe(caminho);
  return CAMPOS_DA_FICHA.find((c) => c.caminho === molde);
}

/** O VALOR NUM CAMINHO, ou `undefined`. Índice de lista entra como degrau
 *  normal (`arr["0"]` é `arr[0]`).
 *
 *  🔴 EXPORTADO NA TAREFA 6 (autorizado no A7 do brief), e o que ele apagou:
 *  `FichaInteira.tsx` tinha um irmão de 7 linhas, o MESMO algoritmo, e a revisão
 *  da Tarefa 5 mediu que os dois concordavam em 90 caminhos concretos + 22 casos
 *  de borda. Duas respostas para a mesma pergunta é dívida — e a Tarefa 6 ia
 *  precisar ler valor de novo, em mais um lugar. Uma pergunta, uma resposta. */
export function lerCaminho(raiz: unknown, degraus: readonly string[]): unknown {
  let no: unknown = raiz;
  for (const degrau of degraus) {
    if (typeof no !== "object" || no === null) return undefined;
    no = (no as Record<string, unknown>)[degrau];
  }
  return no;
}

/** O registro com os MOLDES EXPANDIDOS para os waypoints que ESTA ficha tem.
 *
 *  🔴 É esta função que as telas iteram — nunca `CAMPOS_DA_FICHA` cru, que
 *  traz `[]` no lugar do índice e não dá pra gravar. Uma ficha com 3
 *  waypoints devolve 3 conjuntos; nenhum `[]` sobra na saída. */
export function camposDaFicha(ficha: Ficha): CampoDaFicha[] {
  const saida: CampoDaFicha[] = [];
  const jaExpandidos = new Set<string>();

  for (const campo of CAMPOS_DA_FICHA) {
    const corte = campo.caminho.indexOf(MOLDE);
    if (corte < 0) {
      saida.push(campo);
      continue;
    }
    // Os moldes de uma mesma lista são expandidos JUNTOS, na posição do
    // primeiro: o painel mostra o waypoint 0 inteiro, depois o 1 inteiro —
    // não todos os nomes e depois todas as latitudes.
    const prefixo = campo.caminho.slice(0, corte);
    if (jaExpandidos.has(prefixo)) continue;
    jaExpandidos.add(prefixo);

    const lista = lerCaminho(ficha, prefixo.split("."));
    if (!Array.isArray(lista)) throw new Error(`\`${prefixo}\` não é uma lista nesta ficha`);

    const moldes = CAMPOS_DA_FICHA.filter((c) => c.caminho.startsWith(prefixo + MOLDE));
    for (let i = 0; i < lista.length; i++) {
      for (const molde of moldes) {
        saida.push({ ...molde, caminho: `${prefixo}.${i}${molde.caminho.slice(corte + MOLDE.length)}` });
      }
    }
  }
  return saida;
}

function exigirCampo(caminho: string): CampoDaFicha {
  if (caminho.includes(MOLDE)) {
    throw new Error(`\`${caminho}\` é o molde, não um campo: diga o índice (\`trajeto.waypoints.0.nome\`)`);
  }
  const campo = campoPorCaminho(caminho);
  // 🔴 LISTA BRANCA, e é de propósito. Sem ela, um corpo com `{"campo":"slug"}`
  // renomearia o lugar e quebraria todo link que já circula.
  if (!campo) throw new Error(`campo fora do registro do painel: \`${caminho}\``);
  return campo;
}

/** 🔴 A REGRA MAIS IMPORTANTE DESTE ARQUIVO: `""` NUNCA CHEGA AO DOCUMENTO.
 *
 *  Caixa vazia é ERRO DE PREENCHIMENTO; "não sei" é outra ação, e ela REMOVE a
 *  chave (`removerCampo`). Medido em `src/app/[slug]/page.tsx:105`:
 *  `ficha.custo.curto ?? precoCurto` — o `??` não pega string vazia, então
 *  gravar `""` deixaria o chip EM BRANCO na ficha pública em vez de cair no
 *  preço. Vale pra todo campo opcional, e só-espaços conta como vazia. */
function recusarVazio(caminho: string, valor: ValorDeCampo): void {
  const vazia = (v: unknown) => typeof v === "string" && v.trim() === "";
  // A cidade não tem "não sei" (M-N3 da re-revisão da 11b): a frase de baixo
  // mandaria dizê-lo. A dela é a do POST.
  if (caminho === "cidade" && vazia(valor)) throw new Error(CIDADE_VAZIA);
  if (vazia(valor) || (Array.isArray(valor) && valor.some(vazia))) {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    throw new Error(`caixa vazia em \`${caminho}\`: escreva algo, ou diga "não sei" (que tira o campo)`);
  }
}

/** 🔴 A CIDADE SEM LETRA NEM NÚMERO (`"--"`) NÃO ENTRA, EM PORTA NENHUMA (onda de
 *  fix da Tarefa 11b, X3). O POST do lugar novo já a recusava; as portas de
 *  responder (o rascunho e a ficha no ar) a gravavam, e ela aparecia na tela
 *  pública — "Nome — -- · BatePerna" no título do link — e parava de separar
 *  dois lugares pelo par. A frase é a MESMA do POST. Chamada pelos dois
 *  caminhos de escrita de folha (`aplicarCampo` e `validarFolha`). */
function recusarCidadeSemLetra(caminho: string, valor: unknown): void {
  if (caminho === "cidade" && typeof valor === "string" && slugDoNome(valor) === "") {
    throw new Error(CIDADE_SEM_LETRA);
  }
}

/** A recusa de índice que a lista não tem — uma frase só, pra `escrever` e pra
 *  `tirarEtapa` (onda de conserto 1 da Tarefa 10: pedir o Ponto 2 de um trajeto
 *  de um ponto respondia com a frase do LUGAR, que fala de outra coisa). */
const itemInexistente = (i: number, tem: number): string => `não existe o item ${i} nesta lista (ela tem ${tem})`;

/** Escreve (ou apaga) a folha de `degraus` devolvendo uma cópia — NUNCA muta o
 *  que recebeu. Só os objetos do caminho tocado são copiados; os irmãos saem
 *  pela mesma referência, que é o que faz "só o campo pedido muda". */
/*  `criar` (Tarefa 11) só é `true` no RASCUNHO: lá o documento é incompleto por
    natureza, e responder `custo.curto` antes de `custo.tag` tem de criar o
    `custo`. Na ficha que está no ar ele é sempre `false`, e o degrau ausente
    continua recusado como sempre foi (ver o comentário do `filho === undefined`). */
function escrever(
  no: unknown,
  degraus: readonly string[],
  valor: unknown,
  remover: boolean,
  criar = false,
): unknown {
  const [degrau, ...resto] = degraus;

  if (Array.isArray(no)) {
    if (!/^\d+$/.test(degrau)) throw new Error(`\`${degrau}\` não é índice de uma lista`);
    const i = Number(degrau);
    // Índice que não existe não é criado: waypoint novo é outra ação, e
    // inventar um aqui gravaria uma etapa vazia no trajeto de um lugar real.
    if (i >= no.length) throw new Error(itemInexistente(i, no.length));
    if (resto.length === 0) throw new Error("remover ou trocar um item inteiro da lista não passa por aqui");
    const copia = no.slice();
    copia[i] = escrever(no[i], resto, valor, remover, criar);
    return copia;
  }

  if (typeof no !== "object" || no === null) throw new Error(`\`${degrau}\` não cabe: o degrau acima não é um objeto`);
  const copia = { ...(no as Record<string, unknown>) };

  if (resto.length === 0) {
    if (remover) delete copia[degrau];
    else copia[degrau] = valor;
    return copia;
  }

  const filho = copia[degrau];
  if (filho === undefined) {
    // Nada a remover num bloco que já não existe.
    if (remover) return no;
    // 🔴 AQUI HAVIA UM CAMINHO QUE NUNCA DAVA CERTO, e a revisão de 2026-09-26
    // mediu: ele criava `{}` para o degrau ausente e deixava o
    // `fichaSchema.parse` decidir — só que um objeto com UMA folha nunca passa
    // no schema (era o `horario` sem `fecha`, `Required`), então a gravação
    // estourava SEMPRE, com um ZodError cru. Na ficha no ar o degrau ausente é
    // recusado aqui; o horário, que era o caso, virou uma entrada só (11c).
    //
    // 🔴 E NO RASCUNHO (`criar`) o degrau ausente NASCE como objeto vazio — lá
    // não há schema do documento inteiro a satisfazer, e cada folha já foi
    // conferida contra o tipo dela antes de chegar aqui. Item de LISTA nunca
    // nasce, nem no rascunho: um `{}` no lugar de um índice viraria um objeto
    // com chave `"0"`, não um waypoint.
    if (criar && !/^\d+$/.test(resto[0])) {
      copia[degrau] = escrever({}, resto, valor, remover, criar);
      return copia;
    }
    throw new Error(`\`${degrau}\` não existe neste documento`);
  }
  copia[degrau] = escrever(filho, resto, valor, remover, criar);
  return copia;
}

/** O pedaço do `_def` do zod que este arquivo precisa ler. O zod não exporta
 *  um tipo pra isso; a alternativa seria `any` espalhado. */
type DefZod = {
  typeName: string;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  shape?: () => Record<string, z.ZodTypeAny>;
};

function desembrulhar(tipo: z.ZodTypeAny): z.ZodTypeAny {
  const d = tipo._def as unknown as DefZod;
  if (d.typeName === "ZodOptional" || d.typeName === "ZodNullable" || d.typeName === "ZodDefault") {
    return desembrulhar(d.innerType as z.ZodTypeAny);
  }
  return tipo;
}

/** O tipo Zod que o `fichaSchema` declara para UM caminho concreto.
 *
 *  Existe pra `validarFolha` conferir uma folha do RASCUNHO (que não passa
 *  pelo schema do documento inteiro) contra a FONTE, não contra uma cópia da
 *  regra — repetir aqui um formato do schema seria a espécie "duas fontes pra
 *  mesma pergunta", que este projeto já pagou. */
function tipoNoCaminho(caminho: string): z.ZodTypeAny | undefined {
  let atual: z.ZodTypeAny | undefined = fichaSchema;
  for (const degrau of caminho.split(".")) {
    if (!atual) return undefined;
    const nu = desembrulhar(atual);
    const d = nu._def as unknown as DefZod;
    if (d.typeName === "ZodObject") atual = d.shape!()[degrau];
    else if (d.typeName === "ZodArray") atual = /^\d+$/.test(degrau) ? d.type : undefined;
    else return undefined;
  }
  return atual;
}

/** Confere UMA folha contra a regra que o schema declara pra ela, e estoura
 *  NOMEANDO a folha. O ZodError fica aqui dentro: quem lê a recusa é o dono do
 *  app, e `invalid_string` não diz a ele qual das duas horas está errada. */
function validarFolha(caminho: string, valor: unknown): void {
  recusarVazio(caminho, valor as ValorDeCampo);
  recusarCidadeSemLetra(caminho, valor);
  const tipo = tipoNoCaminho(caminho);
  if (!tipo) throw new Error(`\`${caminho}\` não existe no fichaSchema`);
  if (desembrulhar(tipo).safeParse(valor).success) return;
  const especie = campoPorCaminho(caminho)?.especie ?? "campo";
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
  throw new Error(`\`${caminho}\` não serve: este campo é do tipo \`${especie}\``);
}

/** 🔴 O HORÁRIO ENTRA INTEIRO, E SUBSTITUI O QUE HAVIA (Tarefa 11c). A
 *  conferência é a de `problemaDasFaixas` — a fonte única das regras de uma
 *  lista de faixas — e estoura `Error` com a frase dela, nunca um ZodError cru
 *  (que a rota devolveria como 400 mudo). Devolve a lista só com as duas horas
 *  de cada faixa: o rascunho não passa pelo schema, que é quem tiraria o resto.
 *
 *  ⚠️ Antes da 11c o horário era um BLOCO que voltava inteiro só quando
 *  AUSENTE e, presente, se editava folha a folha (ruling H1 emendado). A
 *  edição folha a folha deixou de existir: com intervalo, abre e fecha de cada
 *  faixa dependem um do outro, e a lista é o campo. */
function conferirFaixas(valor: unknown): Faixa[] {
  const problema = problemaDasFaixas(valor);
  if (problema !== null) throw new Error(problema);
  return (valor as Faixa[]).map(({ abre, fecha }) => ({ abre, fecha }));
}

/** Grava UM campo sobre o documento atual e devolve o JSON novo.
 *
 *  🔴 REVALIDA O DOCUMENTO INTEIRO, não só o campo: esta é a porta que impede
 *  um formulário de gravar ficha quebrada, e ela é a única. Estoura em vez de
 *  devolver algo meio certo — quem chama traduz o estouro em 400.
 *
 *  O `caminho` é CONCRETO (`trajeto.waypoints.0.nome`), nunca o molde. */
export function aplicarCampo(docAtual: string, caminho: string, valor: ValorDeCampo): string {
  const campo = exigirCampo(caminho);

  if (campo.especie === "faixas") {
    const faixas = conferirFaixas(valor);
    const atual = fichaSchema.parse(JSON.parse(docAtual));
    return JSON.stringify(fichaSchema.parse(escrever(atual, caminho.split("."), faixas, false)));
  }

  recusarVazio(caminho, valor);
  recusarCidadeSemLetra(caminho, valor);
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  return JSON.stringify(fichaSchema.parse(escrever(atual, caminho.split("."), valor, false)));
}

/** Grava a COORDENADA INTEIRA de um ponto do trajeto — `lat` e `lng` juntas,
 *  numa versão só — e devolve o JSON novo (Tarefa 8, onda de conserto 1, R1).
 *
 *  🔴 POR QUE ISTO EXISTE AO LADO DE `aplicarCampo`: o ponto guarda a
 *  coordenada em DUAS folhas, e gravar cada uma num `PUT` deixava uma janela em
 *  que o documento no ar tinha a latitude nova com a longitude velha — um ponto
 *  que ninguém escolheu, publicado pela ficha `force-dynamic` na hora, se a rede
 *  caísse entre os dois. Aqui as duas folhas entram no MESMO documento, ou
 *  nenhuma.
 *
 *  O índice tem de existir: isto não cria ponto (acrescentar etapa é outra
 *  ação, e o `escrever` recusa com frase). Faixa e finitude são do schema
 *  (`latSchema`/`lngSchema`), que revalida o documento inteiro como em toda
 *  forma de escrita. O `indice` chega já conferido como inteiro ≥ 0 pela rota. */
export function gravarPonto(docAtual: string, indice: number, lat: number, lng: number): string {
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  const base = ["trajeto", "waypoints", String(indice)];
  const comLat = escrever(atual, [...base, "lat"], lat, false);
  return JSON.stringify(fichaSchema.parse(escrever(comLat, [...base, "lng"], lng, false)));
}

/** A RECUSA QUE NÃO É DE FORMA, É DO TRAJETO DE AGORA — e por isso vira 409, não
 *  400 (Tarefa 10). A rota a reconhece pela CLASSE e devolve a `message` com
 *  409, no padrão das recusas da coerência: o pedido estava bem escrito, mas
 *  pede algo que este trajeto não deixa (tirar o lugar; tirar um ponto que não é
 *  o último — o que acontece quando a tela do dono está velha e o trajeto já
 *  mudou por outro aparelho).
 *
 *  ⚠️ Subclasse de `Error` DE PROPÓSITO: o `recusar400` da rota só deixa vazar
 *  `message` de `Error` exato, então se a rota esquecer de tratar esta classe a
 *  frase NÃO vaza por acidente com o código errado — vira 400 vazio, e o teste
 *  que exige 409 com a frase fica vermelho. */
export class RecusaDoTrajeto extends Error {}

/** 🔴 O PONTO 1 É O LUGAR. `waypoints[0]` é o que a home mostra, o pin do mapa,
 *  a ordem do acervo e a distância — tirá-lo pela ação de "tirar o último"
 *  trocaria o lugar pela primeira etapa do caminho até ele, em silêncio, em
 *  todas as telas. "Ponto 1" é a palavra do painel (`FichaInteira`), que conta
 *  os pontos a partir de 1. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const RECUSA_TIRAR_O_LUGAR = "O Ponto 1 é o próprio lugar: ele não sai do trajeto.";

/** ACRESCENTA UM PONTO NO FIM do trajeto e devolve o JSON novo (Tarefa 10).
 *
 *  🔴 SÓ NO FIM, e nunca antes do `[0]`: o primeiro ponto é O LUGAR, e um ponto
 *  inserido no início viraria o nome da home, o pin e a distância.
 *
 *  🔴 A COORDENADA É A QUE O DONO MARCOU NO MAPA, e chega no corpo. Até a onda de
 *  conserto 1 ela era COPIADA do último ponto (ruling C1 do brief, trocada pelo
 *  próprio orquestrador): a ficha pública imprimia a cópia como fato Nível A, com
 *  "Abrir no mapa", e na primeira etapa a cópia era a do PRÓPRIO destino — o app
 *  afirmando uma posição que ninguém deu, sem nada que a distinguisse de uma
 *  conferida. Agora não existe cópia de coordenada em lugar nenhum do caminho: a
 *  tela abre o mapa do ponto novo SEM PIN (a vista no último ponto; onda de fix 2
 *  da 11f, m-5), e o que chega aqui é o toque dele. Não há heurística de "igual
 *  à anterior" (que comeria o caso real de duas etapas no mesmo ponto: é tocar
 *  ali). Faixa e finitude são do schema, como em `gravarPonto`.
 *
 *  Sem `nota`: nada é pré-preenchido (§4.4 da spec). O nome vem do dono e é
 *  gravado como chegou; em branco é recusado com frase, como toda caixa vazia. */
export function acrescentarEtapa(docAtual: string, nome: string, lat: number, lng: number): string {
  if (nome.trim() === "") {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    throw new Error("o ponto novo precisa de um nome: escreva algo");
  }
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  const novo = { nome, lat, lng };
  return JSON.stringify(
    fichaSchema.parse({
      ...atual,
      trajeto: { ...atual.trajeto, waypoints: [...atual.trajeto.waypoints, novo] },
    }),
  );
}

/** TIRA O ÚLTIMO PONTO do trajeto e devolve o JSON novo (Tarefa 10).
 *
 *  🔴 `indice` TEM DE SER O DO ÚLTIMO, e não é redundância: é a tela dizendo QUAL
 *  ponto ela mostrou ao dono. Se o trajeto mudou por outro aparelho desde que a
 *  tela abriu, o "último" de agora é outro ponto — e tirar sem conferir apagaria
 *  um ponto que ele não viu. Recusa com frase, e o `reload` mostra o de agora.
 *
 *  🔴 E O `[0]` NUNCA SAI — nem quando é o único (onde `0` também seria "o
 *  último"): ver `RECUSA_TIRAR_O_LUGAR`. Nada se perde de verdade: a versão
 *  anterior fica em `ficha_versoes`, e "voltar" a devolve. */
export function tirarEtapa(docAtual: string, indice: number): string {
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  const pontos = atual.trajeto.waypoints;
  // A ORDEM DAS TRÊS RECUSAS: o lugar primeiro (o `0` é sempre o lugar, até
  // num trajeto de um ponto, onde ele também seria "o último"); depois o ponto
  // que não existe (400, a frase de item inexistente — é pedido errado, não
  // conflito); e por fim o ponto que existe mas não é o último (409).
  if (indice < 1) throw new RecusaDoTrajeto(RECUSA_TIRAR_O_LUGAR);
  if (indice >= pontos.length) throw new Error(itemInexistente(indice, pontos.length));
  if (indice !== pontos.length - 1) {
    throw new RecusaDoTrajeto(
      // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
      `Só o último ponto sai: este trajeto tem ${pontos.length} pontos, e o último é o Ponto ${pontos.length}.`,
    );
  }
  return JSON.stringify(
    fichaSchema.parse({ ...atual, trajeto: { ...atual.trajeto, waypoints: pontos.slice(0, -1) } }),
  );
}

/** O "NÃO SEI": tira a chave do documento em vez de gravar vazio, e o app
 *  passa a CALAR sobre aquilo. Campo obrigatório não tem "não sei" (§4.2).
 *  Termina na mesma porta — o documento sem a chave tem que continuar válido. */
export function removerCampo(docAtual: string, caminho: string): string {
  recusarNaoSeiObrigatorio(caminho);
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  return JSON.stringify(fichaSchema.parse(escrever(atual, caminho.split("."), undefined, true)));
}

/** A recusa do "não sei" num campo obrigatório — uma frase só, pra ficha no ar
 *  (`removerCampo`) e pro rascunho (`tirarDoRascunho`). */
function recusarNaoSeiObrigatorio(caminho: string): void {
  const campo = exigirCampo(caminho);
  if (!campo.obrigatorio) return;
  // 🔴 A CIDADE (M-N3 da re-revisão da 11b): a frase de baixo diria que sem ela
  // "a ficha não existe" — falso, as fichas de antes da 11b existem sem ela. A
  // dela é a do POST, que diz por que ela é pedida.
  if (caminho === "cidade") throw new Error(CIDADE_VAZIA);
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
  throw new Error(`\`${caminho}\` é obrigatório: sem ele a ficha não existe, então não tem "não sei"`);
}

// ═══════════════════════════════════════════════════════════════════════════
// O RASCUNHO (Tarefa 11) — as mesmas três escritas, sobre documento INCOMPLETO.
//
// 🔴 POR QUE UMA VARIANTE, E NÃO `aplicarCampo` (E6 da auditoria, MEDIDO antes
// de escrever): as três escritas da ficha no ar começam por
// `fichaSchema.parse(JSON.parse(docAtual))`, e um rascunho recém-nascido
// (`{slug, modos, trajeto}`) não passa — `aplicarCampo(rascunho, "voz", …)`
// estoura `Required` sobre `rotulo_escaneio`, `promessa`, `condicao`… antes de
// tocar a voz. Rascunho incompleto é o estado normal, não um erro.
//
// O QUE AS VARIANTES MANTÊM, campo a campo: a lista branca do registro
// (`exigirCampo` — `slug` e `modos` não são perguntas), a caixa vazia recusada
// (`""` nunca chega ao documento), o TIPO de cada folha conferido contra o
// schema (`validarFolha` — um `piso` inventado não entra nem no rascunho, porque
// o formulário não teria instrumento pra relê-lo), o horário conferido pelas
// MESMAS regras da ficha no ar (`conferirFaixas`), e o "não sei" que não existe
// em campo obrigatório.
//
// O QUE ELAS NÃO FAZEM, de propósito: o `fichaSchema.parse` do documento
// inteiro e o portão de coerência. Os dois são de PUBLICAR (Tarefa 12), que é
// quando o rascunho passa a afirmar alguma coisa.
// ═══════════════════════════════════════════════════════════════════════════

/** O documento do rascunho, que tem de ser um OBJETO — e nada mais se exige. */
function abrirRascunho(docAtual: string): Record<string, unknown> {
  const doc: unknown = JSON.parse(docAtual);
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    throw new Error("o rascunho guardado não é um documento");
  }
  return doc as Record<string, unknown>;
}

/** `aplicarCampo` sobre o rascunho: grava UMA resposta e devolve o JSON novo. */
export function aplicarNoRascunho(docAtual: string, caminho: string, valor: ValorDeCampo): string {
  const campo = exigirCampo(caminho);
  // 🔴 MEIA COORDENADA (onda de conserto 1 da Tarefa 11): a coordenada do ponto
  // entra como PAR, por `gravarPontoNoRascunho`. Uma folha sozinha deixaria o
  // rascunho com latitude sem longitude — a janela que a Tarefa 8 (R1) fechou
  // na ficha no ar.
  if (/^trajeto\.waypoints\.\d+\.(lat|lng)$/.test(caminho)) {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    throw new Error("a coordenada do ponto entra inteira: a latitude e a longitude juntas, no mesmo Salvar");
  }
  const atual = abrirRascunho(docAtual);
  if (campo.especie === "faixas") {
    return JSON.stringify(escrever(atual, caminho.split("."), conferirFaixas(valor), false, true));
  }

  validarFolha(caminho, valor);
  return JSON.stringify(escrever(atual, caminho.split("."), valor, false, true));
}

/** `removerCampo` sobre o rascunho: o "não sei", que tira a resposta. */
export function tirarDoRascunho(docAtual: string, caminho: string): string {
  recusarNaoSeiObrigatorio(caminho);
  return JSON.stringify(escrever(abrirRascunho(docAtual), caminho.split("."), undefined, true));
}

/** `gravarPonto` sobre o rascunho: a coordenada INTEIRA do ponto, as duas
 *  metades juntas. O ponto tem de existir (o `[0]` nasce com o nome); a faixa
 *  e a finitude são as do schema, conferidas folha a folha. */
export function gravarPontoNoRascunho(docAtual: string, indice: number, lat: number, lng: number): string {
  const base = ["trajeto", "waypoints", String(indice)];
  validarFolha([...base, "lat"].join("."), lat);
  validarFolha([...base, "lng"].join("."), lng);
  const comLat = escrever(abrirRascunho(docAtual), [...base, "lat"], lat, false);
  return JSON.stringify(escrever(comLat, [...base, "lng"], lng, false));
}
