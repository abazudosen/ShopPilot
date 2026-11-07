import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()] as PluginOption[],
  envDir: "..",
  server: {
    proxy: {
      "/api": "http://localhost:3500",
    },
  },
});
