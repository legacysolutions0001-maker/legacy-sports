import { httpServerHandler } from "cloudflare:node";

export interface Env {
  DATABASE_URL: string;
  SESSION_SECRET: string;
  [key: string]: unknown;
}

const PORT = 8080;

let handlerPromise: Promise<{ fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response> | Response }> | null = null;

async function init(env: Env) {
  Object.assign(process.env, env);

  const { default: app } = await import("./app");
  const { logger } = await import("./lib/logger");
  const { bootstrap } = await import("./lib/bootstrap");
  const { startBillingScheduler } = await import("./lib/billing");

  await bootstrap().catch((err) => {
    logger.error({ err }, "Bootstrap (migrations / seed) failed");
  });

  startBillingScheduler();

  app.listen(PORT);

  return httpServerHandler({ port: PORT });
}

export default {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    if (!handlerPromise) {
      handlerPromise = init(env);
    }
    const handler = await handlerPromise;
    return handler.fetch(request, env, ctx);
  },
};
