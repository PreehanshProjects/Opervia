import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
import { Buffer } from "node:buffer";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key) {
    let valid = key.startsWith("sb_publishable_");
    if (key.startsWith("eyJ")) {
      try {
        valid =
          JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
            .role === "anon";
      } catch {
        valid = false;
      }
    }
    if (!valid)
      throw new Error(
        "VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable or anon key. Secret and service-role keys are forbidden.",
      );
    if (env.VITE_SUPABASE_URL !== "https://vlgapyuvtwygstwwogps.supabase.co")
      throw new Error(
        "If changing the Supabase project, update the configured URL validation and production CSP headers together.",
      );
  }
  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true },
  };
});
