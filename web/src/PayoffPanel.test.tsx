import { render, screen } from "@testing-library/react";
import PayoffPanel from "./PayoffPanel";

test("renders evaluation evidence and an evidence-bound pilot outcome", () => {
  render(<PayoffPanel />);

  // Exact safety control: both systems retain every incident; no approximate
  // precision matching is represented as a fairness guarantee.
  expect(screen.getByTestId("payoff-panel")).toBeTruthy();
  expect(screen.getByText(/fixed 100% recall operating point/i)).toBeTruthy();
  expect(screen.getByText(/gas-only 16-channel MOX baseline/i)).toBeTruthy();
  expect(screen.getByText(/200 replay episodes/i)).toBeTruthy();
  expect(screen.getByTestId("cm-compound-tp").textContent).toBe("50");
  expect(screen.getByTestId("cm-compound-fp").textContent).toBe("0");
  expect(screen.getByTestId("cm-compound-tn").textContent).toBe("150");
  expect(screen.getByTestId("cm-baseline-fp").textContent).toBe("140");
  expect(screen.getByTestId("cm-baseline-fn").textContent).toBe("0");

  // two-tier timing strip: WATCH precedes the crossing, ALARM follows it
  const timing = screen.getByTestId("leadtime-strip").textContent ?? "";
  expect(timing).toMatch(/14s before/i);
  expect(timing).toMatch(/26s after/i);

  expect(screen.getByText(/design-partner pilot measure/i)).toBeTruthy();
  const pilotOutcome = screen.getByTestId("pilot-outcome").textContent ?? "";
  expect(pilotOutcome).toMatch(/fewer unnecessary evacuation escalations/i);
  expect(pilotOutcome).toMatch(/preserving hazardous-condition recall/i);
  expect(screen.queryByText(/₹2 lakh/)).toBeNull();
  expect(screen.queryByText(/NGT interim deposit/i)).toBeNull();
});
