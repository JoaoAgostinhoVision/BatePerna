import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, inserirAviso, retirarAviso, versaoAtual, type EfeitoAviso } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";

export const dynamic = "force-dynamic";

const EFEITOS: readonly EfeitoAviso[] = ["nenhum", "fresco", "frio", "fechado"];

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

  const { slug, texto, efeito, venceEm, baseId } = body as {
    slug?: unknown; texto?: unknown; efeito?: unknown; venceEm?: unknown; baseId?: unknown;
  };
  // 🔴 A EXISTÊNCIA DO LUGAR SAI DE `versaoAtual`, NUNCA DE `getFicha` (R1 da onda
  // de conserto 1 da Task 9, 2026-10-01) — a mesma regra das rotas irmãs
  // (`visibilidade`, `previsao-carimbo`). `getFicha` filtra os ocultos, e a
  // página do lugar escondido abre pro dono desde a Task 9 com este formulário
  // dentro: o dono escrevia o aviso e lia "Não consegui publicar." pra sempre.
  // Esconder tira do PÚBLICO, nunca do DONO. O aviso gravado num lugar
  // escondido vale quando ele voltar ao ar, e gravá-lo NÃO desesconde nada:
  // esta rota não toca em `ficha_versoes`.
  if (typeof slug !== "string" || (await versaoAtual(getClient(), slug)) == null) {
    return new Response("", { status: 400 });
  }
  if (typeof texto !== "string" || texto.trim() === "") return new Response("", { status: 400 });
  if (typeof efeito !== "string" || !EFEITOS.includes(efeito as EfeitoAviso)) {
    return new Response("", { status: 400 });
  }
  // 🔴 Prazo no passado nasce vencido: o dono acha que publicou e a tela não
  // mostra nada. `<=`, não `<` — no instante exato do prazo, já venceu, mesma
  // regra de `avisoVigente` (`vence_em > agora`).
  if (typeof venceEm !== "number" || venceEm <= agora) return new Response("", { status: 400 });
  // 🔴 A versão que a tela abriu — a identidade do lugar (onda de fix 2 da 11e,
  // M6). `inserirAviso` a confere no mesmo INSERT.
  if (!baseIdValido(baseId)) return new Response("", { status: 400 });

  // 🔴 `inserirAviso` grava SÓ SE o lugar da tela ainda mora em `slug` (onda de
  // fix da 11e, I1): a troca de endereço entre a leitura acima e esta linha
  // deixaria um "fechado" órfão no endereço velho, que nunca aparece no lugar. E
  // "o lugar da tela" é a versão `baseId`, não o endereço (onda 2, M6): sem
  // isso, depois de outro lugar retomar `slug`, o aviso caía nele.
  const id = await inserirAviso(getClient(), slug, texto.trim(), efeito as EfeitoAviso, agora, venceEm, baseId);
  if (id === null) {
    return new Response(LUGAR_MUDOU_DE_ENDERECO, {
      status: 409,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
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
