// Drill-down panel — latest RiskScore for the selected zone: level badge,
// compound/anomaly readouts, contributor bars (plan.md Task 12).
import type { Level, RiskScore } from "./ws";

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
      <p className="mt-2 text-right text-[10px] text-slate-400">as of {score.ts}</p>
    </aside>
  );
}
