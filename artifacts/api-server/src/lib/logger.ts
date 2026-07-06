type Fields = Record<string, unknown>;

function serializeValue(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack, name: value.name };
  }
  return value;
}

function emit(level: "info" | "warn" | "error" | "debug", a: unknown, b?: unknown): void {
  const isObj = a !== null && typeof a === "object";
  const fields: Fields | undefined = isObj ? (a as Fields) : undefined;
  const msg = isObj ? (typeof b === "string" ? b : undefined) : (a as string | undefined);
  const entry = {
    level,
    time: new Date().toISOString(),
    ...(fields ?? {}),
    ...(msg !== undefined ? { msg } : {}),
  };
  const line = JSON.stringify(entry, serializeValue);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (a: unknown, b?: unknown) => emit("info", a, b),
  warn: (a: unknown, b?: unknown) => emit("warn", a, b),
  error: (a: unknown, b?: unknown) => emit("error", a, b),
  debug: (a: unknown, b?: unknown) => emit("debug", a, b),
};

export function httpLogger(req: any, res: any, next: () => void): void {
  req.log = logger;
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      { method: req.method, url: req.url?.split("?")[0], statusCode: res.statusCode, ms: Date.now() - start },
      "request",
    );
  });
  next();
}
