// Typed WS client — types mirror core/contracts.py by hand (plan.md §2).
export type Level = "green" | "amber" | "red";

export interface Contributor {
  feature: string;
  value: number;
  weight: number;
}

// Mirrors core/kg.py PlantGraph.subgraph(): 2-hop neighborhood, floor-plan px coords.
export interface SubgraphNode {
  id: string;
  type?: string; // zone | sensor | ignition | worker_group | permit
  label?: string;
  x?: number;
  y?: number;
}

export interface SubgraphEdge {
  source: string;
  target: string;
}

export interface RiskScore {
  ts: string;
  zone: string;
  anomaly: number;
  compound: number;
  level: Level;
  contributors: Contributor[];
  subgraph: { nodes?: SubgraphNode[]; edges?: SubgraphEdge[] };
}

export interface Alert {
  ts: string;
  zone: string;
  kind: "evacuation";
  compound: number;
  report_id: string;
}

export type LiveMsg = RiskScore | Alert;

export function connectLive(onMsg: (m: LiveMsg) => void): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/live`);
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  // ponytail: no reconnect/backoff — demo box; add a retry loop if the demo WS ever drops
  return ws;
}
