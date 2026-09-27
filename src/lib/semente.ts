import type { Client } from "@libsql/client";
import { gravarVersao, versoesAtuais } from "@/lib/db";
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
  const semeados: string[] = [];
  const pulados: string[] = [];
  for (const f of fichas) {
    if (jaTem.has(f.slug) || semeados.includes(f.slug)) { pulados.push(f.slug); continue; }
    await gravarVersao(client, f.slug, JSON.stringify(f), "semente", agora);
    semeados.push(f.slug);
  }
  return { semeados, pulados };
}
