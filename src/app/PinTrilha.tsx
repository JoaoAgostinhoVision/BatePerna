"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { fechadoPeloDono } from "@/lib/aviso";
import { faseDe } from "@/lib/carimbo-fase";
import { fechadoAgora, type Abertura, type Agora } from "@/lib/horario";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { tomDe, type Severidade } from "@/lib/severidade";
import { useLeitura } from "./leituras";
import { useVenceu } from "./useVenceu";

/** O pin de uma trilha no mapa da home.
 *
 *  É ÂNCORA, não botão: `href="#<slug>"` rola até o cartão daquela trilha. Assim
 *  tocar o pin funciona com o JavaScript desligado, que é a regra da casa —
 *  este app não tem next/link nem navegação soft em lugar nenhum.
 *
 *  A COR não tem estado próprio aqui: sai do mesmo contexto que pinta o selo do
 *  cartão. Guardar a leitura localmente seria a segunda fonte de cor, e foi
 *  exatamente isso que uma vez pôs "Não vá" dentro de um selo verde. O único
 *  estado local é o relógio da validade (useVenceu), que não decide cor de
 *  veredito — decide se ainda há veredito. */
export default function PinTrilha({
  slug,
  nome,
  left,
  top,
  inicial,
  abertura,
  severidade,
  conferido,
  agora = null,
}: {
  slug: string;
  nome: string;
  left: number;
  top: number;
  inicial: LeituraCarimbo;
  /** Quando esta trilha abre — hora, dias, ou os dois. Sem ela, o pin nunca
   *  fecha, e o mapa seria a quarta boca a discordar das outras três. */
  abertura?: Abertura;
  /** O nível desta trilha: o pin é pintado pelo TOM, igual ao cartão e ao selo.
   *  Sem ele o mapa seria a quarta boca a discordar das outras três. */
  severidade: Severidade;
  /** O lugar foi conferido pelo João? Obrigatório pela razão do
   *  `fechadoPeloDono` de `Situacao`: opcional, um mapa novo esqueceria e o
   *  pin de um lugar não conferido sairia igual aos outros. */
  conferido: boolean;
  /** O relógio de Recife (`Agora`), ou `null` no primeiro render. Chega por prop
   *  pela mesma razão que a leitura chega: são N pins, e a fonte tem que ser
   *  UMA — quem lê o relógio é o `MapaHome`, uma vez só. */
  agora?: Agora | null;
}) {
  const leitura = useLeitura(slug) ?? inicial;
  const venceu = useVenceu(leitura.calculadoEm);
  const fase = faseDe({
    conferindo: false,
    erro: leitura.erro,
    venceu,
    falhou: false,
    fechado: fechadoAgora(abertura, agora),
    // O mesmo relógio do calendário decide o prazo do aviso (`epochS` viaja
    // dentro de `agora`); `null` no primeiro render, o aviso vale como chegou.
    fechadoPeloDono: fechadoPeloDono(leitura.aviso, agora?.epochS ?? null),
  });

  return (
    <a
      className="pin-home"
      href={`#${slug}`}
      data-lugar={slug}
      data-state={tomDe(leitura.estado, severidade)}
      data-fase={fase}
      // 🔴 A MARCA (spec de 07/10, Parte 2): o pin não tem texto, então ela é o
      // CONTORNO (`data-conferido`, no `home.css`) e o nome que o leitor de
      // tela lê. Sai quando o João confere.
      {...(conferido ? {} : { "data-conferido": "nao", "data-marca": "nao-conferido" })}
      style={{ left, top }}
      aria-label={conferido ? `Ver ${nome}` : `Ver ${nome}, ${ETIQUETA_NAO_CONFERIDO}`}
    />
  );
}
