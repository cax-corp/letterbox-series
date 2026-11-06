import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { colourBootstrap } from "./src/colour-themes";
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "vela-saved-colour-theme",
      transformIndexHtml(html) {
        return html.replace(
          "<!-- vela-colour-bootstrap -->",
          `<script>${colourBootstrap()}</script>`,
        );
      },
    },
  ],
  base: "./",
  cacheDir: `node_modules/.vite-${mode}`,
}));
