import { getClient, ensureSchema } from "../src/lib/db";

async function main() {
  const client = getClient();
  await ensureSchema(client);
  console.log("schema aplicado");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
