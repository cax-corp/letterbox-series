import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.luma.cinema",
  appName: "Vela",
  webDir: "dist",
  android: { backgroundColor: "#0B141B" },
  plugins: {
    SystemBars: {
      style: "DARK",
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
  server: { androidScheme: "https" },
};
export default config;
