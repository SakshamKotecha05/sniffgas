"""Pre-registered eval labels (plan Task 6, §3, §5). Frozen Jul 9 — sha256 recorded in README/deck.

Consumed only by core/eval/run_eval.py and fusion-training corpus generation.
NEVER imported by any model module (anti-circularity guardrail, ADR 0001).
"""
import pandas as pd

from core.contracts import ContextEvent

ALARM_PPM = 400.0  # India Second Schedule STEL, no scaling — ADR 0001

# Context kinds that represent a hazardous condition *turning on* (mirrors the
# "on" half of core/kg.py's PlantGraph state machine — permit_closed/maintenance_end
# are the "off" half and never themselves trigger a compound incident).
HAZARD_KINDS = {"permit_active", "maintenance_start", "shift_change", "worker_pos"}


def leak_onsets(df: pd.DataFrame) -> list[pd.Interval]:
    """Baseline(0) -> nonzero setpoint_gas1 intervals. Ground truth, never a model output."""
    nonzero = df.setpoint_gas1.ne(0)
    group = (nonzero != nonzero.shift(fill_value=False)).cumsum()
    return [
        pd.Interval(seg.t_s.iloc[0], seg.t_s.iloc[-1], closed="both")
        for _, seg in df.groupby(group)
        if seg.setpoint_gas1.iloc[0] != 0
    ]


def alarm_crossings(df: pd.DataFrame, ppm: float = ALARM_PPM) -> list[float]:
    """t_s of each rising crossing of setpoint_gas1 through `ppm` (pure ground truth, ADR 0001)."""
    above = df.setpoint_gas1.ge(ppm)
    crossed = above & ~above.shift(fill_value=False)
    return df.loc[crossed, "t_s"].tolist()


def compound_incident(onset: pd.Interval, events: list[ContextEvent], window_s: int = 600) -> bool:
    """True iff a hazardous context event lands within `window_s` of the gas `onset` (§5).

    `onset` bounds are t_s (seconds into the trace); `events[i].ts` is compared via
    its POSIX timestamp, so offline label/eval code must construct ContextEvents with
    ts = epoch + timedelta(seconds=at_s) — a t_s-anchored epoch, distinct from the
    wall-clock `base=now()` convention sim/replay.py uses for live stream pacing.
    """
    lo, hi = onset.left - window_s, onset.right + window_s
    return any(ev.kind in HAZARD_KINDS and lo <= ev.ts.timestamp() <= hi for ev in events)
