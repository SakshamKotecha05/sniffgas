import { render, screen } from "@testing-library/react";
import DrillDown from "./DrillDown";

test("translates signed contributors into a readable risk explanation", () => {
  render(
    <DrillDown
      zone="Z1"
      score={{
        ts: "2026-07-21T08:14:00Z",
        zone: "Z1",
        anomaly: 0.42,
        compound: 0.58,
        level: "amber",
        state: "WATCH",
        contributors: [
          { feature: "hot_work_active", value: 1, weight: 0.31 },
          { feature: "maintenance_in_zone", value: 0, weight: -0.12 },
        ],
        subgraph: { nodes: [], edges: [] },
      }}
    />,
  );

  expect(screen.getByTestId("drilldown-level").textContent).toMatch(/WATCH/i);
  expect(screen.getByTestId("contrib-hot_work_active").textContent).toMatch(/Active hot-work permit/i);
  expect(screen.getByTestId("contrib-direction-hot_work_active").textContent).toMatch(/increases risk/i);
  expect(screen.getByTestId("contrib-direction-maintenance_in_zone").textContent).toMatch(/reduces risk/i);
  expect(screen.getByTestId("why-risk").textContent).toMatch(/hot-work permit/i);
});

test("names a WATCH score as gas-elevated once CO has crossed the STEL", () => {
  render(
    <DrillDown
      zone="Z1"
      score={{
        ts: "2026-07-21T08:14:00Z",
        zone: "Z1",
        anomaly: 0.42,
        compound: 0.58,
        level: "amber",
        state: "WATCH",
        ppm: 520,
        contributors: [],
        subgraph: { nodes: [], edges: [] },
      }}
    />,
  );

  expect(screen.getByTestId("drilldown-level").textContent).toMatch(/WATCH · GAS ELEVATED/i);
});
