import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind Render/Cloudflare proxy — required for secure cookies + correct req.ip
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Security headers ──────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────
const rawDomains = process.env["REPLIT_DOMAINS"] ?? "";
const renderUrl = process.env["RENDER_EXTERNAL_URL"] ?? "";
const corsOrigin = process.env["CORS_ORIGIN"] ?? "";
const allowedOrigins: string[] = [
  ...rawDomains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`),
  ...(renderUrl ? [renderUrl.replace(/\/$/, "")] : []),
  ...(corsOrigin ? [corsOrigin.replace(/\/$/, "")] : []),
];
if (process.env["NODE_ENV"] !== "production") {
  allowedOrigins.push("http://localhost:3000", "http://localhost:5173");
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin not allowed — ${origin}`));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// ── Health check endpoint ─────────────────────────────────────────────────
app.get("/api/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Legacy Sports API is healthy" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", router);

// ── 404 JSON handler ──────────────────────────────────────────────────────
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Serve web frontend ────────────────────────────────────────────────────
const candidateDirs = [
  process.env["WEB_DIST_DIR"],
  path.resolve(process.cwd(), "artifacts/web/dist/public"),
  path.resolve(process.cwd(), "artifacts/web/dist"),
  path.resolve(process.cwd(), "../web/dist/public"),
  path.resolve(process.cwd(), "../web/dist"),
  path.resolve(process.cwd(), "dist/web"),
].filter((d): d is string => Boolean(d));

const webDir = candidateDirs.find(
  (d) => fs.existsSync(d) && fs.existsSync(path.join(d, "index.html")),
);

if (webDir) {
  logger.info({ webDir }, "Serving web frontend");
  app.use(express.static(webDir, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });
} else {
  logger.warn({ tried: candidateDirs }, "No web frontend dist found");
  app.get("/", (_req, res) => {
    res.status(200).json({ status: "ok", message: "Legacy Sports API is running" });
  });
}

export default app;
