import type { Estado } from "@/lib/motor";

/** COM QUE FORÇA esta trilha fala quando choveu.
 *
 *  🔴 POR QUE ELE EXISTE (2026-09-10). O carimbo tinha DUAS palavras pro acervo
 *  inteiro, e elas vinham de bocas diferentes: `"Não vá"` é a `voz` da Rampa do
 *  Pepê (*"é barro: molhou, não vá"*), e `"barro · dá um tempo"` era paráfrase
 *  minha da `voz` da Pedra Furada (*"espera passar umas 3 horas"*). As duas
 *  eram aplicadas à Véu de Noiva, que tem uma terceira fala, mais branda — e
 *  perguntado direto, ele respondeu: ***"com chuva dá pra ir sim, com
 *  cuidado"***. Três lugares, três severidades, uma língua só.
 *
 *  É a mesma espécie que `secaRapido`, `piso`/`CHUVA_NO_PISO` e
 *  `discriminador.formato` já desarmaram, uma camada acima: ali era um FATO de
 *  um lugar escrito num componente que serve todos; aqui é a VOZ de um lugar
 *  virando a língua de todos.
 *
 *  A régua do projeto decide o corte: **qual nível** é fato do LUGAR e mora na
 *  ficha (`condicao.severidade`), escrito por quem conhece o lugar; **as
 *  palavras** de cada nível moram aqui, uma vez, pra nenhuma ficha poder
 *  inventar prosa de carimbo por conta própria. Mesmo molde do `CHUVA_NO_PISO`
 *  em `src/lib/piso.ts`.
 *
 *  Puro de propósito, sem zod e sem `node:fs`, pela mesma razão que `piso.ts`:
 *  client components leem este módulo direto. `src/types/ficha.ts` monta o
 *  `z.enum` A PARTIR de `SEVERIDADES` — nunca o contrário. */
export const SEVERIDADES = ["nao-va", "espera", "cuidado"] as const;

export type Severidade = (typeof SEVERIDADES)[number];

/** As duas linhas do carimbo no ramo MOLHADO: a palavra grande e a linha de
 *  baixo. O ramo seco não é assunto deste módulo — ele é o mesmo em todo o
 *  acervo ("Pode ir" / "seco · carro comum"), e continua em `carimbo-fase.ts`. */
export type Fala = { marca: string; sub: string };

/** 🔴 A PROCEDÊNCIA DE CADA PALAVRA, e ela é o conteúdo deste arquivo — não um
 *  comentário decorativo. Quem mexer numa string aqui está trocando a voz de um
 *  lugar real, e precisa da palavra DELE pra fazer isso.
 *
 *  - **`nao-va`** — `"Não vá"` é fala literal dele (`voz` da Rampa), e ele ainda
 *    ESCOLHEU essa palavra entre três saídas em 2026-08-27. É o texto mais bem
 *    procedido do app. `"barro · dá um tempo"` é o que estava no ar: `barro` é
 *    material (⚠️ ver o aviso no fim deste bloco) e *"dá um tempo"* é paráfrase
 *    minha — **mantido por ora, e é o único par deste arquivo ainda pendente da
 *    palavra dele.**
 *  - **`espera`** — `Espera {n}h` é a `voz` da Pedra Furada (*"espera passar
 *    umas 3 horas"*) com o número vindo da FICHA, escolha dele em 2026-09-10.
 *    🔴 O número NUNCA é literal aqui: são 3h na Pedra Furada e **6h** na Rampa
 *    e na Véu. Escrever "3 horas" nesta tabela mentiria em duas das três fichas
 *    no dia em que nascesse.
 *  - **`cuidado`** — `"Vá com cuidado"` / `"molhado · sem pressa"` é **redação
 *    minha, escolhida por ele em 2026-09-10** entre três saídas, com a tabela de
 *    procedência à vista (a alternativa 100% dele era `"Dá pra ir"` /
 *    `"com cuidado"`, e ele não a escolheu). Aprovação registrada: a escolha
 *    entre saídas apresentadas é o ato de aprovação deste projeto.
 *
 *  ⚠️ **`barro` no `sub` do `nao-va` supõe o MATERIAL, e isso é dívida conhecida
 *  e aceita por ele em 2026-08-27, de olhos abertos.** A ficha de asfalto a
 *  quebra. Não reponha material nos outros níveis: `chuvaNoPiso` já é o dono
 *  dessa metade, e recriá-la aqui seria o `CHUVA_NO_PISO` de volta no arquivo
 *  vizinho. */
const FALA_MOLHADA: Record<Severidade, (horasPassado: number) => Fala> = {
  "nao-va": () => ({ marca: "Não vá", sub: "barro · dá um tempo" }),
  espera: (h) => ({ marca: `Espera ${h}h`, sub: "barro · dá um tempo" }),
  cuidado: () => ({ marca: "Vá com cuidado", sub: "molhado · sem pressa" }),
};

/** A VOZ desta trilha no ramo molhado: qual nível ela declara, e a janela da
 *  PRÓPRIA ficha, que o nível `espera` precisa pra dizer o número certo.
 *
 *  Um objeto e não dois parâmetros soltos: os dois só fazem sentido juntos, e
 *  soltos um call site poderia passar a severidade de uma ficha com a janela de
 *  outra sem o compilador piscar. */
export type Voz = { severidade: Severidade; horasPassado: number };

/** A voz de uma ficha, montada num lugar só.
 *
 *  🔴 Existe pra que os QUATRO componentes que precisam dela não montem o par à
 *  mão — quatro montagens é a família de defeito que este projeto já pagou três
 *  vezes (a palavra e a cor nascendo de commits diferentes). Recebe a `condicao`
 *  estruturalmente, e não a `Ficha` inteira, pra este módulo continuar sem zod. */
export function vozDaFicha(condicao: {
  severidade: Severidade;
  regra: { janela_passado_horas: number };
}): Voz {
  return { severidade: condicao.severidade, horasPassado: condicao.regra.janela_passado_horas };
}

/** O que esta trilha diz quando choveu.
 *
 *  `horasPassado` é `condicao.regra.janela_passado_horas` da PRÓPRIA ficha, e
 *  não um padrão: é ele que faz o nível `espera` dizer 3h onde são 3h e 6h onde
 *  são 6h. Passar um número de outra ficha aqui é a mentira que este parâmetro
 *  existe pra impedir. */
export function falaMolhada(severidade: Severidade, horasPassado: number): Fala {
  return FALA_MOLHADA[severidade](horasPassado);
}

/** De que COR é a leitura que está na tela.
 *
 *  🔴 A cor deixou de ser sinônimo do estado em 2026-09-10, por decisão dele
 *  (*"a cor e o grupo seguem o nível"*). Antes, `data-state` era o `Estado` cru
 *  — e com o nível `cuidado` valendo, a Véu de Noiva mostraria *"Vá com
 *  cuidado"* dentro de um retângulo VERMELHO, com pin vermelho. Palavra e cor
 *  discordando é o defeito que `Moldura.tsx` e `SeloTrilha.tsx` foram escritos
 *  pra impedir; a diferença é que desta vez ele nasceria do mesmo commit, de
 *  propósito.
 *
 *  ⚠️ **`espera` divide o vermelho com `nao-va`, e isso é escolha de desenho,
 *  não esquecimento:** a cor responde *"dá pra ir AGORA?"*, e "espera 3h" é
 *  não-agora. Se ele quiser `espera` em âmbar, é uma linha aqui e quatro no
 *  CSS. */
export type Tom = "fresco" | "frio" | "cuidado";

export function tomDe(estado: Estado, severidade: Severidade): Tom {
  if (estado === "fresco") return "fresco";
  return severidade === "cuidado" ? "cuidado" : "frio";
}
