import { useEffect, useState } from "react";
import Heatmap from "./Heatmap";
import CoDial from "./CoDial";
import DrillDown from "./DrillDown";
import AlertFlow from "./AlertFlow";
import PayoffPanel from "./PayoffPanel";
import { connectLive, type Alert, type Level, type RiskScore } from "./ws";

export default function App() {
  const [scores, setScores] = useState<Record<string, RiskScore>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const ws = connectLive((m) => {
      if ("level" in m) setScores((prev) => ({ ...prev, [m.zone]: m }));
      else setAlert(m); // ponytail: latest alert wins; add a queue if multi-zone alerts overlap
    });
    return () => ws.close();
  }, []);

  const levels: Record<string, Level> = Object.fromEntries(
    Object.entries(scores).map(([zone, s]) => [zone, s.level]),
  );

  // Hero dial tracks the plant's worst live CO reading (ADR 0003) — same message as level.
  const worst = Object.values(scores).reduce<RiskScore | null>(
    (w, s) => (s.ppm != null && (w == null || s.ppm > (w.ppm ?? -Infinity)) ? s : w),
    null,
  );

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">
        Compound Risk — Live Plant View
      </h1>
      <AlertFlow alert={alert} onAck={() => setAlert(null)} />
      <div className="flex flex-wrap items-start gap-6">
        <CoDial ppm={worst?.ppm ?? null} zone={worst?.zone ?? null} />
        <Heatmap levels={levels} selected={selected} onSelect={setSelected} />
        <DrillDown zone={selected} score={selected ? (scores[selected] ?? null) : null} />
        <PayoffPanel />
      </div>
    </main>
  );
}
