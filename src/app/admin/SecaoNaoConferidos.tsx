import Link from "next/link";

// PENDENTE: redação minha, o João ainda não leu (o título é o da spec de 07/10, Parte 3)
export const TITULO_NAO_CONFERIDOS = "Mandados por quem usa o app, ainda não conferidos";

/** A data e a hora de Recife, em números — nenhuma palavra. Usada aqui e na
 *  caixa da origem (`CaixaDaOrigem`, de cliente): função pura, sem `next/link`
 *  no caminho dela. */
export const quandoRecife = (s: number): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(s * 1000));

export type ItemNaoConferido = {
  slug: string;
  nome: string;
  cidade?: string;
  mandadoEm: number;
  quem: string | null;
  email: string | null;
};

/** O TOPO DO PAINEL (spec de 07/10, Parte 3): o que quem usa o app mandou e o
 *  João ainda não conferiu, o mais novo primeiro. Sem nenhum, a seção não
 *  existe. Nome e e-mail de quem mandou SÓ aqui e na caixa do lugar
 *  (`CaixaDaOrigem`) — nunca numa tela pública. Sem nome nem e-mail (a pessoa
 *  não tem linha em `contribuidores`), a linha da pessoa CALA: nenhum traço,
 *  nenhum "anônimo" — nada inventado. */
export default function SecaoNaoConferidos({ itens }: { itens: readonly ItemNaoConferido[] }) {
  if (itens.length === 0) return null;
  return (
    <section className="adm-nao-conferidos" data-testid="nao-conferidos">
      <h2>{TITULO_NAO_CONFERIDOS}</h2>
      <ul className="adm-lista">
        {itens.map((i) => (
          <li key={i.slug} className="adm-item" data-lugar={i.slug}>
            <Link href={`/admin/${i.slug}`} className="adm-item-link">
              <span className="adm-item-nome">
                {i.nome}
                {i.cidade && <span className="adm-item-cidade">{i.cidade}</span>}
              </span>
            </Link>
            {(i.quem || i.email) && (
              <span className="adm-quem">{[i.quem, i.email].filter(Boolean).join(" · ")}</span>
            )}
            <time dateTime={new Date(i.mandadoEm * 1000).toISOString()}>{quandoRecife(i.mandadoEm)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
