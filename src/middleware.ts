import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ULTIMA, ehCaminhoDeFicha } from "@/lib/despacho";

const UM_ANO = 60 * 60 * 24 * 365;

/** Metade escrita da memória do "onde você estava".
 *
 *  Só grava — nunca decide. Validar o cookie exigiria saber quais fichas
 *  existem, e middleware não enxerga content/fichas. Quem valida é "/". */
export function middleware(req: NextRequest): NextResponse {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;
  if (ehCaminhoDeFicha(pathname)) {
    res.cookies.set(COOKIE_ULTIMA, pathname.slice(1), {
      path: "/",
      maxAge: UM_ANO,
      sameSite: "lax",
    });
  }
  return res;
}

// Fora: assets do Next, API, ícones e qualquer coisa com extensão. O que sobra
// são as navegações de página, que é onde a memória faz sentido.
export const config = {
  matcher: ["/((?!_next/|api/|icones/|.*\\.).*)"],
};
