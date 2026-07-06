import { Container, getContainer } from "@cloudflare/containers";

export interface Env {
  LS_CONTAINER: DurableObjectNamespace<LsContainer>;
  DATABASE_URL: string;
  SESSION_SECRET: string;
}

export class LsContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "10m";

  envVars = {
    NODE_ENV: "production",
    PORT: "8080",
    DATABASE_URL: this.env.DATABASE_URL,
    SESSION_SECRET: this.env.SESSION_SECRET,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.LS_CONTAINER);
    return container.fetch(request);
  },
};
