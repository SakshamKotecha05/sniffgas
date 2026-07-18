import { useEffect, useState } from "react";
import Heatmap from "./Heatmap";
import { connectLive, type Level } from "./ws";

export default function App() {
  const [levels, setLevels] = useState<Record<string, Level>>({});

  useEffect(() => {
    const ws = connectLive((m) => {
      if ("level" in m) setLevels((prev) => ({ ...prev, [m.zone]: m.level }));
    });
    return () => ws.close();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">
        Compound Risk — Live Plant View
      </h1>
      <Heatmap levels={levels} />
    </main>
  );
}
