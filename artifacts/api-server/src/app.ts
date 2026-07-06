import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
import { httpLogger, logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(httpLogger);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: e, cause: e.cause, code: (err as NodeJS.ErrnoException)?.code }, "Unhandled error");
  res.status(500).json({ error: "Internal server error", detail: e.message, code: (err as NodeJS.ErrnoException)?.code });
});

export default app;
