module.exports = {
  apps: [
    {
      name: "frontend-dev",
      cwd: "/home/ubuntu/cv_ai_0818", 
      script: "pnpm",
      args: "dev --host 0.0.0.0 --port 3000",
      interpreter: "none",            
      env: {
        NODE_ENV: "development",
        HOST: "0.0.0.0",
        PORT: 3000,
        FASTAPI_BASE_URL: "http://52.76.179.88:8000",
        NUXT_VITE_HMR_HOST: "52.76.179.88",
        NUXT_VITE_HMR_PORT: 3000,
        NUXT_VITE_HMR_PROTOCOL: "ws",
        // Public entry used to derive HMR host/port; adjust if you access via :3000
        // For access via http://101.201.60.17 (port 80), leave as-is
        // For access via http://101.201.60.17:3000, change to include :3000
        NUXT_PUBLIC_SITE_URL: "http://101.201.60.17"
        // Optional explicit overrides if needed:
        // HMR_HOST: "101.201.60.17",
        // HMR_CLIENT_PORT: 80
      }
    },
    {
    name: "backend-fastapi",
    cwd: "/home/ubuntu/cv_ai_0818/backend_fastapi",
    script: "./.venv/bin/uvicorn",
    args: "app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=*",
    interpreter: "none",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    autorestart: true,
    min_uptime: 2000,
    restart_delay: 2000,
    max_restarts: 10,
    env: { 
        NODE_ENV: "production", 
        // Allow all origins for the backend CORS
        FASTAPI_CORS_ALLOW_ORIGINS: "*"
        }
    }
  ]
}
