import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { enderecoNovoDoDono, getFichaDoDono } from "@/lib/ficha";
import { avisoDoEndereco } from "@/lib/endereco";
import { cidadeDoDoc } from "@/lib/rascunho";
import { atoDeVisibilidade, camposQueMudaram } from "@/lib/campos-mudados";
import { PRAZO_AVISO_MS, resolverEstado } from "@/lib/carimbo-estado";
import { comPrazo } from "@/lib/cache-rotas";
import { avisoVigente, getClient, historico, type AvisoLinha, type FichaVersao } from "@/lib/db";
import CaixaDeSenha from "../CaixaDeSenha";
import BotaoVisibilidade from "../BotaoVisibilidade";
import { FONTES_DE_PRODUCAO, vistaDaCidade } from "@/lib/vista-do-mapa";
import FichaInteira, { precisaDeVista, rotuloDe } from "../FichaInteira";
import HistoricoDaFicha, { type VersaoNaTela } from "../HistoricoDaFicha";
import PainelAdmin from "../PainelAdmin";
import { ComVersaoDaTela } from "../campos/gravar";
import "../admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Sentinela do estouro do prazo — nunca pode ser confundido com uma
 *  `AvisoLinha` real nem com `null` (que aqui significa "leitura OK, sem
 *  aviso publicado"). Um `Symbol` garante identidade única mesmo que este
 *  módulo seja reimportado; nenhum outro valor pode ser `===` a ele. */
const ESTOUROU = Symbol("prazo do aviso do admin");

/** Irmão do `ESTOUROU` de cima, pro `historico` — mesma razão: `Symbol` não
 *  pode ser confundido nem com uma lista real (mesmo vazia) nem com o `null`
 *  de "leitura OK". */
const ESTOUROU_HISTORICO = Symbol("prazo do historico da ficha");

/** Quanto o HISTÓRICO espera o banco antes de seguir sem ele.
 *
 *  🔴 FIX ROUND 1 (2026-09-26): este prazo tinha o NOME do vizinho
 *  (`PRAZO_AVISO_MS`) emprestado — mesmo valor, mas a justificativa dele
 *  ("UMA consulta de uma linha, indexada", ver `carimbo-estado.ts`) não bate
 *  aqui: `historico()` devolve TODAS as versões daquele lugar, não uma linha
 *  só. Poucas linhas por lugar hoje (a régua é editar a voz, não trocar a
 *  cada minuto) — daí o mesmo valor ser razoável —, mas o nome tem que dizer
 *  a verdade sobre a consulta que ele governa, não repetir o do irmão. */
const PRAZO_HISTORICO_MS = 2_000;

// PENDENTE: redação minha, o João ainda não leu
const HISTORICO_ERRO_LEITURA = "Não consegui ler o histórico — pode estar incompleto.";

/** O aviso vigente de UM lugar — mesmo molde do `lerAvisosVigentes` que a
 *  antiga página única tinha (agora em `admin/page.tsx`, pro acervo inteiro).
 *
 *  🔴 BANCO FORA DO AR *e* BANCO PENDURADO caem os dois em `{ erro: true }`.
 *  O `try/catch` sozinho só cobre o primeiro — um Turso que aceita a conexão
 *  e nunca responde não lança, ele fica parado, e sem prazo o `Promise.all`
 *  do `Lugar` abaixo travaria pra sempre. `comPrazo` (`src/lib/cache-rotas.ts`)
 *  fecha o segundo caso, com a mesma constante nomeada (`PRAZO_AVISO_MS`, a
 *  mesma consulta indexada de uma linha, o mesmo Turso) que o `lerAviso`
 *  público usa em `src/lib/carimbo-estado.ts`.
 *
 *  O irmão público pode devolver `null` no estouro porque lá "sem aviso" e
 *  "não consegui ler" dão a MESMA tela pro visitante — tanto faz. Aqui é o
 *  ADMIN: ele já tem canal honesto pra "não consegui ler" (`avisoErro` →
 *  `AVISO_ERRO_LEITURA`, com `role="alert"`, em `../PainelAdmin`), e usar
 *  `null` no estouro faria o dono abrir a própria tela e ler "sem aviso
 *  publicado" quando na verdade o Turso só ficou mudo — o recado dele
 *  pareceria ter sumido. Por isso o estouro usa o sentinela `ESTOUROU` (nunca
 *  confundível com uma leitura real) e cai no MESMO ramo de erro que o
 *  `catch` já usa pro banco fora do ar. */
async function lerAvisoVigente(slug: string, agora: number): Promise<{ aviso?: AvisoLinha; erro: boolean }> {
  try {
    const linha = await comPrazo<AvisoLinha | null | typeof ESTOUROU>(
      avisoVigente(getClient(), slug, agora),
      PRAZO_AVISO_MS,
      ESTOUROU,
    );
    if (linha === ESTOUROU) return { erro: true };
    return { aviso: linha ?? undefined, erro: false };
  } catch {
    return { erro: true };
  }
}

/** O histórico de versões de UM lugar — mesma trava que `lerAvisoVigente`:
 *  banco pendurado não pode segurar o `Promise.all` abaixo pra sempre, e
 *  "não consegui ler" não pode virar silenciosamente "não há histórico" (por
 *  isso `erro`, não uma lista vazia, no estouro). Prazo próprio
 *  (`PRAZO_HISTORICO_MS`, acima) — mesmo Turso do irmão, mas outra consulta,
 *  e o nome tem que dizer isso. */
async function lerHistorico(slug: string): Promise<{ versoes: FichaVersao[]; erro: boolean }> {
  try {
    const linhas = await comPrazo<FichaVersao[] | typeof ESTOUROU_HISTORICO>(
      historico(getClient(), slug),
      PRAZO_HISTORICO_MS,
      ESTOUROU_HISTORICO,
    );
    if (linhas === ESTOUROU_HISTORICO) return { versoes: [], erro: true };
    return { versoes: linhas, erro: false };
  } catch {
    return { versoes: [], erro: true };
  }
}

/** A tela de UM lugar (Task 5, 2026-09-25): nasce da lista em `/admin`, e é
 *  quem hoje monta o `PainelAdmin` — que passou a servir um lugar só. */
export default async function Lugar({ params }: { params: Promise<{ slug: string }> }) {
  // 🔴 A GUARDA DE CONFIG VEM ANTES DE TUDO — antes da sessão e antes de
  // tocar o banco (`getFichaDoDono`): painel desligado não anuncia que existe, nem
  // gasta banco. Mesma ordem da página irmã (`admin/page.tsx`).
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    notFound();
  }

  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  const dentro = sessaoValida(process.env, token, Math.floor(Date.now() / 1000));

  if (!dentro) {
    return (
      <main className="adm">
        <h1>Painel</h1>
        <CaixaDeSenha />
      </main>
    );
  }

  const { slug } = await params;
  // 🔴 A PRÉ-CONDIÇÃO QUE A TASK 5 DEIXOU ESCRITA AQUI, CUMPRIDA NA TASK 9
  // (2026-10-01): a existência do lugar é conferida por `versaoAtual` (dentro de
  // `getFichaDoDono`), que vê a última versão, escondida ou não — e não mais
  // pelo `getFicha`, que filtra os ocultos e dava 404 pro DONO justamente na
  // página onde mora o botão de mostrar o lugar de novo.
  const doDono = await getFichaDoDono(slug);
  if (!doDono) {
    // 🔴 O ENDEREÇO VELHO LEVA AO PAINEL NOVO (Tarefa 11e, M5 da auditoria):
    // DEPOIS da sessão — sem ela, a caixa de senha não diz pra onde o endereço
    // leva —, e SEM olhar `oculto`: esconder é tirar do público, não do dono.
    const novo = await enderecoNovoDoDono(slug);
    if (novo !== null) redirect(`/admin/${novo}`);
    notFound();
  }
  const { ficha, oculto, versaoId } = doDono;

  const agora = Math.floor(Date.now() / 1000);
  // 🔴 SÓ COM UMA LINHA DE MAPA SEM PONTO (Tarefa 11f, m5): o schema não deixa
  // isso chegar, e uma ficha sã abre sem ir ao serviço de geocoding.
  const vistaSemPonto = precisaDeVista(ficha) ? await vistaDaCidade(ficha, FONTES_DE_PRODUCAO) : null;
  const [leitura, { aviso, erro: avisoErro }, { versoes: linhas, erro: historicoErro }] = await Promise.all([
    resolverEstado(ficha),
    lerAvisoVigente(slug, agora),
    lerHistorico(slug),
  ]);

  // 🔴 "QUE CAMPO MUDOU" É CONTA DO SERVIDOR (B2 da auditoria da Task 9): o
  // histórico é `"use client"` e não pode importar o registro de campos (zod no
  // celular). As versões vêm da mais nova pra mais velha, então a anterior de
  // cada uma é a SEGUINTE da lista; a última não tem anterior. Os rótulos são
  // os de `rotuloDe`, a mesma fonte que nomeia o bloco na ficha inteira.
  const versoes: VersaoNaTela[] = linhas.map((v, i) => ({
    ...v,
    mudou: camposQueMudaram(linhas[i + 1]?.doc ?? null, v.doc).map(rotuloDe),
    // 🔴 O ATO, não o estado (R2 da onda de conserto 1): marca só a versão em
    // que o `oculto` MUDOU em relação à anterior.
    ato: atoDeVisibilidade(linhas[i + 1]?.oculto ?? null, v.oculto),
  }));

  return (
    <main className="adm">
      <h1>Painel</h1>
      {/* 🔴 TUDO QUE GRAVA NESTA TELA FICA AQUI DENTRO (onda de fix 2 da 11e, M6):
          a versão que esta página leu é a identidade do lugar em cada gravação
          — editores, esconder, aviso, voltar, trocar o endereço. Ver
          `VersaoDaTela`, em `../campos/gravar`. */}
      <ComVersaoDaTela id={versaoId}>
        <PainelAdmin ficha={ficha} leitura={leitura} aviso={aviso} avisoErro={avisoErro} agora={agora} />
        <BotaoVisibilidade slug={slug} oculto={oculto} />
        {/* 🔴 A Task 6 (2026-09-30) FECHOU A ESCADA: `EditorDeVoz` foi apagado e a
            `voz` passou a ser editada dentro do bloco `campo-voz` da ficha
            inteira, pelo `EditorProsa`, como qualquer outro campo de prosa. Não
            há mais um componente de tela pra um campo só. */}
        <FichaInteira
          ficha={ficha}
          vistaSemPonto={vistaSemPonto ?? undefined}
          // 🔴 As cidades que o lugar JÁ TEVE saem do histórico que esta página já
          // leu; histórico que falhou chega aqui como lista vazia (`lerHistorico`),
          // e o painel cala (I7).
          avisoDoEndereco={avisoDoEndereco({
            endereco: slug,
            nome: ficha.trajeto.waypoints[0].nome,
            cidade: ficha.cidade,
            cidadesDoHistorico: linhas.map((v) => cidadeDoDoc(v.doc)),
          })}
        />
        {historicoErro && <p className="adm-erro" role="alert">{HISTORICO_ERRO_LEITURA}</p>}
        <HistoricoDaFicha versoes={versoes} />
      </ComVersaoDaTela>
    </main>
  );
}
