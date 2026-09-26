import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Em dev o SW só atrapalha: serve build velho e confunde depuração.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Não há mais outputFileTracingIncludes de content/fichas: desde 2026-09-25 a
  // ficha vem do banco (src/lib/ficha.ts, via src/lib/ficha-fonte.ts), não mais de
  // fs em tempo de request. content/fichas só é lido por scripts/semear-fichas.ts
  // (a semente) e em teste — os dois rodam fora do bundle serverless, então não
  // precisam de tracer nenhum. Quem impede a volta é
  // tests/lib/sem-disco-em-producao.test.ts.
};

export default withSerwist(nextConfig);
