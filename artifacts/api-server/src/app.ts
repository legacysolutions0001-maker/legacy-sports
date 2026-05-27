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

// ── CORS — allow only own domain(s) + localhost in dev ───────────────────
const rawDomains = process.env["REPLIT_DOMAINS"] ?? "";
const renderUrl = process.env["RENDER_EXTERNAL_URL"] ?? "";
const corsOrigin = process.env["CORS_ORIGIN"] ?? "";
const allowedOrigins: string[] = [
  ...rawDomains
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`),
  "https://legacy-sports-xmoq.onrender.com",
  "https://legacy-sports-ql8y.onrender.com",
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

app.use("/api", router);

// ── 404 JSON handler for unmatched /api routes ────────────────────────────
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Serve the built web frontend (single-domain deployments) ──────────────
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
  logger.warn({ tried: candidateDirs }, "No web frontend dist found — root path will 404");
  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("html")
      .send(
        "<!doctype html><meta charset=utf-8><title>Legacy Sports API</title>" +
          "<body style='font-family:system-ui;padding:40px;color:#1a3a5c'>" +
          "<h1>Legacy Sports API</h1><p>API is running. Frontend bundle was not deployed alongside the API.</p>" +
          "<p>Try <a href='/api/healthz'>/api/healthz</a>.</p></body>",
      );
  });
}

export default app;
