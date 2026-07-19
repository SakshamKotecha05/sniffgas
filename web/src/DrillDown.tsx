// Drill-down panel — latest RiskScore for the selected zone: level badge,
// compound/anomaly readouts, contributor bars, "why red" subgraph node-link
// render (plain SVG; no graph lib — plan.md Task 12 / D8).
import type { Level, RiskScore, SubgraphNode } from "./ws";

const BADGE: Record<Level, string> = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

const BAR: Record<Level, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

// Node fill by kg.py node type; permits/ignition pop, plumbing stays muted.
const NODE_FILL: Record<string, string> = {
  zone: "#475569", // slate-600
  sensor: "#0ea5e9", // sky-500
  ignition: "#f97316", // orange-500
  worker_group: "#10b981", // emerald-500
  permit: "#e11d48", // rose-600
};

function SubgraphView({
  zone,
  nodes,
  edges,
  level,
}: {
  zone: string;
  nodes: SubgraphNode[];
  edges: { source: string; target: string }[];
  level: Level;
}) {
  const placed = nodes.filter(
    (n): n is SubgraphNode & { x: number; y: number } =>
      typeof n.x === "number" && typeof n.y === "number",
  );
  if (placed.length === 0) return null;

  // Fit floor-plan px coords into the panel: pad the bounding box, let SVG scale.
  const PAD = 46;
  const xs = placed.map((n) => n.x);
  const ys = placed.map((n) => n.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;
  const pos = new Map(placed.map((n) => [n.id, n]));

  return (
    <svg
      data-testid="drilldown-subgraph"
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className="mt-1 w-full rounded bg-slate-50"
      role="img"
      aria-label={`Risk subgraph around ${zone}`}
    >
      {edges.map((e) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return null;
        return (
          <line
            key={`${e.source}-${e.target}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#cbd5e1"
            strokeWidth={2}
          />
        );
      })}
      {placed.map((n) => {
        const isFocus = n.id === zone;
        return (
          <g key={n.id} data-testid={`sg-node-${n.id}`}>
            {isFocus && (
              <circle
                cx={n.x}
                cy={n.y}
                r={22}
                fill="none"
                stroke={level === "red" ? "#ef4444" : level === "amber" ? "#f59e0b" : "#22c55e"}
                strokeWidth={4}
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.type === "zone" ? 15 : 10}
              fill={NODE_FILL[n.type ?? ""] ?? "#94a3b8"}
            />
            <text
              x={n.x}
              y={n.y + (n.type === "zone" ? 32 : 26)}
              textAnchor="middle"
              fontSize={13}
              fill="#334155"
            >
              {n.label ?? n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DrillDown({
  zone,
  score,
}: {
  zone: string | null;
  score: RiskScore | null;
}) {
  if (!zone) {
    return (
      <aside data-testid="drilldown" className="w-full max-w-sm rounded-lg bg-white p-4 shadow">
        <p className="text-sm text-slate-500">Select a zone to inspect its risk drivers.</p>
      </aside>
    );
  }

  if (!score) {
    return (
      <aside data-testid="drilldown" className="w-full max-w-sm rounded-lg bg-white p-4 shadow">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">{zone}</h2>
        <p className="text-sm text-slate-500">No risk scores received for this zone yet.</p>
      </aside>
    );
  }

  const maxW = Math.max(...score.contributors.map((c) => Math.abs(c.weight)), 1e-9);

  return (
    <aside data-testid="drilldown" className="w-full max-w-sm rounded-lg bg-white p-4 shadow">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{zone}</h2>
        <span
          data-testid="drilldown-level"
          className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${BADGE[score.level]}`}
        >
          {score.level}
        </span>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">Compound risk</dt>
          <dd data-testid="drilldown-compound" className="font-mono text-slate-800">
            {score.compound.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Anomaly</dt>
          <dd className="font-mono text-slate-800">{score.anomaly.toFixed(2)}</dd>
        </div>
      </dl>

      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        Top contributors
      </h3>
      {score.contributors.length === 0 ? (
        <p className="text-sm text-slate-400">None reported.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...score.contributors]
            .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
            .slice(0, 5)
            .map((c) => (
              <li key={c.feature} data-testid={`contrib-${c.feature}`} className="text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>{c.feature}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {c.value.toFixed(1)} · w {c.weight.toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-100">
                  <div
                    className={`h-1.5 rounded ${BAR[score.level]}`}
                    style={{ width: `${(Math.abs(c.weight) / maxW) * 100}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      )}

      {(score.subgraph.nodes?.length ?? 0) > 0 && (
        <>
          <h3 className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Risk subgraph (2-hop)
          </h3>
          <SubgraphView
            zone={zone}
            nodes={score.subgraph.nodes ?? []}
            edges={score.subgraph.edges ?? []}
            level={score.level}
          />
        </>
      )}
      <p className="mt-2 text-right text-[10px] text-slate-400">as of {score.ts}</p>
    </aside>
  );
}
