"use client";
import { createContext, useContext, useState } from "react";

/** PRA ONDE OS EDITORES GRAVAM — e se o número de motor pede prévia (Tarefa 11).
 *
 *  🔴 O PADRÃO É A FICHA NO AR, e ninguém que já existia muda: `FichaInteira`
 *  não monta provedor nenhum, então todo editor continua gravando em
 *  `/api/admin/ficha`, como antes. Só o formulário de LUGAR NOVO
 *  (`FormularioDeLugar`) envolve os mesmos editores num provedor que aponta pra
 *  `/api/admin/rascunho` — é o que deixa a caixa de prosa, a lista, o
 *  interruptor, o horário e o mapa servirem ao rascunho SEM CÓPIA. As duas portas
 *  aceitam as mesmas formas de corpo (`{slug, campo, valor}`, `{slug, campo,
 *  naoSei}`, `{slug, ponto, lat, lng}`), então o editor não sabe a diferença.
 *
 *  `previa: false` desliga a prévia do carimbo no número de motor: ela pede ao
 *  servidor o carimbo do lugar com o número novo, e um rascunho não tem lugar no
 *  ar pra calcular — a resposta seria sempre "não consegui conferir", uma frase
 *  de falha que não é falha nenhuma.
 *
 *  `depoisDeGravar` diz pra onde a tela vai depois de um sucesso. `null` (o
 *  PADRÃO, o da ficha no ar) é o `location.reload()` de sempre: a mesma tela,
 *  relida do banco. O formulário de lugar novo, que é UMA PERGUNTA POR VEZ
 *  (decisão do João, 2026-10-03), passa uma função que dá o endereço da
 *  PRÓXIMA pergunta a partir do `slug` que a porta DEVOLVEU — e a tela vai pra
 *  lá com `location.assign`, também relida do banco. 🔴 O slug devolvido, nunca
 *  o que a tela tinha: corrigir o nome ou a cidade muda o endereço do rascunho
 *  (onda de fix 2 da 11b), e o endereço velho já não existe. Recusa e falha de
 *  rede não vão a lugar nenhum, nos dois casos. */
export const PortaDoEditor = createContext<{
  gravarEm: string;
  previa: boolean;
  depoisDeGravar: ((slug: string) => string) | null;
}>({
  gravarEm: "/api/admin/ficha",
  previa: true,
  depoisDeGravar: null,
});

/** A GRAVAÇÃO DE UM CAMPO, UMA VEZ SÓ — o que os editores desta pasta
 *  compartilham.
 *
 *  🔴 O PADRÃO ERA O DO `EditorDeVoz`, COPIADO E NÃO REINVENTADO (A8 do
 *  brief): estado local, `PUT` em `/api/admin/ficha`, `location.reload()` no
 *  sucesso. Com ~30 campos na tela, recarregar depois de cada gravação parece
 *  grosseiro — e é o certo aqui: **a tela vem da fonte nova (o banco), nunca de
 *  estado otimista.** Este projeto já pagou "duas fontes pra mesma pergunta"
 *  mais de uma vez; um editor que pintasse o valor novo sozinho estaria
 *  afirmando que a gravação virou documento sem ter lido o documento.
 *
 *  🔴 A FRASE DA RECUSA É O CORPO DA RESPOSTA, EM QUALQUER CÓDIGO (A4 do brief).
 *  Até 2026-09-27 a rota devolvia `""` em todo 400 e as frases do registro
 *  morriam ali; a Tarefa 3 consertou, e são elas que dizem ao dono O QUE FAZER
 *  ("preencha o `horario` inteiro de uma vez"). Um editor que escrevesse "erro"
 *  no 400 e só respeitasse o 409 jogaria aquele conserto no lixo. Frase própria
 *  (`ERRO_GRAVAR`) só quando o corpo vem VAZIO — que é o caso do `ZodError` e
 *  das recusas de forma, onde não existe português pra mostrar.
 *
 *  🔴 E O QUE ELE DIGITOU NÃO SOME EM RECUSA NENHUMA (A9). Este módulo não
 *  toca no estado do editor: em 400, em 409 e em falha de rede, o que está na
 *  caixa continua na caixa. Perder no celular, por um sinal ruim, o texto que
 *  acabou de escrever é o defeito que faz alguém parar de usar o painel. Quem
 *  troca a tela é só o SUCESSO — `location.reload()`, ou `location.assign` pra
 *  próxima pergunta no formulário de lugar novo (ver `depoisDeGravar`). */

// PENDENTE: vinha do `EditorDeVoz` já marcado; o João ainda não leu
export const ERRO_GRAVAR = "Não consegui salvar.";
// PENDENTE: vinha do `EditorDeVoz` já marcado; o João ainda não leu
export const ERRO_REDE = "Sem rede.";

export type Gravacao = {
  /** A frase da última recusa, ou `null`. Vem do corpo da resposta quando ele
   *  tem texto; de `ERRO_GRAVAR`/`ERRO_REDE` quando não tem. */
  erro: string | null;
  salvando: boolean;
  /** Manda o corpo pra porta. O corpo é montado por quem chama, porque cada
   *  espécie manda uma forma diferente (`valor` texto, `valor` lista, `valor`
   *  lista de faixas do horário, `naoSei: true`) — e a porta lê exatamente o que chegou. */
  gravar: (corpo: Record<string, unknown>) => Promise<void>;
  /** Recusa DAQUI, sem viagem nenhuma.
   *
   *  🔴 ISTO NÃO É A GARANTIA, e a distinção importa: a garantia é a porta, que
   *  revalida o documento inteiro. O cliente recusa antes só pra poupar uma ida
   *  ao banco numa rede de interior — e há teste cravando que a rota **não foi
   *  chamada** nesses casos, que é a única forma de provar que é isso que
   *  acontece. */
  recusarAqui: (frase: string) => void;
};

export function usarGravacao(): Gravacao {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { gravarEm, depoisDeGravar } = useContext(PortaDoEditor);

  async function gravar(corpo: Record<string, unknown>): Promise<void> {
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(gravarEm, { method: "PUT", body: JSON.stringify(corpo) });
      if (r.ok) {
        if (depoisDeGravar === null) location.reload();
        else location.assign(depoisDeGravar(((await r.json()) as { slug: string }).slug));
        return;
      }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setSalvando(false);
    }
  }

  return { erro, salvando, gravar, recusarAqui: setErro };
}
