import { CAMPOS_DA_FICHA, lerCaminho } from "@/lib/campos-da-ficha";
import { faixasDe, problemaDasFaixas } from "@/lib/horario";
import { fichaSchema } from "@/types/ficha";

/** A PORTA DE PUBLICAR, a parte que é só do DOCUMENTO (Tarefa 12): o que a rota
 *  `POST /api/admin/publicar` confere no rascunho antes de pedir ao banco que o
 *  ponha no ar. O que é de banco (o endereço livre, o rascunho ainda ser o que a
 *  tela leu) mora em `publicarRascunho` (`db.ts`); o par (nome, cidade) e a
 *  coerência, na rota, porque leem o acervo.
 *
 *  Mora aqui, e não na rota, porque um arquivo de rota do Next não exporta nada
 *  além dos métodos — e as frases têm de ser importáveis pelos testes. Este
 *  módulo importa o registro e o zod: SÓ SERVIDOR. */

// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_ILEGIVEL = "Nada foi publicado: o rascunho guardado não é um documento que o app consiga ler.";
// PENDENTE: redação minha, o João ainda não leu
export const FALTA_OBRIGATORIO =
  "Nada foi publicado: ainda falta responder pergunta que todo lugar precisa ter. As que faltam estão listadas nesta tela.";
// PENDENTE: redação minha, o João ainda não leu
export const FORMA_ERRADA =
  "Nada foi publicado: uma resposta deste rascunho não está na forma que o app lê. Volte às perguntas e responda de novo a que estiver estranha.";
// PENDENTE: redação minha, o João ainda não leu
export const SLUG_DE_DENTRO = "Nada foi publicado: o rascunho diz um endereço e mora em outro.";
// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_MUDOU =
  "Nada foi publicado: o rascunho mudou desde que você abriu esta tela. Recarregue a página pra ver o que vai ao ar.";
// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_SUMIU =
  "Nada foi publicado: este rascunho não está mais neste endereço. Ele foi apagado, ou mudou de nome ou de cidade: volte pela lista do painel.";
/** 🔴 O DUPLO TOQUE (M4 da auditoria): o 1º pedido publicou e apagou o
 *  rascunho; o 2º acha o endereço ocupado e nenhum rascunho. A frase não afirma
 *  que o lugar dali é o deste rascunho — a mesma leitura também é a de um
 *  rascunho que mudou de endereço e outro lugar que nasceu neste —, só o que é
 *  verdade nos dois casos, e onde conferir. */
// PENDENTE: redação minha, o João ainda não leu
export const JA_PUBLICADO_OU_OCUPADO =
  "Nada foi publicado agora: este endereço já é de um lugar do app, e o rascunho não está mais aqui. Se você tocou duas vezes, o lugar foi publicado no primeiro toque: confira na lista do painel.";
// PENDENTE: redação minha, o João ainda não leu
export const NADA_PUBLICADO = "Nada foi publicado. Recarregue a página e tente de novo.";

/** Os campos OBRIGATÓRIOS do registro que `doc` não responde (12-I1), pelo
 *  caminho — o molde `[]` conferido em CADA ponto do trajeto que o documento
 *  tem (e a lista ausente ou vazia conta como faltando).
 *
 *  🔴 É O REGISTRO, NÃO SÓ O `fichaSchema`: a `cidade` é opcional no schema (as
 *  fichas de antes da Tarefa 11b não a têm) e obrigatória no registro — é ela
 *  que separa dois lugares de mesmo nome, e todo lugar NOVO nasce com ela. Em
 *  todo outro obrigatório as duas réguas concordam (ver
 *  `OBRIGATORIO_SO_NO_REGISTRO` em `tests/lib/campos-da-ficha.test.ts`). */
export function obrigatoriosFaltando(doc: unknown): string[] {
  const faltam: string[] = [];
  for (const campo of CAMPOS_DA_FICHA) {
    if (!campo.obrigatorio) continue;
    const corte = campo.caminho.indexOf("[]");
    if (corte < 0) {
      if (lerCaminho(doc, campo.caminho.split(".")) === undefined) faltam.push(campo.caminho);
      continue;
    }
    const lista = lerCaminho(doc, campo.caminho.slice(0, corte).split("."));
    const resto = campo.caminho.slice(corte + 3).split(".");
    if (!Array.isArray(lista) || lista.length === 0 || lista.some((item) => lerCaminho(item, resto) === undefined)) {
      faltam.push(campo.caminho);
    }
  }
  return faltam;
}

/** O documento que vai ao ar, ou a frase da recusa (todas 400 na rota).
 *
 *  A ordem: abrir → os obrigatórios do registro → as regras do horário → o
 *  `fichaSchema` → o `slug` de dentro.
 *   - 🔴 O HORÁRIO PELA REGRA DE ESCRITA (12-I3, M3 da auditoria): o schema
 *     aceita faixas sobrepostas (as regras de uma lista moram em
 *     `problemaDasFaixas`, não no caminho de leitura), e o rascunho pode ter
 *     sido gravado antes de uma regra existir. `faixasDe` lê as duas formas —
 *     um rascunho antigo com o horário em OBJETO não é recusado por isso.
 *   - 🔴 O QUE VAI AO AR É O DOCUMENTO NORMALIZADO (`fichaSchema.parse`), não o
 *     texto do rascunho: o horário em objeto vira a lista, e chave que o schema
 *     não conhece sai. É o "nascimento" do lugar — o que o app vai ler.
 *   - 🔴 O `slug` DE DENTRO TEM DE SER O ENDEREÇO (I12): `buscarFichas` passa o
 *     acervo inteiro por `fichaDaVersao`, que estoura "Ficha divergente" quando
 *     os dois discordam — um documento assim no ar derrubaria a HOME INTEIRA.
 *     Recusa, nunca reescreve: o painel mantém os dois iguais (`docNoEndereco`),
 *     e um rascunho que discorda é defeito a ver, não a esconder. */
export function prepararPublicacao(texto: string, slug: string): { doc: string } | { frase: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(texto);
  } catch {
    return { frase: RASCUNHO_ILEGIVEL };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return { frase: RASCUNHO_ILEGIVEL };
  if (obrigatoriosFaltando(doc).length > 0) return { frase: FALTA_OBRIGATORIO };
  if ("horario" in doc) {
    const problema = problemaDasFaixas(faixasDe((doc as { horario: unknown }).horario));
    if (problema !== null) return { frase: problema };
  }
  const lido = fichaSchema.safeParse(doc);
  if (!lido.success) return { frase: FORMA_ERRADA };
  if (lido.data.slug !== slug) return { frase: SLUG_DE_DENTRO };
  return { doc: JSON.stringify(lido.data) };
}
