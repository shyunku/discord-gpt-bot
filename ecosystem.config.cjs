const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "discord-gpt-bot",
      cwd: __dirname,
      script: path.join("src", "index.js"),
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 10000,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
