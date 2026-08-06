import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllFichas } from "@/lib/ficha";
import { COOKIE_ULTIMA, destinoDe } from "@/lib/despacho";

export const dynamic = "force-dynamic";

/** "/" não renderiza nada: despacha pra última ficha que você abriu.
 *
 *  Aqui é o único lugar que pode fazer as duas coisas de uma vez — ler o
 *  cookie e saber quais fichas existem (fs). O middleware grava o cookie mas
 *  não enxerga content/fichas; server component enxerga mas não pode gravar
 *  cookie durante o render. Por isso a validação mora deste lado.
 *
 *  Efeito de brinde: como é redirect de verdade, a URL na tela vira
 *  /rampa-do-pepe — mandar o link leva a pessoa pra ficha certa, não pra
 *  "a última ficha de quem abrir". */
export default async function Raiz() {
  const ultima = (await cookies()).get(COOKIE_ULTIMA)?.value;
  const slugs = getAllFichas().map((f) => f.slug);
  redirect(destinoDe(ultima, slugs));
}
