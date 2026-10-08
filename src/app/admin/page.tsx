import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { getAcervoDoDono } from "@/lib/ficha";
import { resolverEstados } from "@/lib/carimbo-estado";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, listarRascunhos, type Rascunho } from "@/lib/db";
import { naoConferidos, type NaoConferido } from "@/lib/db-contribuidor";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";
import CaixaDeSenha from "./CaixaDeSenha";
import ListaDeLugares from "./ListaDeLugares";
import SecaoNaoConferidos from "./SecaoNaoConferidos";
import { TITULO_REGRA_PADRAO } from "./campos/palavras";
import "./admin.css";

export const dynamic = "force-dynamic";

const ESTOUROU = Symbol("prazo dos rascunhos");

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** `/admin` virou LISTA na Task 5 (2026-09-25) — antes era o painel dos três
 *  lugares numa tela só; hoje é um índice, e cada item leva a `/admin/<slug>`,
 *  que é quem monta o `PainelAdmin` de UM lugar. Por isso esta página não lê
 *  mais os avisos vigentes (aquilo virou responsabilidade da página do
 *  lugar): ela só precisa do acervo e do estado do motor de cada um, pra
 *  `ListaDeLugares` derivar a marca do selo público — e, desde a Tarefa 11, dos
 *  rascunhos; desde a Task 6 da rodada de 07/10, dos lugares mandados por quem
 *  usa ainda não conferidos, que moram na seção do topo e não na lista. */
export default async function Admin() {
  // 🔴 Painel desligado NÃO EXISTE — 404, nunca uma tela dizendo "configure-me".
  // O motivo (senha curta, sem segredo) vai pro LOG, nunca pra tela: ver
  // `avisarDesligado`.
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

  const agora = Math.floor(Date.now() / 1000);
  // 🔴 B1 DA AUDITORIA DA TASK 9 (2026-10-01): o acervo do DONO, com os
  // escondidos — NUNCA `getAllFichas`. Aquela filtra os ocultos (o lugar
  // escondido sumia desta lista, sem caminho de volta pela tela); fazê-la
  // DEVOLVER os ocultos os poria em toda superfície pública que a usa (ela já
  // os LÊ desde 06/10, e os tira antes de devolver). Ver o docblock de
  // `getAcervoDoDono`.
  const { fichas, ocultos } = await getAcervoDoDono();
  const leituras = Object.fromEntries(await resolverEstados(fichas));
  // 🔴 OS RASCUNHOS (Tarefa 11) — a porta de volta pro lugar novo que ele
  // começou. Leitura DIRETA de `ficha_rascunhos`, que nunca passa pelo acervo:
  // é por isso que um rascunho não aparece na lista dos lugares. Mesmo prazo da
  // leitura do dono, e o estouro é erro, como lá.
  const linhas = await comPrazo<Rascunho[] | typeof ESTOUROU>(
    listarRascunhos(getClient()),
    PRAZO_FICHA_MS,
    ESTOUROU,
  );
  if (linhas === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura dos rascunhos.");
  const rascunhos = linhas.map((r) => ({ slug: r.slug, nome: nomeDoRascunho(r.doc, r.slug), cidade: cidadeDoDoc(r.doc) }));
  // 🔴 OS MANDADOS POR QUEM USA, AINDA NÃO CONFERIDOS (Task 6 da rodada de
  // 07/10) — a fila dele, no topo. Mesma sentinela e mesmo prazo dos rascunhos,
  // pela mesma razão: banco pendurado é erro, nunca uma fila vazia que diria
  // "nada pra conferir".
  const fila = await comPrazo<NaoConferido[] | typeof ESTOUROU>(naoConferidos(getClient()), PRAZO_FICHA_MS, ESTOUROU);
  if (fila === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura dos lugares não conferidos.");
  const itens = fila.map((l) => ({
    slug: l.slug,
    nome: nomeDoRascunho(l.doc, l.slug),
    cidade: cidadeDoDoc(l.doc),
    mandadoEm: l.mandadoEm,
    quem: l.contribuidor.nome,
    email: l.contribuidor.email,
  }));
  // Conferidos voltam pra lista normal (spec, Parte 3); os não conferidos moram
  // só na seção do topo.
  const daLista = fichas.filter((f) => f.origem.conferido);

  return (
    <main className="adm">
      <h1>Painel</h1>
      <SecaoNaoConferidos itens={itens} />
      <ListaDeLugares fichas={daLista}leituras={leituras} ocultos={ocultos} rascunhos={rascunhos} agora={agora} />
      <Link href="/admin/chuva" className="adm-novo-link">{TITULO_REGRA_PADRAO}</Link>
    </main>
  );
}
