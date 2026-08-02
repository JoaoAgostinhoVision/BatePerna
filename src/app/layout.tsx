import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BatePerna",
  description: "Aventura pela via segura.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
