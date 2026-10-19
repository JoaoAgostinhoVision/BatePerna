import { faixasDe, linhasDosGrupos, rotuloFaixaCurta, type GrupoDeHorario } from "@/lib/horario";
import type { PerguntaNaTela } from "../campos/tipos";
import { rotuloDe } from "../FichaInteira";
import { NAO, SIM } from "../campos/palavras";

/** A REVISÃO ANTES DE PUBLICAR (17/10, Task 8), a parte de DADO: cada pergunta
 *  da tela vira uma linha com a resposta já em texto, o estado, e o endereço do
 *  "Corrigir". Nada de função na linha — o componente que a desenha
 *  (`RevisaoDoLugar`) só imprime.
 *
 *  🔴 A MESMA LISTA SERVE ÀS DUAS TELAS (a do João e a de quem usa): quem a
 *  monta passa as perguntas dele (`montarPerguntas` / `montarPerguntasDaPessoa`)
 *  e o `corrigir` dele (`ROTAS[onde].corrigir`). A ordem é a das perguntas, e a
 *  CIDADE entra logo depois do ponto: ela não é mais pergunta (sai do ponto que
 *  se marca), mas é obrigatória — sem ela o publicar recusa — e a única
 *  correção é marcar o ponto de novo, por isso o `corrigir` dela é o do ponto.
 *  Rascunho com ponto e SEM cidade (dado de antes de ela sair do ponto) mostra a
 *  falta aqui, e a frase de recusa da porta ("estão listadas nesta tela") fica
 *  verdadeira. */

export type LinhaDaRevisao = {
  caminho: string;
  pergunta: string;
  /** `falta` = obrigatória sem resposta; `pulada` = opcional sem resposta (no
   *  documento, pular e nunca responder são a mesma ausência). */
  estado: "respondida" | "falta" | "pulada";
  /** A resposta em TEXTO PRONTO (rótulo da lista, Sim/Não, faixas curtas); `null`
   *  no ponto e quando não há resposta. */
  resposta: string | null;
  /** O ponto marcado, pro mapinha — a coordenada nunca vira número na tela. */
  ponto: { lat: number; lng: number } | null;
  corrigir: string;
  /** Só na linha do nome, quando o par (nome na cidade) trava o publicar. */
  aviso: string | null;
};

const CAMINHO_DO_NOME = "trajeto.waypoints.0.nome";
const CAMINHO_DO_PONTO = "trajeto.waypoints.0.lat";
const CAMINHO_DA_CIDADE = "cidade";

function ehPar(v: unknown): v is { lat: number; lng: number } {
  return (
    typeof v === "object" && v !== null &&
    typeof (v as { lat?: unknown }).lat === "number" && typeof (v as { lng?: unknown }).lng === "number"
  );
}

/** O ponto de uma pergunta de coordenada: a linha `.lat` carrega o par em
 *  `campo.ponto`; `condicao.coords` tem o par no próprio valor. */
function pontoDe(p: PerguntaNaTela): { lat: number; lng: number } | null {
  if (p.especie !== "coord") return null;
  if (p.campo.ponto) return { lat: p.campo.ponto.lat, lng: p.campo.ponto.lng };
  return ehPar(p.valor) ? { lat: p.valor.lat, lng: p.valor.lng } : null;
}

/** A resposta de uma pergunta como o dono a lê, ou `null` quando não há (ou é
 *  coordenada, que é mapinha e não texto). Documento é dado: forma que a espécie
 *  não espera conta como sem resposta, nunca estoura.
 *
 *  Lista pelo RÓTULO (`campo.rotulos`: Grátis, Pago, os nomes dos dias), nunca
 *  pelo valor cru; opção sem rótulo aparece pelo cru. */
/** Um grupo que dá pra escrever: dias que são lista de texto e faixas que são
 *  faixas de verdade (`faixasDe`). Forma torta fica de fora, nunca estoura. */
function ehGrupoLegivel(g: unknown): g is GrupoDeHorario {
  if (typeof g !== "object" || g === null) return false;
  const { dias, faixas } = g as { dias?: unknown; faixas?: unknown };
  return Array.isArray(dias) && dias.length > 0 && dias.every((d) => typeof d === "string") && (faixasDe(faixas)?.length ?? 0) > 0;
}

export function respostaNaTela(p: PerguntaNaTela): string | null {
  const v = p.valor;
  switch (p.especie) {
    case "prosa":
      return typeof v === "string" && v.trim() !== "" ? v : null;
    case "lista": {
      const itens = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
      const palavras = itens
        .filter((i): i is string => typeof i === "string" && i !== "")
        .map((i) => p.campo.rotulos?.[i] ?? i);
      return palavras.length > 0 ? palavras.join(", ") : null;
    }
    case "booleano":
      return typeof v === "boolean" ? (v ? SIM : NAO) : null;
    case "numero":
      return typeof v === "number" && Number.isFinite(v) ? String(v) : null;
    case "faixas": {
      const faixas = faixasDe(v);
      return faixas && faixas.length > 0 ? rotuloFaixaCurta(faixas) : null;
    }
    case "coord":
      return null;
    // O HORÁRIO DIFERENTE EM ALGUNS DIAS (18/10): uma linha por grupo — os dias
    // por extenso e as horas —, juntas por quebra de linha (o componente
    // desenha cada uma num parágrafo). Pela MESMA função da ficha
    // (`linhasDosGrupos`); o horário de sempre não repete: já é a pergunta dele.
    // Grupo que não é grupo (documento é dado) não entra; sobrando nenhum, é
    // sem resposta.
    case "grupos": {
      if (!Array.isArray(v)) return null;
      const grupos = v.filter(ehGrupoLegivel);
      if (grupos.length === 0) return null;
      return linhasDosGrupos({ horarioPorDia: grupos }).map((l) => `${l.dias}: ${l.faixas}`).join("\n");
    }
  }
}

export function montarRevisao(
  perguntas: readonly PerguntaNaTela[],
  doc: unknown,
  o: { corrigir: (n: number) => string; aviso: string | null },
): LinhaDaRevisao[] {
  // Lista sem a pergunta do ponto é defeito de programa: a cidade ficaria sem
  // linha, e a falta dela, calada. Estoura, como `montarPerguntasDaPessoa`.
  if (!perguntas.some((p) => p.campo.caminho === CAMINHO_DO_PONTO)) {
    throw new Error(`a pergunta "${CAMINHO_DO_PONTO}" não está na lista: a linha da cidade não tem onde entrar`);
  }
  const linhas: LinhaDaRevisao[] = [];
  perguntas.forEach((p, i) => {
    const caminho = p.campo.caminho;
    const resposta = respostaNaTela(p);
    const ponto = pontoDe(p);
    const tem = resposta !== null || ponto !== null;
    linhas.push({
      caminho,
      pergunta: p.texto,
      estado: tem ? "respondida" : p.campo.obrigatorio ? "falta" : "pulada",
      resposta,
      ponto,
      corrigir: o.corrigir(i + 1),
      aviso: caminho === CAMINHO_DO_NOME ? o.aviso : null,
    });
    if (caminho === CAMINHO_DO_PONTO) {
      const cidade = (doc as { cidade?: unknown } | null)?.cidade;
      const temCidade = typeof cidade === "string" && cidade.trim() !== "";
      linhas.push({
        caminho: CAMINHO_DA_CIDADE,
        pergunta: rotuloDe(CAMINHO_DA_CIDADE),
        estado: temCidade ? "respondida" : "falta",
        resposta: temCidade ? cidade : null,
        ponto: null,
        corrigir: o.corrigir(i + 1),
        aviso: null,
      });
    }
  });
  return linhas;
}
