/** A barra embaixo, na altura do polegar. Dois destinos e só: "Minhas" nasce
 *  quando existir memória de aparelho — aba que não leva a lugar nenhum é
 *  mentira de interface.
 *
 *  Não aparece na ficha: lá a decisão é a tela inteira, e uma barra fixa
 *  disputaria espaço com o carimbo e com o "Fui". A saída da ficha continua
 *  sendo a marca no canto.
 *
 *  Âncora pura, como todo link deste app: não existe navegação soft aqui.
 *
 *  E desde 07/10 um terceiro item, que não é seção: a lista de quem manda um
 *  lugar (`/contribuir`), de onde ela manda um novo. */

/** O terceiro item leva à área DELA (`/contribuir`). Até 25/10 chamava-se
 *  "+ mandar um lugar" (LIDA 13/10); com o perfil (onde ela já foi, o que ela
 *  mandou) a área deixou de ser só de mandar, e o item virou "Você". */
// PENDENTE: redação minha (25/10), esperando a leitura do João.
export const ITEM_VOCE = "Você";

/** `aqui` ausente = nenhuma seção acesa: as telas de quem manda um lugar
 *  (25/10) mostram a barra, mas não são "Hoje" nem "Trilhas", e o item de
 *  mandar continua sem `aria-current` (não é seção). */
export default function BarraNavegacao({ aqui }: { aqui?: "hoje" | "trilhas" }) {
  const destinos = [
    { chave: "hoje", href: "/", ic: "🧭", rotulo: "Hoje" },
    { chave: "trilhas", href: "/trilhas", ic: "🗺️", rotulo: "Trilhas" },
  ] as const;

  return (
    <nav className="barra" aria-label="Seções do app">
      {destinos.map((d) => (
        <a
          key={d.chave}
          className="barra-item"
          href={d.href}
          aria-current={d.chave === aqui ? "page" : undefined}
        >
          <span className="ic" aria-hidden="true">{d.ic}</span>
          {d.rotulo}
        </a>
      ))}
      {/* Link comum, sem `aria-current`: não é uma "seção" do app (sem sessão,
          o Clerk pede login — spec, Parte 1). Leva à LISTA dela, que tem o
          "+ mandar um lugar novo" no topo (I5 da pré-auditoria). */}
      <a className="barra-item barra-mandar" href="/contribuir">
        <span className="ic" aria-hidden="true">👤</span>
        {ITEM_VOCE}
      </a>
    </nav>
  );
}
