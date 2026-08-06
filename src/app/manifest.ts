import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BatePerna",
    short_name: "BatePerna",
    description: "Aventura pela via segura.",
    lang: "pt-BR",
    // A raiz despacha pra última ficha aberta — então o manifest não precisa
    // saber qual é, e o comportamento acompanha você sem redeploy.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#E7DFD0",
    theme_color: "#E7DFD0",
    icons: [
      { src: "/icones/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
