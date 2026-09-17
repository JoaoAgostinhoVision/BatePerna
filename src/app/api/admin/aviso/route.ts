import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { getClient, inserirAviso, retirarAviso, type EfeitoAviso } from "@/lib/db";
import { getFicha } from "@/lib/ficha";

export const dynamic = "force-dynamic";

const EFEITOS: readonly EfeitoAviso[] = ["nenhum", "fresco", "frio", "fechado"];

function tokenDoCookie(req: Request): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_ADMIN}=`))
    ?.slice(COOKIE_ADMIN.length + 1);
}

export async function POST(req: Request): Promise<Response> {
  // 🔴 404, não 401: painel desligado não anuncia que existe. Mesma regra de
  // /entrar e /sair — e ela vem ANTES da sessão, porque sem ADMIN_SENHA não
  // existe segredo pra validar sessão nenhuma.
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("", { status: 400 });
  }
  // 🔴 `null` é JSON válido — não estoura o catch acima — mas destructurar
  // `null` estoura na hora. Mesma guarda que /entrar já tem com o `?.` em
  // `senha`, só que aqui há quatro campos, então o corpo inteiro é checado.
  if (typeof body !== "object" || body === null) return new Response("", { status: 400 });

  const { slug, texto, efeito, venceEm } = body as {
    slug?: unknown; texto?: unknown; efeito?: unknown; venceEm?: unknown;
  };
  if (typeof slug !== "string" || getFicha(slug) == null) return new Response("", { status: 400 });
  if (typeof texto !== "string" || texto.trim() === "") return new Response("", { status: 400 });
  if (typeof efeito !== "string" || !EFEITOS.includes(efeito as EfeitoAviso)) {
    return new Response("", { status: 400 });
  }
  // 🔴 Prazo no passado nasce vencido: o dono acha que publicou e a tela não
  // mostra nada. `<=`, não `<` — no instante exato do prazo, já venceu, mesma
  // regra de `avisoVigente` (`vence_em > agora`).
  if (typeof venceEm !== "number" || venceEm <= agora) return new Response("", { status: 400 });

  const id = await inserirAviso(getClient(), slug, texto.trim(), efeito as EfeitoAviso, agora, venceEm);
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("", { status: 400 });

  await retirarAviso(getClient(), id);
  return new Response("", { status: 200, headers: { "cache-control": "no-store" } });
}
