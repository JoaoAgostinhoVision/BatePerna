import { ImageResponse } from "next/og";
import { ACCENT, ANTEPE, CALCANHAR, CREME, PISO, TAMANHOS, geometria } from "@/lib/marca";

// Prerenderizados no build: os PNGs viram arquivo estático, não trabalho por
// request. URLs fixas (/icones/192, ...) pra o manifest poder citá-las.
export const dynamic = "force-static";

export function generateStaticParams(): { nome: string }[] {
  return Object.keys(TAMANHOS).map((nome) => ({ nome }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nome: string }> },
): Promise<Response> {
  const { nome } = await params;
  const medida = TAMANHOS[nome];
  if (!medida) return new Response("ícone desconhecido", { status: 404 });

  const { px, margem } = medida;
  const { janela, desenho } = geometria(margem);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: ACCENT }}>
        <svg width={px} height={px} viewBox={`${janela.min} ${janela.min} ${janela.tamanho} ${janela.tamanho}`}>
          <g transform={`translate(${desenho.inicio} ${desenho.inicio}) scale(${desenho.escala})`}>
            <path d={ANTEPE} fill={CREME} />
            <path d={CALCANHAR} fill={CREME} />
            {PISO.map((b) => (
              <rect key={b.y} x={b.x} y={b.y} width={b.w} height={4.5} rx={2.25} fill={ACCENT} />
            ))}
          </g>
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
