import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, lugarDoDono } from "@/lib/db";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { JA_CONFERIDO } from "@/lib/porta-da-pessoa";
import EdicaoDaPessoa from "../EdicaoDaPessoa";
import { montarPerguntasDaPessoa } from "../perguntas";
import { quemNaTela } from "../sessao";
import "../../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo do lugar dela");

/** EDITAR O DELA, NO AR (spec, Parte 1): só o lugar DELA, e só enquanto não
 *  conferido — depois disso o editar some (aqui, e o INSERT recusaria de
 *  qualquer jeito: Task 12). Lugar de outra pessoa ou do João é o 404 de
 *  sempre: não revela que existe. */
export default async function EditarDaPessoa({ params }: { params: Promise<{ slug: string }> }) {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const { slug } = await params;
  // Banco pendurado não segura a página (M9 da revisão final): o prazo das
  // irmãs (`/contribuir/novo`), e o estouro é ERRO, não "não existe".
  const lugar = await comPrazo<Awaited<ReturnType<typeof lugarDoDono>> | typeof ESTOUROU>(
    lugarDoDono(getClient(), slug), PRAZO_FICHA_MS, ESTOUROU,
  );
  if (lugar === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura do lugar.");
  if (lugar === null || lugar.origem.contribuidor !== quem.pessoa.id) notFound();
  if (lugar.origem.conferido) {
    return (
      <main className="adm">
        <p className="adm-erro">{JA_CONFERIDO}</p>
        <Link href={`/${slug}`}>{slug}</Link>
      </main>
    );
  }
  return (
    <main className="adm">
      <EdicaoDaPessoa slug={slug} versaoId={lugar.versao.id} perguntas={montarPerguntasDaPessoa(JSON.parse(lugar.versao.doc))} />
    </main>
  );
}
