import { getAllFichas } from "@/lib/ficha";
import { fatosDaTrilha } from "@/lib/fatos-da-trilha";

/** A LISTA DO QUE EXISTE — o acervo inteiro, sem carimbo, com os fatos
 *  permanentes de cada lugar.
 *
 *  🔴 POR QUE ELA SAIU DA PÁGINA (2026-09-11). Ela morava dentro de
 *  `trilhas/page.tsx`, e o `not-found` precisou dela: quem cai num link de
 *  trilha que não existe quer uma trilha, e a resposta útil é mostrar as que
 *  existem. Copiar o JSX pra lá seriam duas listas do mesmo acervo podendo
 *  divergir — a mesma família que fez `fatosDaTrilha` nascer meia hora antes.
 *
 *  É a mesma doutrina que o service worker já segue em `planoDaRaiz`: *"o
 *  acervo é a versão honesta da home quando não há clima pra ler: mostra o que
 *  existe e não finge veredito"*. Aqui não há trilha pra mostrar; lá não há
 *  rede. A resposta é a mesma.
 *
 *  ⚠️ SEM CARIMBO, e é o desenho: a resposta desta lista não muda com a chuva.
 *  Quem mostra veredito é a home.
 *
 *  Sem distância: server component, e a pergunta aqui não é "o que está perto".
 *  Ausente é silêncio, a régua de sempre. */
export default function ListaDoAcervo({ titulo }: { titulo: string }) {
  const fichas = getAllFichas();
  return (
    <div className="lista">
      <div className="lista-k">{titulo}</div>
      {fichas.map((f) => {
        // UMA chamada por ficha: montar a lista duas vezes (uma pro teste de
        // vazio, outra pro laço) seria a mesma montagem feita duas vezes na
        // mesma tela — a coisa exata que `fatosDaTrilha` desfez.
        const fatos = fatosDaTrilha(f, { comAbertura: true });
        return (
          <a key={f.slug} className="lista-item" href={`/${f.slug}`}>
            <span className="scan">{f.rotulo_escaneio}</span>
            <span className="lista-t">{f.trajeto.waypoints[0].nome}</span>
            <span className="lista-p">{f.promessa}</span>
            {/* O separador vive ENTRE os pedaços, e não colado no texto de
                cada um: com o " · " dentro, a marca do Nível B pintaria o
                ponto também — e o ponto não é conhecimento de ninguém, é
                pontuação. Mesma montagem do cartão da home. */}
            {fatos.length > 0 && (
              <span className="cartao-meta">
                {fatos.map((p, i) => (
                  <span key={p.texto}>
                    {i > 0 && <span className="sep"> · </span>}
                    <span data-nivel={p.nivel}>{p.texto}</span>
                  </span>
                ))}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
