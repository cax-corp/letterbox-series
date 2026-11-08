import type { SupabaseClient } from "@supabase/supabase-js";
import { t as tr } from "./i18n";
import type { Profile } from "./profile";

export const avatarBucket = "vela-avatars";
export const maxPhotoBytes = 48 * 1024;
export const maxPhotoDataLength = 23 + Math.ceil(maxPhotoBytes / 3) * 4;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const localProfilePhoto = (photo: string) =>
  photo.length <= maxPhotoDataLength &&
  /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo);
export function remoteProfilePhoto(photo: string) {
  try {
    const url = new URL(photo);
    return (
      photo.length <= 1000 &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      new RegExp(
        `^/storage/v1/object/public/${avatarBucket}/${uuid}/${uuid}\\.jpg$`,
      ).test(url.pathname)
    );
  } catch {
    return false;
  }
}
export function validProfilePhoto(photo: unknown): photo is string {
  return (
    typeof photo === "string" &&
    (localProfilePhoto(photo) || remoteProfilePhoto(photo))
  );
}
export async function uploadProfilePhoto(
  client: SupabaseClient,
  account: string,
  profile: Profile,
): Promise<Profile> {
  if (!profile.photo || !localProfilePhoto(profile.photo)) return profile;
  if (!new RegExp(`^${uuid}$`).test(account))
    throw new Error(tr("Reconnectez-vous pour transférer votre photo."));
  const bytes = Uint8Array.from(atob(profile.photo.slice(23)), (char) =>
    char.charCodeAt(0),
  );
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (value) => value.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 32);
  const photoId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
  const path = `${account}/${photoId}.jpg`,
    bucket = client.storage.from(avatarBucket);
  const { error } = await bucket.upload(
    path,
    new Blob([bytes], { type: "image/jpeg" }),
    { contentType: "image/jpeg", cacheControl: "31536000", upsert: false },
  );
  if (error && String((error as { statusCode?: string }).statusCode) !== "409")
    throw new Error(
      tr(
        "La photo reste sur cet appareil. Le stockage des photos doit être activé dans Supabase, ou le transfert doit être réessayé.",
      ),
    );
  const url = bucket.getPublicUrl(path).data.publicUrl;
  if (!remoteProfilePhoto(url))
    throw new Error(tr("L’adresse de la photo n’a pas pu être vérifiée."));
  return { ...profile, photo: url };
}

/** Only the new, resized JPEG is kept: the source file and its metadata are discarded. */
export async function decodeProfilePhoto(
  file: File,
): Promise<
  CanvasImageSource & { width: number; height: number; close?: () => void }
> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(tr("Choisissez une image JPEG, PNG ou WebP."));
  if (file.size > 12 * 1024 * 1024)
    throw new Error(tr("Choisissez une image de moins de 12 Mo."));
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: 1024,
        resizeQuality: "high",
        imageOrientation: "from-image",
      });
      if (bitmap.height > 8192 || bitmap.height < 16) {
        bitmap.close();
        throw new Error("dimensions");
      }
      return bitmap;
    }
    const url = URL.createObjectURL(file),
      image = new Image();
    try {
      image.src = url;
      await image.decode();
      if (!image.width || !image.height) throw new Error("dimensions");
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    throw new Error(
      tr("Cette image ne peut pas être ouverte. Essayez une autre photo."),
    );
  }
}
export type PhotoCrop = { zoom: number; x: number; y: number };
export function paintPhotoCrop(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource & { width: number; height: number },
  crop: PhotoCrop,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(tr("Le recadrage n’est pas disponible sur cet appareil."));
  const size = canvas.width,
    scale = Math.max(size / image.width, size / image.height) * crop.zoom;
  const width = image.width * scale,
    height = image.height * scale;
  ctx.fillStyle = "#0d2530";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(
    image,
    (size - width) / 2 + (crop.x * (width - size)) / 2,
    (size - height) / 2 + (crop.y * (height - size)) / 2,
    width,
    height,
  );
}
export function encodeProfilePhoto(
  image: CanvasImageSource & { width: number; height: number },
  crop: PhotoCrop,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  paintPhotoCrop(canvas, image, crop);
  try {
    for (const quality of [0.88, 0.78, 0.66, 0.54, 0.42, 0.3]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (localProfilePhoto(data)) return data;
    }
    throw new Error(
      tr("La photo ne peut pas être compressée. Essayez une autre image."),
    );
  } finally {
    canvas.width = canvas.height = 1;
  }
}
