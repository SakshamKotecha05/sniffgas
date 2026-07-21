import { operationalStatus } from "./riskDisplay";

test("keeps the operational level aligned with the map while naming gas evidence", () => {
  expect(operationalStatus({ level: "amber", state: "ALARM", ppm: 520 })).toMatchObject({
    label: "WATCH · GAS CONFIRMED",
    tone: "watch",
  });
  expect(operationalStatus({ level: "amber", state: "WATCH", ppm: 520 })).toMatchObject({
    label: "WATCH · GAS ELEVATED",
    tone: "watch",
  });
  expect(operationalStatus({ level: "red", state: "ALARM", ppm: 520 })).toMatchObject({
    label: "ALARM · GAS CONFIRMED",
    tone: "alarm",
  });
});

test("does not label an above-STEL physical reading as normal when fusion has no advisory", () => {
  expect(operationalStatus({ level: "green", state: "NORMAL", ppm: 466.67 })).toMatchObject({
    label: "CO ELEVATED · NO ADVISORY",
    tone: "watch",
  });
});
