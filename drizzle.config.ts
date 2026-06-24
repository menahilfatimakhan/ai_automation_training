import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local for CLI tooling (drizzle-kit / migrate).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // RLS policies are authored as custom SQL migrations in ./drizzle (Step 3);
  // they are applied in order alongside the generated table migrations.
  verbose: true,
  strict: true,
});
