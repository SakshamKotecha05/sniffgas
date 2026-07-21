// Drill-down panel — the latest RiskScore is translated into a readable, signed
// evidence trail. It remains a view over the frozen payload; no risk logic lives here.
import { operationalStatus } from "./riskDisplay";
import type { Contributor, Level, RiskScore, SubgraphNode } from "./ws";

const NODE_FILL: Record<string, string> = {
  zone: "#94a3b8",
  sensor: "#38bdf8",
  ignition: "#fb923c",
  worker_group: "#34d399",
  permit: "#f472b6",
};

const NODE_LABEL: Record<string, string> = {
  zone: "Zone",
  sensor: "Sensor",
  ignition: "Ignition source",
  worker_group: "Crew",
  permit: "Permit",
};

const FEATURE_LABEL: Record<string, string> = {
  anomaly: "Gas-pattern anomaly",
  gas_residual_slope: "Gas residual slope",
  hot_work_active: "Active hot-work permit",
  maintenance_in_zone: "Maintenance in zone",
  shift_changeover: "Shift changeover",
  worker_count_in_zone: "Crew count in zone",
  ignition_within_2_hops: "Ignition source nearby",
  co_ppm: "CO concentration",
  temp_c: "Process temperature",
  ppm_slope: "CO rise rate",
};

const toneForLevel: Record<Level, string> = {
  green: "normal",
  amber: "watch",
  red: "alarm",
};

function featureLabel(feature: string) {
  return FEATURE_LABEL[feature] ?? feature.replace(/_/g, " ");
}

function signedDirection(weight: number) {
  if (weight > 0) return "increases risk";
  if (weight < 0) return "reduces risk";
  return "neutral weighting";
}

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.valueOf())) return ts;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

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
    (node): node is SubgraphNode & { x: number; y: number } =>
      typeof node.x === "number" && typeof node.y === "number",
  );
  if (placed.length === 0) return null;

  const PAD = 46;
  const xs = placed.map((node) => node.x);
  const ys = placed.map((node) => node.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;
  const pos = new Map(placed.map((node) => [node.id, node]));
  const types = [...new Set(placed.map((node) => node.type).filter((type): type is string => Boolean(type)))];

  return (
    <div className="subgraph-shell">
      <div className="subgraph-legend" aria-label="Risk subgraph legend">
        {types.map((type) => (
          <span key={type}>
            <i aria-hidden="true" style={{ backgroundColor: NODE_FILL[type] ?? "#94a3b8" }} />
            {NODE_LABEL[type] ?? type}
          </span>
        ))}
      </div>
      <svg
        data-testid="drilldown-subgraph"
        viewBox={`${minX} ${minY} ${w} ${h}`}
        className="subgraph-view"
        role="img"
        aria-label={`Risk subgraph around ${zone}`}
      >
        {edges.map((edge) => {
          const source = pos.get(edge.source);
          const target = pos.get(edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#64748b"
              strokeOpacity=".7"
              strokeWidth={2}
            />
          );
        })}
        {placed.map((node) => {
          const isFocus = node.id === zone;
          const halo = level === "red" ? "#fb7185" : level === "amber" ? "#fbbf24" : "#4ade80";
          return (
            <g key={node.id} data-testid={`sg-node-${node.id}`}>
              {isFocus && <circle cx={node.x} cy={node.y} r={23} fill="none" stroke={halo} strokeWidth={3.5} />}
              <circle cx={node.x} cy={node.y} r={node.type === "zone" ? 14 : 10} fill={NODE_FILL[node.type ?? ""] ?? "#94a3b8"} />
              <text x={node.x} y={node.y + (node.type === "zone" ? 31 : 25)} textAnchor="middle" fontSize={12} fill="#e2e8f0">
                {node.label ?? node.id}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="subgraph-summary">
        Linked safety factors: {types.map((type) => NODE_LABEL[type] ?? type).join(", ")}.
      </p>
    </div>
  );
}

function ContributorRow({ contributor, maxWeight }: { contributor: Contributor; maxWeight: number }) {
  const direction = signedDirection(contributor.weight);
  const directionClass = contributor.weight > 0 ? "positive" : contributor.weight < 0 ? "negative" : "neutral";
  return (
    <li key={contributor.feature} data-testid={`contrib-${contributor.feature}`} className="contributor-row">
      <div className="contributor-heading">
        <span>{featureLabel(contributor.feature)}</span>
        <span data-testid={`contrib-direction-${contributor.feature}`} className={`contributor-direction ${directionClass}`}>
          {contributor.weight > 0 ? "↑" : contributor.weight < 0 ? "↓" : "→"} {direction}
        </span>
      </div>
      <div className="contributor-meta">
        <span>observed {contributor.value.toFixed(1)}</span>
        <span>model weight {contributor.weight >= 0 ? "+" : ""}{contributor.weight.toFixed(2)}</span>
      </div>
      <div className="contributor-track" aria-hidden="true">
        <div
          className={`contributor-fill ${directionClass}`}
          style={{ width: `${(Math.abs(contributor.weight) / maxWeight) * 100}%` }}
        />
      </div>
    </li>
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
      <aside data-testid="drilldown" className="glass-panel drilldown-panel drilldown-empty">
        <p className="eyebrow">Evidence drill-down</p>
        <h2 className="panel-title">Choose a plant zone</h2>
        <p>Select a zone on the floor plan to inspect its live drivers and connected safety context.</p>
      </aside>
    );
  }

  if (!score) {
    return (
      <aside data-testid="drilldown" className="glass-panel drilldown-panel drilldown-empty">
        <p className="eyebrow">Evidence drill-down · {zone}</p>
        <h2 className="panel-title">Awaiting this zone’s score</h2>
        <p>No risk score has arrived for {zone}. Unknown is not treated as a normal state.</p>
      </aside>
    );
  }

  const status = operationalStatus(score);
  const sortedContributors = [...score.contributors]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 5);
  const maxWeight = Math.max(...sortedContributors.map((contributor) => Math.abs(contributor.weight)), 1e-9);
  const lead = sortedContributors.find((contributor) => contributor.weight !== 0);

  return (
    <aside data-testid="drilldown" className={`glass-panel drilldown-panel drilldown-${toneForLevel[score.level]}`}>
      <div className="panel-topline">
        <div>
          <p className="eyebrow">Evidence drill-down</p>
          <h2 className="panel-title">{zone} risk trail</h2>
        </div>
        <span data-testid="drilldown-level" className={`risk-chip risk-chip-${status.tone}`}>
          {status.label}
        </span>
      </div>

      <dl className="risk-metrics">
        <div>
          <dt>Compound risk</dt>
          <dd data-testid="drilldown-compound">{score.compound.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Gas anomaly</dt>
          <dd>{score.anomaly.toFixed(2)}</dd>
        </div>
      </dl>

      <section data-testid="why-risk" className="why-card" aria-label="Why this risk state">
        <p className="eyebrow">Why this state</p>
        <p>
          {lead
            ? `${status.label} in ${zone} is led by ${featureLabel(lead.feature).toLowerCase()} (${signedDirection(lead.weight)}).`
            : `${status.label} in ${zone} has no contributor details yet.`}
        </p>
      </section>

      <section className="contributors-section" aria-labelledby="contributors-title">
        <h3 id="contributors-title" className="section-label">Top model contributors</h3>
        {sortedContributors.length === 0 ? (
          <p className="empty-copy">None reported.</p>
        ) : (
          <ul className="contributors-list">
            {sortedContributors.map((contributor) => (
              <ContributorRow key={contributor.feature} contributor={contributor} maxWeight={maxWeight} />
            ))}
          </ul>
        )}
      </section>

      {(score.subgraph.nodes?.length ?? 0) > 0 && (
        <section className="subgraph-section" aria-labelledby="subgraph-title">
          <h3 id="subgraph-title" className="section-label">Connected safety context · 2 hops</h3>
          <SubgraphView
            zone={zone}
            nodes={score.subgraph.nodes ?? []}
            edges={score.subgraph.edges ?? []}
            level={score.level}
          />
        </section>
      )}
      <p className="as-of">Score time · {formatTimestamp(score.ts)}</p>
    </aside>
  );
}
