"use client";
import { useEffect } from "react";
import { COOKIE_ULTIMA, UM_ANO_S } from "@/lib/despacho";

/** A metade escrita da memória do "onde você estava".
 *
 *  Mora dentro da ficha, e não num middleware, porque este componente só chega
 *  a existir numa ficha que renderizou: um link quebrado dá 404 e nada é
 *  gravado. Antes o middleware gravava antes de saber se a rota existia, e
 *  /rampa-pepe (digitado torto) apagava a memória boa de /rampa-do-pepe.
 *
 *  De brinde, passou a valer offline: o service worker serve a ficha guardada,
 *  isto roda, e o cookie passa a concordar com o ponteiro do cache — antes
 *  divergiam justamente quando não havia rede pro middleware rodar.
 *
 *  Só a memória depende de JS. A decisão — o carimbo — continua chegando
 *  pronta do servidor no primeiro paint. */
export default function LembrarUltima({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie =
      `${COOKIE_ULTIMA}=${encodeURIComponent(slug)}; path=/; max-age=${UM_ANO_S}; samesite=lax`;
  }, [slug]);
  return null;
}
