// plan.md Task 11 check: mock WS message flips zone Z1 to red (vitest + jsdom, one test)
import { render, screen, act, fireEvent } from "@testing-library/react";
import App from "./App";

class FakeWS {
  static last: FakeWS | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeWS.last = this;
  }
  close() {}
}

test("mock WS risk score flips zone Z1 to red", () => {
  vi.stubGlobal("WebSocket", FakeWS as unknown as typeof WebSocket);
  render(<App />);
  expect(screen.getByTestId("zone-Z1").dataset.level).toBe("green");
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
  expect(screen.getByTestId("drilldown-level").textContent).toBe("red");
  expect(screen.getByTestId("drilldown-compound").textContent).toBe("0.91");
  expect(screen.getByTestId("contrib-co_ppm")).toBeTruthy();
  expect(screen.getByTestId("contrib-temp_c")).toBeTruthy();
});
