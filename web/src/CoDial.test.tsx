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

test("names a WATCH advisory even while CO remains below the STEL", () => {
  render(<CoDial ppm={280} zone="Z1" level="amber" state="WATCH" />);

  const dial = screen.getByTestId("co-dial");
  expect(dial.dataset.state).toBe("normal");
  expect(dial.dataset.riskState).toBe("WATCH");
  expect(screen.getByTestId("co-dial-advisory").textContent).toMatch(/WATCH/i);
});

test("keeps a WATCH fusion state distinct from a physical STEL crossing", () => {
  render(<CoDial ppm={520} zone="Z1" level="amber" state="WATCH" />);

  const dial = screen.getByTestId("co-dial");
  expect(dial.dataset.state).toBe("alarm");
  expect(dial.dataset.riskState).toBe("WATCH");
  expect(screen.getByTestId("co-dial-advisory").textContent).toMatch(/WATCH · GAS ELEVATED/i);
  expect(dial.textContent).toMatch(/CO THRESHOLD CROSSED · STEL 400/i);
  expect(dial.textContent).not.toMatch(/ALARM · CO ≥ STEL 400/i);
});
