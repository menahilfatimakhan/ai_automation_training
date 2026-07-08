// PM2 process definitions — keeps both the web app and the scheduler alive,
// restarting on crash/reboot. Usage on the server:  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "newszn",
      script: "npm",
      args: "start", // runs `next start`
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      // Standalone scheduler process (src/scheduler/index.ts) — hourly ad
      // sync, 4-hourly anomaly scan, hourly daily-target/report check. Not
      // part of the Next.js request lifecycle; see docs/DEPLOYMENT.md.
      name: "newszn-scheduler",
      script: "npx",
      args: "tsx src/scheduler/index.ts",
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
