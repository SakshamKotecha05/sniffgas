// plan.md D11 check: panel renders frozen eval_report.md numbers + sourced ROI range, honestly labeled
import { render, screen } from "@testing-library/react";
import PayoffPanel from "./PayoffPanel";

test("renders confusion matrix, lead-time state, and sourced ROI range", () => {
  render(<PayoffPanel />);

  // confusion matrix at matched precision 0.26 (guardrail 3), 200 episodes
  expect(screen.getByTestId("payoff-panel")).toBeTruthy();
  expect(screen.getByText(/matched precision 0\.26/i)).toBeTruthy();
  expect(screen.getByText(/200 replay episodes/i)).toBeTruthy();
  expect(screen.getByTestId("cm-compound-tp").textContent).toBe("50");
  expect(screen.getByTestId("cm-compound-fp").textContent).toBe("100");
  expect(screen.getByTestId("cm-compound-tn").textContent).toBe("50");
  expect(screen.getByTestId("cm-baseline-fp").textContent).toBe("140");
  expect(screen.getByTestId("cm-baseline-fn").textContent).toBe("0");

  // two-tier timing strip: WATCH precedes the crossing, ALARM follows it
  const timing = screen.getByTestId("leadtime-strip").textContent ?? "";
  expect(timing).toMatch(/14s before/i);
  expect(timing).toMatch(/26s after/i);

  // ROI: a ₹ range (not a single number), labeled and anchored to cited clause ids
  expect(screen.getByText(/illustrative estimate, sourced/i)).toBeTruthy();
  const roi = screen.getByTestId("roi-range").textContent ?? "";
  expect(roi).toMatch(/₹.*–.*₹/); // range, not false precision
  expect(screen.getByText(/\[fa-92\]/)).toBeTruthy();
  expect(screen.getByText(/\[fa-96a\]/)).toBeTruthy();
});
