// PM2: Airnet VPS (talabapass.uz). Sirlar bu yerda emas — /etc/talabapass/env dan (node --env-file) o'qiladi.
// Ishga tushirish/yangilash faqat deploy/deploy.sh orqali (docs/server.md).
module.exports = {
  apps: [
    {
      name: "talabapass",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      node_args: "--env-file=/etc/talabapass/env",
      exec_mode: "cluster",
      instances: 2,
      max_memory_restart: "1200M",
      kill_timeout: 10000,
    },
  ],
};
