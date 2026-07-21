import { act, render, screen } from "@testing-library/react";
import AlertFlow from "./AlertFlow";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("loads the incident report inside the command surface", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      narrative: "Evacuate Z1 and isolate the hot-work area. [fa-41b]",
      structured: {
        zone: "Z1",
        permit_ids: ["PTW-17"],
        clause_ids: ["fa-41b"],
        actions: ["Evacuate Z1"],
        timeline: ["08:14 — alarm confirmed"],
      },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <AlertFlow
      alert={{
        ts: "2026-07-21T08:14:00Z",
        zone: "Z1",
        kind: "evacuation",
        compound: 0.91,
        report_id: "rpt-Z1-081400",
      }}
      onAck={vi.fn()}
    />,
  );

  const report = await screen.findByTestId("incident-report");
  expect(screen.getByLabelText("Active evacuation response briefing")).toBeTruthy();
  expect(report.textContent).toMatch(/Evacuate Z1/i);
  expect(report.textContent).toMatch(/fa-41b/i);
  expect(fetchMock).toHaveBeenCalledWith("/reports/rpt-Z1-081400");
  expect(screen.getByTestId("report-status").textContent).toMatch(/cited report/i);
});

test("stops refreshing once the local cited rehearsal report is available", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      narrative: "Evacuate Z1. [fa-41b]",
      structured: { clause_ids: ["fa-41b"] },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <AlertFlow
      alert={{
        ts: "2026-07-21T08:14:00Z",
        zone: "Z1",
        kind: "evacuation",
        compound: 0.91,
        report_id: "rpt-Z1-081400",
      }}
      onAck={vi.fn()}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(31_500);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("keeps polling through the live report timeout budget, then stops", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ narrative: "Prepared report" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <AlertFlow
      alert={{
        ts: "2026-07-21T08:14:00Z",
        zone: "Z1",
        kind: "evacuation",
        compound: 0.91,
        report_id: "rpt-Z1-081400",
      }}
      onAck={vi.fn()}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_499);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(31_500);
  });
  expect(fetchMock).toHaveBeenCalledTimes(22);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(22);
});

test("keeps a failed report fetch framed as a response briefing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

  render(
    <AlertFlow
      alert={{
        ts: "2026-07-21T08:14:00Z",
        zone: "Z1",
        kind: "evacuation",
        compound: 0.91,
        report_id: "rpt-Z1-081400",
      }}
      onAck={vi.fn()}
    />,
  );

  expect(await screen.findByText(/response briefing remains active/i)).toBeTruthy();
  expect(screen.queryByText(/evacuation alert remains active/i)).toBeNull();
});
