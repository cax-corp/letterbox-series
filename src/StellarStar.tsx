import { memo } from "react";

// Primitive props let unchanged stars skip React/DOM work when the camera pans.
export default memo(function StellarStar({
  id,
  name,
  caption,
  kind,
  x,
  y,
  radius,
  depth,
  opacity,
  active,
  halo,
  flare,
}: {
  id: string;
  name: string;
  caption: string;
  kind: string;
  x: number;
  y: number;
  radius: number;
  depth: number;
  opacity: number;
  active: boolean;
  halo: boolean;
  flare: boolean;
}) {
  return (
    <g
      data-taste-id={id}
      data-depth={depth.toFixed(2)}
      opacity={opacity}
      className={`taste-point ${kind} ${active ? "is-selected" : ""}`}
    >
      <title>{name}</title>
      <circle
        cx={x}
        cy={y}
        r={Math.max(10, radius * 3)}
        fill="transparent"
        stroke="none"
      />
      {halo && (
        <circle
          cx={x}
          cy={y}
          r={radius * 11}
          className="taste-star-halo"
          style={{ fill: `url(#stellar-glow-${kind})` }}
        />
      )}
      {flare && (
        <rect
          x={x - radius * 21}
          y={y - 0.28}
          width={radius * 42}
          height=".56"
          fill="url(#stellar-flare)"
          className="stellar-flare"
        />
      )}
      <circle cx={x} cy={y} r={radius} className="taste-star-core" />
      {active && (
        <path
          className="taste-selection"
          d={`M${x},${y - 9}l9,9 -9,9 -9,-9Z`}
        />
      )}
      {caption && (
        <text x={x + 9} y={y - 7}>
          {caption.length > 32 ? caption.slice(0, 31) + "…" : caption}
        </text>
      )}
    </g>
  );
});
