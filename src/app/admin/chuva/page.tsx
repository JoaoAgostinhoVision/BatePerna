import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, lerRegraPadrao } from "@/lib/db";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import type { RegraPadrao } from "@/lib/regra-padrao";
import CaixaDeSenha from "../CaixaDeSenha";
import { rotuloDe } from "../FichaInteira";
import TelaDaRegraPadrao from "../TelaDaRegraPadrao";
import { TITULO_REGRA_PADRAO } from "../campos/palavras";
import "../admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo da regra padrão");

export default async function Chuva() {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    notFound();
  }
  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!sessaoValida(process.env, token, Math.floor(Date.now() / 1000))) {
    return (
      <main className="adm">
        <h1>Painel</h1>
        <CaixaDeSenha />
      </main>
    );
  }
  const atual = await comPrazo<RegraPadrao | typeof ESTOUROU>(lerRegraPadrao(getClient()), PRAZO_FICHA_MS, ESTOUROU);
  if (atual === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura da regra padrão.");
  return (
    <main className="adm">
      <h1>Painel</h1>
      <h2>{TITULO_REGRA_PADRAO}</h2>
      <TelaDaRegraPadrao
        atual={atual}
        rotulos={{
          previsao: rotuloDe("condicao.regra.janela_previsao_horas"),
          passado: rotuloDe("condicao.regra.janela_passado_horas"),
          limiar: rotuloDe("condicao.regra.limiar_mm"),
          severidade: rotuloDe("condicao.severidade"),
        }}
      />
    </main>
  );
}
