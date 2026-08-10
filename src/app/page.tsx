import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllFichas } from "@/lib/ficha";
import { COOKIE_ULTIMA, destinoDe } from "@/lib/despacho";

export const dynamic = "force-dynamic";

/** "/" não renderiza nada: despacha pra última ficha que você abriu.
 *
 *  Aqui é o único lugar que lê o cookie e sabe quais fichas existem (fs) ao
 *  mesmo tempo — por isso a validação mora deste lado. Quem grava é a própria
 *  ficha (LembrarUltima), que só roda depois de ela ter renderizado; o valor
 *  ainda pode envelhecer no celular e apontar pra ficha que saiu do ar.
 *
 *  Efeito de brinde: como é redirect de verdade, a URL na tela vira
 *  /rampa-do-pepe — mandar o link leva a pessoa pra ficha certa, não pra
 *  "a última ficha de quem abrir". */
export default async function Raiz() {
  const ultima = (await cookies()).get(COOKIE_ULTIMA)?.value;
  const slugs = getAllFichas().map((f) => f.slug);
  redirect(destinoDe(ultima, slugs));
}
