import type { Client } from "@libsql/client";
import { enderecosComRascunho, enderecosVelhos, gravarVersao, versoesAtuais } from "@/lib/db";
import type { Ficha } from "@/types/ficha";

/** Põe no banco as fichas que ainda não estão lá, e SÓ essas.
 *
 *  🔴 IDEMPOTENTE, e isto é a coisa inteira. A semente roda uma vez, mas
 *  alguém vai rodá-la de novo — por engano, ou porque o primeiro deploy morreu
 *  no meio. Regravar não violaria o append-only (nada seria apagado), e ainda
 *  assim o texto que o João escreveu pelo painel sumiria da tela: a semente
 *  viraria a versão de maior `id`, que é a que o app mostra. A proteção vale
 *  DENTRO do lote também: `jaTem` é um retrato de antes do laço, então dois
 *  slugs iguais na mesma `fichas` também precisam ser rastreados enquanto o
 *  laço roda — sem isto, o segundo escaparia do `jaTem.has` e gravaria de
 *  novo na mesma chamada. */
export async function semear(
  client: Client, fichas: Ficha[], agora: number,
): Promise<{ semeados: string[]; pulados: string[] }> {
  // 🔴 `incluirOcultos: true`, E ESTA LINHA É CRÍTICA. A pergunta daqui é "este
  // lugar já tem ficha no banco?", e lugar ESCONDIDO tem. Com o filtro padrão de
  // `versoesAtuais` (só o que está no ar), um acervo cujos lugares estão todos
  // escondidos pareceria VAZIO daqui: `jaTem` viria sem nenhum slug, a semente
  // regravaria tudo, e as versões novas nasceriam VISÍVEIS por cima do que o dono
  // escondeu de propósito. Ele esconderia três lugares, o deploy seguinte
  // rodaria `npm run semear`, e os três voltariam AO AR sem ninguém pedir — a
  // mesma família do defeito que o "IDEMPOTENTE" do docstring acima existe pra
  // impedir, entrando pela coluna nova.
  const jaTem = await versoesAtuais(client, { incluirOcultos: true });
  // 🔴 E TODO ENDEREÇO ANTIGO CONTA COMO "JÁ TEM" (Tarefa 11e, E6). Um lugar
  // cujo endereço o dono trocou não está mais em `versoesAtuais` sob o endereço
  // de nascença — e a semente, que é o JSON de nascença, o regravaria lá,
  // VISÍVEL: dois lugares públicos, um deles com a voz antiga no ar.
  const velhos = await enderecosVelhos(client);
  // 🔴 E TODO ENDEREÇO COM RASCUNHO TAMBÉM (M3 da revisão final, 2026-10-06).
  // Um rascunho no endereço de um JSON do disco faria a semente gravar a versão
  // AO LADO dele — rascunho e lugar no mesmo endereço, o estado que
  // `criarRascunho` declara impossível. Sem caminho real hoje (os JSONs já
  // estão no banco de produção); é guarda barato, não trava de deploy.
  const comRascunho = await enderecosComRascunho(client);
  const semeados: string[] = [];
  const pulados: string[] = [];
  for (const f of fichas) {
    if (jaTem.has(f.slug) || velhos.has(f.slug) || comRascunho.has(f.slug) || semeados.includes(f.slug)) { pulados.push(f.slug); continue; }
    await gravarVersao(client, f.slug, JSON.stringify(f), "semente", agora);
    semeados.push(f.slug);
  }
  return { semeados, pulados };
}
