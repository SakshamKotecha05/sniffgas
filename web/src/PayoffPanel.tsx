// plan.md D11: renders frozen eval_report.md numbers — confusion matrix at matched
// precision, lead-time strip (honest empty state), ROI ₹ range (Q15: range, not a
// false-precision single number; anchored to Factories Act §92/§96A penalty text +
// public Vizag gas-incident figures; labeled "illustrative estimate, sourced").
//
// Numbers below are copied verbatim from eval_report.md (frozen D11). If eval is
// re-run, update EVAL here and in the README tables together.

const EVAL = {
  matchedPrecision: 0.25,
  thresholds: { base: 0.328, comp: 0.004 },
  matrix: {
    baseline: { tp: 20, fp: 60, fn: 0, tn: 0 }, // single-sensor (tuned)
    compound: { tp: 20, fp: 60, fn: 0, tn: 0 }, // fusion ON
  },
  leadTime: null as null | number[], // eval_report.md: "no crossing runs detected"
  latencyMs: { p50: 5.1, p95: 5.6 },
};

// ROI anchors (sourced):
// - Factories Act 1948 §92: fine up to ₹1 lakh (+₹1,000/day continuing).
// - Factories Act 1948 §96A: up to 7 yrs imprisonment + fine up to ₹2 lakh
//   (+₹5,000/day continuing) for Ch IV-A hazardous-process contraventions.
// - Public benchmark: LG Polymers Vizag gas leak (May 2020) — ₹50 crore interim
//   deposit ordered by NGT (O.A. 73/2020).
const ROI_RANGE = "₹2 lakh – ₹50 crore";

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
    <tr className="border-t border-slate-100">
      <td className="py-1 pr-2 text-left font-medium text-slate-600">{label}</td>
      {(["tp", "fp", "fn", "tn"] as const).map((k) => (
        <td key={k} data-testid={`cm-${idPrefix}-${k}`} className="px-2 py-1 text-right tabular-nums">
          {cells[k]}
        </td>
      ))}
    </tr>
  );
}

export default function PayoffPanel() {
  return (
    <aside data-testid="payoff-panel" className="w-full max-w-sm rounded-lg bg-white p-4 shadow">
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Payoff</h2>
      <p className="mb-3 text-xs text-slate-500">
        Compound vs tuned single-sensor at matched precision 0.25 (thresholds base{" "}
        {EVAL.thresholds.base} / comp {EVAL.thresholds.comp}) · 80 replay episodes, seed 42
      </p>

      <h3 className="text-sm font-medium text-slate-700">Confusion matrix</h3>
      <table className="mb-3 w-full text-xs text-slate-700">
        <thead>
          <tr className="text-right text-slate-400">
            <th className="py-1 text-left font-normal">system</th>
            <th className="px-2 font-normal">TP</th>
            <th className="px-2 font-normal">FP</th>
            <th className="px-2 font-normal">FN</th>
            <th className="px-2 font-normal">TN</th>
          </tr>
        </thead>
        <tbody>
          <MatrixRow label="single-sensor (tuned)" cells={EVAL.matrix.baseline} idPrefix="baseline" />
          <MatrixRow label="compound (fusion ON)" cells={EVAL.matrix.compound} idPrefix="compound" />
        </tbody>
      </table>

      <h3 className="text-sm font-medium text-slate-700">Lead time before alarm-line crossing (STEL 400)</h3>
      <div data-testid="leadtime-strip" className="mb-3 rounded bg-slate-50 p-2 text-xs text-slate-500">
        {EVAL.leadTime ? (
          EVAL.leadTime.join(", ")
        ) : (
          <>no crossing runs detected in the replay set — measured only on crossing runs</>
        )}
      </div>

      <h3 className="text-sm font-medium text-slate-700">Scoring latency</h3>
      <p className="mb-3 text-xs text-slate-500">
        tick → risk score: p50 {EVAL.latencyMs.p50} ms / p95 {EVAL.latencyMs.p95} ms
      </p>

      <h3 className="text-sm font-medium text-slate-700">
        Avoided liability per prevented incident{" "}
        <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-normal text-amber-800">
          illustrative estimate, sourced
        </span>
      </h3>
      <p data-testid="roi-range" className="text-xl font-semibold tabular-nums text-slate-800">
        {ROI_RANGE}
      </p>
      <ul className="mt-1 list-disc pl-4 text-[11px] leading-4 text-slate-500">
        <li>Factories Act §92: fine to ₹1 lakh, +₹1,000/day continuing</li>
        <li>Factories Act §96A: up to 7 yrs + ₹2 lakh, +₹5,000/day (Ch IV-A)</li>
        <li>NGT interim deposit, Vizag gas leak (May 2020): ₹50 crore</li>
      </ul>
    </aside>
  );
}
