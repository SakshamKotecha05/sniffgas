// CO concentration gauge — the hero visual (ADR 0003): reads RiskScore.ppm so the
// needle and the plant Heatmap turn red from the same message. The whole story is
// one number vs one line: CO setpoint vs STEL 400 (ADR 0001, India Factories Act).
const P_MIN = 200; // native green window floor (plan.md §5: setpoints span 200→533)
const P_MAX = 520;
const P_STEL = 400; // the regulatory line; ppm >= 400 is the alarm crossing (ADR 0001)
const R = 90;
const CX = 110;
const CY = 100;
const GREEN = "#22c55e";
const RED = "#ef4444";

// π at P_MIN (left) → 0 at P_MAX (right): a top semicircle, needle sweeps left→right.
const clamp = (p: number) => Math.max(P_MIN, Math.min(P_MAX, p));
const ang = (p: number) => Math.PI * (1 - (clamp(p) - P_MIN) / (P_MAX - P_MIN));
const at = (p: number, radius = R): [number, number] => [
  CX + radius * Math.cos(ang(p)),
  CY - radius * Math.sin(ang(p)),
];
const arc = (a: number, b: number) => {
  const [x1, y1] = at(a);
  const [x2, y2] = at(b);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

export default function CoDial({ ppm, zone }: { ppm: number | null; zone: string | null }) {
  const alarm = ppm != null && ppm >= P_STEL;
  const state = alarm ? "alarm" : "normal";
  const color = alarm ? RED : GREEN;
  const label =
    ppm == null
      ? "CO concentration: awaiting feed"
      : `CO concentration ${Math.round(ppm)} ppm, ${alarm ? "ALARM — at or above" : "below"} the STEL 400 line`;

  const [tickInner, tickOuter] = [at(P_STEL, R - 11), at(P_STEL, R + 5)];
  const stelLabel = at(P_STEL, R + 20);

  return (
    <div
      data-testid="co-dial"
      data-state={state}
      className="w-full max-w-sm rounded-lg bg-white p-4 shadow"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          CO — worst zone
        </h2>
        {zone && <span className="font-mono text-xs text-slate-400">{zone}</span>}
      </div>

      <svg viewBox="0 -14 220 122" role="img" aria-label={label} className="w-full">
        {/* safe / danger bands — the danger third is always visible, even at rest */}
        <path d={arc(P_MIN, P_STEL)} fill="none" stroke={GREEN} strokeOpacity={0.3} strokeWidth={12} strokeLinecap="round" />
        <path d={arc(P_STEL, P_MAX)} fill="none" stroke={RED} strokeOpacity={0.3} strokeWidth={12} strokeLinecap="round" />

        {/* the STEL 400 line, named — meaning never rides on color alone */}
        <line x1={tickInner[0]} y1={tickInner[1]} x2={tickOuter[0]} y2={tickOuter[1]} stroke="#334155" strokeWidth={2} />
        <text x={stelLabel[0]} y={stelLabel[1]} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
          STEL 400
        </text>

        {ppm != null && (
          <g className={alarm ? "animate-pulse motion-reduce:animate-none" : undefined}>
            <line x1={CX} y1={CY} x2={at(ppm)[0]} y2={at(ppm)[1]} stroke={color} strokeWidth={3} strokeLinecap="round" />
            <circle cx={CX} cy={CY} r={5} fill={color} />
          </g>
        )}
      </svg>

      <div className="-mt-1 text-center">
        <div
          data-testid="co-dial-value"
          className={`font-mono text-4xl font-semibold tabular-nums ${
            alarm ? "animate-pulse text-red-600 motion-reduce:animate-none" : "text-slate-800"
          }`}
        >
          {ppm == null ? "—" : Math.round(ppm)}
          <span className="ml-1 text-base font-normal text-slate-400">ppm</span>
        </div>
        <p className={`mt-0.5 text-xs font-medium ${alarm ? "text-red-600" : "text-slate-500"}`}>
          {ppm == null ? "awaiting CO feed" : alarm ? "ALARM · CO ≥ STEL 400" : "below STEL 400"}
        </p>
      </div>
    </div>
  );
}
