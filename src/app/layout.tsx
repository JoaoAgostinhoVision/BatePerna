import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BatePerna",
  description: "Aventura pela via segura.",
};

/** --ground do ficha.css nos dois temas: a barra de status do celular passa a
 *  ser a mesma cor do fundo da ficha em vez de uma faixa branca por cima.
 *  viewportFit cover é o que deixa o CSS alcançar as safe areas. */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E7DFD0" },
    { media: "(prefers-color-scheme: dark)", color: "#100D08" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
