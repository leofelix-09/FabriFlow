import path from "path";
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mochaPlugins } from "@getmocha/vite-plugins";

const isVercel = !!process.env.VERCEL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const basePlugins: any[] = [...mochaPlugins(process.env as any), react()];

export default defineConfig(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [...basePlugins];

  // Only use Cloudflare plugin for local dev (not on Vercel)
  if (!isVercel) {
    try {
      const { cloudflare } = await import("@cloudflare/vite-plugin");
      plugins.push(cloudflare());
    } catch {
      // Cloudflare plugin not available, skip
    }
  }

  return {
    plugins,
    server: {
      allowedHosts: true,
    },
    build: {
      chunkSizeWarningLimit: 5000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  } satisfies UserConfig;
});
