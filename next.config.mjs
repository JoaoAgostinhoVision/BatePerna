import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Em dev o SW só atrapalha: serve build velho e confunde depuração.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A ficha é lida de content/fichas em tempo de request (src/lib/ficha.ts via fs).
  // O tracer estático do Next não enxerga readdirSync dinâmico, então incluímos a
  // pasta explicitamente no bundle serverless — senão o deploy quebra ("ficha não
  // encontrada"), e só em produção. tests/deploy/tracing.test.ts é o cadeado:
  // ele falha se nascer rota que lê ficha sem declarar aqui.
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
    "/[slug]": ["./content/**/*"],
    "/trilhas": ["./content/**/*"],
    "/api/confirmar": ["./content/**/*"],
    "/api/cron/motor": ["./content/**/*"],
  },
};

export default withSerwist(nextConfig);
