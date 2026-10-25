import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** A BASE DA RODADA: o commit de onde a execução partiu (07/10). Frase que já
 *  existia aqui pode ter `LIDA:`; frase que nasceu DEPOIS, não (I6). */
const BASE = "cc6c467";

/** Os módulos onde as palavras desta rodada (07/10) moram. Arquivo de palavras
 *  NOVO desta rodada entra aqui; os do painel que ganharam frase também.
 *  ⚠️ Esta lista é à mão, e lista à mão é cega ao que cresce — por isso ela
 *  NÃO é a única cerca: a varredura de baixo (`arquivosDaRodada`) enumera do
 *  GIT todo arquivo de `src/` que mudou desde a base, e exige marca em toda
 *  constante de texto exportada que nasceu depois dela. A lista daqui fica
 *  porque é mais estrita: nestes arquivos, até a frase antiga precisa de marca. */
const ARQUIVOS = [
  "src/lib/origem.ts",
  "src/lib/porta-da-pessoa.ts",
  "src/lib/porta-da-regra-padrao.ts",
  "src/lib/calibrar.ts",
  "src/app/contribuir/palavras.ts",
  "src/app/admin/SecaoNaoConferidos.tsx",
  "src/app/admin/CaixaDaOrigem.tsx",
  "src/app/admin/TelaDaRegraPadrao.tsx",
  "src/app/admin/campos/EditorCalibrar.tsx",
  "src/app/BarraNavegacao.tsx",
  // Cidade do ponto (17/10): módulos NOVOS com frase. Nestes, até a antiga precisa de marca.
  "src/app/admin/AvisoDoPar.tsx",
  "src/app/admin/RevisaoDoLugar.tsx",
  "src/app/admin/MapinhaDoPonto.tsx",
  "src/lib/rotulos-das-opcoes.ts",
];

/** As constantes de texto exportadas: `export const NOME = "..."` ou
 *  `` `...` `` (uma linha, ou a abertura de uma de várias). Aspas simples também: uma frase com aspas duplas dentro (`GRUPO_LISTA_VAZIA`) as usa, e o regex só de `"` e crase não a via. */
function frasesExportadas(fonte: string): { nome: string; linha: number }[] {
  const linhas = fonte.split(/\r?\n/);
  return linhas.flatMap((l, i) => {
    const m = /^export const ([A-Z][A-Z0-9_]*)\s*(?::\s*string\s*)?=\s*(["'`]|$)/.exec(l);
    return m ? [{ nome: m[1], linha: i }] : [];
  });
}

/** A marca de uma constante: `PENDENTE` ou `LIDA:` num comentário `//` do
 *  BLOCO DE COMENTÁRIO colado em cima dela (o docblock da constante pode ficar
 *  entre ela e a marca). `PENDENTE` ganha quando as duas aparecem.
 *  🔴 O BLOCO, E NÃO "AS 3 LINHAS DE CIMA" (o brief): com constantes coladas
 *  uma na outra (`contribuir/palavras.ts`, `admin/campos/palavras.ts`), a
 *  janela de 3 linhas alcançava o `// PENDENTE` da VIZINHA de cima — tirar a
 *  marca do `MUDAR` ou do `BLOQUEAR_MESMO` SOBREVIVIA, medido. O bloco para na
 *  primeira linha que não é comentário (código, ou linha em branco). */
function marcaDe(linhas: string[], i: number): "PENDENTE" | "LIDA" | null {
  const acima = comentariosDeCima(linhas, i);
  if (acima.some((l) => /PENDENTE/.test(l))) return "PENDENTE";
  if (acima.some((l) => /LIDA:/.test(l))) return "LIDA";
  return null;
}

/** Os comentários `//` do bloco colado em cima da linha `i` (a régua de
 *  `marcaDe`, separada pra a lista datada ler a DATA da marca). */
function comentariosDeCima(linhas: string[], i: number): string[] {
  return indicesDeCima(linhas, i).map((j) => linhas[j]);
}

/** Os ÍNDICES das linhas de `comentariosDeCima` — pra cerca da data (I2)
 *  saber se uma linha `LIDA:` datada é a marca de um nome da lista. */
function indicesDeCima(linhas: string[], i: number): number[] {
  let topo = i;
  while (topo > 0 && /^\s*(\/\/|\/\*|\*)/.test(linhas[topo - 1])) topo--;
  const r: number[] = [];
  for (let j = topo; j < i; j++) if (/^\s*\/\//.test(linhas[j])) r.push(j);
  return r;
}

/** 🔴 A LISTA DATADA (Task 18, onda de copy de 13/10). O João leu o pacote
 *  "Frases de quem manda" (o banco do artifact, coleção `respostas`) e marcou
 *  "Serve" em toda frase desta rodada, menos as que ele MUDOU (essas entram
 *  com o texto dele, e as duas irmãs "ao abrir" são a proposta que ele
 *  aprovou) e a meia-linha da regra padrão, que ele mandou TIRAR.
 *
 *  O I6 continua de pé: `LIDA:` numa frase nova é recusada — SALVO nas
 *  nomeadas aqui, por arquivo, e só com a data da leitura dele na própria
 *  marca. Frase nova FORA desta lista nasce `PENDENTE`, como sempre. E a lista
 *  não apodrece calada: cada nome tem de existir no arquivo dito, ser NOVO
 *  desde a base, e estar `LIDA:` com essa data (caso abaixo).
 *
 *  ⚠️ As frases desta rodada que não são `export const` (as entradas de
 *  `FRASE_DA_PESSOA`, o `contribuidor` do histórico, o ` · não conferido` do
 *  título do link) são conferidas POR NOME nos casos do fim do arquivo, com a
 *  mesma data. */
const LIDAS_EM = "2026-10-13";
const MARCA_DA_LEITURA = new RegExp(`LIDA:.*${LIDAS_EM}`);
const LIDAS_EM_13_10: Readonly<Record<string, readonly string[]>> = {
  "src/lib/origem.ts": ["ETIQUETA_NAO_CONFERIDO", "FAIXA_NAO_CONFERIDO", "SECO_SEM_CARRO"],
  "src/lib/porta-da-pessoa.ts": [
    "CLERK_FORA", "CLERK_FORA_AO_ABRIR", "BLOQUEADA", "RASCUNHO_DELA_SUMIU", "NOME_JA_EM_USO", "JA_CONFERIDO",
    "JA_CONFERIDO_AO_ABRIR", "FALTA_DA_PESSOA", "FORA_DA_LISTA_DELA", "JA_NO_AR_DA_PESSOA", "RECUSA_DA_PESSOA",
    "ABERTURA_DA_EDICAO",
  ],
  "src/lib/porta-da-regra-padrao.ts": [
    "JANELA_NEGATIVA_PADRAO", "JANELAS_ZERADAS", "LIMIAR_SEM_CHUVA", "JANELA_ALEM_DA_PREVISAO", "JANELA_ALEM_DO_PASSADO",
  ],
  "src/lib/calibrar.ts": ["JA_TEM_REGRA"],
  "src/lib/campos-da-pessoa.ts": ["SEM_NAO_SEI", "TEXTO_LONGO_DEMAIS", "TEXTO_LONGO_DEMAIS_NO_PUBLICAR"],
  "src/app/contribuir/palavras.ts": ["TITULO_MEUS", "MANDAR_UM_LUGAR_NOVO", "CONFERIDO", "MUDAR", "TITULO_MANDAR"],
  "src/app/admin/SecaoNaoConferidos.tsx": ["TITULO_NAO_CONFERIDOS"],
  "src/app/admin/CaixaDaOrigem.tsx": ["MANDADO_POR", "CONFERI", "CONFERI_MESMO"],
  "src/app/admin/TelaDaRegraPadrao.tsx": ["SALVAR_REGRA", "VALE_PARA"],
  "src/app/admin/campos/EditorCalibrar.tsx": ["CALIBRAR", "CALIBRAR_AJUDA", "FALTA_UM_DOS_QUATRO"],
  "src/app/admin/campos/palavras.ts": ["TITULO_REGRA_PADRAO", "NAO_CONFERIU", "BLOQUEAR", "BLOQUEAR_MESMO", "DESBLOQUEAR"],
  "src/app/admin/TelaDePublicar.tsx": ["AVISO_PUBLICAR_PESSOA"],
};

/** 🔴 A SEGUNDA LISTA DATADA (onda de copy de 18/10, rodada "cidade do ponto").
 *  O João leu o pacote "Frases da cidade do ponto" (o banco do artifact,
 *  coleção `respostas`) e marcou "Serve" nas 18 constantes `PENDENTE` da rodada
 *  (a lista do relatório da Task 9). O `ENDERECO_AINDA_NAO_SAIU` entra com o
 *  texto da PROPOSTA que ele escolheu; `BUSCAR` e `CORRIGIR` são palavra dele de
 *  17/10. O molde é o da de 13/10, e cada data cerca a SUA lista: um nome desta
 *  com a marca de 13/10 (ou o contrário) não é leitura dele — é recusado. */
const LIDAS_EM_18 = "2026-10-18";
const LIDAS_EM_18_10: Readonly<Record<string, readonly string[]>> = {
  "src/app/admin/AvisoDoPar.tsx": ["CORRIGIR_O_NOME"],
  "src/app/admin/campos/EditorCoordenada.tsx": ["EM_CIDADE"],
  "src/app/admin/campos/palavras.ts": [
    "BUSCAR", "BUSCANDO", "ROTULO_DA_BUSCA", "NENHUM_ACHADO", "BUSCA_NAO_SAIU", "CIDADE_DEPOIS_DE_SALVAR",
  ],
  "src/app/admin/FormularioDeLugar.tsx": ["SEGUIR_SEM_SALVAR", "VOLTAR_A_REVISAO"],
  "src/app/admin/MapinhaDoPonto.tsx": ["MAPA_DO_PONTO"],
  "src/app/admin/RevisaoDoLugar.tsx": ["TITULO_REVISAO", "CORRIGIR"],
  "src/lib/porta-da-pessoa.ts": ["NOME_EXISTE_NA_CIDADE"],
  "src/lib/porta-de-publicar.ts": ["ENDERECO_AINDA_NAO_SAIU"],
  "src/lib/rascunho.ts": ["CIDADE_DO_PONTO_NAO_SAIU"],
  "src/lib/rotulos-das-opcoes.ts": ["ROTULO_GRATIS", "ROTULO_PAGO"],
};

/** 🔴 A TERCEIRA LISTA DATADA (onda de copy de 20/10, rodada "horário por dia").
 *  O João leu o pacote "Frases do horário por dia" (o banco do artifact, coleção
 *  `respostas`) e marcou "Serve" em todas. São as 19 constantes de texto
 *  exportadas que a rodada criou; as frases que NÃO são `export const` (o
 *  título do campo, a pergunta, as três montagens e o rótulo da caixa de hora)
 *  são conferidas POR NOME em `ALVOS_LIDOS_EM_20_10`, no fim. O molde é o das
 *  outras duas, e cada data cerca a SUA lista. */
const LIDAS_EM_20 = "2026-10-20";
const LIDAS_EM_20_10: Readonly<Record<string, readonly string[]>> = {
  "src/lib/horario.ts": [
    "GRUPO_NAO_E_LISTA", "GRUPO_LISTA_VAZIA", "GRUPO_MAIS_DE_TRES", "GRUPO_SEM_HORARIO", "GRUPO_MAL_FORMADO",
    "GRUPO_SEM_DIA", "GRUPO_DIA_DESCONHECIDO", "GRUPO_SEM_FAIXA", "GRUPO_DIA_REPETIDO", "GRUPO_DIA_REPETIDO_NO_GRUPO",
    "GRUPO_DIA_FECHADO", "GRUPO_COBRE_TUDO", "GRUPO_IGUAL_AO_HORARIO",
  ],
  "src/lib/campos-da-ficha.ts": ["TIRE_O_HORARIO_POR_DIA_ANTES"],
  "src/lib/fatos-da-trilha.ts": ["MARCA_OUTROS_DIAS"],
  "src/app/admin/campos/EditorGrupos.tsx": ["TITULO_DO_GRUPO", "MAIS_GRUPO", "TIRAR_GRUPO", "RESPONDA_O_HORARIO_PRIMEIRO"],
};

/** As frases de 20/10 que não são `export const`: arquivo, a âncora (UMA linha) e
 *  o que ela é. A marca é o bloco de comentário colado em cima da âncora. */
const ALVOS_LIDOS_EM_20_10: readonly (readonly [string, RegExp, string])[] = [
  ["src/app/admin/FichaInteira.tsx", /^\s+horarioPorDia: "Os dias com outro horário",$/, "o título do campo"],
  ["src/app/admin/novo/perguntas.ts", /^\s+horarioPorDia: "Algum dia esse lugar abre ou fecha em outra hora\?/, "a pergunta"],
  ["src/app/[slug]/page.tsx", /^\s+\? linhasHora\.map\(\(l\) => \($/, "a linha do ticket por grupo"],
  ["src/app/admin/novo/revisao.ts", /^\s+return linhasDosGrupos\(.*`\$\{l\.dias\}: \$\{l\.faixas\}`/, "a linha da revisão por grupo"],
  ["src/lib/fatos-da-trilha.ts", /^\s+\? `\$\{rotuloFaixaCurta\(t\.horario\)\} \(\$\{MARCA_OUTROS_DIAS\}\)`$/, "a pílula montada"],
  ["src/app/admin/campos/CaixasDeFaixas.tsx", /^\s+aria-label=\{nome === undefined \? daCaixa : /, "o nome da caixa de hora com o do grupo"],
];

/** 🔴 A QUARTA LISTA DATADA (21/10, pacote pequeno "o 409 do ponto"). O João
 *  leu as duas frases por extenso no chat e as escolheu. Só `export const`. */
const LIDAS_EM_21 = "2026-10-21";
const LIDAS_EM_21_10: Readonly<Record<string, readonly string[]>> = {
  "src/lib/porta-da-pessoa.ts": ["NOME_JA_EM_USO_NO_AR", "PONTO_CAI_EM_NOME_EM_USO"],
};

/** 🔴 A QUINTA LISTA DATADA (25/10, rodada `d-401`). O João escolheu a frase
 *  do aviso no chat, lendo-a por extenso. No mesmo dia ele marcou "Serve" no
 *  `DESFAZER`, que é ANTIGO (07/10) e por isso não cabe numa lista de frases
 *  novas: a marca dele é conferida à parte, no caso de 25/10 lá embaixo. */
const LIDAS_EM_25 = "2026-10-25";
const LIDAS_EM_25_10: Readonly<Record<string, readonly string[]>> = {
  "src/app/admin/campos/palavras.ts": ["TEXTO_GUARDADO"],
  // O perfil dela (25/10): as cinco palavras novas, lidas no mesmo dia.
  "src/app/contribuir/palavras.ts": ["TITULO_VOCE", "TITULO_FUI", "FUI_VAZIO", "FOI_EM"],
  "src/app/BarraNavegacao.tsx": ["ITEM_VOCE"],
};
/** As frases ANTIGAS que ele leu em 25/10: arquivo e nome. */
const ANTIGAS_LIDAS_EM_25_10: readonly (readonly [string, string])[] = [["src/app/admin/campos/palavras.ts", "DESFAZER"]];

/** Uma leitura dele: a data e os nomes que ela libera NUM arquivo. */
type Leitura = { data: string; nomes: readonly string[] };

/** As listas datadas, cada uma com a sua data. Lista datada nova entra aqui. */
const LISTAS_DATADAS: readonly { data: string; lista: Readonly<Record<string, readonly string[]>> }[] = [
  { data: LIDAS_EM, lista: LIDAS_EM_13_10 },
  { data: LIDAS_EM_18, lista: LIDAS_EM_18_10 },
  { data: LIDAS_EM_20, lista: LIDAS_EM_20_10 },
  { data: LIDAS_EM_21, lista: LIDAS_EM_21_10 },
  { data: LIDAS_EM_25, lista: LIDAS_EM_25_10 },
];

/** As leituras que valem num arquivo (uma por lista datada que o cita). */
function leiturasDe(arquivo: string): Leitura[] {
  return LISTAS_DATADAS.flatMap(({ data, lista }) => (lista[arquivo] ? [{ data, nomes: lista[arquivo] }] : []));
}

const marcaDaData = (data: string) => new RegExp(`LIDA:.*${data}`);

/** O que está errado na lista datada de UM arquivo: nome que não é constante
 *  de texto exportada dele, que já existia na base (então não precisava da
 *  lista), ou que não está `LIDA:` com a data da leitura. */
function problemasDaLista(fonte: string, base: Set<string>, lidas: readonly string[], data: string = LIDAS_EM): string[] {
  const linhas = fonte.split(/\r?\n/);
  const frases = frasesExportadas(fonte);
  return lidas.flatMap((nome) => {
    const f = frases.find((x) => x.nome === nome);
    if (f === undefined) return [`${nome}: está na lista de ${data} e não é constante de texto exportada do arquivo`];
    if (base.has(nome)) return [`${nome}: já existia em ${BASE} — não é frase desta rodada`];
    const marca = marcaDe(linhas, f.linha);
    if (marca !== "LIDA" || !comentariosDeCima(linhas, f.linha).some((l) => marcaDaData(data).test(l))) {
      return [`${nome}: está na lista de ${data} e não está marcada LIDA com essa data`];
    }
    return [];
  });
}

/** 🔴 A DATA EXIGE NOME DA LISTA (I2 da revisão da Task 18). A lista datada
 *  cerca num sentido só: nome da lista exige a data. O outro sentido faltava —
 *  uma frase ANTIGA que ele não leu (o `DESFAZER` da Tarefa 15, as
 *  "Dúvida/Mudar" de `endereco.ts`) podia ganhar `LIDA:` com a data de 13/10,
 *  a afirmação mais forte do arquivo, e a suíte inteira ficava verde (medido
 *  pelo revisor). O I6 não alcança: ele só recusa LIDA em frase NOVA.
 *
 *  As linhas de UM arquivo onde a marca datada (de `data`) é legítima: o
 *  bloco de comentário de cada nome da lista DESSA data no arquivo (os alvos
 *  por nome valem só pra 13/10), mais os alvos que não são
 *  `export const` e são conferidos POR NOME nos casos do fim (as entradas de
 *  `FRASE_DA_PESSOA`, o `contribuidor` do histórico, a linha do título). Toda
 *  outra linha com `LIDA:` e a data é marca que ele não deu. */
function linhasDaDataPermitidas(arquivo: string, linhas: string[], data: string = LIDAS_EM): Set<number> {
  const ok = new Set<number>();
  const frases = frasesExportadas(linhas.join("\n"));
  const lista = LISTAS_DATADAS.find((l) => l.data === data)?.lista ?? {};
  for (const nome of lista[arquivo] ?? []) {
    const f = frases.find((x) => x.nome === nome);
    if (f !== undefined) for (const j of indicesDeCima(linhas, f.linha)) ok.add(j);
  }
  // Os alvos conferidos por nome: os de 13/10 (`alvosPorNome`) e os de 20/10
  // (`ALVOS_LIDOS_EM_20_10`); a de 18/10 só tem `export const`.
  if (data === LIDAS_EM) for (const i of alvosPorNome(arquivo, linhas)) ok.add(i);
  // Os de 20/10: o bloco de comentário colado em cima de cada âncora.
  if (data === LIDAS_EM_20) {
    for (const [a, ancora] of ALVOS_LIDOS_EM_20_10) {
      if (a !== arquivo) continue;
      linhas.forEach((l, i) => { if (ancora.test(l)) for (const j of indicesDeCima(linhas, i)) ok.add(j); });
    }
  }
  return ok;
}

/** As linhas DATADAS dos alvos conferidos por nome (a mesma régua dos três
 *  casos do fim do arquivo): a linha de CIMA de cada entrada de
 *  `FRASE_DA_PESSOA` e do `contribuidor`; a PRÓPRIA linha do título. */
function alvosPorNome(arquivo: string, linhas: string[]): number[] {
  if (arquivo === "src/lib/porta-da-pessoa.ts") {
    const abre = linhas.findIndex((l) => /^export const FRASE_DA_PESSOA\b/.test(l));
    const fecha = linhas.findIndex((l, i) => i > abre && /^};/.test(l));
    if (abre < 0) return [];
    return linhas.flatMap((l, i) => (i > abre && i < fecha && /^\s+"[a-z-]+":(\s|$)/.test(l) ? [i - 1] : []));
  }
  if (arquivo === "src/app/admin/HistoricoDaFicha.tsx") {
    const i = linhas.findIndex((l) => /^\s+contribuidor: "quem mandou",/.test(l));
    return i > 0 ? [i - 1] : [];
  }
  if (arquivo === "src/app/[slug]/page.tsx") {
    return linhas.flatMap((l, i) => (/^\s+const nome = .*ETIQUETA_NAO_CONFERIDO/.test(l) ? [i] : []));
  }
  return [];
}

/** Toda linha de `src/` com `LIDA:` e a data da leitura, do GIT (os
 *  rastreados, e `--untracked` pros que ainda não entraram no índice). */
function marcasDatadasEmSrc(data: string = LIDAS_EM): { arquivo: string; linha: number }[] {
  const saida = execFileSync("git", ["grep", "-n", "--untracked", "-E", `LIDA:.*${data}`, "--", "src"], { encoding: "utf8" });
  return saida.split(/\r?\n/).flatMap((l) => {
    const m = /^(.+?):(\d+):/.exec(l);
    return m ? [{ arquivo: m[1], linha: Number(m[2]) - 1 }] : [];
  });
}

/** 🔴 FRASE MUDADA DE ARQUIVO NÃO É FRASE NOVA (Task 8, 17/10): `PULADA` e
 *  `SEM_RESPOSTA`, que o João já leu, moravam em `FormularioDeLugar.tsx`
 *  (cliente) e foram pra `palavras.ts` porque a revisão, de SERVIDOR, não pode
 *  importar constante de módulo `"use client"` (chegaria como referência de
 *  cliente). Sem esta tabela o guarda as leria como nascidas aqui e exigiria
 *  `PENDENTE` de frase que ele leu. Destino → { nome → arquivo onde ela estava
 *  na BASE }; o caso "as movidas" confere que cada uma estava mesmo lá. */
const MOVIDAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "src/app/admin/campos/palavras.ts": {
    PULADA: "src/app/admin/FormularioDeLugar.tsx",
    SEM_RESPOSTA: "src/app/admin/FormularioDeLugar.tsx",
  },
};

function fonteNaBase(arquivo: string): string {
  try {
    return execFileSync("git", ["show", `${BASE}:${arquivo}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

/** Os nomes das constantes de texto que o arquivo exportava na BASE (mais as
 *  que se mudaram pra ele de um arquivo que as exportava lá). Arquivo que não
 *  existia lá = nenhum (toda frase dele é nova). */
function nomesNaBase(arquivo: string): Set<string> {
  const nomes = new Set(frasesExportadas(fonteNaBase(arquivo)).map((f) => f.nome));
  for (const [nome, origem] of Object.entries(MOVIDAS[arquivo] ?? {})) {
    if (frasesExportadas(fonteNaBase(origem)).some((f) => f.nome === nome)) nomes.add(nome);
  }
  return nomes;
}

/** 🔴 I6 DA PRÉ-AUDITORIA: `LIDA:` só vale pra frase que JÁ EXISTIA na base.
 *  Frase que nasceu nesta rodada e diz `LIDA:` é marca escrita por mim — e
 *  "pode seguir" (aprovar o DESENHO) nunca é "li e aprovei" a frase (memória
 *  "trava removida por quem escreveu"). Foi o `SECO_SEM_CARRO` do plano
 *  original, e o guarda de antes o aceitava. */
function problemasDaMarca(fonte: string, base: Set<string>, leituras: readonly Leitura[] = []): string[] {
  const linhas = fonte.split(/\r?\n/);
  return frasesExportadas(fonte).flatMap((f) => {
    const marca = marcaDe(linhas, f.linha);
    if (marca === null) return [`${f.nome}: sem marca`];
    // A exceção das listas datadas: só o nome dito, e só com a data DA LISTA
    // que o diz na marca (a data de outra leitura não serve).
    const acima = comentariosDeCima(linhas, f.linha);
    const lidaPorEle = leituras.some((l) => l.nomes.includes(f.nome) && acima.some((c) => marcaDaData(l.data).test(c)));
    if (marca === "LIDA" && !base.has(f.nome) && !lidaPorEle) {
      return [`${f.nome}: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`];
    }
    return [];
  });
}

/** 🔴 A CERCA QUE NÃO É À MÃO (Task 16, por cima do brief). Todo arquivo
 *  `.ts`/`.tsx` de `src/` que mudou desde a BASE — o que o git diz, mais o que
 *  ainda não foi adicionado (`--others`: arquivo novo fora do índice não
 *  aparece no `git diff`). Foi esta enumeração que achou as frases que a lista
 *  `ARQUIVOS` não via: `AVISO_PUBLICAR_PESSOA` (`TelaDePublicar.tsx`, Task 13),
 *  `NAO_CONFERIU`/`TITULO_REGRA_PADRAO`/`BLOQUEAR`/`BLOQUEAR_MESMO`/
 *  `DESBLOQUEAR` (`admin/campos/palavras.ts`, Tasks 6, 7, 15) e `SEM_NAO_SEI`
 *  (`campos-da-pessoa.ts`, Task 10). */
function arquivosDaRodada(): string[] {
  const git = (args: string[]) =>
    execFileSync("git", args, { encoding: "utf8" }).split(/\r?\n/).filter((f) => /^src\/.*\.tsx?$/.test(f));
  const mudados = git(["diff", "--name-only", "--diff-filter=d", BASE, "--", "src"]);
  const soltos = git(["ls-files", "--others", "--exclude-standard", "--", "src"]);
  return [...new Set([...mudados, ...soltos])].sort();
}

/** Nos arquivos que JÁ existiam, frase antiga pode não ter marca nenhuma (é de
 *  antes da regra); o que a varredura cobra é a frase NOVA: nome que a base não
 *  exportava. Nova = `PENDENTE`, e `LIDA` nova é recusada como no I6 — fora
 *  das listas datadas (`LISTAS_DATADAS`), que são a única exceção. */
function problemasDasNovas(
  fonte: string, base: Set<string>, naoSaoFrase: readonly string[] = [], leituras: readonly Leitura[] = [],
): string[] {
  return problemasDaMarca(fonte, base, leituras).filter((p) => {
    const nome = p.slice(0, p.indexOf(":"));
    return !base.has(nome) && !naoSaoFrase.includes(nome);
  });
}

/** 🔴 AS CONSTANTES DE TEXTO NOVAS QUE NÃO SÃO FRASE DE TELA — por NOME, com o
 *  porquê, e nunca por heurística (tamanho, forma, espaço): exceção por forma
 *  come o caso real que se parece com ela. Marcar uma destas `PENDENTE` poria
 *  no pacote de copy dele uma coisa que não é palavra pra ler. Cada nome daqui
 *  tem de EXISTIR no arquivo (caso abaixo), senão a exceção apodrece calada.
 *  - `PONTO` = "ponto": a CHAVE da pergunta do mapa na lista de obrigatórias
 *    que faltam (`obrigatoriosDaPessoaFaltando`, a régua da porta); nunca vai à
 *    tela — a revisão monta as linhas pelas perguntas e mostra o texto delas. */
const NAO_SAO_FRASE: Readonly<Record<string, readonly string[]>> = {
  "src/lib/campos-da-pessoa.ts": ["PONTO"],
  // `USER_AGENT_DO_APP` = o cabeçalho que o servidor manda ao Nominatim (política
  // de uso dele): nunca vai à tela de ninguém.
  "src/lib/nominatim.ts": ["USER_AGENT_DO_APP"],
  // `CHAVE_DO_NOME_NOVO` = a chave do `localStorage` do nome guardado no 401
  // (rodada `d-401`, 25/10): nunca vai à tela de ninguém.
  "src/app/admin/campos/texto-guardado.ts": ["CHAVE_DO_NOME_NOVO"],
  // `CHAVE_FUI` = a chave do `localStorage` das idas anotadas no aparelho
  // (25/10, o perfil dela): nunca vai à tela de ninguém.
  "src/lib/fui-no-aparelho.ts": ["CHAVE_FUI"],
};

/** As constantes de texto exportadas que nasceram depois da BASE, em todo
 *  arquivo da rodada — a matéria-prima da não-vacuidade da varredura. */
function frasesNovasDaRodada(): string[] {
  return arquivosDaRodada().flatMap((a) => {
    const base = nomesNaBase(a);
    return frasesExportadas(readFileSync(path.join(process.cwd(), a), "utf8"))
      .filter((f) => !base.has(f.nome))
      .map((f) => f.nome);
  });
}

const ler = (arquivo: string) => readFileSync(path.join(process.cwd(), arquivo), "utf8").split(/\r?\n/);

describe("toda frase nova desta rodada nasce marcada", () => {
  it("o guarda leu frases (não-vacuidade): pelo menos 30 nos arquivos da rodada", () => {
    const total = ARQUIVOS.reduce((n, a) => n + frasesExportadas(readFileSync(path.join(process.cwd(), a), "utf8")).length, 0);
    expect(total).toBeGreaterThanOrEqual(30);
  });

  // Não-vacuidade da leitura da BASE: se o `git show` falhasse sempre, toda
  // frase pareceria nova — o guarda ficaria MAIS estrito, nunca mais frouxo;
  // mesmo assim, ele tem de saber ler a base de verdade.
  it("o guarda lê a base: um arquivo que já existia nela devolve as frases de lá", () => {
    expect(nomesNaBase("src/lib/porta-de-publicar.ts").has("RASCUNHO_MUDOU")).toBe(true);
    expect(nomesNaBase("src/lib/origem.ts").size, "origem.ts nasce nesta rodada").toBe(0);
  });

  it("as movidas: cada frase de MOVIDAS era frase exportada do arquivo de origem na base, e vive agora no destino", () => {
    for (const [destino, nomes] of Object.entries(MOVIDAS)) {
      const hoje = frasesExportadas(readFileSync(path.join(process.cwd(), destino), "utf8")).map((f) => f.nome);
      for (const [nome, origem] of Object.entries(nomes)) {
        expect(frasesExportadas(fonteNaBase(origem)).map((f) => f.nome), `${nome} na base de ${origem}`).toContain(nome);
        expect(hoje, `${nome} em ${destino}`).toContain(nome);
      }
    }
  });

  it.each(ARQUIVOS)("%s: toda constante de texto exportada tem marca, e LIDA só em frase que já existia ou que ele leu (13/10, 18/10)", (arquivo) => {
    const fonte = readFileSync(path.join(process.cwd(), arquivo), "utf8");
    expect(problemasDaMarca(fonte, nomesNaBase(arquivo), leiturasDe(arquivo))).toEqual([]);
  });

  // 🔴 A LISTA DATADA NÃO APODRECE CALADA (Task 18): cada nome existe no
  // arquivo dito, é novo desde a base, e está `LIDA:` com a data da leitura.
  // Uma frase da lista que volte a `PENDENTE`, ou um nome que suma do código
  // (apagado, renomeado), deixa este caso vermelho.
  it("a lista do que ele leu em 13/10: cada nome existe, é desta rodada, e está LIDA com a data", () => {
    const problemas = Object.entries(LIDAS_EM_13_10).flatMap(([arquivo, nomes]) =>
      problemasDaLista(readFileSync(path.join(process.cwd(), arquivo), "utf8"), nomesNaBase(arquivo), nomes).map(
        (p) => `${arquivo}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
    // Não-vacuidade: a lista é a rodada inteira, menos as frases que não são
    // `export const` (conferidas por nome no fim do arquivo).
    // 44: o `MANDAR_UM_LUGAR` saiu em 25/10 (o item da barra virou "Você").
    expect(Object.values(LIDAS_EM_13_10).flat().length).toBe(44);
  });

  // 🔴 I2 DA REVISÃO DA TASK 18: o outro sentido da cerca — a data exige nome
  // da lista. Toda linha `LIDA:` com a data em `src` tem de ser a marca de um
  // nome de `LIDAS_EM_13_10` no arquivo dito (frase ANTIGA também: a lista só
  // tem frase desta rodada), ou de um dos alvos conferidos por nome.
  it(`toda marca LIDA de ${LIDAS_EM} em src é de um nome da lista datada (ou de um alvo conferido por nome)`, () => {
    const marcas = marcasDatadasEmSrc();
    const porArquivo = new Map<string, Set<number>>();
    const fora = marcas.flatMap(({ arquivo, linha }) => {
      if (!porArquivo.has(arquivo)) porArquivo.set(arquivo, linhasDaDataPermitidas(arquivo, ler(arquivo)));
      return porArquivo.get(arquivo)!.has(linha) ? [] : [`${arquivo}:${linha + 1}: ${ler(arquivo)[linha].trim()}`];
    });
    expect(fora).toEqual([]);
    // Não-vacuidade: 44 da lista + 6 de `FRASE_DA_PESSOA` + o `contribuidor`
    // + o título = 52 linhas em 13/10 (53 até o `MANDAR_UM_LUGAR` sair, 25/10). Se o `git grep` voltasse vazio, a cerca
    // passaria calada.
    expect(marcas.length).toBe(52);
  });

  // A lista de 18/10, no mesmo molde: não apodrece calada, e a data dela só
  // vale no bloco de um nome dela.
  it("a lista do que ele leu em 18/10: cada nome existe, é desta rodada, e está LIDA com a data", () => {
    const problemas = Object.entries(LIDAS_EM_18_10).flatMap(([arquivo, nomes]) =>
      problemasDaLista(readFileSync(path.join(process.cwd(), arquivo), "utf8"), nomesNaBase(arquivo), nomes, LIDAS_EM_18).map(
        (p) => `${arquivo}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
    // Não-vacuidade: as 18 constantes da lista da Task 9.
    expect(Object.values(LIDAS_EM_18_10).flat().length).toBe(18);
  });

  it(`toda marca LIDA de ${LIDAS_EM_18} em src é de um nome da lista de 18/10`, () => {
    const marcas = marcasDatadasEmSrc(LIDAS_EM_18);
    const porArquivo = new Map<string, Set<number>>();
    const fora = marcas.flatMap(({ arquivo, linha }) => {
      if (!porArquivo.has(arquivo)) porArquivo.set(arquivo, linhasDaDataPermitidas(arquivo, ler(arquivo), LIDAS_EM_18));
      return porArquivo.get(arquivo)!.has(linha) ? [] : [`${arquivo}:${linha + 1}: ${ler(arquivo)[linha].trim()}`];
    });
    expect(fora).toEqual([]);
    // Não-vacuidade: uma marca por constante da lista, nenhuma outra.
    expect(marcas.length).toBe(18);
  });

  // A não-vacuidade da VARREDURA: ela tem de enumerar os arquivos que a lista
  // à mão não tem, e achar neles as frases que só ela vê. Se o `git diff`
  // voltasse vazio (base errada, git ausente), a varredura passaria calada —
  // por isso o piso de 41 (as constantes de texto novas da rodada: 42 contadas
  // em 12/10, menos o `PONTO`, que não é frase; em 13/10 saiu
  // `MEIA_LINHA_REGRA_PADRAO` e entraram `CLERK_FORA_AO_ABRIR` e
  // `JA_CONFERIDO_AO_ABRIR` — 43 contadas, o piso fica) e os nomes que moram
  // FORA de `ARQUIVOS`.
  it("a varredura enumera do git: os arquivos fora da lista à mão, e as frases novas deles", () => {
    const arquivos = arquivosDaRodada();
    for (const a of ["src/app/admin/TelaDePublicar.tsx", "src/app/admin/campos/palavras.ts", "src/lib/campos-da-pessoa.ts"]) {
      expect(arquivos, a).toContain(a);
      expect(ARQUIVOS, a).not.toContain(a);
    }
    const excecoes = Object.values(NAO_SAO_FRASE).flat();
    const novas = frasesNovasDaRodada().filter((n) => !excecoes.includes(n));
    expect(novas.length).toBeGreaterThanOrEqual(41);
    for (const n of ["AVISO_PUBLICAR_PESSOA", "NAO_CONFERIU", "TITULO_REGRA_PADRAO", "BLOQUEAR", "BLOQUEAR_MESMO", "DESBLOQUEAR", "SEM_NAO_SEI"]) {
      expect(novas, n).toContain(n);
    }
  });

  it("todo arquivo de src/ que mudou desde a base: toda constante de texto exportada NOVA nasce PENDENTE (fora das listas datadas)", () => {
    const problemas = arquivosDaRodada().flatMap((a) =>
      problemasDasNovas(readFileSync(path.join(process.cwd(), a), "utf8"), nomesNaBase(a), NAO_SAO_FRASE[a], leiturasDe(a)).map(
        (p) => `${a}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
  });

  it("cada exceção de NAO_SAO_FRASE existe: é constante de texto NOVA do arquivo dito, e não está em ARQUIVOS", () => {
    for (const [arquivo, nomes] of Object.entries(NAO_SAO_FRASE)) {
      expect(arquivosDaRodada(), arquivo).toContain(arquivo);
      expect(ARQUIVOS, arquivo).not.toContain(arquivo);
      const base = nomesNaBase(arquivo);
      const novas = frasesExportadas(readFileSync(path.join(process.cwd(), arquivo), "utf8")).map((f) => f.nome);
      for (const n of nomes) {
        expect(novas, n).toContain(n);
        expect(base.has(n), n).toBe(false);
      }
    }
  });

  // Os controles: o guarda SABE achar uma frase sem marca, e uma LIDA nova.
  it("controle: uma frase sem marca é achada", () => {
    const fonte = 'const x = 1;\nexport const FRASE = "sem marca";\n';
    expect(problemasDaMarca(fonte, new Set())).toEqual(["FRASE: sem marca"]);
  });

  it("controle: a marca da VIZINHA de cima não serve (constantes coladas); o docblock entre a marca e a frase serve", () => {
    const coladas = '// PENDENTE: minha\nexport const A = "a";\n// sem a palavra\nexport const B = "b";\n';
    expect(problemasDaMarca(coladas, new Set())).toEqual(["B: sem marca"]);
    const comDoc = '// PENDENTE: minha\n/** o porquê,\n *  em duas linhas */\nexport const C = "c";\n';
    expect(problemasDaMarca(comDoc, new Set())).toEqual([]);
  });

  it("controle: LIDA numa frase nova é achada; LIDA numa frase da base passa; PENDENTE sempre passa", () => {
    const fonte = '// LIDA: aprovada\nexport const NOVA = "x";\n// LIDA: aprovada\nexport const VELHA = "y";\n// PENDENTE: minha\nexport const OUTRA = "z";\n';
    expect(problemasDaMarca(fonte, new Set(["VELHA"]))).toEqual([
      `NOVA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
  });

  it("controle da varredura: frase antiga sem marca passa; frase nova sem marca, e LIDA nova, são achadas", () => {
    const fonte = 'export const VELHA = "antes da regra";\nexport const NOVA = "sem marca";\n// LIDA: aprovada\nexport const OUTRA = "x";\n';
    expect(problemasDasNovas(fonte, new Set(["VELHA"]))).toEqual([
      "NOVA: sem marca",
      `OUTRA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
    // A exceção cala SÓ o nome dito, nunca o vizinho.
    expect(problemasDasNovas(fonte, new Set(["VELHA"]), ["OUTRA"])).toEqual(["NOVA: sem marca"]);
  });

  // Os controles da lista datada (Task 18): ela abre a porta do I6 SÓ pro nome
  // dito e SÓ com a data na marca; e acusa nome da lista que voltou a
  // PENDENTE, que perdeu a data, ou que não existe mais.
  it("controle da lista datada: LIDA com a data passa só no nome da lista; sem a data, ou fora da lista, é achada", () => {
    const fonte =
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM}.\nexport const DA_LISTA = "x";\n` +
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM}.\nexport const FORA_DA_LISTA = "y";\n` +
      `// LIDA: aprovada\nexport const SEM_DATA = "z";\n`;
    expect(problemasDaMarca(fonte, new Set(), [{ data: LIDAS_EM, nomes: ["DA_LISTA", "SEM_DATA"] }])).toEqual([
      `FORA_DA_LISTA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
      `SEM_DATA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
  });

  // Duas listas datadas (18/10): a data de uma não abre a porta pro nome da
  // outra — cada leitura cerca os SEUS nomes.
  it("controle das duas listas: a marca de 13/10 num nome de 18/10 (e o contrário) é achada", () => {
    const fonte =
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM}.\nexport const DE_18 = "x";\n` +
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM_18}.\nexport const DE_13 = "y";\n` +
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM_18}.\nexport const BOA_18 = "z";\n`;
    const leituras = [
      { data: LIDAS_EM, nomes: ["DE_13"] },
      { data: LIDAS_EM_18, nomes: ["DE_18", "BOA_18"] },
    ];
    expect(problemasDaMarca(fonte, new Set(), leituras)).toEqual([
      `DE_18: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
      `DE_13: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
    expect(problemasDaLista(fonte, new Set(), ["DE_18", "BOA_18"], LIDAS_EM_18)).toEqual([
      `DE_18: está na lista de ${LIDAS_EM_18} e não está marcada LIDA com essa data`,
    ]);
  });

  it("controle da lista datada: nome que voltou a PENDENTE, sem a data, que não existe, ou que é da base — achados", () => {
    const fonte =
      `// LIDA: proposta aprovada pelo João no pacote de copy em ${LIDAS_EM}.\nexport const BOA = "x";\n` +
      `// PENDENTE: redação minha, o João ainda não leu\nexport const VOLTOU = "y";\n` +
      `// LIDA: aprovada\nexport const SEM_DATA = "z";\n` +
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM}.\nexport const VELHA = "w";\n`;
    expect(problemasDaLista(fonte, new Set(["VELHA"]), ["BOA", "VOLTOU", "SEM_DATA", "SUMIU", "VELHA"])).toEqual([
      `VOLTOU: está na lista de ${LIDAS_EM} e não está marcada LIDA com essa data`,
      `SEM_DATA: está na lista de ${LIDAS_EM} e não está marcada LIDA com essa data`,
      `SUMIU: está na lista de ${LIDAS_EM} e não é constante de texto exportada do arquivo`,
      `VELHA: já existia em ${BASE} — não é frase desta rodada`,
    ]);
  });

  // O controle da cerca da data (I2): a marca datada no bloco de um nome da
  // lista é permitida; a mesma marca numa frase ANTIGA fora dela, não.
  it("controle da cerca da data: a LIDA datada só é permitida no bloco de um nome da lista", () => {
    const linhas = [
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM}.`,
      'export const BLOQUEAR = "Bloquear";',
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM}.`,
      'export const DESFAZER = "Desfazer";',
    ];
    const ok = linhasDaDataPermitidas("src/app/admin/campos/palavras.ts", linhas);
    expect(ok.has(0)).toBe(true);
    expect(ok.has(2)).toBe(false);
    // A cerca de 18/10: o `BUSCAR` (da lista de 18/10) é permitido nela, o
    // `BLOQUEAR` (da de 13/10) não — e a de 13/10 não permite o `BUSCAR`.
    const de18 = [
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM_18}.`,
      'export const BUSCAR = "Buscar";',
      `// LIDA: o João marcou "Serve" no pacote de copy em ${LIDAS_EM_18}.`,
      'export const BLOQUEAR = "Bloquear";',
    ];
    const ok18 = linhasDaDataPermitidas("src/app/admin/campos/palavras.ts", de18, LIDAS_EM_18);
    expect(ok18.has(0)).toBe(true);
    expect(ok18.has(2)).toBe(false);
    expect(linhasDaDataPermitidas("src/app/admin/campos/palavras.ts", de18).has(0)).toBe(false);
  });

  // ⚠️ O brief media as entradas com `/^\s+"[a-z-]+": "/`, e duas das seis
  // quebram a linha depois dos dois-pontos (`"horario-invertido-sem-aviso":` e
  // `"semana-inteira-nao-declara":`): o caso contava 4 e ficava vermelho. A
  // entrada é a CHAVE, com ou sem o texto na mesma linha — e só dentro do
  // bloco do `FRASE_DA_PESSOA`.
  // Task 18: as seis ele leu em 13/10 ("Serve") — a marca é a LIDA datada.
  it(`cada frase de FRASE_DA_PESSOA tem LIDA de ${LIDAS_EM} na linha de cima`, () => {
    const linhas = ler("src/lib/porta-da-pessoa.ts");
    const abre = linhas.findIndex((l) => /^export const FRASE_DA_PESSOA\b/.test(l));
    const fecha = linhas.findIndex((l, i) => i > abre && /^};/.test(l));
    expect(abre, "o bloco existe").toBeGreaterThan(-1);
    const entradas = linhas.flatMap((l, i) => (i > abre && i < fecha && /^\s+"[a-z-]+":(\s|$)/.test(l) ? [i] : []));
    expect(entradas.length).toBe(6);
    for (const i of entradas) {
      expect(linhas[i - 1], linhas[i]).toMatch(/^\s*\/\/ LIDA:/);
      expect(linhas[i - 1], linhas[i]).toMatch(MARCA_DA_LEITURA);
    }
  });

  // As frases desta rodada que o regex de `export const NOME = "…"` não lê
  // (M9 da pré-auditoria): entrada de objeto, e a marca que divide a linha com
  // um `LIDA:` antigo (caso de baixo). Conferidas POR NOME. (As duas funções
  // que devolviam frase — `parDeRascunhoDeQuemUsa` e
  // `enderecoDeRascunhoDeQuemUsa`, em `rascunho.ts` — foram apagadas na Task
  // 17, com o estado que as alcançava: rascunho de quem usa não ocupa mais
  // nome. Não há outra função-frase nova na rodada.)
  it.each([
    ["src/app/admin/HistoricoDaFicha.tsx", /^\s+contribuidor: "quem mandou",/],
  ] as const)(`%s: %s tem LIDA de ${LIDAS_EM} na linha de cima`, (arquivo, alvo) => {
    const linhas = ler(arquivo);
    const i = linhas.findIndex((l) => alvo.test(l));
    expect(i, "a frase existe").toBeGreaterThan(0);
    expect(linhas[i - 1]).toMatch(/^\s*\/\/ LIDA:/);
    expect(linhas[i - 1]).toMatch(MARCA_DA_LEITURA);
  });

  // 🔴 AS MONTAGENS DE TELA DO HORÁRIO POR DIA (revisão final da rodada, I2,
  // 20/10; o João leu e marcou "Serve" no mesmo dia, então hoje são LIDA): não são `export const`, então o varredor de cima não as vê — e a
  // revisão achou as três sem marca. Conferidas POR NOME, como as de cima:
  // cada âncora acha UMA linha, e o bloco de comentário colado em cima dela
  // (a mesma régua de `marcaDe`) diz `LIDA:` com a data de 20/10. Não é varredura: montagem
  // nova fora desta lista continua dependendo de quem revisa.
  it.each([
    ["src/app/[slug]/page.tsx", /^\s+\? linhasHora\.map\(\(l\) => \($/],
    ["src/app/admin/novo/revisao.ts", /^\s+return linhasDosGrupos\(.*`\$\{l\.dias\}: \$\{l\.faixas\}`/],
    ["src/lib/fatos-da-trilha.ts", /^\s+\? `\$\{rotuloFaixaCurta\(t\.horario\)\} \(\$\{MARCA_OUTROS_DIAS\}\)`$/],
  ] as const)("%s: a montagem %s tem a LIDA de 20/10", (arquivo, alvo) => {
    const linhas = ler(arquivo);
    const achadas = linhas.flatMap((l, i) => (alvo.test(l) ? [i] : []));
    expect(achadas, "a montagem existe, numa linha só").toHaveLength(1);
    expect(marcaDe(linhas, achadas[0])).toBe("LIDA");
    expect(comentariosDeCima(linhas, achadas[0]).some((l) => marcaDaData(LIDAS_EM_20).test(l))).toBe(true);
  });

  // A lista de 20/10, no mesmo molde das outras: não apodrece calada, a data só
  // vale no bloco de um nome dela ou de um alvo dela, e nenhuma PENDENTE da
  // rodada sobrou nos alvos nomeados.
  it("a lista do que ele leu em 20/10: cada nome existe, é desta rodada, e está LIDA com a data", () => {
    const problemas = Object.entries(LIDAS_EM_20_10).flatMap(([arquivo, nomes]) =>
      problemasDaLista(readFileSync(path.join(process.cwd(), arquivo), "utf8"), nomesNaBase(arquivo), nomes, LIDAS_EM_20).map(
        (p) => `${arquivo}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
    // Não-vacuidade: as 19 constantes de texto exportadas da rodada.
    expect(Object.values(LIDAS_EM_20_10).flat().length).toBe(19);
  });

  it(`toda marca LIDA de ${LIDAS_EM_20} em src é de um nome da lista de 20/10 ou de um alvo dela`, () => {
    const marcas = marcasDatadasEmSrc(LIDAS_EM_20);
    const porArquivo = new Map<string, Set<number>>();
    const fora = marcas.flatMap(({ arquivo, linha }) => {
      if (!porArquivo.has(arquivo)) porArquivo.set(arquivo, linhasDaDataPermitidas(arquivo, ler(arquivo), LIDAS_EM_20));
      return porArquivo.get(arquivo)!.has(linha) ? [] : [`${arquivo}:${linha + 1}: ${ler(arquivo)[linha].trim()}`];
    });
    expect(fora).toEqual([]);
    // Não-vacuidade: uma marca por constante da lista (19) e uma por alvo (6).
    expect(marcas.length).toBe(19 + ALVOS_LIDOS_EM_20_10.length);
  });

  // A lista de 21/10, no mesmo molde: não apodrece calada, e a data dela só
  // vale no bloco de um nome dela.
  it("a lista do que ele leu em 21/10: cada nome existe, é desta rodada, e está LIDA com a data", () => {
    const problemas = Object.entries(LIDAS_EM_21_10).flatMap(([arquivo, nomes]) =>
      problemasDaLista(readFileSync(path.join(process.cwd(), arquivo), "utf8"), nomesNaBase(arquivo), nomes, LIDAS_EM_21).map(
        (p) => `${arquivo}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
    expect(Object.values(LIDAS_EM_21_10).flat().length).toBe(2);
  });

  it(`toda marca LIDA de ${LIDAS_EM_21} em src é de um nome da lista de 21/10`, () => {
    const marcas = marcasDatadasEmSrc(LIDAS_EM_21);
    const porArquivo = new Map<string, Set<number>>();
    const fora = marcas.flatMap(({ arquivo, linha }) => {
      if (!porArquivo.has(arquivo)) porArquivo.set(arquivo, linhasDaDataPermitidas(arquivo, ler(arquivo), LIDAS_EM_21));
      return porArquivo.get(arquivo)!.has(linha) ? [] : [`${arquivo}:${linha + 1}: ${ler(arquivo)[linha].trim()}`];
    });
    expect(fora).toEqual([]);
    // Não-vacuidade: uma marca por constante da lista.
    expect(marcas.length).toBe(2);
  });

  // A lista de 25/10, no mesmo molde, mais a frase antiga que ele leu no dia.
  it("a lista do que ele leu em 25/10: cada nome existe, é desta rodada, e está LIDA com a data", () => {
    const problemas = Object.entries(LIDAS_EM_25_10).flatMap(([arquivo, nomes]) =>
      problemasDaLista(readFileSync(path.join(process.cwd(), arquivo), "utf8"), nomesNaBase(arquivo), nomes, LIDAS_EM_25).map(
        (p) => `${arquivo}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
    expect(Object.values(LIDAS_EM_25_10).flat().length).toBe(6);
  });

  it(`toda marca LIDA de ${LIDAS_EM_25} em src é de um nome da lista de 25/10 ou de uma frase antiga que ele leu nesse dia`, () => {
    const marcas = marcasDatadasEmSrc(LIDAS_EM_25);
    const porArquivo = new Map<string, Set<number>>();
    const fora = marcas.flatMap(({ arquivo, linha }) => {
      if (!porArquivo.has(arquivo)) {
        const ok = linhasDaDataPermitidas(arquivo, ler(arquivo), LIDAS_EM_25);
        const frases = frasesExportadas(ler(arquivo).join("\n"));
        for (const [a, nome] of ANTIGAS_LIDAS_EM_25_10) {
          const f = a === arquivo ? frases.find((x) => x.nome === nome) : undefined;
          if (f !== undefined) for (const j of indicesDeCima(ler(arquivo), f.linha)) ok.add(j);
        }
        porArquivo.set(arquivo, ok);
      }
      return porArquivo.get(arquivo)!.has(linha) ? [] : [`${arquivo}:${linha + 1}: ${ler(arquivo)[linha].trim()}`];
    });
    expect(fora).toEqual([]);
    // Não-vacuidade: as seis frases novas e a antiga.
    expect(marcas.length).toBe(7);
  });

  it.each(ALVOS_LIDOS_EM_20_10)("%s: %s — o alvo existe, numa linha só, com a LIDA de 20/10 e sem PENDENTE", (arquivo, alvo) => {
    const linhas = ler(arquivo);
    const achadas = linhas.flatMap((l, i) => (alvo.test(l) ? [i] : []));
    expect(achadas, "o alvo existe, numa linha só").toHaveLength(1);
    expect(marcaDe(linhas, achadas[0])).toBe("LIDA");
    expect(comentariosDeCima(linhas, achadas[0]).some((l) => marcaDaData(LIDAS_EM_20).test(l))).toBe(true);
  });

  // Task 18: só a parte que era PENDENTE trocou — o LIDA de 07/10 do formato
  // fica, e o ` · não conferido` ganha o LIDA datado de 13/10, na mesma linha.
  it(`o título do link (generateMetadata): o \` · não conferido\` tem LIDA de ${LIDAS_EM} na própria linha, depois do LIDA antigo`, () => {
    const linhas = ler("src/app/[slug]/page.tsx");
    const nome = linhas.filter((l) => /^\s+const nome = .*ETIQUETA_NAO_CONFERIDO/.test(l));
    expect(nome).toHaveLength(1);
    expect(nome[0]).toMatch(new RegExp(`// LIDA:.*2026-10-07.*LIDA: o " · não conferido".*${LIDAS_EM}`));
    expect(nome[0]).not.toMatch(/PENDENTE/);
  });
});
