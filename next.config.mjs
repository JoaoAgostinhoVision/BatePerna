/** @type {import('next').NextConfig} */
const nextConfig = {
  // A ficha é lida de content/fichas em tempo de request (src/lib/ficha.ts via fs).
  // O tracer estático do Next não enxerga readdirSync dinâmico, então incluímos a
  // pasta explicitamente no bundle serverless — senão o deploy quebra ("ficha não encontrada").
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
  },
};
export default nextConfig;
