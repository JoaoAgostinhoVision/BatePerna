/** A barra embaixo, na altura do polegar. Dois destinos e só: "Minhas" nasce
 *  quando existir memória de aparelho — aba que não leva a lugar nenhum é
 *  mentira de interface.
 *
 *  Não aparece na ficha: lá a decisão é a tela inteira, e uma barra fixa
 *  disputaria espaço com o carimbo e com o "Fui". A saída da ficha continua
 *  sendo a marca no canto.
 *
 *  Âncora pura, como todo link deste app: não existe navegação soft aqui. */
export default function BarraNavegacao({ aqui }: { aqui: "hoje" | "trilhas" }) {
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
    </nav>
  );
}
