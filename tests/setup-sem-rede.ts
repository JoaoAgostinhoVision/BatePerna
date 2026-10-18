/** A suíte NUNCA bate no Nominatim de verdade (política de uso, spec §7): todo
 *  `fetch` pra ele estoura. Entra por `setupFiles` em `vitest.config.ts`. Os
 *  testes que querem ver o `fetch` do módulo trocam o global com `vi.stubGlobal`
 *  (e o desfazem) — o que não pode é chegar à rede. */
const real = globalThis.fetch;
globalThis.fetch = ((entrada: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* URL relativa: não é o Nominatim */
  }
  if (host === "nominatim.openstreetmap.org") {
    return Promise.reject(new Error("a suíte nunca bate no Nominatim de verdade"));
  }
  return real(entrada, init);
}) as typeof fetch;
