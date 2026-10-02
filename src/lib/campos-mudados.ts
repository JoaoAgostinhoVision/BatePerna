import { CAMPOS_DA_FICHA, camposDaFicha, lerCaminho } from "@/lib/campos-da-ficha";
import type { Ficha } from "@/types/ficha";

/** QUE CAMPO MUDOU de uma versão da ficha pra anterior (Task 9, 2026-10-01).
 *  Devolve os caminhos CONCRETOS (`trajeto.waypoints.0.lat`), na ordem do
 *  registro — que é a ordem em que a ficha inteira mostra os blocos.
 *
 *  🔴 FUNÇÃO PURA DO SERVIDOR, e mora aqui por causa do bundle (B2 da auditoria
 *  da Task 9): o histórico é `"use client"`, e o registro de campos começa com
 *  `import { z } from "zod"`. Quem chama é `admin/[slug]/page.tsx`, que resolve
 *  os rótulos (`rotuloDe`) e entrega ao componente só strings.
 *
 *  🔴 CAMPO A CAMPO PELO REGISTRO, NUNCA `JSON.stringify` DO DOCUMENTO. O texto
 *  do documento muda com a ORDEM das chaves sem mudar uma palavra (uma gravação
 *  pela semente, pelo "voltar" ou à mão), e o dono leria "mudou tudo" numa
 *  versão que não mudou nada. E pelo REGISTRO porque é ele que define o que é
 *  campo do painel: `slug` e `modos` não se editam por aqui, e não aparecem.
 *
 *  🔴 NUNCA LANÇA. Uma versão antiga que não parseia (ou que parseia em algo que
 *  não é objeto) devolve o que dá pra dizer — em geral nada — em vez de derrubar
 *  o histórico inteiro do lugar. Mesma regra que o componente já seguia pra voz.
 *
 *  ⚠️ `anterior === null` é a PRIMEIRA versão do lugar: não há com o que
 *  comparar, e "mudou tudo" encheria a linha da semente com os 30 rótulos. */
export function camposQueMudaram(anterior: string | null, atual: string): string[] {
  if (anterior === null) return [];
  const a = abrir(anterior);
  const b = abrir(atual);
  if (a === NAO_ABRIU || b === NAO_ABRIU) return [];

  const blocos = new Set(CAMPOS_DA_FICHA.filter((c) => c.especie === "bloco").map((c) => c.caminho));
  const mudou: string[] = [];
  for (const { caminho } of camposDaFicha(esqueletoDaUniao(a, b))) {
    // Folha de um bloco que ENTROU ou SAIU inteiro: quem mudou foi o bloco, e
    // ele já está na lista (o bloco vem antes das folhas no registro).
    const bloco = [...blocos].find((x) => caminho.startsWith(`${x}.`));
    if (bloco && (lerCaminho(a, bloco.split(".")) === undefined) !== (lerCaminho(b, bloco.split(".")) === undefined)) {
      continue;
    }
    const va = lerCaminho(a, caminho.split("."));
    const vb = lerCaminho(b, caminho.split("."));
    // O bloco presente nas DUAS não é "campo que mudou" — ele não se edita
    // inteiro com ele presente (ver `gravarBloco`); quem mudou é a folha.
    if (blocos.has(caminho) && va !== undefined && vb !== undefined) continue;
    if (!mesmoValor(va, vb)) mudou.push(caminho);
  }
  return mudou;
}

const NAO_ABRIU = Symbol("documento que não parseia");

function abrir(doc: string): unknown {
  try {
    return JSON.parse(doc);
  } catch {
    return NAO_ABRIU;
  }
}

/** `camposDaFicha` expande os moldes (`[]`) nos índices de UMA ficha; o diff
 *  precisa da UNIÃO das duas — um ponto que entrou só existe na nova, um que
 *  saiu só na anterior. Este esqueleto tem, em cada lista de molde, o tamanho da
 *  MAIOR das duas, e nada mais: `camposDaFicha` só lê o comprimento das listas.
 *  Lista ausente ou que não é lista conta como vazia — documento torto não
 *  derruba (ver o "nunca lança" acima). */
function esqueletoDaUniao(a: unknown, b: unknown): Ficha {
  const raiz: Record<string, unknown> = {};
  for (const { caminho } of CAMPOS_DA_FICHA) {
    const corte = caminho.indexOf("[]");
    if (corte < 0) continue;
    const degraus = caminho.slice(0, corte).split(".");
    const tamanho = (x: unknown) => {
      const lista = lerCaminho(x, degraus);
      return Array.isArray(lista) ? lista.length : 0;
    };
    let no = raiz;
    for (const d of degraus.slice(0, -1)) no = (no[d] ??= {}) as Record<string, unknown>;
    no[degraus.at(-1)!] = new Array(Math.max(tamanho(a), tamanho(b))).fill(null);
  }
  return raiz as unknown as Ficha;
}

/** Igualdade de VALOR, cega à ordem das chaves de um objeto e atenta à ordem de
 *  uma lista (`dias` em outra ordem é outro dado). Os valores de campo são
 *  folhas rasas — texto, número, booleano, lista de texto, o par `{lat, lng}` —,
 *  mas a recursão não custa nada e não depende disso. */
function mesmoValor(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (typeof x !== "object" || typeof y !== "object" || x === null || y === null) return false;
  if (Array.isArray(x) !== Array.isArray(y)) return false;
  if (Array.isArray(x) && Array.isArray(y)) {
    return x.length === y.length && x.every((v, i) => mesmoValor(v, y[i]));
  }
  const kx = Object.keys(x);
  const ky = Object.keys(y);
  if (kx.length !== ky.length) return false;
  return kx.every((k) => Object.prototype.hasOwnProperty.call(y, k) && mesmoValor((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]));
}

/** O ATO DE VISIBILIDADE de uma versão: ela ESCONDEU o lugar, MOSTROU de novo,
 *  ou nenhum dos dois (R2 da onda de conserto 1 da Task 9, 2026-10-01).
 *
 *  🔴 O HISTÓRICO MARCA O ATO, NÃO O ESTADO — decisão do orquestrador. Com a
 *  marca vinda do `oculto` da versão, toda edição feita com o lugar escondido a
 *  carregava, e a versão que MOSTROU o lugar de novo aparecia sem nada: o dono
 *  perdia a trilha de quando o lugar voltou ao ar.
 *
 *  `anterior === null` é a primeira versão do lugar: ela só leva marca se
 *  NASCEU escondida — aí o ato de esconder aconteceu nela. */
export function atoDeVisibilidade(anterior: boolean | null, atual: boolean): "escondeu" | "mostrou" | null {
  if (anterior === null) return atual ? "escondeu" : null;
  if (anterior === atual) return null;
  return atual ? "escondeu" : "mostrou";
}
