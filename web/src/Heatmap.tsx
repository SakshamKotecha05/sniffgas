// SVG schematic floor plan — zones are colored by the frozen RiskScore level, but
// every state is also named and the unavailable-feed state has a distinct hatch.
import type { KeyboardEvent } from "react";
import type { Level } from "./ws";

type DisplayLevel = Level | "unknown";

const FILL: Record<DisplayLevel, string> = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#fb7185",
  unknown: "#94a3b8",
};

const levelLabel: Record<DisplayLevel, string> = {
  green: "NORMAL",
  amber: "WATCH ADVISORY",
  red: "ALARM",
  unknown: "AWAITING FEED",
};

const longLevelLabel: Record<DisplayLevel, string> = {
  green: "normal live score",
  amber: "WATCH advisory",
  red: "ALARM",
  unknown: "awaiting live feed",
};

const ZONES = [
  { id: "Z1", x: 40, y: 72, w: 330, h: 174, label: "Coke Oven Battery", short: "Z1" },
  { id: "Z2", x: 404, y: 72, w: 236, h: 174, label: "Blast Furnace", short: "Z2" },
  { id: "Z3", x: 40, y: 284, w: 600, h: 112, label: "Casting Bay", short: "Z3" },
];

const LEGEND: { level: DisplayLevel; label: string }[] = [
  { level: "unknown", label: "Awaiting feed" },
  { level: "green", label: "Normal" },
  { level: "amber", label: "Watch" },
  { level: "red", label: "Alarm" },
];

export default function Heatmap({
  levels,
  selected = null,
  onSelect,
}: {
  levels: Partial<Record<string, Level>>;
  selected?: string | null;
  onSelect?: (zone: string) => void;
}) {
  const liveZones = Object.keys(levels).filter((zone) => ZONES.some((candidate) => candidate.id === zone)).length;

  return (
    <svg
      viewBox="0 0 680 442"
      className="plant-map-svg"
      role="group"
      aria-label="Interactive plant floor plan"
    >
      <title>Plant floor plan</title>
      <desc>Three selectable operating zones. State is rendered with a name and pattern as well as color.</desc>
      <defs>
        <linearGradient id="map-surface" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#111d2f" />
          <stop offset="1" stopColor="#09111f" />
        </linearGradient>
        <linearGradient id="zone-green" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#4ade80" stopOpacity=".46" />
          <stop offset="1" stopColor="#14532d" stopOpacity=".24" />
        </linearGradient>
        <linearGradient id="zone-amber" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fbbf24" stopOpacity=".52" />
          <stop offset="1" stopColor="#78350f" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id="zone-red" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fb7185" stopOpacity=".56" />
          <stop offset="1" stopColor="#881337" stopOpacity=".3" />
        </linearGradient>
        <pattern id="awaiting-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#162337" />
          <line x1="0" x2="0" y2="9" stroke="#64748b" strokeOpacity=".68" strokeWidth="2" />
        </pattern>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#94a3b8" strokeOpacity=".06" strokeWidth="1" />
        </pattern>
        <filter id="zone-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="680" height="442" rx="18" fill="url(#map-surface)" />
      <rect x="0" y="0" width="680" height="442" rx="18" fill="url(#grid)" />
      <path d="M24 52H656M24 268H656M386 52V268" fill="none" stroke="#475569" strokeOpacity=".54" strokeWidth="3" strokeDasharray="7 8" />
      <path d="M24 410H656" fill="none" stroke="#334155" strokeWidth="2" />

      <g aria-hidden="true">
        <circle cx="42" cy="52" r="4" fill="#22d3ee" opacity=".85" />
        <text x="54" y="56" fill="#94a3b8" fontSize="11" letterSpacing="1.1">PLANT TELEMETRY</text>
        <text x="638" y="56" fill="#94a3b8" fontSize="11" textAnchor="end">{liveZones} / {ZONES.length} ZONES SCORED</text>
      </g>

      {ZONES.map((zone) => {
        const level: DisplayLevel = levels[zone.id] ?? "unknown";
        const isSelected = selected === zone.id;
        const select = () => onSelect?.(zone.id);
        const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            select();
          }
        };
        const accessibleLabel = `Inspect ${zone.short} · ${zone.label}: ${longLevelLabel[level]}`;
        const fill = level === "unknown" ? "url(#awaiting-hatch)" : `url(#zone-${level})`;
        const statusWidth = level === "unknown" ? 127 : level === "amber" ? 131 : 74;

        return (
          <g
            key={zone.id}
            className={`plant-zone plant-zone-${level}`}
            onClick={select}
            onKeyDown={onKeyDown}
            role={onSelect ? "button" : "group"}
            aria-label={accessibleLabel}
            aria-pressed={onSelect ? isSelected : undefined}
            tabIndex={onSelect ? 0 : undefined}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            {isSelected && (
              <rect
                x={zone.x - 5}
                y={zone.y - 5}
                width={zone.w + 10}
                height={zone.h + 10}
                rx="14"
                fill="none"
                stroke="#e2e8f0"
                strokeOpacity=".9"
                strokeWidth="2"
                filter="url(#zone-glow)"
              />
            )}
            <rect
              data-testid={`zone-${zone.id}`}
              data-level={level}
              aria-label={longLevelLabel[level]}
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx="10"
              fill={fill}
              stroke={FILL[level]}
              strokeOpacity={isSelected ? 1 : 0.72}
              strokeWidth={isSelected ? 3 : 1.5}
              style={{ transition: "fill .35s ease, stroke .35s ease" }}
            />
            <path
              d={`M ${zone.x + 16} ${zone.y + 48} H ${zone.x + zone.w - 16}`}
              stroke="#e2e8f0"
              strokeOpacity=".16"
              strokeWidth="1"
            />
            <text x={zone.x + 16} y={zone.y + 27} fill="#f8fafc" fontSize="18" fontWeight="700">
              {zone.short}
            </text>
            <text x={zone.x + 16} y={zone.y + 43} fill="#cbd5e1" fontSize="11" letterSpacing=".35">
              {zone.label.toUpperCase()}
            </text>
            <rect
              x={zone.x + 16}
              y={zone.y + zone.h - 36}
              width={statusWidth}
              height="21"
              rx="10.5"
              fill="#020617"
              fillOpacity=".48"
              stroke={FILL[level]}
              strokeOpacity=".8"
            />
            <circle cx={zone.x + 27} cy={zone.y + zone.h - 25.5} r="4" fill={FILL[level]} />
            <text
              data-testid={`zone-status-${zone.id}`}
              x={zone.x + 37}
              y={zone.y + zone.h - 21}
              fill="#f8fafc"
              fontSize="10"
              fontWeight="700"
              letterSpacing=".55"
            >
              {levelLabel[level]}
            </text>
            <text x={zone.x + zone.w - 16} y={zone.y + zone.h - 21} textAnchor="end" fill="#e2e8f0" fillOpacity=".75" fontSize="10">
              {isSelected ? "INSPECTING" : onSelect ? "SELECT" : ""}
            </text>
          </g>
        );
      })}

      <g data-testid="plant-legend" aria-label="Map state legend" role="group">
        {LEGEND.map((item, index) => {
          const x = 40 + index * 152;
          return (
            <g key={item.level} transform={`translate(${x}, 424)`}>
              <rect width="12" height="12" rx="3" fill={item.level === "unknown" ? "url(#awaiting-hatch)" : FILL[item.level]} />
              <text x="19" y="10" fill="#94a3b8" fontSize="10">{item.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
