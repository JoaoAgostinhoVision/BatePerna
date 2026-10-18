import type { AchadoNoMapa } from "@/lib/nominatim";
import type * as Servico from "@/lib/nominatim-servico";

/** O DUBLÊ DO NOMINATIM das rotas que o chamam. Quem o usa faz, no topo:
 *
 *    vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());
 *
 *  e muda `nominatimDeTeste.ponto` / `.busca` em cada caso; `.pontos` e `.buscas`
 *  registram o que a rota pediu. 🔴 O ESTADO MORA EM `globalThis` (`??=`), não num
 *  `const` de módulo — a regra do dublê do Clerk (`./sessao-da-pessoa`): um
 *  import depois de `vi.resetModules()` renasce o módulo e devolve o MESMO objeto. */
export type EstadoDoNominatim = {
  ponto: { cidade: string } | { falha: string };
  busca: { achados: AchadoNoMapa[] } | { falha: string };
  pontos: { lat: number; lng: number }[];
  buscas: string[];
};
const g = globalThis as typeof globalThis & { __nominatim?: EstadoDoNominatim };
export const nominatimDeTeste: EstadoDoNominatim = (g.__nominatim ??= {
  ponto: { cidade: "Cidade Marcador Um" },
  busca: { achados: [] },
  pontos: [],
  buscas: [],
});

export function dubleDoNominatim(): Pick<typeof Servico, "cidadeDoPonto" | "buscarNoMapa"> {
  return {
    cidadeDoPonto: (async (lat: number, lng: number) => {
      nominatimDeTeste.pontos.push({ lat, lng });
      return nominatimDeTeste.ponto;
    }) as typeof Servico.cidadeDoPonto,
    buscarNoMapa: (async (q: string) => {
      nominatimDeTeste.buscas.push(q);
      return nominatimDeTeste.busca;
    }) as typeof Servico.buscarNoMapa,
  };
}
