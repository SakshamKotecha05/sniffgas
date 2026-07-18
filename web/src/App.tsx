import { useEffect, useState } from "react";
import Heatmap from "./Heatmap";
import DrillDown from "./DrillDown";
import { connectLive, type Level, type RiskScore } from "./ws";

export default function App() {
  const [scores, setScores] = useState<Record<string, RiskScore>>({});
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const ws = connectLive((m) => {
      if ("level" in m) setScores((prev) => ({ ...prev, [m.zone]: m }));
    });
    return () => ws.close();
  }, []);

  const levels: Record<string, Level> = Object.fromEntries(
    Object.entries(scores).map(([zone, s]) => [zone, s.level]),
  );

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">
        Compound Risk — Live Plant View
      </h1>
      <div className="flex flex-wrap items-start gap-6">
        <Heatmap levels={levels} selected={selected} onSelect={setSelected} />
        <DrillDown zone={selected} score={selected ? (scores[selected] ?? null) : null} />
      </div>
    </main>
  );
}
