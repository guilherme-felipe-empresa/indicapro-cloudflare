import { defineConfig, loadEnv } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build") {
    for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
      if (!(process.env[key] || env[key])) {
        throw new Error(`Configure ${key} nas variáveis de build da Cloudflare ou no .env local.`);
      }
    }
  }
  return {
    plugins: [
      tsconfigPaths(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart(),
      react(),
      tailwindcss(),
    ],
    server: { port: 8080 },
  };
});
