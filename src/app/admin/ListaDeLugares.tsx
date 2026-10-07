import Link from "next/link";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { marcaAgora } from "./marca-agora";
import { ESCONDIDO } from "./campos/palavras";
import { enderecoDePublicar } from "./novo/enderecos";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const RODAPE_LISTA = "Toque num lugar pra ver e mudar o que o app diz dele.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Da maquete que ele aprovou; primeira vez no código.
export const LUGAR_NOVO = "+ lugar novo";
// PENDENTE: redação minha, o João ainda não leu
export const TITULO_RASCUNHOS = "Começados, ainda fora do ar";
// PENDENTE: redação minha, o João ainda não leu
export const IR_PUBLICAR = "publicar";

/** Um rascunho na lista: o slug (pro link), o nome e a cidade que ele digitou
 *  ao criar. `cidade` ausente: rascunho nascido antes da Tarefa 11b — cala. */
export type RascunhoNaLista = { slug: string; nome: string; cidade?: string };

type Props = {
  fichas: Ficha[];
  leituras: Record<string, LeituraCarimbo>;
  /** Os slugs ESCONDIDOS do público (Task 9). Obrigatório de propósito: quem
   *  monta a lista tem de dizer quais estão escondidos, e uma página que
   *  esquecesse não compila — em vez de mostrar todos como se estivessem no ar. */
  ocultos: ReadonlySet<string>;
  /** Os lugares NOVOS, ainda em rascunho (Tarefa 11). Obrigatório pela mesma
   *  razão do `ocultos`: uma página que esquecesse não compila — em vez de o
   *  rascunho sumir da tela e a porta de volta pra ele sumir junto. */
  rascunhos: readonly RascunhoNaLista[];
  agora: number;
};

/** A lista do painel (Task 5, 2026-09-25): um item por lugar do acervo, cada
 *  um levando pro seu PRÓPRIO `/admin/<slug>` — nunca pro de outro. Tocar na
 *  Pedra Furada e cair na Rampa seria editar a voz de um lugar achando que é a
 *  de outro, a pior coisa que este painel pode fazer.
 *
 *  A marca ao lado do nome é `marcaAgora` — a MESMA pipeline que o painel do
 *  lugar (`PainelAdmin`) usa, nunca uma cópia: string fixa aqui seria a voz de
 *  um lugar virando a língua dos três, a espécie que este app já pagou quatro
 *  vezes (a última em `severidade.ts`, 16/09).
 *
 *  🔴 O "+ lugar novo" da maquete que o João aprovou VOLTOU na Tarefa 11. Ele
 *  tinha saído porque criar lugar era rodada futura, e um botão que não abre
 *  nada promete o que o app não cumpre; agora ele abre `/admin/novo`, o
 *  formulário de verdade, e o motivo de ficar fora deixou de valer.
 *
 *  🔴 E OS RASCUNHOS MORAM NUMA SEÇÃO SEPARADA, NUNCA NA LISTA DOS LUGARES
 *  (Tarefa 11, E5 da auditoria). Um rascunho não está no ar — misturá-lo aos
 *  lugares faria o dono achar que o app já fala dele. A seção é a porta de
 *  volta: sem ela, sair do formulário perdia o rascunho de vista. Sem rascunho,
 *  a seção não aparece.
 *  Cada rascunho tem DOIS links (Tarefa 12, R3 da auditoria de 06/10): o nome
 *  continua as perguntas; o "publicar" abre a tela de publicar, que mostra o que
 *  falta e o que o app vai calar ANTES de pôr no ar — nada vai ao ar pelo toque
 *  na lista.
 *
 *  🔴 O LUGAR ESCONDIDO ESTÁ NA LISTA, MARCADO (Task 9, 2026-10-01). Esconder
 *  tira do PÚBLICO, não do dono: sem ele aqui, não haveria caminho pela tela
 *  até o botão de mostrá-lo de novo. Quem entrega o escondido é a página
 *  (`getAcervoDoDono`); este componente só marca o que recebe. */
export default function ListaDeLugares({ fichas, leituras, ocultos, rascunhos, agora }: Props) {
  return (
    <>
      <ul className="adm-lista" data-testid="lugares">
        {fichas.map((f) => {
          const leitura = leituras[f.slug];
          return (
            <li key={f.slug} className="adm-item" data-lugar={f.slug} data-testid={`lugar-${f.slug}`}>
              <Link href={`/admin/${f.slug}`} className="adm-item-link">
                {/* 🔴 A CIDADE junto do nome, embaixo dele (Tarefa 11b): dois
                    lugares de mesmo nome só se distinguem por ela. Sem cidade,
                    cala — nenhum traço, nenhum "sem cidade". */}
                <span className="adm-item-nome">
                  {f.trajeto.waypoints[0].nome}
                  {f.cidade && <span className="adm-item-cidade">{f.cidade}</span>}
                </span>
                {ocultos.has(f.slug) && <span className="adm-marca-escondido">{ESCONDIDO}</span>}
                {leitura && <span className="adm-item-marca">{marcaAgora(f, leitura, agora)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="adm-lista-rodape">{RODAPE_LISTA}</p>
      <Link href="/admin/novo" className="adm-novo-link">
        {LUGAR_NOVO}
      </Link>
      {rascunhos.length > 0 && (
        <section className="adm-rascunhos" data-testid="rascunhos">
          <h2 className="adm-rascunhos-titulo">{TITULO_RASCUNHOS}</h2>
          <ul className="adm-lista">
            {rascunhos.map((r) => (
              <li key={r.slug} className="adm-item" data-rascunho={r.slug}>
                <Link href={`/admin/novo?slug=${encodeURIComponent(r.slug)}`} className="adm-item-link">
                  <span className="adm-item-nome">
                    {r.nome}
                    {r.cidade && <span className="adm-item-cidade">{r.cidade}</span>}
                  </span>
                </Link>
                <a href={enderecoDePublicar(r.slug)} className="adm-item-publicar">
                  {IR_PUBLICAR}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
