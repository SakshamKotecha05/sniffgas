// plan.md Task 11 check: mock WS message flips zone Z1 to red (vitest + jsdom, one test)
import { render, screen, act } from "@testing-library/react";
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
