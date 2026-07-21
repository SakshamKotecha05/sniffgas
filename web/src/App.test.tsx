// plan.md Task 11 check: mock WS message flips zone Z1 to red (vitest + jsdom, one test)
import { render, screen, act, fireEvent } from "@testing-library/react";
import App from "./App";

class FakeWS {
  static last: FakeWS | null = null;
  static instances: FakeWS[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeWS.last = this;
    FakeWS.instances.push(this);
  }
  close() {}
  open() { this.onopen?.(); }
  disconnect() { this.onclose?.(); }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWS.last = null;
  FakeWS.instances = [];
  vi.useRealTimers();
});

test("renders an Aegis command shell before the live feed arrives", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);

  expect(screen.getByRole("heading", { name: /aegis command/i })).toBeTruthy();
  expect(screen.getByLabelText(/plant command surface/i)).toBeTruthy();
  expect(screen.getByTestId("command-state").textContent).toMatch(/awaiting live feed/i);
});

test("reconnects a dropped live feed and names the intermediate state", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);

  act(() => {
    FakeWS.last!.disconnect();
  });
  expect(screen.getByText(/reconnecting live feed/i)).toBeTruthy();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(750);
  });
  expect(FakeWS.instances).toHaveLength(2);

  act(() => {
    FakeWS.last!.open();
  });
  expect(screen.getByText(/connected · awaiting score/i)).toBeTruthy();
});

test("mock WS risk score flips zone Z1 to red", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);
  expect(screen.getByTestId("zone-Z1").dataset.level).toBe("unknown");
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-19T00:00:00Z", zone: "Z1", anomaly: 0.55, compound: 0.91,
        level: "red", contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );
  expect(screen.getByTestId("zone-Z1").dataset.level).toBe("red");
});

test("does not present a zone as safe before its live feed arrives", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);

  expect(screen.getByTestId("zone-Z1").dataset.level).toBe("unknown");
  expect(screen.getByTestId("zone-Z1").getAttribute("aria-label")).toMatch(/awaiting/i);
});

test("clicking a zone opens drill-down with contributors", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);
  expect(screen.getByTestId("drilldown").textContent).toMatch(/Select a zone/);
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-19T00:00:00Z", zone: "Z1", anomaly: 0.55, compound: 0.91,
        level: "red",
        contributors: [
          { feature: "co_ppm", value: 412.0, weight: 0.7 },
          { feature: "temp_c", value: 88.2, weight: 0.2 },
        ],
        subgraph: { nodes: [], edges: [] },
      }),
    }),
  );
  act(() => {
    fireEvent.click(screen.getByTestId("zone-Z1"));
  });
  expect(screen.getByTestId("drilldown-level").textContent).toMatch(/ALARM/i);
  expect(screen.getByTestId("drilldown-compound").textContent).toBe("0.91");
  expect(screen.getByTestId("contrib-co_ppm")).toBeTruthy();
  expect(screen.getByTestId("contrib-temp_c")).toBeTruthy();
});

test("CO dial alarms when a live zone reports ppm at/above STEL 400", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);
  expect(screen.getByTestId("co-dial").dataset.state).toBe("normal");
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-19T00:00:00Z", zone: "Z1", anomaly: 0.55, compound: 0.91,
        level: "red", ppm: 452, contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );
  const dial = screen.getByTestId("co-dial");
  expect(dial.dataset.state).toBe("alarm");
  expect(dial.textContent).toMatch(/452/);
});

test("focuses a WATCH advisory on its zone while CO remains below the STEL", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);

  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-21T08:14:00Z", zone: "Z1", anomaly: 0.42, compound: 0.58,
        level: "amber", state: "WATCH", ppm: 280,
        contributors: [{ feature: "hot_work_active", value: 1, weight: 0.31 }],
        subgraph: { nodes: [], edges: [] },
      }),
    }),
  );

  expect(screen.getByTestId("command-state").textContent).toMatch(/WATCH/i);
  expect(screen.getByTestId("co-dial").getAttribute("data-zone")).toBe("Z1");
  expect(screen.getByTestId("co-dial-value").textContent).toMatch(/280/);
  expect(screen.getByTestId("drilldown").textContent).toMatch(/active hot-work permit/i);
});

test("names WATCH as gas-elevated once the live CO setpoint crosses STEL", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);

  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-21T08:14:00Z", zone: "Z1", anomaly: 0.42, compound: 0.58,
        level: "amber", state: "WATCH", ppm: 520,
        contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );

  expect(screen.getByTestId("command-state").textContent).toMatch(/WATCH · GAS ELEVATED/i);
  expect(screen.getByTestId("drilldown-level").textContent).toMatch(/WATCH · GAS ELEVATED/i);
  expect(screen.getByTestId("co-dial-advisory").textContent).toMatch(/WATCH · GAS ELEVATED/i);
});

test("does not label an above-STEL green loop tail as normal", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);

  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:00Z", zone: "Z1", anomaly: 0.20, compound: 0.04,
        level: "green", state: "NORMAL", ppm: 466.67,
        contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );

  expect(screen.getByTestId("command-state").textContent).toMatch(/CO ELEVATED · NO ADVISORY/i);
  expect(screen.getByTestId("drilldown-level").textContent).toMatch(/CO ELEVATED · NO ADVISORY/i);
  expect(screen.getByTestId("co-dial-advisory").textContent).toMatch(/CO ELEVATED · NO ADVISORY/i);
});

test("evacuation alert shows its cited report; the local briefing can be dismissed", async () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      narrative: "Evacuate Z1 and isolate the hot-work area. [fa-41b]",
      structured: { clause_ids: ["fa-41b"], actions: ["Evacuate Z1"] },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(screen.queryByTestId("alert-banner")).toBeNull();
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-19T00:00:00Z", zone: "Z1", kind: "evacuation",
        compound: 0.91, report_id: "rpt-Z1-000000",
      }),
    }),
  );
  const banner = screen.getByTestId("alert-banner");
  expect(banner.textContent).toMatch(/EVACUATION/i);
  expect(banner.textContent).toMatch(/Z1/);
  expect(await screen.findByText(/Evacuate Z1 and isolate/i)).toBeTruthy();
  expect(screen.getByTestId("alert-ack").textContent).toMatch(/Dismiss briefing/i);
  expect(fetchMock).toHaveBeenCalledWith("/reports/rpt-Z1-000000");
  act(() => {
    fireEvent.click(screen.getByTestId("alert-ack"));
  });
  expect(screen.queryByTestId("alert-banner")).toBeNull();
});

test("marks an unacknowledged evacuation briefing as prior when live risk downgrades", async () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  render(<App />);

  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:00Z", zone: "Z1", anomaly: 0.55, compound: 0.91,
        level: "red", state: "ALARM", ppm: 452, contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:01Z", zone: "Z1", kind: "evacuation",
        compound: 0.91, report_id: "rpt-Z1-081401",
      }),
    }),
  );
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:10Z", zone: "Z1", anomaly: 0.20, compound: 0.04,
        level: "amber", state: "WATCH", ppm: 280, contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );

  await screen.findByText("Prior response brief");
  expect(screen.getByTestId("command-state").textContent).toMatch(/WATCH/i);
  expect(screen.getByLabelText("Prior evacuation briefing")).toBeTruthy();
  expect(screen.getByTestId("alert-banner").textContent).toMatch(/PRIOR ALARM/i);
});

test("marks an evacuation briefing as prior when its red level downgrades to WATCH", async () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  render(<App />);

  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:00Z", zone: "Z1", anomaly: 0.55, compound: 0.91,
        level: "red", state: "ALARM", ppm: 520, contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:01Z", zone: "Z1", kind: "evacuation",
        compound: 0.91, report_id: "rpt-Z1-081401",
      }),
    }),
  );
  act(() =>
    FakeWS.last!.onmessage!({
      data: JSON.stringify({
        ts: "2026-07-22T08:14:10Z", zone: "Z1", anomaly: 0.45, compound: 0.62,
        level: "amber", state: "ALARM", ppm: 520, contributors: [], subgraph: { nodes: [], edges: [] },
      }),
    }),
  );

  await screen.findByText("Prior response brief");
  expect(screen.getByTestId("command-state").textContent).toMatch(/WATCH · GAS CONFIRMED/i);
  expect(screen.getByTestId("drilldown-level").textContent).toMatch(/WATCH · GAS CONFIRMED/i);
  expect(screen.getByLabelText("Prior evacuation briefing")).toBeTruthy();
  expect(screen.getByTestId("alert-banner").textContent).toMatch(/PRIOR ALARM/i);
});
