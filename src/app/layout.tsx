import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BatePerna",
  description: "Aventura pela via segura.",
  icons: {
    icon: "/icones/192",
    apple: "/icones/apple",
  },
  /** O manifest sozinho não é garantia em todo iOS: sem
   *  apple-mobile-web-app-capable o ícone da tela inicial pode abrir dentro do
   *  Safari, com barra de URL — e a moldura de app desta rodada não aparece.
   *  statusBarStyle fica opaco de propósito: black-translucent jogaria a ficha
   *  por baixo do relógio com texto claro sobre o creme do tema claro. */
  appleWebApp: { capable: true, title: "BatePerna", statusBarStyle: "default" },
  /** `appleWebApp.capable` no Next 15 sai como `mobile-web-app-capable`, a tag
   *  padrão — que o WebKit só entende do iOS 17.4 em diante. Abaixo disso, a
   *  única que abre em tela cheia é a antiga com prefixo. Depreciada, sim, e é
   *  exatamente ela que salva um iPhone que não subiu de versão. */
  other: { "apple-mobile-web-app-capable": "yes" },
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
