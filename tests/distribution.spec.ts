import { test, expect } from "./fixtures";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
test("migration Android : les anciennes installations ne reçoivent pas le nouveau certificat par leur canal de mise à jour", async ({
  page,
}) => {
  const legacy = JSON.parse(
    await readFile(path.join(root, "public/release.json"), "utf8"),
  );
  const stable = JSON.parse(
    await readFile(path.join(root, "public/release-stable.json"), "utf8"),
  );
  const pkg = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const pin = (
    await readFile(
      path.join(root, "android/signing-certificate.sha256"),
      "utf8",
    )
  ).trim();
  expect(legacy).toEqual({
    version: "2.10.1",
    versionCode: 41,
    apk: "Vela-2.10.1.apk",
  });
  expect(stable.versionCode).toBeGreaterThan(legacy.versionCode);
  expect(stable.version).toBe(pkg.version);
  expect(stable.apk).toBe(`Vela-${pkg.version}.apk`);
  expect(stable.certificateSha256).toBe(pin);
  expect(pin).not.toBe(
    "62582febe4d5df81e9ba3bfad0e33701fc67c9380cc7d96ddc7090c9d60f0c33",
  );
  const response = await page.goto("/android-migration.html");
  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Passer à Vela 2.11", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Une désinstallation efface les données locales/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Télécharger Vela 2.11.0", exact: true }),
  ).toHaveAttribute("href", "downloads/" + stable.apk);
});
test("signature de distribution : refus du mauvais certificat, de plusieurs signataires et d’une vérification APK échouée", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vela-signature-test-"));
  try {
    const apk = path.join(dir, "test.apk"),
      signer = path.join(dir, "apksigner");
    await writeFile(apk, "test");
    const pin = (
      await readFile(
        path.join(root, "android/signing-certificate.sha256"),
        "utf8",
      )
    ).trim();
    const run = () =>
      spawnSync(
        process.execPath,
        [path.join(root, "scripts/verify-apk-signature.mjs"), apk],
        { encoding: "utf8", env: { ...process.env, VELA_APKSIGNER: signer } },
      );
    const stub = async (report: string, code = 0) =>
      writeFile(
        signer,
        `#!/usr/bin/env node\nconsole.log(${JSON.stringify(report)});process.exit(${code});\n`,
        { mode: 0o700 },
      );
    await stub(`Signer #1 certificate SHA-256 digest: ${pin}`);
    expect(run().status).toBe(0);
    await stub("Signer #1 certificate SHA-256 digest: " + "0".repeat(64));
    expect(run().status).not.toBe(0);
    await stub(
      `Signer #1 certificate SHA-256 digest: ${pin}\nSigner #2 certificate SHA-256 digest: ${pin}`,
    );
    expect(run().status).not.toBe(0);
    await stub(`Signer #1 certificate SHA-256 digest: ${pin}`, 1);
    expect(run().status).not.toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
