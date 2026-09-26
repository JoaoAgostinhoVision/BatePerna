import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { getFicha } from "@/lib/ficha";
import { PRAZO_AVISO_MS, resolverEstado } from "@/lib/carimbo-estado";
import { comPrazo } from "@/lib/cache-rotas";
import { avisoVigente, getClient, type AvisoLinha } from "@/lib/db";
import CaixaDeSenha from "../CaixaDeSenha";
import EditorDeVoz from "../EditorDeVoz";
import PainelAdmin from "../PainelAdmin";
import "../admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Sentinela do estouro do prazo — nunca pode ser confundido com uma
 *  `AvisoLinha` real nem com `null` (que aqui significa "leitura OK, sem
 *  aviso publicado"). Um `Symbol` garante identidade única mesmo que este
 *  módulo seja reimportado; nenhum outro valor pode ser `===` a ele. */
const ESTOUROU = Symbol("prazo do aviso do admin");

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

/** A tela de UM lugar (Task 5, 2026-09-25): nasce da lista em `/admin`, e é
 *  quem hoje monta o `PainelAdmin` — que passou a servir um lugar só. */
export default async function Lugar({ params }: { params: Promise<{ slug: string }> }) {
  // 🔴 A GUARDA DE CONFIG VEM ANTES DE TUDO — antes da sessão e antes de
  // tocar o banco (`getFicha`): painel desligado não anuncia que existe, nem
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
  const ficha = await getFicha(slug);
  if (!ficha) notFound();

  const agora = Math.floor(Date.now() / 1000);
  const [leitura, { aviso, erro: avisoErro }] = await Promise.all([
    resolverEstado(ficha),
    lerAvisoVigente(slug, agora),
  ]);

  return (
    <main className="adm">
      <h1>Painel</h1>
      <PainelAdmin ficha={ficha} leitura={leitura} aviso={aviso} avisoErro={avisoErro} agora={agora} />
      <EditorDeVoz ficha={ficha} />
    </main>
  );
}
