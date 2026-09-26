import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { getAllFichas } from "@/lib/ficha";
import { resolverEstados } from "@/lib/carimbo-estado";
import CaixaDeSenha from "./CaixaDeSenha";
import ListaDeLugares from "./ListaDeLugares";
import "./admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** `/admin` virou LISTA na Task 5 (2026-09-25) — antes era o painel dos três
 *  lugares numa tela só; hoje é um índice, e cada item leva a `/admin/<slug>`,
 *  que é quem monta o `PainelAdmin` de UM lugar. Por isso esta página não lê
 *  mais os avisos vigentes (aquilo virou responsabilidade da página do
 *  lugar): ela só precisa do acervo e do estado do motor de cada um, pra
 *  `ListaDeLugares` derivar a marca do selo público. */
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
  const fichas = await getAllFichas();
  const leituras = Object.fromEntries(await resolverEstados(fichas));

  return (
    <main className="adm">
      <h1>Painel</h1>
      <ListaDeLugares fichas={fichas} leituras={leituras} agora={agora} />
    </main>
  );
}
