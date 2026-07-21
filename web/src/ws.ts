// Typed WS client — types mirror core/contracts.py by hand (plan.md §2).
export type Level = "green" | "amber" | "red";

// ISA-18.2-style two-tier alarm state (core/fusion.py predict_state):
// WATCH = hazardous context assembled, gas not yet confirming; ALARM = gas-confirmed.
export type RiskState = "NORMAL" | "WATCH" | "ALARM";

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
  state?: RiskState; // optional: tolerate pre-two-tier payloads (defaults NORMAL)
  ppm?: number; // ADR 0003: zone CO setpoint at score time, drives CoDial; optional like state
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

export type LiveConnectionState = "connecting" | "connected" | "reconnecting";

export type LiveConnection = {
  close: () => void;
};

const RECONNECT_DELAY_MS = 750;
const MAX_RECONNECT_DELAY_MS = 8_000;

export function connectLive(
  onMsg: (m: LiveMsg) => void,
  onConnectionState?: (state: LiveConnectionState) => void,
): LiveConnection {
  let closed = false;
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;
  let reconnectAttempts = 0;

  const clearRetry = () => {
    if (retryTimer != null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const connect = () => {
    if (closed) return;
    onConnectionState?.(reconnectAttempts ? "reconnecting" : "connecting");

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/live`);
    socket = ws;
    ws.onopen = () => {
      reconnectAttempts = 0;
      onConnectionState?.("connected");
    };
    ws.onmessage = (event) => onMsg(JSON.parse(event.data));
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (closed || retryTimer != null) return;
      onConnectionState?.("reconnecting");
      const delay = Math.min(RECONNECT_DELAY_MS * (2 ** reconnectAttempts), MAX_RECONNECT_DELAY_MS);
      reconnectAttempts += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };
  };

  connect();
  return {
    close: () => {
      closed = true;
      clearRetry();
      socket?.close();
    },
  };
}
