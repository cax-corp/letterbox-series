import { t as tr, getLanguage } from "./i18n";
import type { CSSProperties, ReactNode } from "react";
import { avatarBackgrounds, type AvatarId, type Profile } from "./profile";

type Eyes =
  | "dots"
  | "wink"
  | "happy"
  | "closed"
  | "glasses"
  | "hearts"
  | "wide"
  | "tired"
  | "angry"
  | "round-glasses";
type Mouth =
  | "smile"
  | "grin"
  | "laugh"
  | "oh"
  | "flat"
  | "frown"
  | "smirk"
  | "tongue"
  | "small";
type Face = {
  eyes: Eyes;
  mouth: Mouth;
  tilt?: number;
  extra?: "blush" | "tear" | "brow" | "monocle" | "headphones" | "stache";
};
const faces: Partial<Record<AvatarId, Face>> = {
  smile: { eyes: "dots", mouth: "smile" },
  wink: { eyes: "wink", mouth: "smirk", tilt: -6 },
  grin: { eyes: "dots", mouth: "grin" },
  laugh: { eyes: "happy", mouth: "laugh", tilt: -8 },
  cool: { eyes: "glasses", mouth: "smirk" },
  love: { eyes: "hearts", mouth: "smile" },
  starry: { eyes: "wide", mouth: "small" },
  sleepy: { eyes: "closed", mouth: "oh", tilt: 8 },
  surprised: { eyes: "wide", mouth: "oh" },
  curious: { eyes: "dots", mouth: "small", extra: "brow", tilt: -9 },
  unimpressed: { eyes: "tired", mouth: "flat" },
  grumpy: { eyes: "angry", mouth: "frown" },
  shy: { eyes: "dots", mouth: "small", extra: "blush" },
  mischief: { eyes: "angry", mouth: "grin", tilt: 5 },
  cheeky: { eyes: "wink", mouth: "tongue" },
  zen: { eyes: "closed", mouth: "smile" },
  teary: { eyes: "happy", mouth: "small", extra: "tear" },
  monocle: { eyes: "dots", mouth: "smirk", extra: "monocle" },
  nerd: { eyes: "round-glasses", mouth: "grin" },
  headphones: { eyes: "happy", mouth: "smile", extra: "headphones" },
  stache: { eyes: "dots", mouth: "small", extra: "stache" },
};
const cutout = "var(--avatar-background)";
function Eye({ kind, x, right }: { kind: Eyes; x: number; right: boolean }) {
  let art: ReactNode;
  if (kind === "happy" || (kind === "wink" && right))
    art = <path d="M-8 3Q0-9 8 3" />;
  else if (kind === "closed") art = <path d="M-8-1Q0 7 8-1" />;
  else if (kind === "hearts")
    art = (
      <path
        d="M0 9C-20-4-5-16 0-6C5-16 20-4 0 9Z"
        fill="currentColor"
        stroke="none"
      />
    );
  else if (kind === "wide")
    art = (
      <>
        <ellipse rx="9" ry="12" />
        <ellipse rx="3" ry="5" fill="currentColor" stroke="none" />
      </>
    );
  else if (kind === "tired")
    art = (
      <>
        <path d="M-9-2H9" />
        <path d="M-4 1V6" />
      </>
    );
  else if (kind === "angry")
    art = (
      <>
        <ellipse cy="3" rx="5" ry="6" fill="currentColor" stroke="none" />
        <path d={right ? "M-8-5L8-10" : "M-8-10L8-5"} />
      </>
    );
  else art = <ellipse rx="5.5" ry="8" fill="currentColor" stroke="none" />;
  return <g transform={`translate(${x} 42)`}>{art}</g>;
}
function EyePair({ kind }: { kind: Eyes }) {
  if (kind === "glasses")
    return (
      <>
        <path
          d="M17 34H44V43Q44 55 31 55Q18 55 18 43ZM56 34H83L82 43Q82 55 69 55Q56 55 56 43Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="M42 38Q50 33 58 38M14 35H19M81 35H86" />
        <path
          d="M24 39H34M62 39H72"
          stroke={cutout}
          strokeWidth="3"
          opacity=".55"
        />
      </>
    );
  return (
    <>
      <Eye kind={kind} x={33} right={false} />
      <Eye kind={kind} x={67} right />
      {kind === "round-glasses" && (
        <>
          <circle cx="33" cy="42" r="15" strokeWidth="4" />
          <circle cx="67" cy="42" r="15" strokeWidth="4" />
          <path d="M48 40Q50 38 52 40M14 39H18M82 39H86" strokeWidth="4" />
        </>
      )}
    </>
  );
}
function Smile({ kind }: { kind: Mouth }) {
  if (kind === "grin" || kind === "laugh")
    return (
      <>
        <path
          d={
            kind === "laugh"
              ? "M29 61H71Q71 87 50 87Q29 87 29 61Z"
              : "M25 61H75Q72 83 50 83Q28 83 25 61Z"
          }
          fill="currentColor"
          stroke="none"
        />
        <path
          d={kind === "laugh" ? "M35 64H65L63 69H37Z" : "M32 64H68L65 71H35Z"}
          fill={cutout}
          stroke="none"
        />
        {kind === "laugh" && (
          <path
            d="M41 80Q50 73 59 80"
            stroke={cutout}
            strokeWidth="5"
            opacity=".5"
          />
        )}
      </>
    );
  if (kind === "oh")
    return (
      <ellipse
        cx="50"
        cy="72"
        rx="8"
        ry="11"
        fill="currentColor"
        stroke="none"
      />
    );
  if (kind === "flat") return <path d="M38 71H62" />;
  if (kind === "frown") return <path d="M34 76Q50 61 66 76" />;
  if (kind === "smirk") return <path d="M35 72Q56 79 69 63" />;
  if (kind === "tongue")
    return (
      <>
        <path d="M31 65Q50 82 69 65" />
        <path
          d="M51 72V78Q51 91 62 88Q70 85 67 72Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="M60 75V82" stroke={cutout} strokeWidth="2.5" />
      </>
    );
  return (
    <path d={kind === "small" ? "M41 69Q50 77 59 69" : "M29 63Q50 86 71 63"} />
  );
}
function Character({ id }: { id: AvatarId }) {
  if (id === "cat")
    return (
      <>
        <path d="M21 50L18 22L38 35Q50 30 62 35L82 22L79 50" />
        <EyePair kind="dots" />
        <path
          d="M47 58H53L50 62ZM50 62V67M40 67Q45 72 50 67Q55 72 60 67M15 57L29 60M14 68L29 66M71 60L85 57M71 66L86 68"
          strokeWidth="4"
        />
      </>
    );
  if (id === "robot")
    return (
      <>
        <path d="M50 19V27" />
        <circle cx="50" cy="15" r="5" fill="currentColor" stroke="none" />
        <rect x="21" y="29" width="58" height="49" rx="13" />
        <path d="M14 43V61M86 43V61M35 65H65" />
        <rect
          x="31"
          y="41"
          width="10"
          height="11"
          rx="3"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="59"
          y="41"
          width="10"
          height="11"
          rx="3"
          fill="currentColor"
          stroke="none"
        />
        <path d="M43 65V69M56 65V69" strokeWidth="3" />
      </>
    );
  if (id === "ghost")
    return (
      <>
        <path
          d="M24 77V46Q24 18 50 18Q76 18 76 46V77L63 70L50 78L37 70Z"
          fill="currentColor"
          stroke="none"
        />
        <g stroke={cutout}>
          <path d="M39 40V48M61 40V48" />
          <path d="M43 60Q50 67 57 60" strokeWidth="4" />
        </g>
      </>
    );
  if (id === "astronaut")
    return (
      <>
        <circle cx="50" cy="49" r="30" />
        <path d="M32 78V84H68V78M12 43V57M88 43V57" />
        <rect
          x="28"
          y="35"
          width="44"
          height="30"
          rx="13"
          fill="currentColor"
          stroke="none"
        />
        <g stroke={cutout}>
          <path d="M40 44V48M60 44V48" strokeWidth="4" />
          <path d="M44 55Q50 60 56 55" strokeWidth="3" />
        </g>
      </>
    );
  if (id === "cyclops")
    return (
      <>
        <ellipse cx="50" cy="42" rx="21" ry="18" />
        <ellipse
          cx="50"
          cy="42"
          rx="7"
          ry="10"
          fill="currentColor"
          stroke="none"
        />
        <Smile kind="grin" />
      </>
    );
  if (id === "alien")
    return (
      <>
        <path
          d="M24 29Q33 55 43 48Q47 32 24 29ZM76 29Q67 55 57 48Q53 32 76 29Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="M43 68Q50 74 57 68" strokeWidth="4" />
        <path d="M29 20L24 13M71 20L76 13" strokeWidth="4" />
      </>
    );
  if (id === "mask")
    return (
      <>
        <path
          d="M17 34Q32 24 50 34Q68 24 83 34L77 53Q63 65 50 51Q37 65 23 53Z"
          fill="currentColor"
          stroke="none"
        />
        <path
          d="M27 41Q33 35 39 41M61 41Q67 35 73 41"
          stroke={cutout}
          strokeWidth="4"
        />
        <Smile kind="smirk" />
      </>
    );
  return null;
}
function FaceArt({ id }: { id: AvatarId }) {
  const f = faces[id];
  if (!f) return <Character id={id} />;
  return (
    <g transform={`rotate(${f.tilt || 0} 50 50)`}>
      <EyePair kind={f.eyes} />
      <Smile kind={f.mouth} />
      {f.extra === "blush" && (
        <g opacity=".22" fill="currentColor" stroke="none">
          <ellipse cx="23" cy="58" rx="9" ry="5" />
          <ellipse cx="77" cy="58" rx="9" ry="5" />
        </g>
      )}
      {f.extra === "tear" && (
        <path
          d="M79 54Q91 70 79 70Q68 70 79 54Z"
          fill="currentColor"
          stroke="none"
          opacity=".5"
        />
      )}
      {f.extra === "brow" && <path d="M57 23Q68 17 77 23" strokeWidth="4" />}
      {f.extra === "monocle" && (
        <>
          <circle cx="67" cy="42" r="16" strokeWidth="3" />
          <path d="M83 45V69Q83 78 75 82" strokeWidth="3" />
        </>
      )}
      {f.extra === "headphones" && (
        <>
          <path d="M17 47V41Q17 11 50 11Q83 11 83 41V47" strokeWidth="5" />
          <rect
            x="10"
            y="39"
            width="12"
            height="27"
            rx="6"
            fill="currentColor"
            stroke="none"
          />
          <rect
            x="78"
            y="39"
            width="12"
            height="27"
            rx="6"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
      {f.extra === "stache" && (
        <path
          d="M50 59Q40 45 32 59Q27 67 21 61Q27 80 50 66Q73 80 79 61Q73 67 68 59Q60 45 50 59Z"
          fill="currentColor"
          stroke="none"
        />
      )}
    </g>
  );
}

/** Original vector presets; no remote portrait, raster atlas or image upload. */
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
    avatarBackgrounds[2];
  return (
    <span
      className="preset-avatar"
      style={
        {
          width: size,
          height: size,
          background: background.color,
          color: background.ink,
          "--avatar-background": background.color,
        } as CSSProperties
      }
      aria-label={tr("Avatar de {0}", name || "Vela")}
      role="img"
    >
      {profile.avatar === "initial" ? (
        <span
          className="avatar-initial"
          style={{ fontSize: size * 0.43 }}
          aria-hidden="true"
        >
          {Array.from(name.trim())[0]?.toLocaleUpperCase(getLanguage()) || "V"}
        </span>
      ) : (
        <svg
          className="avatar-art"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <FaceArt id={profile.avatar} />
        </svg>
      )}
    </span>
  );
}
