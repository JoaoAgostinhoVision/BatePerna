import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { getAllFichas } from "@/lib/ficha";
import { resolverEstados } from "@/lib/carimbo-estado";
import { avisosVigentes, getClient, type AvisoLinha } from "@/lib/db";
import CaixaDeSenha from "./CaixaDeSenha";
import PainelAdmin from "./PainelAdmin";
import "./admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Os avisos vigentes de TODOS os lugares, numa consulta só — mesmo molde do
 *  `lerAvisos` de `carimbo-estado.ts`: banco fora do ar não pode derrubar o
 *  painel, só dizer isso na tela. */
async function lerAvisosVigentes(agora: number): Promise<{ avisos: Record<string, AvisoLinha>; erro: boolean }> {
  try {
    const linhas = await avisosVigentes(getClient(), agora);
    return { avisos: Object.fromEntries(linhas), erro: false };
  } catch {
    return { avisos: {}, erro: true };
  }
}

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
  const fichas = getAllFichas();
  const [leituras, { avisos, erro: avisosErro }] = await Promise.all([
    resolverEstados(fichas),
    lerAvisosVigentes(agora),
  ]);

  return (
    <main className="adm">
      <h1>Painel</h1>
      <PainelAdmin
        fichas={fichas}
        leituras={Object.fromEntries(leituras)}
        avisos={avisos}
        avisosErro={avisosErro}
        agora={agora}
      />
    </main>
  );
}
