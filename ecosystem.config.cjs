// PM2 process definition — keeps `next start` alive and restarts on crash/reboot.
// Usage on the server:  pm2 start ecosystem.config.cjs
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
  ],
};
