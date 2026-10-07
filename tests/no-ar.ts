import { noAr } from "@/lib/regra-padrao";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import type { Ficha, FichaNoAr } from "@/types/ficha";

/** Uma ficha do JOÃO como a leitura do público a entrega: conferida, e com a
 *  regra dela (a padrão só entra se o documento não tiver regra). Pra testes
 *  que montam ficha à mão e a dão a um componente público. */
export function doJoao(f: Ficha): FichaNoAr {
  return noAr(f, { conferido: true }, REGRA_PADRAO_INICIAL);
}
