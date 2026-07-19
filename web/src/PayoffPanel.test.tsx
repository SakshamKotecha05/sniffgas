// plan.md D11 check: panel renders frozen eval_report.md numbers + sourced ROI range, honestly labeled
import { render, screen } from "@testing-library/react";
import PayoffPanel from "./PayoffPanel";

test("renders confusion matrix, lead-time state, and sourced ROI range", () => {
  render(<PayoffPanel />);

  // confusion matrix at matched precision 0.25 (guardrail 3)
  expect(screen.getByTestId("payoff-panel")).toBeTruthy();
  expect(screen.getByText(/matched precision 0\.25/i)).toBeTruthy();
  expect(screen.getByTestId("cm-compound-tp").textContent).toBe("20");
  expect(screen.getByTestId("cm-compound-fp").textContent).toBe("60");
  expect(screen.getByTestId("cm-baseline-fn").textContent).toBe("0");

  // lead-time strip renders the honest empty state from eval_report.md
  expect(screen.getByText(/no crossing runs detected/i)).toBeTruthy();

  // ROI: a ₹ range (not a single number), labeled and anchored to §92/§96A
  expect(screen.getByText(/illustrative estimate, sourced/i)).toBeTruthy();
  const roi = screen.getByTestId("roi-range").textContent ?? "";
  expect(roi).toMatch(/₹.*–.*₹/); // range, not false precision
  expect(screen.getByText(/§92/)).toBeTruthy();
  expect(screen.getByText(/§96A/)).toBeTruthy();
});
