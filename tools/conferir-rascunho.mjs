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

// `cidade` (Tarefa 11b): o fichaSchema a ACEITA AUSENTE — as fichas de antes de
// 04/10 não a têm —, e aqui a AUSENTE também passa (onda de fix da 11b: exigi-la
// dizia "FORMA: ✗" pra uma ficha que o loadAll() aceita). Ausente vira uma linha
// de AVISO no fim, não erro: lugar NOVO nasce com ela, e publicar sem ela é a
// recusa da Tarefa 12, não a FORMA. PRESENTE, a régua é a do PAINEL, mais dura
// que a do schema: o schema aceita qualquer texto (`""` e `"--"` passam lá), e
// aqui ela tem de ser texto com letra ou número — é o que as portas do painel
// gravam, e o que separa dois lugares pelo par.
// (A régua é a de `slugDoNome`, de `src/lib/rascunho.ts`: sem acento, sobra a-z ou 0-9.)
const temLetra = (s) => /[a-z0-9]/.test(s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
if ("cidade" in f && !(str(f.cidade) && temLetra(f.cidade)))
  erros.push("cidade: presente, mas não é texto com letra ou número");
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

// 🔴 OS NOMES DE PISO SAEM DE `src/lib/piso.ts`, NUNCA DE UMA LISTA AQUI.
// Até 2026-09-04 esta linha repetia os quatro à mão — o espelho exato do
// defeito que `tests/lib/ficha.test.ts` existe pra impedir no zod: um quinto
// piso acrescentado em `piso.ts` passaria no `tsc` e no parse, e seria
// **recusado pela ferramenta que o RESUME manda rodar antes de publicar**.
// Lido do fonte porque isto é `.mjs` e não importa TypeScript; se a leitura
// falhar, ela GRITA em vez de cair numa lista de reserva — lista de reserva
// aqui seria o defeito de volta com outra roupa.
const fontePiso = fs.readFileSync(new URL("../src/lib/piso.ts", import.meta.url), "utf8");
const decl = /export const PISOS = \[([\s\S]*?)\]/.exec(fontePiso);
if (!decl) {
  erros.push("não consegui ler PISOS de src/lib/piso.ts — a checagem do piso ficaria oca");
} else {
  const nomes = [...decl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (nomes.length === 0) erros.push("PISOS foi lido vazio de src/lib/piso.ts");
  if (f.piso && nomes.length && !nomes.includes(f.piso))
    erros.push(`piso: "${f.piso}" não é um dos ${nomes.length} de src/lib/piso.ts (${nomes.join(", ")})`);
}
if ("carroComum" in f && typeof f.carroComum !== "boolean") erros.push("carroComum");
// O horário (Tarefa 11c): a LISTA de 1 a 3 faixas OU o objeto de antes — as
// duas formas que o fichaSchema aceita. Só a FORMA: ordem e sobreposição são
// regras de escrita do painel (`problemaDasFaixas`, em src/lib/horario.ts).
if ("horario" in f) {
  const faixas = Array.isArray(f.horario) ? f.horario : [f.horario];
  if (faixas.length < 1 || faixas.length > 3) erros.push("horario: de 1 a 3 faixas");
  faixas.forEach((faixa, i) => {
    for (const k of ["abre", "fecha"])
      if (!/^\d{2}:\d{2}$/.test(faixa?.[k] ?? "")) erros.push(`horario.${i}.${k}: precisa ser HH:MM`);
  });
}

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
console.log(
  `cidade: ${"cidade" in f ? "presente" : "AUSENTE — o schema aceita, mas lugar NOVO nasce com ela e publicar sem ela é recusado (Tarefa 12)"}`,
);
process.exit(erros.length ? 1 : 0);
