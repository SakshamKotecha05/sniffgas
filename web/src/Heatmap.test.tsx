import { fireEvent, render, screen } from "@testing-library/react";
import Heatmap from "./Heatmap";

test("selects a plant zone with Enter as well as pointer input", () => {
  const onSelect = vi.fn();
  render(<Heatmap levels={{ Z1: "amber" }} onSelect={onSelect} />);

  const zone = screen.getByRole("button", { name: /inspect z1/i });
  fireEvent.keyDown(zone, { key: "Enter" });

  expect(onSelect).toHaveBeenCalledWith("Z1");
});

test("renders named state labels and a legend instead of relying on color alone", () => {
  render(<Heatmap levels={{ Z1: "amber" }} />);

  expect(screen.getByTestId("zone-status-Z1").textContent).toMatch(/WATCH/i);
  expect(screen.getByTestId("zone-status-Z2").textContent).toMatch(/AWAITING/i);
  expect(screen.getByTestId("plant-legend").textContent).toMatch(/ALARM/i);
});
