import { useEffect, useState } from "react";
import Heatmap from "./Heatmap";
import CoDial from "./CoDial";
import DrillDown from "./DrillDown";
import AlertFlow from "./AlertFlow";
import PayoffPanel from "./PayoffPanel";
import { operationalStatus, resolvedRiskState } from "./riskDisplay";
import { connectLive, type Alert, type Level, type LiveConnectionState, type RiskScore } from "./ws";

const stateRank = { NORMAL: 0, WATCH: 1, ALARM: 2 } as const;
const levelRank = { green: 0, amber: 1, red: 2 } as const;

function commandStatus(score: RiskScore | null) {
  return operationalStatus(score ?? {});
}

function activeScore(scores: Record<string, RiskScore>) {
  return Object.values(scores).reduce<RiskScore | null>((current, score) => {
    if (!current) return score;
    const currentRank = stateRank[resolvedRiskState(current) ?? "NORMAL"] * 10 + levelRank[current.level];
    const scoreRank = stateRank[resolvedRiskState(score) ?? "NORMAL"] * 10 + levelRank[score.level];
    return scoreRank > currentRank || (scoreRank === currentRank && score.compound > current.compound)
      ? score
      : current;
  }, null);
}

export default function App() {
  const [scores, setScores] = useState<Record<string, RiskScore>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>("connecting");

  useEffect(() => {
    const ws = connectLive((m) => {
      if ("level" in m) setScores((prev) => ({ ...prev, [m.zone]: m }));
      else setAlert(m); // ponytail: latest alert wins; add a queue if multi-zone alerts overlap
    }, setConnectionState);
    return () => ws.close();
  }, []);

  const levels: Record<string, Level> = Object.fromEntries(
    Object.entries(scores).map(([zone, s]) => [zone, s.level]),
  );

  // The hero must tell one coherent incident story: explicit selection wins; otherwise
  // follow the most urgent live zone so the dial, state, and drill-down cannot disagree.
  const active = activeScore(scores);
  const focusedZone = selected ?? active?.zone ?? null;
  const focusedScore = focusedZone ? (scores[focusedZone] ?? null) : null;
  const status = commandStatus(focusedScore);
  const receivedAnyScore = Object.keys(scores).length > 0;
  const feedTone = connectionState === "reconnecting" ? "reconnecting" : receivedAnyScore ? "live" : "waiting";
  const feedLabel = connectionState === "reconnecting"
    ? "RECONNECTING LIVE FEED"
    : receivedAnyScore
      ? "LIVE DATA RECEIVED"
      : connectionState === "connected"
        ? "CONNECTED · AWAITING SCORE"
        : "AWAITING LIVE FEED";
  // Evacuation is triggered by a red level crossing. If a newer score is no longer
  // red, retain the briefing but label it as prior rather than imply an active evacuation.
  const alertScore = alert ? scores[alert.zone] : null;
  const alertIsCurrentEvacuation = !alertScore || alertScore.level === "red";

  return (
    <main className="dashboard-shell">
      <a className="skip-link" href="#command-main">Skip to plant command surface</a>

      <header className="command-header">
        <div className="brand-lockup">
          <svg viewBox="0 0 40 40" aria-hidden="true" className="brand-mark">
            <path d="M20 3 34 8v10c0 9.1-5.7 15.3-14 19-8.3-3.7-14-9.9-14-19V8L20 3Z" fill="currentColor" opacity=".22" />
            <path d="M20 5.7 31.6 9.8v8.2c0 7.3-4.3 12.6-11.6 16-7.3-3.4-11.6-8.7-11.6-16V9.8L20 5.7Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m13.4 20.3 4.2 4.2 9-9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
          </svg>
          <div>
            <p className="brand-kicker">Industrial safety intelligence</p>
            <p className="brand-name">AEGIS / PS1</p>
          </div>
        </div>
        <div className="command-header-status">
          <span role="status" aria-live="polite" className={`feed-pill feed-pill-${feedTone}`}>
            <span aria-hidden="true" className="feed-dot" />
            {feedLabel}
          </span>
          <span className="header-context">Compound fusion · operational view</span>
        </div>
      </header>

      <section className="command-intro" aria-labelledby="command-title">
        <div>
          <p className="eyebrow">Real-time compound-risk command</p>
          <h1 id="command-title">Aegis Command</h1>
          <p>
            A single truthful view of gas evidence, work context, and the controls that should move next.
          </p>
        </div>
        <div className={`command-state-card command-state-${status.tone}`}>
          <span className="state-card-label">Operational level · zone {focusedZone ?? "—"}</span>
          <strong data-testid="command-state">{status.label}</strong>
          <p>{status.detail}</p>
        </div>
      </section>

      <AlertFlow alert={alert} isCurrentEvacuation={alertIsCurrentEvacuation} onAck={() => setAlert(null)} />

      <section id="command-main" className="command-grid" aria-label="Plant command surface">
        <section className="glass-panel map-command" aria-labelledby="plant-map-title">
          <div className="panel-topline">
            <div>
              <p className="eyebrow">Spatial risk view</p>
              <h2 id="plant-map-title" className="panel-title">Plant floor plan</h2>
            </div>
            <p className="panel-hint">Select a zone to inspect its evidence trail.</p>
          </div>
          <Heatmap levels={levels} selected={selected} onSelect={setSelected} />
        </section>

        <div className="analysis-rail">
          <CoDial
            ppm={focusedScore?.ppm ?? null}
            zone={focusedZone}
            level={focusedScore?.level ?? null}
            state={focusedScore?.state ?? null}
          />
          <DrillDown zone={focusedZone} score={focusedScore} />
        </div>
        <PayoffPanel />
      </section>
    </main>
  );
}
