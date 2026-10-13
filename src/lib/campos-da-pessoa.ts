import { aplicarCampo, aplicarNoRascunho, gravarPonto, gravarPontoNoRascunho, lerCaminho } from "@/lib/campos-da-ficha";
import { fichaSchema } from "@/types/ficha";

/** AS PERGUNTAS DE QUEM USA O APP (spec de 07/10, Parte 1) — a lista FECHADA
 *  do que ela escreve. Os INSTRUMENTOS são os do painel (cada caminho daqui
 *  existe no registro, `CAMPOS_DA_FICHA`, e a gravação de cada folha passa
 *  pela mesma conferência de tipo), mas QUAIS caminhos e QUAIS são
 *  obrigatórios é desta lista, não do registro: o registro diz o que o lugar
 *  do JOÃO exige.
 *
 *  O que NÃO está aqui a pessoa não escreve — e a página cala (Task 4). */
export const CAMPOS_DA_PESSOA: readonly string[] = [
  "trajeto.waypoints.0.nome", // 1. nome
  "cidade", //                   2. cidade
  //                             3. o ponto no mapa — `PONTO`, gravado à parte
  "promessa", //                 4. o que é, em uma frase
  "acesso", //                   5. como se chega
  "avisos", //                   6. o que pode dar errado (opcional)
  "custo.tag", //                7. custa ou é grátis
  "custo.valor", //                 … e quanto (opcional)
  "horario", //                  8. horário (opcional)
  "dias", //                        e dias (opcional)
];

export const OPCIONAIS_DA_PESSOA: ReadonlySet<string> = new Set(["avisos", "custo.valor", "horario", "dias"]);

/** A pergunta do mapa, na lista do que falta. Não é caminho do documento: é o
 *  ponto 0 E a coordenada da chuva, juntos. */
export const PONTO = "ponto";

export function ehCampoDaPessoa(c: unknown): c is string {
  return typeof c === "string" && CAMPOS_DA_PESSOA.includes(c);
}

/** 🔴 O PONTO É UM SÓ (spec, pergunta 3): "a coordenada da chuva E o ponto 1
 *  do trajeto". Grava os dois, com os mesmos números, numa conta só. */
export function pontoNoRascunhoDaPessoa(doc: string, lat: number, lng: number): string {
  return aplicarNoRascunho(gravarPontoNoRascunho(doc, 0, lat, lng), "condicao.coords", { lat, lng });
}

/** A recusa do "não sei" numa pergunta que ela tem de responder (onda de fix
 *  da Task 10): chega a ela no corpo do 400, então é frase de tela — sem
 *  caminho interno (`promessa`, `custo.tag`), que ela nunca viu. Uma só pra
 *  obrigatório e pra campo fora da lista: este segundo a rota já recusa antes,
 *  mudo, por `ehCampoDaPessoa`. */
// PENDENTE: redação minha, o João ainda não leu
export const SEM_NAO_SEI = "Nada foi gravado: esta pergunta precisa de resposta, então aqui não dá pra dizer \"não sei\".";

/** O "não sei" DELA: só nos opcionais da lista dela (`avisos` inclusive, que
 *  é obrigatório no registro do João). Rascunho não passa pelo schema. */
export function tirarDoRascunhoDaPessoa(doc: string, caminho: string): string {
  if (!OPCIONAIS_DA_PESSOA.has(caminho)) throw new Error(SEM_NAO_SEI);
  const atual = JSON.parse(doc) as Record<string, unknown>;
  if (caminho === "custo.valor") {
    const custo = atual.custo as Record<string, unknown> | undefined;
    if (custo) {
      const { valor: _valor, ...resto } = custo;
      return JSON.stringify({ ...atual, custo: resto });
    }
    return doc;
  }
  const { [caminho]: _fora, ...resto } = atual;
  return JSON.stringify(resto);
}

/** O ponto DELA no lugar NO AR (Task 12): o ponto 0 e a coordenada da chuva
 *  juntos, e o documento inteiro passa pelo schema (as duas funções do
 *  registro já fazem — `gravarPonto` e `aplicarCampo` revalidam tudo). */
export function pontoDaPessoa(doc: string, lat: number, lng: number): string {
  return aplicarCampo(gravarPonto(doc, 0, lat, lng), "condicao.coords", { lat, lng });
}

/** O "não sei" DELA no lugar NO AR — os opcionais da lista DELA (o
 *  `removerCampo` do registro recusaria `avisos`, obrigatório pro João), e o
 *  resultado passa pelo schema, como toda gravação de lugar no ar. Obrigatório
 *  dela estoura com `SEM_NAO_SEI`, a frase do 400. */
export function tirarCampoDaPessoa(doc: string, caminho: string): string {
  return JSON.stringify(fichaSchema.parse(JSON.parse(tirarDoRascunhoDaPessoa(doc, caminho))));
}

const OBRIGATORIOS = CAMPOS_DA_PESSOA.filter((c) => !OPCIONAIS_DA_PESSOA.has(c));

/** O que falta pra publicar, pela lista DELA. O ponto falta enquanto o ponto 0
 *  ou a coordenada da chuva não tiverem lat E lng. */
export function obrigatoriosDaPessoaFaltando(doc: unknown): string[] {
  const faltam = OBRIGATORIOS.filter((c) => lerCaminho(doc, c.split(".")) === undefined);
  const temPar = (p: unknown) =>
    typeof p === "object" && p !== null && Number.isFinite((p as { lat?: unknown }).lat) && Number.isFinite((p as { lng?: unknown }).lng);
  if (!temPar(lerCaminho(doc, ["trajeto", "waypoints", "0"])) || !temPar(lerCaminho(doc, ["condicao", "coords"]))) {
    faltam.push(PONTO);
  }
  return faltam;
}

/** 🔴 O QUE SOBRA no documento além do que ela escreve — a porta de publicar
 *  dela recusa qualquer sobra (Review Focus 1), mesmo que tenha entrado por um
 *  caminho que não as rotas dela. Devolve os caminhos que sobram. */
export function chavesForaDaPessoa(doc: unknown): string[] {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return ["(documento)"];
  const d = doc as Record<string, unknown>;
  const sobra: string[] = [];
  const PERMITIDAS = new Set(["slug", "modos", "cidade", "promessa", "acesso", "avisos", "trajeto", "condicao", "custo", "horario", "dias"]);
  for (const k of Object.keys(d)) if (!PERMITIDAS.has(k)) sobra.push(k);
  const sobraEm = (onde: string, obj: unknown, permitidas: readonly string[]) => {
    if (typeof obj !== "object" || obj === null) return;
    for (const k of Object.keys(obj)) if (!permitidas.includes(k)) sobra.push(`${onde}.${k}`);
  };
  sobraEm("trajeto", d.trajeto, ["waypoints"]);
  const pontos = (d.trajeto as { waypoints?: unknown } | undefined)?.waypoints;
  if (Array.isArray(pontos)) {
    pontos.slice(1).forEach((_, i) => sobra.push(`trajeto.waypoints.${i + 1}`));
    sobraEm("trajeto.waypoints.0", pontos[0], ["nome", "lat", "lng"]);
  }
  sobraEm("condicao", d.condicao, ["coords"]);
  sobraEm("custo", d.custo, ["tag", "valor"]);
  return sobra;
}
