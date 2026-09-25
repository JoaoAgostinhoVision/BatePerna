import { ensureSchema, getClient } from "../src/lib/db";
import { loadAll } from "../src/lib/ficha";
import { semear } from "../src/lib/semente";

async function main() {
  const client = getClient();
  await ensureSchema(client);
  const r = await semear(client, loadAll(), Math.floor(Date.now() / 1000));
  console.log("semeados:", r.semeados.join(", ") || "(nenhum)");
  console.log("pulados (já no banco):", r.pulados.join(", ") || "(nenhum)");
}
main().catch((e) => { console.error(e); process.exit(1); });
