import { render, screen } from "@testing-library/react";
import CoDial from "./CoDial";

test("shows the CO ppm reading and reads safe below the STEL 400 line", () => {
  render(<CoDial ppm={312} zone="Z1" />);
  const dial = screen.getByTestId("co-dial");
  expect(dial.dataset.state).toBe("normal");
  expect(dial.textContent).toMatch(/312/);
  expect(dial.textContent).toMatch(/ppm/i);
});

test("alarms at or above STEL 400 with a named label, not color alone", () => {
  render(<CoDial ppm={452} zone="Z1" />);
  const dial = screen.getByTestId("co-dial");
  expect(dial.dataset.state).toBe("alarm");
  expect(dial.textContent).toMatch(/452/);
  expect(dial.textContent).toMatch(/STEL 400/i); // threshold named in text, per color-not-only
});

test("boundary: exactly 400 is already the crossing (>= STEL, ADR 0001)", () => {
  render(<CoDial ppm={400} zone="Z1" />);
  expect(screen.getByTestId("co-dial").dataset.state).toBe("alarm");
});

test("no CO yet: placeholder, no false alarm", () => {
  render(<CoDial ppm={null} zone={null} />);
  const dial = screen.getByTestId("co-dial");
  expect(dial.dataset.state).toBe("normal");
  expect(dial.textContent).toMatch(/—|awaiting/i);
});
