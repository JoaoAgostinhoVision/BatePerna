import { BUSCA_NAO_SAIU } from "@/app/admin/campos/palavras";
import { TETO_DA_BUSCA } from "@/lib/nominatim";
import { buscarNoMapa } from "@/lib/nominatim-servico";

const SEM_CACHE = { "cache-control": "no-store" } as const;
const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** A RESPOSTA DAS DUAS PORTAS DA BUSCA NO MAPA (17/10, Task 5) — a do painel e
 *  a de quem usa decidem a porta (404/401, ou o Clerk) e entregam o `q` aqui;
 *  o que vem depois é igual nas duas, e mora num lugar só.
 *
 *  🔴 O QUE NÃO PEDE NADA AO NOMINATIM, na ordem: `q` ausente, vazio ou só de
 *  espaços → 200 `[]`; `q` acima de `TETO_DA_BUSCA` → 400 MUDO. O teto é
 *  conferido AQUI, antes de `buscarNoMapa` (que só barra o vazio): a política
 *  do Nominatim é pedir o mínimo, e o servidor não repassa texto de qualquer
 *  tamanho a um terceiro. Conta o `q` COMO CHEGOU, sem aparar: aparar antes
 *  deixaria passar 120 letras mais um monte de espaços. Falha do serviço
 *  (fora, ou a vez do 1/s ocupada) → 503 com `BUSCA_NAO_SAIU`; os achados
 *  voltam como o serviço deu. Só lê: nada aqui grava. */
export async function respostaDaBusca(q: string | null): Promise<Response> {
  const texto = q ?? "";
  if (texto.length > TETO_DA_BUSCA) return new Response("", { status: 400, headers: TEXTO });
  if (texto.trim() === "") return Response.json([], { headers: SEM_CACHE });
  const r = await buscarNoMapa(texto);
  if ("falha" in r) return new Response(BUSCA_NAO_SAIU, { status: 503, headers: TEXTO });
  return Response.json(r.achados, { headers: SEM_CACHE });
}
