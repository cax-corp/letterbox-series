import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.luma.cinema",
  appName: "Vela",
  webDir: "dist",
  android: { backgroundColor: "#001620" },
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
