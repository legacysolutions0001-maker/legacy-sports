import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outdir: distDir,
    outExtension: { ".js": ".cjs" },
    logLevel: "info",
    // Load .sql files as plain text strings
    loader: { ".sql": "text" },
    external: [
      "node:assert", "node:buffer", "node:child_process", "node:cluster",
      "node:console", "node:constants", "node:crypto", "node:dgram",
      "node:diagnostics_channel", "node:domain", "node:events",
      "node:fs", "node:fs/promises", "node:http", "node:http2", "node:https",
      "node:inspector", "node:module", "node:os", "node:path",
      "node:perf_hooks", "node:process", "node:querystring", "node:readline",
      "node:repl", "node:stream", "node:stream/consumers", "node:stream/promises",
      "node:stream/web", "node:string_decoder", "node:timers", "node:timers/promises",
      "node:trace_events", "node:url", "node:util", "node:util/types",
      "node:v8", "node:vm", "node:wasi", "node:zlib",
      "assert", "buffer", "child_process", "cluster", "console", "constants",
      "crypto", "dgram", "diagnostics_channel", "domain", "events",
      "fs", "http", "http2", "https", "inspector", "module", "os",
      "path", "perf_hooks", "process", "querystring", "readline", "repl",
      "stream", "string_decoder", "timers", "url", "util", "v8",
      "vm", "zlib",
      "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
      "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate",
      "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "lightningcss",
      "pg-native", "oracledb", "mongodb-client-encryption",
      "@prisma/client", "@mikro-orm/*", "@grpc/*", "@swc/*", "@aws-sdk/*",
      "@azure/*", "@opentelemetry/*", "@google-cloud/*", "@google/*",
      "googleapis", "firebase-admin", "@parcel/watcher", "@sentry/profiling-node",
      "@tree-sitter/*", "aws-sdk", "classic-level", "dd-trace", "ffi-napi",
      "grpc", "hiredis", "kerberos", "leveldown", "miniflare", "mysql2",
      "newrelic", "odbc", "piscina", "realm", "ref-napi", "rocksdb",
      "sass-embedded", "sequelize", "serialport", "snappy", "tinypool",
      "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
      "playwright", "puppeteer", "puppeteer-core", "electron",
    ],
    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
