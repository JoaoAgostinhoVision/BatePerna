/** A TELA DE ENTRAR, DENTRO DO APP (25/10, consertos de confiança do estudo
 *  "uso e dinheiro"). Antes, quem tocava "Você" sem estar logado ia pro portal
 *  hospedado do Clerk: em inglês, com o nome de outra marca, sem volta pro app
 *  — parecia golpe. Agora o Clerk manda pra cá (o `signInUrl` do middleware e
 *  do `<ClerkProvider>`), e a mesma tela também cria a conta (`withSignUp`).
 *  Mora num módulo neutro porque o middleware e o layout o leem. */
export const ENTRAR = "/contribuir/entrar";
