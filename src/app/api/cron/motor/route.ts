import { getClient } from "@/lib/db";
import { runMotor } from "@/lib/runMotor";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const agora = Math.floor(Date.now() / 1000);
  const result = await runMotor({ client: getClient(), agora });
  return Response.json(result);
}
