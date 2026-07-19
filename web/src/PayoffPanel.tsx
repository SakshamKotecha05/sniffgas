// plan.md D11: renders frozen eval_report.md numbers — confusion matrix at matched
// precision, lead-time strip (honest empty state), ROI ₹ range (Q15: range, not a
// false-precision single number; anchored to Factories Act §92/§96A penalty text +
// public Vizag gas-incident figures; labeled "illustrative estimate, sourced").
//
// Numbers below are copied verbatim from eval_report.md (frozen D11). If eval is
// re-run, update EVAL here and in the README tables together.

const EVAL = {
  episodes: 200,
  matchedPrecision: 0.26,
  thresholds: { base: 0.255, comp: 0.05 },
  matrix: {
    baseline: { tp: 50, fp: 140, fn: 0, tn: 10 }, // single-sensor (tuned)
    compound: { tp: 50, fp: 100, fn: 0, tn: 50 }, // fusion ON
  },
  // two-tier escalation, ISA-18.2 (ADR 0001): WATCH is advisory and precedes the
  // STEL-400 crossing; ALARM is gas-evidence-gated and typically follows it.
  timing: {
    watch: { median: "14s before", p10: "-10s", p90: "71s", runs: "50/50" },
    alarm: { median: "26s after", p10: "-71s", p90: "32s", runs: "50/50" },
  },
  latencyMs: { p50: 4.8, p95: 5.1 },
};

// ROI anchors — every ₹ figure carries the corpus clause id it came from, so the
// panel resolves through the same span-ID check as the incident report (§8).
// Corpus: agent/corpus/clauses.json.
const ROI_SOURCES = [
  { cite: "fa-92", text: "Factories Act §92: fine to ₹1 lakh, +₹1,000/day continuing" },
  { cite: "fa-96a", text: "Factories Act §96A (41B/41C/41H): up to 7 yrs + ₹2 lakh, +₹5,000/day" },
];
// Public benchmark, not a statute: LG Polymers Vizag gas leak (May 2020) — ₹50
// crore interim deposit ordered by NGT (O.A. 73/2020).
const ROI_BENCHMARK = "NGT interim deposit, Vizag gas leak (May 2020): ₹50 crore";
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
        Compound vs tuned single-sensor at matched precision {EVAL.matchedPrecision} (thresholds base{" "}
        {EVAL.thresholds.base} / comp {EVAL.thresholds.comp}) · {EVAL.episodes} replay episodes, seed 42
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

      <h3 className="text-sm font-medium text-slate-700">
        Two-tier escalation vs alarm-line crossing (STEL 400)
      </h3>
      <div data-testid="leadtime-strip" className="mb-3 rounded bg-slate-50 p-2 text-xs text-slate-500">
        <p>
          <span className="font-medium text-amber-700">WATCH</span> (advisory): median{" "}
          {EVAL.timing.watch.median} the crossing (p10 {EVAL.timing.watch.p10} / p90{" "}
          {EVAL.timing.watch.p90}, {EVAL.timing.watch.runs} crossing runs)
        </p>
        <p className="mt-1">
          <span className="font-medium text-red-700">ALARM</span> (gas-evidence gated): median{" "}
          {EVAL.timing.alarm.median} the crossing (p10 {EVAL.timing.alarm.p10} / p90{" "}
          {EVAL.timing.alarm.p90}, {EVAL.timing.alarm.runs} crossing runs)
        </p>
        <p className="mt-1 text-slate-400">
          The gas gate forbids a confirmed alarm before gas actually rises — that is what keeps
          false-alarm precision intact on the confounder scenarios.
        </p>
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
        {ROI_SOURCES.map((s) => (
          <li key={s.cite}>
            {s.text}{" "}
            <span className="font-mono text-slate-400">[{s.cite}]</span>
          </li>
        ))}
        <li>{ROI_BENCHMARK}</li>
      </ul>
    </aside>
  );
}
