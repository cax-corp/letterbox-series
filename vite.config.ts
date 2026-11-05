import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "./",
  cacheDir: `node_modules/.vite-${mode}`,
}));
