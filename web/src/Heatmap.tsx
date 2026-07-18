// SVG schematic floor plan — zone polygons colored by level (plan.md Task 11 D4, SVG primary).
import type { Level } from "./ws";

const FILL: Record<Level, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

const ZONES = [
  { id: "Z1", x: 10, y: 10, w: 170, h: 130, label: "Z1 · Coke Oven Battery" },
  { id: "Z2", x: 190, y: 10, w: 140, h: 130, label: "Z2 · Blast Furnace" },
  { id: "Z3", x: 10, y: 150, w: 320, h: 90, label: "Z3 · Casting Bay" },
];

export default function Heatmap({
  levels,
  selected = null,
  onSelect,
}: {
  levels: Record<string, Level>;
  selected?: string | null;
  onSelect?: (zone: string) => void;
}) {
  return (
    <svg viewBox="0 0 340 250" className="w-full max-w-3xl" role="img" aria-label="Plant floor plan">
      {ZONES.map((z) => {
        const level = levels[z.id] ?? "green";
        const isSelected = selected === z.id;
        return (
          <g
            key={z.id}
            onClick={() => onSelect?.(z.id)}
            role="button"
            aria-label={`Inspect ${z.label}`}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <rect
              data-testid={`zone-${z.id}`}
              data-level={level}
              x={z.x} y={z.y} width={z.w} height={z.h} rx={6}
              fill={FILL[level]} fillOpacity={0.55}
              stroke={isSelected ? "#1e293b" : FILL[level]} strokeWidth={isSelected ? 3 : 2}
              style={{ transition: "fill 0.6s ease, stroke 0.6s ease" }}
            />
            <text x={z.x + 8} y={z.y + 20} fontSize={11} fill="#1f2937">
              {z.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
