// Evaluation values are copied from the frozen eval_report.md artifact. Any
// business-impact claim needs its own direct source and calculation before it
// appears on the public dashboard.

const EVAL = {
  episodes: 200,
  thresholds: { base: 0.255, comp: 0.922 },
  matrix: {
    baseline: { tp: 50, fp: 140, fn: 0, tn: 10 }, // gas-only 16-channel MOX
    compound: { tp: 50, fp: 0, fn: 0, tn: 150 }, // fusion ON
  },
  // Two-tier replay evaluation: WATCH is advisory before the 400 ppm evaluation
  // anchor; gas-evidence-gated ALARM typically follows it.
  timing: {
    watch: { median: "14s before", p10: "-10s", p90: "71s", runs: "50/50" },
    alarm: { median: "26s after", p10: "-71s", p90: "32s", runs: "50/50" },
  },
  latencyMs: { p50: 4.9, p95: 5.0 },
};

function MatrixRow({
  label,
  cells,
  idPrefix,
}: {
  label: string;
  cells: { tp: number; fp: number; fn: number; tn: number };
  idPrefix: string;
}) {
  return (
    <tr className="border-t border-white/10">
      <td className="py-2 pr-2 text-left font-medium text-slate-200">{label}</td>
      {(["tp", "fp", "fn", "tn"] as const).map((k) => (
        <td key={k} data-testid={`cm-${idPrefix}-${k}`} className="px-2 py-2 text-right tabular-nums text-slate-100">
          {cells[k]}
        </td>
      ))}
    </tr>
  );
}

export default function PayoffPanel() {
  return (
    <aside data-testid="payoff-panel" className="glass-panel payoff-panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Validation evidence</p>
          <h2 className="panel-title">Performance with restraint</h2>
        </div>
        <span className="data-chip">REPLAY</span>
      </div>

      <p className="panel-lede">
        Gas-only 16-channel MOX baseline vs compound fusion.
      </p>
      <div className="payoff-hero" aria-label="Replay result summary">
        <div>
          <span className="metric-value">50 / 50</span>
          <p>hazardous episodes caught by both systems</p>
        </div>
        <div>
          <span className="metric-value">140 / 150 → 0 / 150</span>
          <p>false positives at fixed full recall</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Fixed 100% recall operating point · highest retained-score thresholds base {EVAL.thresholds.base} / comp {EVAL.thresholds.comp}
        {" "}· {EVAL.episodes} replay episodes, seed 42
      </p>

      <h3 className="section-label mt-5">Confusion matrix</h3>
      <table className="mb-5 w-full text-xs text-slate-300">
        <thead>
          <tr className="text-right text-slate-500">
            <th className="py-2 text-left font-normal">system</th>
            <th className="px-2 font-normal">TP</th>
            <th className="px-2 font-normal">FP</th>
            <th className="px-2 font-normal">FN</th>
            <th className="px-2 font-normal">TN</th>
          </tr>
        </thead>
        <tbody>
          <MatrixRow label="gas-only 16-channel MOX" cells={EVAL.matrix.baseline} idPrefix="baseline" />
          <MatrixRow label="compound fusion" cells={EVAL.matrix.compound} idPrefix="compound" />
        </tbody>
      </table>

      <h3 className="section-label">Escalation timing · STEL 400</h3>
      <div data-testid="leadtime-strip" className="timing-grid">
        <div className="timing-card timing-card-watch">
          <span>WATCH · advisory</span>
          <strong>{EVAL.timing.watch.median}</strong>
          <p>crossing · p10 {EVAL.timing.watch.p10} / p90 {EVAL.timing.watch.p90}</p>
        </div>
        <div className="timing-card timing-card-alarm">
          <span>ALARM · gas-confirmed</span>
          <strong>{EVAL.timing.alarm.median}</strong>
          <p>crossing · p10 {EVAL.timing.alarm.p10} / p90 {EVAL.timing.alarm.p90}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        The gas gate does not confirm an alarm before gas rises; WATCH is the earlier advisory.
      </p>

      <div className="metric-strip mt-5">
        <div>
          <span>Scoring p50</span>
          <strong>{EVAL.latencyMs.p50} ms</strong>
        </div>
        <div>
          <span>Scoring p95</span>
          <strong>{EVAL.latencyMs.p95} ms</strong>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Tick → risk-score latency only; it is not an end-to-end dashboard measure.
      </p>

      <h3 className="section-label mt-5">
        Design-partner pilot measure{" "}
        <span className="ml-1 rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-normal tracking-normal text-sky-200">
          proposed, not measured
        </span>
      </h3>
      <p data-testid="pilot-outcome" className="text-sm font-semibold leading-6 text-slate-100">
        Fewer unnecessary evacuation escalations while preserving hazardous-condition recall.
      </p>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">
        Economics require a plant-specific, source-backed baseline. This prototype does not claim an avoided-liability range.
      </p>
    </aside>
  );
}
