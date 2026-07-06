import app from "./app";
import { logger } from "./lib/logger";
import { bootstrap } from "./lib/bootstrap";
import { startBillingScheduler } from "./lib/billing";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  await bootstrap().catch((err) => {
    logger.error({ err }, "Bootstrap (migrations / seed) failed");
    process.exit(1);
  });

  startBillingScheduler();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main();
