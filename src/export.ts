import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
export async function exportCollection(data: unknown) {
  const json = JSON.stringify(data, null, 2);
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: "vela-collection.json",
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: "Ma collection Vela", url: file.uri });
  } else {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "vela-collection.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
