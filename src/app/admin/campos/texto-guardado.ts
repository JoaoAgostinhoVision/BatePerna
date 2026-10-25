/** O TEXTO GUARDADO NO APARELHO DELA (rodada `d-401`, 25/10, desenho aprovado
 *  pelo João no chat). A sessão dela venceu no meio, o Salvar volta 401 e a
 *  tela recarrega pra pedir login (`recarregarSe401`, em `./gravar`). Antes de
 *  recarregar, o texto que estava na caixa fica aqui; depois do login ele volta
 *  à MESMA caixa, ainda não salvo, com o aviso `TEXTO_GUARDADO`. Sai quando ela
 *  salva (o sucesso) ou toca "Desfazer".
 *
 *  🔴 `localStorage`, e não `sessionStorage`: o João decidiu que o texto espera
 *  ela voltar, mesmo que feche o app e volte no outro dia. Sem prazo.
 *
 *  🔴 O APARELHO PODE NEGAR (aba anônima, armazenamento cheio, site bloqueado):
 *  toda leitura e escrita fica em `try/catch`, e o que falha aqui só deixa de
 *  guardar — o 401 recarrega do mesmo jeito, como antes desta rodada.
 *
 *  Só texto escrito à mão: a caixa de texto (`EditorProsa`) e o nome do
 *  primeiro passo (`ComecarLugarNovo`). Uma opção, um dia, um sim/não se
 *  refazem com um toque (decisão minha, no desenho). */

const PREFIXO = "bateperna:texto-guardado:";

/** A chave de UMA caixa: o lugar (o endereço, ou a chave do rascunho) e o
 *  caminho do campo. O guardado de outro lugar nunca entra nesta caixa. */
export const chaveDoTexto = (slug: string, caminho: string): string => `${PREFIXO}${slug}:${caminho}`;

/** O nome do primeiro passo ainda não tem lugar nenhum: chave própria. */
export const CHAVE_DO_NOME_NOVO = `${PREFIXO}novo:nome`;

export function guardarTexto(chave: string, texto: string): void {
  try {
    localStorage.setItem(chave, texto);
  } catch {
    // O aparelho negou: nada guardado, e o 401 segue recarregando.
  }
}

export function lerTexto(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function esquecerTexto(chave: string): void {
  try {
    localStorage.removeItem(chave);
  } catch {
    // Nada a fazer: o que não se lê também não volta.
  }
}
