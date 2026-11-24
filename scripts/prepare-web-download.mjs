import { copyFile, mkdir } from "node:fs/promises";

// Only the Pages build includes this download. Capacitor uses `npm run build`.
const directory = new URL("../dist/downloads/", import.meta.url);
await mkdir(directory, { recursive: true });
await copyFile(
  new URL("../downloads/Vela-2.11.0.apk", import.meta.url),
  new URL("Vela-2.11.0.apk", directory),
);
// Keep the final old-certificate download available for legacy installations.
await copyFile(
  new URL("../downloads/Vela-2.10.1.apk", import.meta.url),
  new URL("Vela-2.10.1.apk", directory),
);
