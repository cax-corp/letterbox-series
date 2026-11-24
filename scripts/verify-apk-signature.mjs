import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const apk = process.argv[2];
if (!apk || !existsSync(apk))
  throw new Error("Pass an existing signed APK path.");
const expected = readFileSync(
  new URL("../android/signing-certificate.sha256", import.meta.url),
  "utf8",
)
  .trim()
  .toLowerCase();
if (!/^[a-f0-9]{64}$/.test(expected))
  throw new Error("Invalid public signing certificate pin.");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const signer =
  process.env.VELA_APKSIGNER ||
  (sdk
    ? path.join(
        sdk,
        "build-tools",
        "36.0.0",
        process.platform === "win32" ? "apksigner.bat" : "apksigner",
      )
    : "apksigner");
const report = execFileSync(signer, ["verify", "--print-certs", apk], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
});
const fingerprints = [
  ...report.matchAll(
    /Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})/gi,
  ),
].map((m) => m[1].toLowerCase());
if (fingerprints.length !== 1 || fingerprints[0] !== expected)
  throw new Error(
    "APK certificate does not match the persistent Vela release key.",
  );
console.log("Vela release signature verified: " + expected);
