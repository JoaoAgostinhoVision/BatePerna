// Confere se o rascunho tem a FORMA que o fichaSchema exige, sem publicá-lo.
// Não substitui o zod — a prova de verdade é o dia em que o arquivo entrar em
// content/fichas/ e o loadAll() rodar. Serve pra pegar chave faltando/errada
// agora, enquanto o arquivo ainda é rascunho.
import fs from "node:fs";

const f = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const erros = [];
const str = (v) => typeof v === "string" && v.length > 0;
const num = (v) => typeof v === "number" && Number.isFinite(v);

for (const k of ["slug", "rotulo_escaneio", "promessa", "voz", "premio", "acesso", "avisos"])
  if (!str(f[k])) erros.push(`${k}: falta ou não é string`);
if (!Array.isArray(f.modos)) erros.push("modos: não é array");

const w = f.trajeto?.waypoints?.[0];
if (!w) erros.push("trajeto.waypoints: precisa de pelo menos um");
else {
  if (!str(w.nome)) erros.push("waypoint.nome");
  if (!num(w.lat) || !num(w.lng)) erros.push("waypoint.lat/lng");
}

const c = f.condicao ?? {};
if (!num(c.coords?.lat) || !num(c.coords?.lng)) erros.push("condicao.coords");
if (c.regra?.tipo !== "chuva_binaria") erros.push('condicao.regra.tipo != "chuva_binaria"');
for (const k of ["janela_previsao_horas", "janela_passado_horas", "limiar_mm"])
  if (!num(c.regra?.[k])) erros.push(`condicao.regra.${k}`);
for (const k of ["regra_texto", "ressalva_proxy"]) if (!str(c[k])) erros.push(`condicao.${k}`);

for (const k of ["formato", "como_ler", "permissao_abortar"])
  if (!str(f.discriminador?.[k])) erros.push(`discriminador.${k}`);

if (!["gratis", "pago"].includes(f.custo?.tag)) erros.push("custo.tag");
if (f.piso && !["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"].includes(f.piso))
  erros.push(`piso: "${f.piso}" não é uma das quatro palavras`);
if ("carroComum" in f && typeof f.carroComum !== "boolean") erros.push("carroComum");
if (f.horario)
  for (const k of ["abre", "fecha"])
    if (!/^\d{2}:\d{2}$/.test(f.horario[k] ?? "")) erros.push(`horario.${k}: precisa ser HH:MM`);

// O rascunho ficou com PROSA MINHA nos quatro campos de voz, pra ele aprovar
// em vez de escrever do zero. Isso o faz PARECER pronto — e é exatamente assim
// que ele viraria ficha por engano. Então a lista de pendentes é declarada no
// próprio arquivo e conferida aqui: enquanto tiver nome, não publica.
const pendente = Array.isArray(f._PENDENTE) ? f._PENDENTE : [];
for (const k of pendente)
  if (!(k in f)) erros.push(`_PENDENTE cita "${k}", que não existe na ficha`);

console.log(erros.length ? "FORMA: ✗\n  " + erros.join("\n  ") : "FORMA: ✓ (todos os campos obrigatórios presentes)");
console.log(
  pendente.length
    ? `PUBLICAR: ✗ — ${pendente.length} campos são REDAÇÃO MINHA, esperando ele aprovar:`
    : "PUBLICAR: ✓ — nenhum campo pendente",
);
for (const k of pendente) console.log(`  🟡 ${k}: ${JSON.stringify(f[k])}`);
console.log(`secaRapido: ${"secaRapido" in f ? "presente" : "AUSENTE de propósito — o carimbo cala"}`);
process.exit(erros.length ? 1 : 0);
