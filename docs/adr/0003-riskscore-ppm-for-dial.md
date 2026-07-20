---
status: accepted
---

# RiskScore carries the CO setpoint `ppm` so the live dial reads it in lockstep with `level`

`RiskScore` gains an additive, defaulted field `ppm: float | None = None` — the
same zone's CO **setpoint** (the `SensorTick` ground-truth ppm, ADR 0002) at
score time. The dashboard's CO dial reads `RiskScore.ppm`, so the needle and the
STEL-400 crossing render from the **same message** that sets `level`, with zero
possibility of drift. Decided 2026-07-21, after the freeze, as a deliberate
additive amendment (§4 allows additive/defaulted changes that break no consumer;
precedent: the `state` field on the same model).

## Context

The demo's hero beat is CO crossing the STEL 400 line (ADR 0001), shown on a
setpoint gauge (ADR 0002). But the UI only ever receives `RiskScore` on `/live`;
`SensorTick.ppm` is never sent, and no gauge component was ever built. To put the
number on a dial there were two shapes:

## Considered options

- **Publish `SensorTick` on a second stream and join client-side** — rejected:
  two streams for one zone means the needle and `level` can render a tick apart
  (the only real "skew" in the system would be one we introduced). More wire,
  more client state, for no gain.
- **Carry `ppm` on `RiskScore`** — chosen: one message, one source of truth,
  needle and level provably in sync. Cost: an additive field on a frozen
  contract. Mitigated — defaulted `None`, breaks no existing consumer (mirrors
  the `state` amendment), and `ws.ts` already treats new fields as optional.

## Consequences

- `core/contracts.py` `RiskScore` += `ppm: float | None = None`; `ws.ts` mirrors
  it as `ppm?: number`.
- The fusion producer (`api/feed.py`) populates `ppm` from the tick it scored;
  any consumer that ignores it is unaffected.
- Enables `CoDial.tsx` (needle 200→520, red at ≥400) — the visible realization
  of ADR 0001 + 0002. This is **feature enablement, not a bug fix**: there was no
  gauge skew, because there was neither a gauge nor a second stream.
