import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, sessaoValida } from "@/lib/admin-guarda";
import CaixaDeSenha from "./CaixaDeSenha";
import "./admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Admin() {
  // 🔴 Painel desligado NÃO EXISTE — 404, nunca uma tela dizendo "configure-me".
  if (!lerConfigAdmin(process.env).ligado) notFound();

  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  const dentro = sessaoValida(process.env, token, Math.floor(Date.now() / 1000));

  return (
    <main className="adm">
      <h1>Painel</h1>
      {dentro ? <p>Em construção — o aviso entra na próxima tarefa.</p> : <CaixaDeSenha />}
    </main>
  );
}
