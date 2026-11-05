import type { CSSProperties } from "react";
import { avatarBackgrounds, avatarCell, type Profile } from "./profile";
export const avatarAtlas = () =>
  `${import.meta.env.BASE_URL}avatars/portraits.png`;
export default function Avatar({
  profile,
  name,
  size = 80,
}: {
  profile: Pick<Profile, "avatar" | "background">;
  name: string;
  size?: number;
}) {
  const background =
      avatarBackgrounds.find((b) => b.id === profile.background) ||
      avatarBackgrounds[0],
    cell = avatarCell(profile.avatar);
  return (
    <span
      className="preset-avatar"
      style={
        {
          width: size,
          height: size,
          background: background.color,
          color: background.ink,
        } as CSSProperties
      }
      aria-label={`Avatar de ${name || "Vela"}`}
      role="img"
    >
      {profile.avatar === "initial" ? (
        <span
          className="avatar-initial"
          style={{ fontSize: size * 0.43 }}
          aria-hidden="true"
        >
          {Array.from(name.trim())[0]?.toLocaleUpperCase("fr-FR") || "V"}
        </span>
      ) : (
        <img
          className="avatar-art"
          src={avatarAtlas()}
          style={{ left: `-${cell[0] * 100}%`, top: `-${cell[1] * 100}%` }}
          alt=""
          draggable={false}
        />
      )}
    </span>
  );
}
