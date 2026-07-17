---
status: accepted
---

# Offline label/eval code anchors ContextEvent.ts to a t_s epoch, not wall-clock

Any offline code that builds `ContextEvent`s for labeling or eval (Task 6+,
`core/eval/*`, fusion-corpus generation) MUST construct timestamps as
`ts = EPOCH + timedelta(seconds=at_s)`, where `EPOCH` is a fixed anchor and
`at_s` is the event's position in trace seconds. The live-stream convention in
`sim/replay.py` — `base = now()` wall-clock pacing — is for demo playback only
and is **forbidden** in label/eval code.

## Context

`compound_incident(onset, events, window_s=600)` compares gas-trace seconds
(`onset.left/right`, i.e. `t_s`) against `ev.ts.timestamp()`. That comparison is
only meaningful when both sides share the same origin. `sim/replay.py`
deliberately uses `now()` so the demo streams in real time; if Task 8 (or any
later task) reuses that convention when generating events for eval, every
`ev.ts.timestamp()` lands ~1.7e9 seconds away from any onset window and
`compound_incident` silently returns False for all events — labels become
garbage with no error raised.

## Considered options

- **Docstring note only** — rejected: easy to miss; the failure is silent.
- **Change `compound_incident` to accept raw `at_s` floats** — rejected:
  `ContextEvent.ts` is a frozen contract (`core/contracts.py`) consumed by the
  live path too; forking the type or the signature for offline use adds a second
  event shape days before the deadline.
- **ADR pinning the epoch convention** (chosen) — plan.md makes ADRs the source
  of truth; Task 8's author reads this before wiring events into eval.

## Consequences

- Offline event builders share one helper-style rule: fixed `EPOCH` +
  `timedelta(seconds=at_s)`. The exact epoch value is irrelevant (windows are
  relative) but must be identical for the gas side and the event side of a run.
- `sim/replay.py` stays untouched; live pacing and offline eval never share a
  time origin, and never need to.
- Cross-checking a live-captured event log against frozen labels requires
  re-anchoring the log to `t_s` first — acceptable; eval runs offline anyway.
