// CO concentration gauge — the hero visual (ADR 0003): reads RiskScore.ppm so the
// needle and the plant Heatmap turn red from the same message. The whole story is
// one number vs one line: CO setpoint vs STEL 400 (ADR 0001, India Factories Act).
import { operationalStatus, resolvedRiskState } from "./riskDisplay";
import type { Level, RiskState } from "./ws";

const P_MIN = 200; // native green window floor (plan.md §5: setpoints span 200→533)
const P_MAX = 520;
const P_STEL = 400; // the regulatory line; ppm >= 400 is the alarm crossing (ADR 0001)
const R = 90;
const CX = 110;
const CY = 100;
const GREEN = "#4ade80";
const RED = "#fb7185";

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

export default function CoDial({
  ppm,
  zone,
  level = null,
  state = null,
}: {
  ppm: number | null;
  zone: string | null;
  level?: Level | null;
  state?: RiskState | null;
}) {
  const alarm = ppm != null && ppm >= P_STEL;
  const dialState = alarm ? "alarm" : "normal";
  const color = alarm ? RED : GREEN;
  const displayLevel = level ?? (alarm ? "red" : null);
  const riskState = resolvedRiskState({ level: displayLevel, state });
  const status = operationalStatus({ level: displayLevel, state, ppm });
  const gasConfirmedAlarm = displayLevel === "red" && riskState === "ALARM";
  const readingLabel = ppm == null
    ? "awaiting CO feed"
    : gasConfirmedAlarm
      ? "ALARM · GAS CONFIRMED"
      : alarm
        ? "CO THRESHOLD CROSSED · STEL 400"
        : "below STEL 400";
  const label =
    ppm == null
      ? "CO concentration: awaiting feed"
      : `CO concentration ${Math.round(ppm)} ppm, ${gasConfirmedAlarm ? "gas-confirmed alarm at or above" : alarm ? "at or above" : "below"} the STEL 400 line`;

  const [tickInner, tickOuter] = [at(P_STEL, R - 11), at(P_STEL, R + 5)];
  const stelLabel = at(P_STEL, R + 20);

  return (
    <div
      data-testid="co-dial"
      data-state={dialState}
      data-risk-state={riskState ?? "AWAITING"}
      data-zone={zone ?? undefined}
      className={`glass-panel co-dial co-dial-${dialState}`}
    >
      <div className="panel-topline">
        <div>
          <p className="eyebrow">Gas evidence</p>
          <h2 className="panel-title">CO setpoint</h2>
        </div>
        <span className="zone-chip">{zone ?? "—"}</span>
      </div>

      <svg viewBox="0 -14 220 122" role="img" aria-label={label} className="dial-visual">
        <defs>
          <radialGradient id="dial-halo" cx="50%" cy="78%" r="65%">
            <stop offset="0" stopColor={alarm ? "#fb7185" : "#4ade80"} stopOpacity=".18" />
            <stop offset="1" stopColor="#0b1220" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={CX} cy={CY} rx="105" ry="92" fill="url(#dial-halo)" />
        <path d={arc(P_MIN, P_STEL)} fill="none" stroke={GREEN} strokeOpacity={0.25} strokeWidth={12} strokeLinecap="round" />
        <path d={arc(P_STEL, P_MAX)} fill="none" stroke={RED} strokeOpacity={0.25} strokeWidth={12} strokeLinecap="round" />
        <path d={arc(P_MIN, ppm ?? P_MIN)} fill="none" stroke={color} strokeOpacity={0.9} strokeWidth={3} strokeLinecap="round" />

        <line x1={tickInner[0]} y1={tickInner[1]} x2={tickOuter[0]} y2={tickOuter[1]} stroke="#f8fafc" strokeWidth={2} />
        <text x={stelLabel[0]} y={stelLabel[1]} textAnchor="middle" fontSize={10} fontWeight={700} fill="#e2e8f0">
          STEL 400
        </text>

        {ppm != null && (
          <g className={alarm ? "animate-pulse motion-reduce:animate-none" : undefined}>
            <line x1={CX} y1={CY} x2={at(ppm)[0]} y2={at(ppm)[1]} stroke="#f8fafc" strokeWidth={2} strokeLinecap="round" />
            <line x1={CX} y1={CY} x2={at(ppm, R - 6)[0]} y2={at(ppm, R - 6)[1]} stroke={color} strokeWidth={4} strokeLinecap="round" />
            <circle cx={CX} cy={CY} r={6} fill="#0f172a" stroke={color} strokeWidth={3} />
          </g>
        )}
      </svg>

      <div className="-mt-2 text-center">
        <div
          data-testid="co-dial-value"
          className={`dial-reading ${
            alarm ? "animate-pulse text-rose-300 motion-reduce:animate-none" : "text-slate-50"
          }`}
        >
          {ppm == null ? "—" : Math.round(ppm)}
          <span className="ml-1 text-base font-normal tracking-normal text-slate-400">ppm</span>
        </div>
        <p className={`mt-1 text-xs font-semibold ${alarm ? "text-rose-200" : "text-slate-300"}`}>
          {readingLabel}
        </p>
      </div>

      <div className="dial-footer">
        <span data-testid="co-dial-advisory" className={`risk-chip risk-chip-${status.tone}`}>
          {status.label}
        </span>
        <span className="dial-context">{zone ? `Focused zone ${zone}` : "Select a zone"}</span>
      </div>
    </div>
  );
}
