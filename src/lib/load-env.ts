import { config } from "dotenv";

/**
 * Side-effect module that loads .env.local. Import this FIRST (before any module
 * that reads validated env, e.g. @/lib/env) in standalone CLI scripts run via
 * tsx (seed, migrate). ES module imports are evaluated in source order before
 * the importing file's body, so a top-of-file `import "@/lib/load-env"` ensures
 * env is populated before eager env validation runs.
 *
 * Next.js loads .env.local itself, so app code never needs this.
 */
config({ path: ".env.local" });
