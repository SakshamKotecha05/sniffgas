"""Replay a scenario DataFrame onto the sensor stream at N× speed."""
import time
from datetime import datetime, timezone

import pandas as pd
import redis

from core.contracts import STREAM_SENSOR, SensorTick, dumps


def replay_sync(df: pd.DataFrame, r: "redis.Redis", zone: str, speed: float = 1.0) -> None:
    """Publish one SensorTick per row of `df` to STREAM_SENSOR, in row order.

    - `t_s` column gives the timeline in seconds; wall-clock pacing is
      (delta t_s) / speed. speed=0 means no sleeping (tests, fast-forward).
    - `setpoint_gas1` is the ground-truth CO ppm shown on the dial.
    - Every other `s*` column is a raw MOX channel (anomaly input only).
    """
    base = datetime.now(timezone.utc)
    prev_t = None
    for row in df.itertuples(index=False):
        row_d = row._asdict()
        t_s = float(row_d["t_s"])
        if speed and prev_t is not None:
            time.sleep(max(0.0, (t_s - prev_t) / speed))
        prev_t = t_s
        tick = SensorTick(
            ts=base + pd.Timedelta(seconds=t_s),
            zone=zone,
            ppm=float(row_d["setpoint_gas1"]),
            channels={k: float(v) for k, v in row_d.items()
                      if k.startswith("s") and k not in ("setpoint_gas1",)},
        )
        r.xadd(STREAM_SENSOR, {"data": dumps(tick)})
